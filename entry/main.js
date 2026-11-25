'use strict';

/**
 * Serpent plugin: WD14 Tagger (unrestricted, library-scoped)
 *
 * - Loads WD14 ONNX models (onnxruntime-web WASM backend) fully offline.
 * - Preprocessing uses white padding, NHWC BGR float32 values in [0,255].
 * - English tags or offline Chinese translations are written as Serpent tags.
 * - The bundled Chinese dictionary can be replaced through a translator hook.
 */

const path = require('node:path');
const fs = require('node:fs');
const chineseTranslator = require('./translator-zh');

const SUPPORTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png']);

// ---------------------------------------------------------------------------
// Translation backend
// ---------------------------------------------------------------------------

// Optional replacement: { translate(tags: string[]): Promise<string[]> }.
// A null backend restores the built-in offline Chinese dictionary.
let translatorBackend = null;

async function translateTags(tags, outputLanguage = 'english') {
  if (outputLanguage !== 'chinese' || tags.length === 0) return tags;
  const backend = translatorBackend || chineseTranslator;
  const translated = await backend.translate(tags);
  if (!Array.isArray(translated) || translated.length !== tags.length ||
      Array.from(translated).some((tag) => typeof tag !== 'string' || !tag.trim() || tag.trim().length > 255)) {
    throw new Error('WD14: translator must return one nonempty tag (at most 255 characters) per input tag.');
  }
  return translated.map((tag) => tag.trim());
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

async function loadSettings(serpent) {
  const get = async (key, fallback) => {
    for (const scope of ['library', 'user']) {
      const value = await serpent.storage.get(key, { scope });
      if (value !== null && value !== undefined) return value;
    }
    return fallback;
  };
  // Library-scoped instances read the same mirror as the library settings UI;
  // user-level defaults remain a fallback when the library has no override.
  const modelDir = String(await get('settings.model-dir', '')).trim();
  const model = String(await get('settings.model', 'wd-vit-tagger-v3'));
  const generalThreshold = Number(await get('settings.general-threshold', 0.35));
  const characterThreshold = Number(await get('settings.character-threshold', 0.85));
  const maxTags = Math.max(1, Number(await get('settings.max-tags', 40)) || 40);
  const outputLanguage = String(await get('settings.output-language', 'english'));
  return { modelDir, model, generalThreshold, characterThreshold, maxTags, outputLanguage };
}

function resolveModelPaths(settings) {
  const base = settings.modelDir;
  if (!base) throw new Error('WD14: model directory is not configured (plugin settings).');
  const onnx = path.join(base, `${settings.model}.onnx`);
  const csv = path.join(base, `${settings.model}.csv`);
  if (!fs.existsSync(onnx)) throw new Error(`WD14: model not found: ${onnx}`);
  if (!fs.existsSync(csv)) throw new Error(`WD14: tags csv not found: ${csv}`);
  return { onnx, csv };
}

// ---------------------------------------------------------------------------
// CSV / selected tags
// ---------------------------------------------------------------------------

const CATEGORY_GENERAL = 0;
const CATEGORY_CHARACTER = 4;
const CATEGORY_RATING = 9;

function parseCsvLine(line) {
  const columns = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      columns.push(value);
      value = '';
    } else value += char;
  }
  if (quoted) throw new Error('WD14: invalid quoted CSV row.');
  columns.push(value);
  return columns;
}

function loadSelectedTags(csvPath) {
  const text = fs.readFileSync(csvPath, 'utf8');
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const entries = lines.slice(1).map((line) => {
    const columns = parseCsvLine(line);
    const category = Number(columns[2]);
    if (columns.length < 3 || !columns[1] || !Number.isFinite(category)) {
      throw new Error('WD14: invalid tags CSV row.');
    }
    return { name: columns[1].trim(), category };
  });
  if (entries.length === 0) throw new Error('WD14: tags CSV is empty.');
  return entries;
}

// ---------------------------------------------------------------------------
// Image decoding + WD14 preprocessing
// ---------------------------------------------------------------------------

let ortPromise = null;
function getOrt() {
  if (!ortPromise) {
    ortPromise = require('onnxruntime-web');
    // Keep inference on this Node utility process; no browser workers or CDN.
    ortPromise.env.wasm.numThreads = 1;
    ortPromise.env.wasm.proxy = false;
  }
  return ortPromise;
}

function imageExtensionFromContent(buffer, mimeType = '') {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'jpg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[String(mimeType).toLowerCase().split(';')[0]] || '';
}

function decodeImage(buffer, ext) {
  if (ext === 'png') {
    const { PNG } = require('pngjs');
    return PNG.sync.read(buffer);
  }
  if (ext === 'jpg' || ext === 'jpeg') {
    const jpeg = require('jpeg-js');
    return jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 1024 });
  }
  throw new Error(`WD14: cannot decode ${ext || 'this image format'}; use a JPEG or PNG image.`);
}

function padToSquare(rgba, srcW, srcH, padValue) {
  const size = Math.max(srcW, srcH);
  const out = new Uint8ClampedArray(size * size * 4);
  // fill with pad color
  for (let i = 0; i < out.length; i += 4) {
    out[i] = padValue; out[i + 1] = padValue; out[i + 2] = padValue; out[i + 3] = 255;
  }
  const dx = Math.floor((size - srcW) / 2);
  const dy = Math.floor((size - srcH) / 2);
  for (let y = 0; y < srcH; y++) {
    const srcRow = y * srcW * 4;
    const dstRow = ((y + dy) * size + dx) * 4;
    for (let x = 0; x < srcW; x++) {
      const srcIndex = srcRow + x * 4;
      const dstIndex = dstRow + x * 4;
      const alpha = rgba[srcIndex + 3] / 255;
      for (let c = 0; c < 3; c++) out[dstIndex + c] = rgba[srcIndex + c] * alpha + padValue * (1 - alpha);
      out[dstIndex + 3] = 255;
    }
  }
  return { data: out, size };
}

function bilinearResize(src, srcW, srcH, dstW, dstH) {
  const dst = new Uint8ClampedArray(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(srcH - 1, Math.max(0, (y + 0.5) * yRatio - 0.5));
    const y0 = Math.floor(sy); const y1 = Math.min(srcH - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(srcW - 1, Math.max(0, (x + 0.5) * xRatio - 0.5));
      const x0 = Math.floor(sx); const x1 = Math.min(srcW - 1, x0 + 1);
      const fx = sx - x0;
      const dstIdx = (y * dstW + x) * 4;
      for (let c = 0; c < 4; c++) {
        const p00 = src[(y0 * srcW + x0) * 4 + c];
        const p01 = src[(y0 * srcW + x1) * 4 + c];
        const p10 = src[(y1 * srcW + x0) * 4 + c];
        const p11 = src[(y1 * srcW + x1) * 4 + c];
        dst[dstIdx + c] = p00 * (1 - fx) * (1 - fy) + p01 * fx * (1 - fy) + p10 * (1 - fx) * fy + p11 * fx * fy;
      }
    }
  }
  return dst;
}

function preprocessToTensor(rgba, srcW, srcH, inputSize) {
  const { data: square, size } = padToSquare(rgba, srcW, srcH, 255);
  const resized = bilinearResize(square, size, size, inputSize, inputSize);
  // WD14 models normalize internally: interleaved NHWC BGR, float32 [0,255].
  const pixels = inputSize * inputSize;
  const bgr = new Float32Array(pixels * 3);
  for (let i = 0; i < pixels; i++) {
    bgr[i * 3] = resized[i * 4 + 2];
    bgr[i * 3 + 1] = resized[i * 4 + 1];
    bgr[i * 3 + 2] = resized[i * 4];
  }
  return [bgr, inputSize, inputSize, 3];
}

// ---------------------------------------------------------------------------
// ONNX session cache
// ---------------------------------------------------------------------------

const defaultState = { sessionCache: null }; // Used only by direct test/translator hooks.

async function getSession(settings, state = defaultState) {
  const { onnx, csv } = resolveModelPaths(settings);
  const key = onnx;
  if (state.sessionCache && state.sessionCache.key === key) return state.sessionCache;

  if (state.sessionCache) {
    await state.sessionCache.session.release();
    state.sessionCache = null;
  }
  const ort = getOrt();
  const session = await ort.InferenceSession.create(fs.readFileSync(onnx), {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
  try {
    const inputName = session.inputNames[0];
    const metadata = Array.isArray(session.inputMetadata)
      ? session.inputMetadata[0] : session.inputMetadata && session.inputMetadata[inputName];
    const dims = metadata && (metadata.shape || metadata.dimensions);
    let inputSize = 448;
    if (dims) {
      if (dims.length !== 4 || dims[3] !== 3 || !Number.isInteger(dims[1]) || dims[1] < 1 || dims[1] !== dims[2]) {
        throw new Error(`WD14: expected a square NHWC model input, received ${JSON.stringify(dims)}.`);
      }
      inputSize = dims[1];
    }
    const tags = loadSelectedTags(csv);
    // The setup signal may have aborted while WASM was loading the model.
    throwIfAborted(state.signal);
    state.sessionCache = { key, session, inputName, inputSize, tags };
    return state.sessionCache;
  } catch (error) {
    await session.release();
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Inference
// ---------------------------------------------------------------------------

async function inferTags(buffer, ext, settings, state = defaultState, signal = state.signal) {
  throwIfAborted(signal);
  const { session, inputName, inputSize, tags } = await getSession(settings, state);
  throwIfAborted(signal);
  const img = decodeImage(buffer, ext === 'jpeg' ? 'jpg' : ext);
  const tensorData = preprocessToTensor(img.data, img.width, img.height, inputSize);
  const ort = getOrt();
  const input = new ort.Tensor('float32', tensorData[0], [1, tensorData[1], tensorData[2], tensorData[3]]);
  const feeds = {};
  feeds[inputName] = input;
  const results = await session.run(feeds);
  throwIfAborted(signal);
  const output = results[session.outputNames[0]];
  const probs = output.data;
  if (probs.length !== tags.length) {
    throw new Error(`WD14: model output (${probs.length}) does not match tags CSV (${tags.length}).`);
  }

  const general = [];
  const character = [];
  const rating = [];
  for (let i = 0; i < tags.length && i < probs.length; i++) {
    const { name, category } = tags[i];
    const p = probs[i];
    if (category === CATEGORY_GENERAL) {
      if (p >= settings.generalThreshold) general.push({ name, p });
    } else if (category === CATEGORY_CHARACTER) {
      if (p >= settings.characterThreshold) character.push({ name, p });
    } else if (category === CATEGORY_RATING) {
      rating.push({ name, p });
    }
  }
  general.sort((a, b) => b.p - a.p);
  character.sort((a, b) => b.p - a.p);

  const picked = [
    ...character.map((tag) => tag.name),
    ...general.map((tag) => tag.name),
  ].slice(0, settings.maxTags);
  const translated = await translateTags(picked, settings.outputLanguage);
  return { tags: [...new Set(translated)], rating };
}

// ---------------------------------------------------------------------------
// Tag write-back
// ---------------------------------------------------------------------------

async function ensureTags(library, names, signal) {
  const existing = new Map();
  let offset = 0;
  for (;;) {
    throwIfAborted(signal);
    const page = await library.tags.list({ limit: 200, offset });
    throwIfAborted(signal);
    for (const t of page.items) existing.set(t.name, t.id);
    if (!page.hasMore || page.items.length === 0) break;
    offset += page.items.length;
  }
  const idByName = existing;
  const result = [];
  for (const name of names) {
    throwIfAborted(signal);
    if (idByName.has(name)) { result.push(idByName.get(name)); continue; }
    const created = await library.tags.create(name);
    throwIfAborted(signal);
    idByName.set(name, created.id);
    result.push(created.id);
  }
  return result;
}

function assetImageExtension(asset) {
  const explicit = String(asset.extension || asset.fileExtension || '').toLowerCase().replace(/^\./, '');
  if (SUPPORTED_EXTENSIONS.has(explicit)) return explicit;
  for (const value of [asset.relativeFilePath, asset.name]) {
    const match = String(value || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    if (match && SUPPORTED_EXTENSIONS.has(match[1])) return match[1];
  }
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png' })[asset.mimeType] || '';
}

function isSupportedAsset(asset) {
  return Boolean(assetImageExtension(asset));
}

function throwIfAborted(signal) {
  if (signal && signal.aborted) {
    const error = new Error('WD14: tagging cancelled.');
    error.name = 'AbortError';
    throw error;
  }
}

async function notify(serpent, severity, message) {
  try { await serpent.ui.notify({ severity, message }); }
  catch { /* A failed notification must not hide the original job result. */ }
}

// ---------------------------------------------------------------------------
// Job handler
// ---------------------------------------------------------------------------

async function runTaggingJob(serpent, libraryId, assetIds, signal, jobId, settings, state = defaultState, onProgress = () => {}) {
  const library = serpent.forLibrary(libraryId);
  const total = assetIds.length;
  let completed = 0;
  let tagged = 0;
  let empty = 0;
  let skipped = 0;
  const failures = [];
  const counts = () => ({ completed, total, tagged, empty, skipped, failed: failures.length });
  const summary = () => `已完成 ${completed}/${total} 张，已打标 ${tagged} 张，失败 ${failures.length} 张，无标签 ${empty} 张，不支持 ${skipped} 张。`;
  const report = async (phase, message) => {
    await onProgress({ ...counts(), phase, message });
    throwIfAborted(signal);
    if (!jobId) return;
    await library.jobs.reportProgress({ jobId, completed, total, progress: total ? completed / total : 0, phase, message });
    throwIfAborted(signal);
  };
  const reportCurrent = (phase, action) => report(phase, `WD14：正在处理第 ${completed + 1}/${total} 张（${action}）；${summary()}`);

  try {
    throwIfAborted(signal);
    await report('loading-model', `WD14：正在加载本地模型；共 ${total} 张图片，已完成 0/${total} 张。首次加载可能需要一些时间。`);
    await getSession(settings, state);
    throwIfAborted(signal);

    for (const assetId of assetIds) {
      throwIfAborted(signal);
      await reportCurrent('reading-image', '读取图片');
      try {
        const content = await library.assets.readContent(assetId, { maxBytes: 64 * 1024 * 1024 });
        throwIfAborted(signal);
        if (content.truncated) throw new Error('asset too large for tagging (64 MiB limit)');
        const buffer = Buffer.from(content.dataBase64, 'base64');
        const ext = imageExtensionFromContent(buffer, content.mimeType);
        if (!SUPPORTED_EXTENSIONS.has(ext)) {
          skipped++;
        } else {
          await reportCurrent('inference', '识别标签');
          const { tags } = await inferTags(buffer, ext, settings, state, signal);
          throwIfAborted(signal);
          if (tags.length === 0) empty++;
          else {
            await reportCurrent('writing-tags', '写入标签');
            const tagIds = await ensureTags(library, tags, signal);
            throwIfAborted(signal);
            const assigned = await library.tags.assign([assetId], tagIds);
            if (assigned.skipped && assigned.skipped.length > 0) {
              throw new Error(`tag assignment skipped: ${assigned.skipped.map((item) => item.reason || item.assetId).join(', ')}`);
            }
            tagged++;
          }
        }
      } catch (error) {
        throwIfAborted(signal);
        failures.push({ assetId, error: String(error && error.message || error) });
      }
      completed++;
      await report('tagging', `WD14：${summary()}`);
    }
    if (failures.length > 0) {
      throw new Error(`WD14: ${failures.length}/${total} image(s) failed; tagged ${tagged}. ${failures[0].assetId}: ${failures[0].error}`);
    }
    await notify(serpent, tagged > 0 ? 'info' : 'warning', `WD14：打标完成。${summary()}`);
    return { completed, tagged, empty, skipped, failures };
  } catch (error) {
    if (signal && signal.aborted) {
      const message = `WD14：已停止。${summary()}已写入的标签会保留。`;
      // The host has already cancelled the job; keep its last authoritative
      // progress and update only our in-process status/notification.
      await onProgress({ ...counts(), phase: 'cancelled', message });
      await notify(serpent, 'info', message);
      throwIfAborted(signal);
    }
    await notify(serpent, 'error', String(error && error.message || error));
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Selection helpers
// ---------------------------------------------------------------------------

function selectionImageAssetIds(context) {
  const invocation = context.invocation || context;
  const selection = invocation.selection || {};
  const assets = Array.isArray(selection.assets) ? selection.assets : [];
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const rawIds = selection.assetIds || context.assetIds || assets.map((asset) => asset.id);
  return [...new Set(rawIds.filter((id) => id && (!byId.has(id) || isSupportedAsset(byId.get(id)))))];
}

async function listFolderImageAssets(serpent, libraryId, folderId) {
  const library = serpent.forLibrary(libraryId);
  const ids = [];
  let offset = 0;
  for (;;) {
    const page = await library.assets.list({ folderId, recursive: true, limit: 200, offset });
    for (const asset of page.items) {
      if (isSupportedAsset(asset)) ids.push(asset.id);
    }
    if (!page.hasMore || page.items.length === 0) break;
    offset += page.items.length;
  }
  return ids;
}

// ---------------------------------------------------------------------------
// setup / dispose
// ---------------------------------------------------------------------------

exports.setup = async function setup(context) {
  const { serpent, subscriptions, signal } = context;
  const state = { sessionCache: null, signal };

  const disposeSession = async () => {
    const cached = state.sessionCache;
    state.sessionCache = null;
    if (cached) await cached.session.release();
  };
  subscriptions.add(disposeSession);
  signal.addEventListener('abort', () => { void disposeSession().catch(() => {}); }, { once: true });

  const tasks = new Map();
  const isActive = (task) => ['queued', 'running', 'stopping'].includes(task.status);
  const trackTask = (jobId, libraryId, assetIds) => {
    if (!tasks.has(jobId)) {
      tasks.set(jobId, {
        jobId, libraryId, attemptCount: 0, status: 'queued', executing: false, cancelRequested: false,
        completed: 0, total: assetIds.length, tagged: 0, empty: 0, skipped: 0, failed: 0,
        phase: 'queued', message: `WD14：等待打标，共 ${assetIds.length} 张图片。`,
      });
    }
    return tasks.get(jobId);
  };
  const trimHistory = () => {
    const history = [...tasks.values()].filter((task) => !isActive(task) && !task.executing);
    for (const task of history.slice(0, -20)) tasks.delete(task.jobId);
  };
  const targetLibrary = (cmdContext) => {
    const invocation = cmdContext.invocation || cmdContext;
    const libraryId = invocation.libraryId || cmdContext.targetLibraryId;
    if (!libraryId) throw new Error('WD14: no target library is open.');
    return libraryId;
  };

  const enqueueTagging = async (libraryId, assetIds) => {
    if (!libraryId) throw new Error('WD14: no target library is open.');
    const settings = await loadSettings(serpent);
    resolveModelPaths(settings);
    const result = await serpent.forLibrary(libraryId).jobs.enqueue({
      handlerId: 'wd14-tag-job',
      payload: { libraryId, assetIds },
      recoveryStrategy: 'idempotent',
    });
    // A recovered/fast job may enter the handler before enqueue resolves.
    trackTask(result.jobId, libraryId, assetIds);
    trimHistory();
    await notify(serpent, 'info', `WD14：已加入 ${assetIds.length} 张图片。后台任务面板显示实时进度。`);
    return result;
  };
  const registerCommand = (id, handler) => serpent.commands.register(id, async (cmdContext) => {
    try { return await handler(cmdContext); }
    catch (error) {
      await notify(serpent, 'error', String(error && error.message || error));
      throw error;
    }
  });

  registerCommand('tag-selection', async (cmdContext) => {
    const invocation = cmdContext.invocation || cmdContext;
    const libraryId = invocation.libraryId || cmdContext.targetLibraryId;
    const assetIds = selectionImageAssetIds(cmdContext);
    if (assetIds.length === 0) {
      await notify(serpent, 'warning', 'WD14: no supported image assets selected.');
      return;
    }
    return enqueueTagging(libraryId, assetIds);
  });

  registerCommand('tag-folder', async (cmdContext) => {
    const invocation = cmdContext.invocation || cmdContext;
    const libraryId = invocation.libraryId || cmdContext.targetLibraryId;
    const folderIds = invocation.selection ? invocation.selection.folderIds : (cmdContext.folderIds || []);
    const folderId = folderIds && folderIds[0] || invocation.browse && invocation.browse.folderId;
    if (!folderId) {
      await notify(serpent, 'warning', 'WD14: no folder selected.');
      return;
    }
    const assetIds = await listFolderImageAssets(serpent, libraryId, folderId);
    if (assetIds.length === 0) {
      await notify(serpent, 'info', 'WD14: folder has no supported images.');
      return;
    }
    return enqueueTagging(libraryId, assetIds);
  });

  registerCommand('tagging-status', async (cmdContext) => {
    const libraryId = targetLibrary(cmdContext);
    const ownTasks = [...tasks.values()].filter((task) => task.libraryId === libraryId);
    const active = ownTasks.filter(isActive);
    const visible = active.length > 0 ? active : ownTasks.slice(-1);
    const labels = { queued: '排队中', running: '运行中', stopping: '正在停止', cancelled: '已停止', completed: '已完成', failed: '失败', finished: '已结束' };
    const message = visible.length > 0
      ? visible.slice(0, 3).map((task) => `${labels[task.status]}：${task.message}`).join('\n') + (active.length > 3 ? `\n另有 ${active.length - 3} 个任务排队中。` : '')
      : 'WD14：当前资源库没有打标任务。';
    await notify(serpent, 'info', message.slice(0, 500));
    return visible.map(({ executing, cancelRequested, ...task }) => task);
  });

  registerCommand('stop-tagging', async (cmdContext) => {
    const libraryId = targetLibrary(cmdContext);
    // Cancel waiting work first, before stopping the running handler can
    // release the shared model queue and start the next batch.
    const active = [...tasks.values()]
      .filter((task) => task.libraryId === libraryId && isActive(task))
      .sort((left, right) => Number(left.executing) - Number(right.executing));
    if (active.length === 0) {
      await notify(serpent, 'info', 'WD14：当前资源库没有正在运行或排队的打标任务。');
      return { cancelled: 0 };
    }
    let cancelled = 0;
    const errors = [];
    for (const task of active) {
      try {
        const result = await serpent.forLibrary(libraryId).jobs.cancel({ jobId: task.jobId, reason: 'user-requested' });
        if (result && result.jobId === task.jobId && result.status === 'cancelled') {
          task.cancelRequested = true;
          task.attemptCount = Math.max(task.attemptCount, Number(result.attemptCount) || 0);
          task.status = task.executing ? 'stopping' : 'cancelled';
          if (!task.executing && task.phase === 'queued') {
            task.phase = 'cancelled';
            task.message = `WD14：已停止排队，已完成 ${task.completed}/${task.total} 张。`;
          }
          cancelled++;
        } else if (task.status === 'queued') {
          // A terminal host job does not run its handler again.
          task.status = 'finished';
          task.message = 'WD14：任务已结束。';
        }
      } catch (error) {
        errors.push(String(error && error.message || error));
      }
    }
    trimHistory();
    if (errors.length > 0) throw new Error(`WD14：已停止 ${cancelled} 个任务，另有 ${errors.length} 个任务停止失败。${errors[0]}`);
    await notify(serpent, 'info', cancelled > 0
      ? `WD14：已请求停止 ${cancelled} 个打标任务，排队任务已取消。当前推理或写入结束后停止，已写入的标签会保留。`
      : 'WD14：任务已结束，无需停止。');
    return { cancelled };
  });

  // One model session per library; serialize jobs to avoid duplicate model
  // loads and competing WASM runs when the command is clicked more than once.
  let queue = Promise.resolve();
  serpent.jobs.registerHandler('wd14-tag-job', (payload, job, jobSignal) => {
    const { libraryId, assetIds } = payload;
    if (typeof libraryId !== 'string' || !libraryId || !Array.isArray(assetIds) || assetIds.length === 0) {
      throw new Error('WD14: invalid tagging job target.');
    }
    const jobId = job && job.jobId;
    const attemptCount = Number(job && job.attemptCount) || 0;
    const previous = tasks.get(jobId);
    // Host retries reuse the job id, but claim increments attemptCount. Keep
    // an old handler's cancellation intact while giving its retry fresh state.
    if (previous && attemptCount > previous.attemptCount) tasks.delete(jobId);
    const task = trackTask(jobId, libraryId, assetIds);
    task.attemptCount = Math.max(task.attemptCount, attemptCount);
    const taskSignal = { get aborted() { return Boolean(signal.aborted || jobSignal && jobSignal.aborted || task.cancelRequested); } };
    const execution = queue.then(async () => {
      let lastNotice = Date.now();
      try {
        throwIfAborted(taskSignal);
        task.executing = true;
        task.status = 'running';
        let settings;
        try { settings = await loadSettings(serpent); }
        catch (error) {
          if (!taskSignal.aborted) await notify(serpent, 'error', String(error && error.message || error));
          throw error;
        }
        const result = await runTaggingJob(serpent, libraryId, assetIds.map(String), taskSignal, job && job.jobId, settings, state, async (progress) => {
          Object.assign(task, progress);
          // Counts also remain available from the menu after a toast expires.
          if (progress.phase !== 'cancelled' && Date.now() - lastNotice >= 5000) {
            lastNotice = Date.now();
            await notify(serpent, 'info', progress.message);
          }
        });
        task.status = 'completed';
        return result;
      } catch (error) {
        task.status = taskSignal.aborted ? 'cancelled' : 'failed';
        if (!taskSignal.aborted) task.message = `WD14：${String(error && error.message || error)}`;
        throw error;
      } finally {
        task.executing = false;
        trimHistory();
      }
    });
    queue = execution.catch(() => {});
    return execution;
  });
};

exports.dispose = async function dispose(reason) {
  void reason;
  // Instance sessions are released by their own setup signal/subscription.
  const cached = defaultState.sessionCache;
  defaultState.sessionCache = null;
  if (cached) await cached.session.release();
};

// Exported for regression tests and optional translator backend wiring.
exports.__internals = {
  translateTags,
  setTranslatorBackend(backend) {
    if (backend != null && typeof backend.translate !== 'function') {
      throw new TypeError('WD14: translator backend must provide translate(tags).');
    }
    translatorBackend = backend || null;
  },
  inferTags,
  loadSelectedTags,
  loadSettings,
  selectionImageAssetIds,
  runTaggingJob,
  preprocessToTensor,
};
