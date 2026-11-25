'use strict';

// Run directly with Node; node:test supplies the runner and no model is loaded.
// Guest contracts were checked against Serpent-0.3.8:
//   src/plugins/plugin-sdk.ts
//   src/scripting/serpent-guest-api.ts
//   src/scripting/plugin-trusted-host.ts
//   src/automation/command-registry.ts
//   src/shared/protocol/responses.ts
// The VM owns its require function, so ORT stubbing never changes Module._load,
// require.cache, globals, or another test's session cache.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { deflateSync } = require('node:zlib');
require('./test-translations.cjs');

const ENTRY = path.resolve(__dirname, '../entry/main.js');
const LIBRARY_ID = 'wd14-test-library';
const JOB_ID = 'fca52f31-732c-4ff5-8029-74940af241a4';
const MODEL = 'wd14-test-model';
const MODEL_BYTES = Buffer.from('ORT mock: not a real ONNX model');
const CSV = [
  'tag_id,name,category,count',
  '0,safe,9,100',
  '1,existing_general,0,100',
  '2,new_general,0,100',
  '3,character_entry,4,100',
  '4,below_threshold,0,100',
].join('\n');
const EXPECTED_TAGS = ['character_entry', 'existing_general', 'new_general'];
const OPAQUE_RGBA = Uint8Array.from([
  255, 0, 0, 255,   0, 255, 0, 255,
  0, 0, 255, 255,   20, 40, 60, 255,
]);
const OPAQUE_BGR = [0, 0, 255, 0, 255, 0, 255, 0, 0, 60, 40, 20];
const ALPHA_RGBA = Uint8Array.from([
  255, 0, 0, 0,    0, 60, 180, 85,
  0, 255, 0, 255,  20, 40, 60, 255,
]);
// Alpha 85 is exactly one third; these values need no rounding convention.
const ALPHA_BGR = [255, 255, 255, 230, 190, 170, 0, 255, 0, 60, 40, 20];

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, bytes) {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, bytes])));
  return Buffer.concat([length, name, bytes, checksum]);
}

function rgbaPng(rgba, width = 2, height = 2) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // 8-bit RGBA, non-interlaced.
  const rows = [];
  for (let y = 0; y < height; y++) {
    rows.push(Buffer.from([0]), Buffer.from(rgba.slice(y * width * 4, (y + 1) * width * 4)));
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const PNG_BYTES = rgbaPng(OPAQUE_RGBA);
const ALPHA_PNG_BYTES = rgbaPng(ALPHA_RGBA);
// A real 2x2 color JPEG, embedded so the test uses only built-in test helpers.
// Decoding still goes through the plugin's installed jpeg-js dependency.
const JPEG_BYTES = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAf/AABEIAAIAAgMBEQACEQEDEQH/xAGiAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgsQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+gEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoLEQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/AP5gtK/aT/aK0/S9NsLD4+fGqxsbGws7OysrP4p+Oba0s7S2t44ba1tbaHXUht7e3hRIoIIkSKKJFjjVVUAfuH0kfo2fR0y36RPj3l2XeAXgrgMvwHjT4pYLA4HBeFnA2FweCweF45z2hhsJhMNQyKFHD4bD0YQo0KFGEKVGlCFOnCMIpL+Vc+8JfCvjrPM543438M/D7jLjTjLNcx4q4v4v4q4M4c4h4o4q4o4hxlbN8/4k4kz/ADfLcZmueZ9nma4zF5nnGcZni8VmGZ5hisRjcbiK+Jr1asv/2Q==',
  'base64',
);

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function objectInput(input, allowedKeys, label) {
  assert.ok(input && typeof input === 'object' && !Array.isArray(input), `${label} requires an object`);
  for (const key of Object.keys(input)) {
    assert.ok(allowedKeys.includes(key), `${label}: unsupported field ${key}`);
  }
}

function nonblank(value, label) {
  assert.equal(typeof value, 'string', `${label} must be a string`);
  assert.ok(value.trim().length > 0, `${label} must not be empty`);
}

function strings(value, label) {
  assert.ok(Array.isArray(value) && value.length > 0 && value.length <= 10000, `${label} must be a nonempty array`);
  for (const item of value) nonblank(item, label);
}

function pageOf(items, input = {}) {
  const limit = input.limit === undefined ? 50 : input.limit;
  const offset = input.offset === undefined ? 0 : input.offset;
  assert.ok(Number.isInteger(limit) && limit > 0 && limit <= 200, 'Guest page limit must be 1..200');
  assert.ok(Number.isInteger(offset) && offset >= 0, 'Guest page offset must be nonnegative');
  return {
    items: items.slice(offset, offset + limit), total: items.length, offset, limit,
    hasMore: offset + limit < items.length,
  };
}

function imageAsset(id, name, relativeFilePath = name, mediaType = 'image') {
  // Serpent invocation snapshots have no extension or fileExtension properties.
  return {
    id, name, relativeFilePath, mediaType, byteSize: PNG_BYTES.length,
    currentRevisionId: `revision-${id}`, locationKind: 'managed', folderId: null,
  };
}

function commandContext(assets, { assetIds, folderIds = [] } = {}) {
  return {
    targetLibraryId: LIBRARY_ID,
    invocation: {
      contextId: '63f5a17b-79d0-4d52-a56f-b2431f2cc0e8', revision: 1,
      libraryId: LIBRARY_ID,
      selection: {
        refs: [], assetIds: assetIds || (assets || []).map((asset) => asset.id),
        folderIds, collectionIds: [], ...(assets === undefined ? {} : { assets }),
      },
      browse: {}, viewer: { active: false },
    },
  };
}

function jobSignal() {
  let aborted = false;
  return {
    abort() { aborted = true; },
    signal: {
      get aborted() { return aborted; },
      throwIfAborted() {
        if (aborted) {
          const error = new Error('The plugin job was cancelled.');
          error.name = 'AbortError';
          throw error;
        }
      },
    },
  };
}

async function fixture(t, options = {}) {
  const temporaryRoot = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'wd14-tagging-test-'));
  const setupController = new AbortController();
  const subscriptions = [];
  let runtime;
  t.after(async () => {
    try {
      setupController.abort();
      if (runtime && typeof runtime.dispose === 'function') await runtime.dispose('test-complete');
      for (const value of subscriptions.reverse()) {
        if (typeof value === 'function') await value();
        else if (value && typeof value.dispose === 'function') await value.dispose();
      }
    } finally {
      // Only remove the exact temporary directory created by this fixture.
      assert.equal(path.dirname(path.resolve(directory)), temporaryRoot);
      assert.ok(path.basename(directory).startsWith('wd14-tagging-test-'));
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
  if (!options.missingModel) fs.writeFileSync(path.join(directory, `${MODEL}.onnx`), MODEL_BYTES);
  if (!options.missingCsv) fs.writeFileSync(path.join(directory, `${MODEL}.csv`), options.csv || CSV);

  const settingsValues = {
    'settings.model-dir': directory, 'settings.model': MODEL,
    'settings.general-threshold': 0.35, 'settings.character-threshold': 0.85,
    'settings.max-tags': 40, 'settings.output-language': 'english',
    ...(options.settings || {}),
  };
  const librarySettings = options.librarySettings === undefined ? settingsValues : options.librarySettings;
  const userSettings = options.userSettings || {};
  const settings = {
    modelDir: directory, model: MODEL, generalThreshold: 0.35,
    characterThreshold: 0.85, maxTags: 40, outputLanguage: 'english',
  };
  const calls = {
    scopes: [], storage: [], enqueues: [], progress: [], notifications: [], cancels: [],
    reads: [], metadata: [], assetLists: [], tagLists: [], creates: [], assignments: [],
    sessions: [], runs: [], injectedFailures: [], releases: 0,
  };
  const jobRecords = new Map();
  const commands = new Map();
  const handlers = new Map();
  const existingTags = options.existingTags || [
    { id: 'tag-existing', name: 'existing_general', assetCount: 3 },
    { id: 'tag-character', name: 'character_entry', assetCount: 1 },
  ];
  const tags = existingTags.map((tag) => ({ ...tag }));
  const failAt = (stage) => {
    if (options.failAt === stage) {
      calls.injectedFailures.push(stage);
      throw new Error(`Injected ${stage} failure`);
    }
  };
  const ort = {
    env: { wasm: {} },
    Tensor: class Tensor {
      constructor(type, data, dims) {
        assert.equal(type, 'float32');
        assert.equal(Object.prototype.toString.call(data), '[object Float32Array]');
        this.type = type; this.data = data; this.dims = Array.from(dims);
      }
    },
    InferenceSession: {
      async create(model, sessionOptions) {
        calls.sessions.push({ model, options: sessionOptions });
        failAt('session-create');
        assert.deepEqual(Buffer.from(model), MODEL_BYTES, 'Only the tiny ONNX placeholder may reach ORT');
        if (options.onSessionCreate) await options.onSessionCreate();
        return {
          inputNames: ['input'], outputNames: ['probabilities'],
          inputMetadata: [{ name: 'input', isTensor: true, type: 'float32', shape: [1, 2, 2, 3] }],
          outputMetadata: [{ name: 'probabilities', isTensor: true, type: 'float32', shape: [1, 5] }],
          async run(feeds) {
            assert.deepEqual(Object.keys(feeds), ['input']);
            const tensor = feeds.input;
            calls.runs.push(tensor);
            assert.deepEqual(tensor.dims, [1, 2, 2, 3], 'Use NHWC dimensions from the real ORT metadata array');
            assert.equal(tensor.data.length, 12);
            for (const value of tensor.data) assert.ok(value >= 0 && value <= 255, 'WD14 pixels must be in 0..255');
            assert.ok(Math.max(...tensor.data) > 1, 'WD14 input must not be divided by 255');
            if (options.expectedTensor) assert.deepEqual(Array.from(tensor.data), options.expectedTensor);
            failAt('inference');
            if (options.onRun) await options.onRun(tensor);
            return { probabilities: { data: Float32Array.from(options.probabilities || [0.98, 0.94, 0.88, 0.96, 0.1]) } };
          },
          release() { calls.releases++; },
        };
      },
    },
  };

  function jobsFor(libraryId) {
    return {
      async enqueue(input) {
        objectInput(input, ['handlerId', 'payload', 'recoveryStrategy'], 'jobs.enqueue');
        nonblank(input.handlerId, 'handlerId');
        if (input.payload !== undefined) {
          assert.ok(input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload));
        }
        if (input.recoveryStrategy !== undefined) assert.ok(['idempotent', 'checkpoint'].includes(input.recoveryStrategy));
        const jobId = calls.enqueues.length === 0 ? JOB_ID : `fca52f31-732c-4ff5-8029-${String(calls.enqueues.length).padStart(12, '0')}`;
        calls.enqueues.push({ libraryId, jobId, input: plain(input) });
        jobRecords.set(jobId, { jobId, libraryId, attemptCount: 0, status: 'queued' });
        return { jobId };
      },
      async cancel(input) {
        objectInput(input, ['jobId', 'reason'], 'jobs.cancel');
        nonblank(input.jobId, 'jobId');
        calls.cancels.push({ libraryId, input: plain(input) });
        if (options.cancelError) throw new Error('Injected cancellation failure');
        const record = jobRecords.get(input.jobId);
        if (options.cancelReturnsNull || !record || !['queued', 'running', 'paused'].includes(record.status)) return null;
        assert.equal(record.libraryId, libraryId, 'Cancel must stay in its owning library');
        record.status = 'cancelled';
        if (options.onCancel) await options.onCancel(input);
        return { ...record }; // The Guest returns a bare JobRecord|null, not { job }.
      },
      async reportProgress(input) {
        objectInput(input, ['jobId', 'completed', 'total', 'phase', 'message', 'progress'], 'jobs.reportProgress');
        assert.ok(jobRecords.has(input.jobId));
        assert.ok(Number.isInteger(input.completed) && input.completed >= 0);
        assert.ok(Number.isInteger(input.total) && input.total >= input.completed);
        if (input.phase !== undefined) assert.ok(typeof input.phase === 'string' && input.phase.length <= 128);
        if (input.message !== undefined) assert.ok(typeof input.message === 'string' && input.message.length <= 1024);
        assert.equal(input.progress, input.total ? input.completed / input.total : 0);
        calls.progress.push({ libraryId, input: plain(input) });
        if (options.onProgress) await options.onProgress(input);
      },
    };
  }

  function apiFor(libraryId) {
    return {
      assets: {
        async list(input = {}) {
          objectInput(input, ['folderId', 'recursive', 'assetIds', 'limit', 'offset'], 'assets.list');
          calls.assetLists.push({ libraryId, input: plain(input) });
          return pageOf(options.folderAssets || [], input);
        },
        async readContent(assetId, input = {}) {
          nonblank(assetId, 'assetId');
          objectInput(input, ['maxBytes', 'offsetBytes'], 'assets.readContent options');
          calls.reads.push({ libraryId, assetId, input: plain(input) });
          failAt('read-content');
          if (options.onRead) await options.onRead(assetId);
          const item = (options.contents && options.contents[assetId]) || {};
          if (item.error) throw item.error;
          const data = item.data || PNG_BYTES;
          return {
            assetId, revisionId: `revision-${assetId}`, byteSize: data.length,
            dataBase64: data.toString('base64'), truncated: item.truncated === true,
            mimeType: Object.hasOwn(item, 'mimeType') ? item.mimeType : 'image/png',
          };
        },
        async getMetadata(assetId) {
          calls.metadata.push({ libraryId, assetId });
          throw new Error('Metadata is unavailable; readContent MIME/signature must be sufficient');
        },
      },
      tags: {
        async list(input = {}) {
          objectInput(input, ['limit', 'offset'], 'tags.list');
          calls.tagLists.push({ libraryId, input: plain(input) });
          failAt('list-tags');
          if (options.onListTags) await options.onListTags();
          return pageOf(tags, input);
        },
        async create(name) {
          nonblank(name, 'tags.create(name)');
          assert.ok(name.length <= 255);
          calls.creates.push({ libraryId, name });
          failAt('create-tag');
          if (options.onCreateTag) await options.onCreateTag(name);
          const tag = { id: `tag-created-${calls.creates.length}`, name, assetCount: 0 };
          tags.push(tag);
          return { ...tag }; // Guest result is not { tag: ... } or { tagId: ... }.
        },
        async assign(assetIds, tagIds) {
          strings(assetIds, 'tags.assign assetIds');
          strings(tagIds, 'tags.assign tagIds');
          calls.assignments.push({ libraryId, assetIds: Array.from(assetIds), tagIds: Array.from(tagIds) });
          failAt('assign-tags');
          if (options.assignSkipped) {
            return { assignedCount: 0, skipped: [{ assetId: assetIds[0], reason: 'asset_not_found' }] };
          }
          for (const id of tagIds) assert.ok(tags.some((tag) => tag.id === id), `Unknown tag ID ${id}`);
          return { assignedCount: assetIds.length * tagIds.length, skipped: [] };
        },
      },
      ui: {
        async notify(input) {
          objectInput(input, ['severity', 'message', 'mode', 'title'], 'ui.notify');
          assert.ok(['info', 'warning', 'error'].includes(input.severity), 'Guest notification severity has no success value');
          nonblank(input.message, 'notification message');
          assert.ok(input.message.length <= 500);
          if (input.mode !== undefined) assert.equal(input.mode, 'toast');
          calls.notifications.push({ libraryId, ...plain(input) });
          return { shown: true, mode: 'toast', severity: input.severity };
        },
      },
      jobs: jobsFor(libraryId),
    };
  }

  const serpent = {
    ...apiFor(undefined), apiVersion: 1,
    forLibrary(libraryId) {
      nonblank(libraryId, 'forLibrary(libraryId)');
      assert.notEqual(libraryId, '__serpent_global_runtime__');
      calls.scopes.push(libraryId);
      // Real scoped API deliberately has no storage, commands, forLibrary, or
      // jobs.registerHandler; adding them would hide invalid implementation.
      return apiFor(libraryId);
    },
    storage: {
      async get(key, input = {}) {
        nonblank(key, 'storage key');
        objectInput(input, ['scope'], 'storage.get options');
        const scope = input.scope || 'library';
        assert.ok(['library', 'user'].includes(scope));
        calls.storage.push({ key, scope });
        if (options.storageErrorScope === scope) throw new Error(`Injected ${scope} storage failure`);
        const values = scope === 'library' ? librarySettings : userSettings;
        return Object.hasOwn(values, key) ? values[key] : null;
      },
    },
    commands: {
      register(id, handler) {
        nonblank(id, 'command id'); assert.equal(typeof handler, 'function');
        commands.set(id, handler);
      },
    },
  };
  serpent.jobs.registerHandler = (id, handler) => {
    nonblank(id, 'job handler id'); assert.equal(typeof handler, 'function');
    handlers.set(id, handler);
  };

  const nativeRequire = createRequire(ENTRY);
  const isolatedRequire = (id) => id === 'onnxruntime-web' ? ort : nativeRequire(id);
  const module = { exports: {} };
  const script = new vm.Script(`(function(exports, require, module, __filename, __dirname) {\n${fs.readFileSync(ENTRY, 'utf8')}\n})`, { filename: ENTRY });
  const wrapper = script.runInNewContext({
    Buffer, console, process, AbortController, AbortSignal,
    setTimeout, clearTimeout, setImmediate, clearImmediate, URL, TextEncoder, TextDecoder,
  });
  wrapper(module.exports, isolatedRequire, module, ENTRY, path.dirname(ENTRY));
  runtime = module.exports;
  assert.equal(typeof runtime.setup, 'function');
  await runtime.setup({
    serpent, subscriptions: { add(value) { subscriptions.push(value); return value; } },
    signal: setupController.signal,
  });
  assert.equal(typeof commands.get('tag-selection'), 'function');
  assert.equal(typeof commands.get('tag-folder'), 'function');
  assert.equal(typeof handlers.get('wd14-tag-job'), 'function');

  const defaultJobController = jobSignal();
  async function runJob(assetIds = ['asset-png'], signal = defaultJobController.signal, payloadOverride, jobId = JOB_ID, attemptCount = 1) {
    const payload = payloadOverride || { libraryId: LIBRARY_ID, assetIds };
    const now = '2026-01-01T00:00:00.000Z';
    const job = {
      jobId, libraryId: LIBRARY_ID, kind: 'plugin.background', status: 'running',
      progress: 0, attemptCount, errorCode: null, errorDetail: null,
      ownerPluginId: 'wd14-tagger', ownerPackageHash: '0'.repeat(64),
      ownerPluginInstanceId: 'wd14-test-instance', ownerScope: 'library', ownerLibraryId: LIBRARY_ID,
      executionAvailability: 'ready', pluginHandlerId: 'wd14-tag-job', payload,
      recoveryStrategy: 'idempotent', createdAt: now, updatedAt: now,
    };
    jobRecords.set(jobId, job);
    try {
      const result = await handlers.get('wd14-tag-job')(payload, job, signal);
      if (job.status === 'running') job.status = 'succeeded';
      return result;
    } catch (error) {
      if (job.status === 'running') job.status = signal.aborted ? 'cancelled' : 'failed';
      throw error;
    }
  }
  return { runtime, serpent, calls, commands, handlers, directory, settings, runJob };
}

function allLibraryScoped(entries, label) {
  assert.ok(entries.length > 0, `Expected ${label} to be called`);
  for (const entry of entries) assert.equal(entry.libraryId, LIBRARY_ID, `${label} must use forLibrary(libraryId)`);
}

function errorNotification(calls) {
  assert.ok(calls.notifications.some((notice) => notice.severity === 'error'), 'Failed job must show an error notification');
}

test('preprocessToTensor returns float32 NHWC BGR pixels in 0..255', async (t) => {
  const { runtime } = await fixture(t);
  const result = runtime.__internals.preprocessToTensor(OPAQUE_RGBA, 2, 2, 2);
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 4);
  assert.equal(Object.prototype.toString.call(result[0]), '[object Float32Array]');
  assert.deepEqual(Array.from(result.slice(1)), [2, 2, 3]);
  assert.deepEqual(Array.from(result[0]), OPAQUE_BGR);
});

test('preprocessToTensor composites transparent and partial-alpha pixels on white', async (t) => {
  const { runtime } = await fixture(t);
  const [data, height, width, channels] = runtime.__internals.preprocessToTensor(ALPHA_RGBA, 2, 2, 2);
  assert.deepEqual([height, width, channels], [2, 2, 3]);
  assert.deepEqual(Array.from(data), ALPHA_BGR);
});

test('inferTags reads ORT metadata, sends NHWC/BGR input and returns multiple actual tags', async (t) => {
  const { runtime, settings, calls } = await fixture(t, { expectedTensor: ALPHA_BGR });
  const result = await runtime.__internals.inferTags(ALPHA_PNG_BYTES, 'png', settings);
  assert.deepEqual(Array.from(result.tags), EXPECTED_TAGS);
  assert.ok(result.tags.length >= 2);
  assert.equal(calls.sessions.length, 1);
  assert.equal(calls.runs.length, 1);
});

test('Chinese output translates common tags offline and preserves unknown names', async (t) => {
  const { runtime } = await fixture(t);
  const input = ['long_hair', '1girl', 'simple_background', 'wd14_unknown_(character)'];
  const translated = Array.from(await runtime.__internals.translateTags(input, 'chinese'));
  assert.equal(translated[0], '长发');
  for (const tag of translated.slice(0, 3)) assert.match(tag, /[\u3400-\u9fff]/u);
  assert.equal(translated[3], input[3]);
  assert.deepEqual(input, ['long_hair', '1girl', 'simple_background', 'wd14_unknown_(character)']);
  const normalized = await runtime.__internals.translateTags([' LONG HAIR ', 'Simple Background'], 'chinese');
  assert.deepEqual(Array.from(normalized), [translated[0], translated[2]]);
  const aliases = await runtime.__internals.translateTags(
    ['blond_hair', 'blonde_hair', 'hatsune_miku', 'star_\\(symbol\\)'], 'chinese');
  assert.deepEqual(Array.from(aliases), ['金发', '金发', '初音未来', '星星（符号）']);
});

test('English output bypasses translation and null restores the built-in Chinese backend', async (t) => {
  const { runtime } = await fixture(t);
  let calls = 0;
  runtime.__internals.setTranslatorBackend({ async translate(tags) {
    calls++;
    return tags.map(() => ' 自定义译文 ');
  } });
  assert.deepEqual(Array.from(await runtime.__internals.translateTags(['long_hair'], 'english')), ['long_hair']);
  assert.equal(calls, 0);
  assert.deepEqual(Array.from(await runtime.__internals.translateTags(['long_hair'], 'chinese')), ['自定义译文']);
  assert.equal(calls, 1);
  assert.throws(() => runtime.__internals.setTranslatorBackend({}), /translate\(tags\)/);
  runtime.__internals.setTranslatorBackend(null);
  assert.deepEqual(Array.from(await runtime.__internals.translateTags(['long_hair'], 'chinese')), ['长发']);
});

test('Chinese setting reaches inference, writes Chinese tags and reuses existing translated tags', async (t) => {
  const csv = CSV.replace('existing_general', 'long_hair').replace('new_general', '1girl')
    .replace('character_entry', 'wd14_unknown_character');
  const h = await fixture(t, {
    csv, settings: { 'settings.output-language': 'chinese' },
    existingTags: [{ id: 'tag-chinese-hair', name: '长发', assetCount: 3 }],
  });
  await h.commands.get('tag-selection')(commandContext([imageAsset('asset-png', 'photo.PNG')]));
  const queued = h.calls.enqueues[0];
  await h.runJob(queued.input.payload.assetIds, undefined, queued.input.payload);
  assert.equal(h.calls.creates.length, 2);
  assert.equal(h.calls.creates[0].name, 'wd14_unknown_character');
  assert.match(h.calls.creates[1].name, /[\u3400-\u9fff]/u);
  assert.deepEqual(h.calls.assignments[0].tagIds, ['tag-created-1', 'tag-chinese-hair', 'tag-created-2']);
  assert.ok(h.calls.storage.some((call) => call.key === 'settings.output-language' && call.scope === 'library'));
});

test('Chinese jobs write model vocabulary additions and reuse existing shoe translations', async (t) => {
  const csv = CSV.replace('existing_general', 'pink_footwear').replace('new_general', 'night_sky');
  const h = await fixture(t, {
    csv, settings: { 'settings.output-language': 'chinese' },
    existingTags: [{ id: 'tag-pink-footwear', name: '粉色鞋类', assetCount: 1 }],
  });
  await h.runJob();
  assert.deepEqual(h.calls.creates.map((call) => call.name), ['character_entry', '夜空']);
  assert.deepEqual(h.calls.assignments[0].tagIds, ['tag-created-1', 'tag-pink-footwear', 'tag-created-2']);
});

test('translations are deduplicated while respecting the max-tags selection limit', async (t) => {
  const h = await fixture(t, { settings: { 'settings.output-language': 'chinese', 'settings.max-tags': 2 } });
  h.runtime.__internals.setTranslatorBackend({ async translate(tags) {
    assert.deepEqual(Array.from(tags), ['character_entry', 'existing_general']);
    return tags.map(() => '同一标签');
  } });
  await h.runJob();
  assert.deepEqual(h.calls.creates.map((call) => call.name), ['同一标签']);
  assert.deepEqual(h.calls.assignments[0].tagIds, ['tag-created-1']);
});

test('invalid or failed translation rejects the job before any tag writes', async (t) => {
  for (const result of [null, [], ['only-one'], ['', '标签', '标签'], ['标签', 1, '标签'], Array(3), ['长'.repeat(256), '标签', '标签']]) {
    const h = await fixture(t, { settings: { 'settings.output-language': 'chinese' } });
    h.runtime.__internals.setTranslatorBackend({ translate: async () => result });
    await assert.rejects(() => h.runJob(), /translator must return/);
    assert.equal(h.calls.creates.length, 0);
    assert.equal(h.calls.assignments.length, 0);
    errorNotification(h.calls);
  }
  const h = await fixture(t, { settings: { 'settings.output-language': 'chinese' } });
  h.runtime.__internals.setTranslatorBackend({ translate: async () => { throw new Error('Translation failed'); } });
  await assert.rejects(() => h.runJob(), /Translation failed/);
  assert.equal(h.calls.assignments.length, 0);
  errorNotification(h.calls);
});

test('two setups of one CJS module keep separate sessions and release only the aborted instance', async (t) => {
  const h = await fixture(t);
  const firstHandler = h.handlers.get('wd14-tag-job');
  const secondController = new AbortController();
  const secondSubscriptions = [];
  t.after(async () => {
    secondController.abort();
    for (const value of secondSubscriptions.reverse()) {
      if (typeof value === 'function') await value();
      else if (value && typeof value.dispose === 'function') await value.dispose();
    }
  });
  await h.runtime.setup({
    serpent: h.serpent,
    subscriptions: { add(value) { secondSubscriptions.push(value); return value; } },
    signal: secondController.signal,
  });
  const secondHandler = h.handlers.get('wd14-tag-job');
  assert.notEqual(firstHandler, secondHandler);
  // Real host instances keep separate registration maps. Select the captured
  // handler while reusing the fixture's fully shaped Guest job record.
  const dispatch = async (handler) => {
    h.handlers.set('wd14-tag-job', handler);
    return h.runJob();
  };
  await dispatch(firstHandler);
  await dispatch(secondHandler);
  assert.equal(h.calls.sessions.length, 2, 'Each setup must own its own model session');
  assert.equal(h.calls.releases, 0);

  secondController.abort();
  await Promise.resolve();
  assert.equal(h.calls.releases, 1, 'Aborting the second setup releases only its own session');
  await dispatch(firstHandler);
  assert.equal(h.calls.sessions.length, 2, 'The first setup must retain and reuse its original session');
  assert.equal(h.calls.releases, 1, 'Running the first setup must not release another session');
  assert.equal(h.calls.runs.length, 3);
});

test('selection command recognizes snapshot JPG/PNG names and paths without extension fields', async (t) => {
  const { commands, calls } = await fixture(t);
  const assets = [
    imageAsset('jpg', 'photo.JPG'), imageAsset('png', 'display title', 'folder/image.PnG'),
    imageAsset('gif', 'animated.gif'), imageAsset('svg', 'drawing.svg'),
    imageAsset('pdf', 'notes.pdf', 'notes.pdf', 'document'),
    imageAsset('video', 'movie.mp4', 'movie.mp4', 'video'),
  ];
  await commands.get('tag-selection')(commandContext(assets));
  assert.equal(calls.enqueues.length, 1);
  allLibraryScoped(calls.enqueues, 'jobs.enqueue');
  assert.equal(calls.enqueues[0].input.handlerId, 'wd14-tag-job');
  assert.deepEqual(calls.enqueues[0].input.payload.assetIds, ['jpg', 'png']);
  assert.equal(calls.enqueues[0].input.payload.libraryId, LIBRARY_ID);
});

test('unsupported snapshots do not fall back to unfiltered selection.assetIds', async (t) => {
  const { commands, calls } = await fixture(t);
  const unsupported = [imageAsset('gif', 'animated.gif'), imageAsset('pdf', 'notes.pdf', 'notes.pdf', 'document')];
  await commands.get('tag-selection')(commandContext(unsupported));
  assert.equal(calls.enqueues.length, 0);
  assert.ok(calls.notifications.some((notice) => notice.severity === 'warning'));
});

test('selection with only assetIds still enqueues a library job', async (t) => {
  const { commands, calls } = await fixture(t);
  await commands.get('tag-selection')(commandContext(undefined, { assetIds: ['asset-png'] }));
  allLibraryScoped(calls.enqueues, 'jobs.enqueue');
  assert.deepEqual(calls.enqueues[0].input.payload.assetIds, ['asset-png']);
});

test('folder command filters paginated Guest asset pages and enqueues through the target library', async (t) => {
  const assets = Array.from({ length: 201 }, (_, index) => imageAsset(`unsupported-${index}`, 'notes.pdf', 'notes.pdf', 'document'));
  assets[0] = imageAsset('folder-jpg', 'photo.JPG');
  assets[200] = imageAsset('folder-png', 'display title', 'subfolder/photo.png');
  const { commands, calls } = await fixture(t, { folderAssets: assets });
  await commands.get('tag-folder')(commandContext([], { folderIds: ['folder-id'] }));
  allLibraryScoped(calls.assetLists, 'assets.list');
  assert.ok(calls.assetLists.length >= 2);
  for (const call of calls.assetLists) {
    assert.equal(call.input.folderId, 'folder-id');
    assert.equal(call.input.recursive, true);
  }
  assert.ok(calls.assetLists.some((call) => call.input.offset > 0));
  allLibraryScoped(calls.enqueues, 'jobs.enqueue');
  assert.deepEqual(calls.enqueues[0].input.payload.assetIds, ['folder-jpg', 'folder-png']);
});

test('settings prefer library values and consult user scope only after missing library values', async (t) => {
  const { runtime, serpent, calls } = await fixture(t, {
    librarySettings: {
      'settings.model-dir': 'library-models', 'settings.model': 'library-model',
      'settings.general-threshold': 0, 'settings.character-threshold': null,
      'settings.max-tags': 2,
    },
    userSettings: {
      'settings.model-dir': 'wrong-user-models', 'settings.model': 'wrong-user-model',
      'settings.general-threshold': 0.99, 'settings.character-threshold': 0.91,
      'settings.max-tags': 99, 'settings.output-language': 'english',
    },
  });
  const settings = await runtime.__internals.loadSettings(serpent);
  assert.equal(settings.modelDir, 'library-models');
  assert.equal(settings.model, 'library-model');
  assert.equal(settings.generalThreshold, 0);
  assert.equal(settings.characterThreshold, 0.91);
  assert.equal(settings.maxTags, 2);
  assert.equal(settings.outputLanguage, 'english');
  for (const key of ['model-dir', 'model', 'general-threshold', 'character-threshold', 'max-tags', 'output-language']) {
    const reads = calls.storage.filter((call) => call.key === `settings.${key}`);
    assert.equal(reads[0].scope, 'library', `Read library setting first: ${key}`);
    if (['character-threshold', 'output-language'].includes(key)) assert.deepEqual(reads.map((call) => call.scope), ['library', 'user']);
    else assert.deepEqual(reads.map((call) => call.scope), ['library']);
  }
});

test('user defaults remain usable when library settings have no value', async (t) => {
  const { runtime, serpent } = await fixture(t, {
    librarySettings: {},
    userSettings: { 'settings.model-dir': 'user-models', 'settings.model': MODEL, 'settings.max-tags': 7 },
  });
  const settings = await runtime.__internals.loadSettings(serpent);
  assert.equal(settings.modelDir, 'user-models');
  assert.equal(settings.model, MODEL);
  assert.equal(settings.maxTags, 7);
});

test('library storage failure rejects the registered job and shows an error notification', async (t) => {
  const h = await fixture(t, { storageErrorScope: 'library' });
  await assert.rejects(() => h.runJob());
  assert.ok(h.calls.storage.some((call) => call.scope === 'library'));
  errorNotification(h.calls);
  assert.equal(h.calls.assignments.length, 0);
});

test('registered job reads content, paginates/reuses/creates tags, assigns IDs and reports library progress', async (t) => {
  const existingTags = Array.from({ length: 201 }, (_, index) => ({ id: `tag-unrelated-${index}`, name: `unrelated_${index}`, assetCount: 0 }));
  existingTags[0] = { id: 'tag-existing', name: 'existing_general', assetCount: 3 };
  existingTags[200] = { id: 'tag-character', name: 'character_entry', assetCount: 1 };
  const h = await fixture(t, { existingTags, expectedTensor: OPAQUE_BGR });
  await h.commands.get('tag-selection')(commandContext([imageAsset('asset-png', 'photo.PNG')]));
  const queued = h.calls.enqueues[0];
  await h.runJob(queued.input.payload.assetIds, undefined, queued.input.payload);
  allLibraryScoped(h.calls.enqueues, 'jobs.enqueue');
  allLibraryScoped(h.calls.reads, 'assets.readContent');
  allLibraryScoped(h.calls.tagLists, 'tags.list');
  assert.ok(h.calls.tagLists.some((call) => call.input.offset > 0));
  assert.deepEqual(h.calls.creates.map((call) => call.name), ['new_general']);
  allLibraryScoped(h.calls.creates, 'tags.create');
  assert.deepEqual(h.calls.assignments, [{
    libraryId: LIBRARY_ID, assetIds: ['asset-png'],
    tagIds: ['tag-character', 'tag-existing', 'tag-created-1'],
  }]);
  assert.equal(h.calls.metadata.length, 0);
  allLibraryScoped(h.calls.progress, 'jobs.reportProgress');
  const last = h.calls.progress.at(-1).input;
  assert.equal(last.completed, 1);
  assert.equal(last.total, 1);
  assert.equal(h.calls.notifications.filter((notice) => notice.severity === 'error').length, 0);
});

for (const [label, data, mimeType] of [
  ['PNG MIME', PNG_BYTES, 'image/png'],
  ['PNG signature with null MIME', PNG_BYTES, null],
  ['JPEG MIME', JPEG_BYTES, 'image/jpeg'],
  ['JPEG signature with generic MIME', JPEG_BYTES, 'application/octet-stream'],
]) {
  test(`registered handler identifies ${label} without getMetadata`, async (t) => {
    const h = await fixture(t, { contents: { 'asset-png': { data, mimeType } } });
    await h.runJob();
    assert.equal(h.calls.metadata.length, 0);
    assert.equal(h.calls.runs.length, 1);
    assert.equal(h.calls.assignments.length, 1);
    assert.ok(h.calls.assignments[0].tagIds.length >= 2);
    allLibraryScoped(h.calls.progress, 'jobs.reportProgress');
  });
}

for (const stage of ['read-content', 'session-create', 'inference', 'list-tags', 'create-tag', 'assign-tags']) {
  test(`${stage} failure rejects the registered job and shows an error notification`, async (t) => {
    const h = await fixture(t, { failAt: stage });
    await assert.rejects(() => h.runJob());
    assert.deepEqual(h.calls.injectedFailures, [stage], 'The requested failure stage must actually be reached');
    errorNotification(h.calls);
    if (stage !== 'assign-tags') assert.equal(h.calls.assignments.length, 0);
  });
}

for (const [label, options] of [
  ['unconfigured model directory', { librarySettings: {} }],
  ['missing ONNX file', { missingModel: true }],
  ['missing tags CSV', { missingCsv: true }],
  ['truncated asset content', { contents: { 'asset-png': { truncated: true } } }],
  ['invalid image content', { contents: { 'asset-png': { data: Buffer.from('not a PNG image'), mimeType: 'image/png' } } }],
]) {
  test(`${label} rejects the registered job and shows an error notification`, async (t) => {
    const h = await fixture(t, options);
    await assert.rejects(() => h.runJob());
    errorNotification(h.calls);
    assert.equal(h.calls.assignments.length, 0);
  });
}

test('assign skipped result is a job failure with an error notification', async (t) => {
  const h = await fixture(t, { assignSkipped: true });
  await assert.rejects(() => h.runJob());
  assert.equal(h.calls.assignments.length, 1);
  errorNotification(h.calls);
});

test('one successful asset cannot turn a later asset failure into job success', async (t) => {
  const h = await fixture(t, { contents: { broken: { error: new Error('Injected second asset read failure') } } });
  await assert.rejects(() => h.runJob(['asset-png', 'broken']));
  assert.equal(h.calls.assignments.length, 1);
  assert.deepEqual(h.calls.assignments[0].assetIds, ['asset-png']);
  errorNotification(h.calls);
});

test('zero inferred tags explicitly warns and does not create or assign tags', async (t) => {
  const h = await fixture(t, { probabilities: [0.98, 0.01, 0.02, 0.01, 0.01] });
  await h.runJob();
  assert.equal(h.calls.runs.length, 1);
  assert.equal(h.calls.creates.length, 0);
  assert.equal(h.calls.assignments.length, 0);
  assert.ok(h.calls.notifications.some((notice) => notice.severity === 'warning'), 'No tags must be visible to the user');
});

test('already cancelled job never reads content or assigns tags', async (t) => {
  const h = await fixture(t);
  const controller = jobSignal();
  controller.abort();
  // The host also checks throwIfAborted after a handler returns. This test
  // accepts either exit path and checks the write-back guarantee itself.
  await h.runJob(['asset-png'], controller.signal).catch(() => undefined);
  assert.equal(h.calls.reads.length, 0);
  assert.equal(h.calls.assignments.length, 0);
});

for (const stage of ['inference', 'list-tags', 'create-tag']) {
  test(`cancellation during ${stage} prevents assignment after the pending operation finishes`, async (t) => {
    const controller = jobSignal();
    const hooks = {
      inference: { onRun: () => controller.abort() },
      'list-tags': { onListTags: () => controller.abort() },
      'create-tag': { onCreateTag: () => controller.abort() },
    };
    const h = await fixture(t, hooks[stage]);
    await h.runJob(['asset-png'], controller.signal).catch(() => undefined);
    assert.equal(controller.signal.aborted, true, 'The selected asynchronous stage must actually be reached');
    assert.equal(h.calls.runs.length, 1);
    if (stage === 'list-tags') assert.ok(h.calls.tagLists.length > 0);
    if (stage === 'create-tag') assert.ok(h.calls.creates.length > 0);
    assert.equal(h.calls.assignments.length, 0, 'Cancellation must be checked again immediately before assign');
  });
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('progress identifies the current image before inference and preserves completed/total across stages', async (t) => {
  let inferred = 0;
  const h = await fixture(t, { onRun() {
    const current = h.calls.progress.at(-1).input;
    assert.equal(current.completed, inferred);
    assert.equal(current.total, 2);
    assert.match(current.message, new RegExp(`第 ${++inferred}/2 张`));
    assert.match(current.message, /识别标签/);
  } });
  await h.runJob(['first', 'second']);
  const reports = h.calls.progress.map((call) => call.input);
  assert.equal(reports[0].completed, 0);
  assert.match(reports[0].message, /加载本地模型/);
  assert.match(reports[0].message, /共 2 张/);
  assert.ok(reports.some((report) => /第 1\/2 张.*写入标签/.test(report.message)));
  assert.equal(reports.at(-1).completed, 2);
  assert.equal(reports.at(-1).progress, 1);
  for (let i = 1; i < reports.length; i++) assert.ok(reports[i].completed >= reports[i - 1].completed);
  assert.ok(reports.some((report) => report.completed === 1 && report.progress === 0.5));
});

test('failed and unsupported images still advance progress with accurate outcome counts', async (t) => {
  const h = await fixture(t, { contents: {
    unsupported: { data: Buffer.from('unsupported format'), mimeType: 'image/gif' },
    broken: { error: new Error('Broken image') },
  } });
  await assert.rejects(() => h.runJob(['good', 'unsupported', 'broken']), /1\/3 image\(s\) failed/);
  const last = h.calls.progress.at(-1).input;
  assert.equal(last.completed, 3);
  assert.equal(last.total, 3);
  assert.match(last.message, /已打标 1 张，失败 1 张.*不支持 1 张/);
  const status = await h.commands.get('tagging-status')(commandContext([]));
  assert.equal(status[0].status, 'failed');
  assert.equal(status[0].tagged, 1);
  assert.equal(status[0].failed, 1);
  assert.equal(status[0].skipped, 1);
});

test('status and stop work without a selection or configured model', async (t) => {
  const h = await fixture(t, { missingModel: true });
  const status = await h.commands.get('tagging-status')(commandContext([]));
  assert.equal(status.length, 0);
  const result = await h.commands.get('stop-tagging')(commandContext([]));
  assert.equal(result.cancelled, 0);
  assert.equal(h.calls.storage.length, 0);
  assert.equal(h.calls.cancels.length, 0);
  assert.ok(h.calls.notifications.every((notice) => notice.severity === 'info'));
});

test('cancellation during content read stops before inference or reading another image', async (t) => {
  const controller = jobSignal();
  const h = await fixture(t, { onRead: () => controller.abort() });
  await assert.rejects(() => h.runJob(['first', 'second'], controller.signal), { name: 'AbortError' });
  assert.equal(h.calls.reads.length, 1);
  assert.equal(h.calls.runs.length, 0);
  assert.equal(h.calls.assignments.length, 0);
  assert.ok(h.calls.notifications.some((notice) => /已停止.*0\/2/.test(notice.message)));
  assert.ok(h.calls.notifications.every((notice) => notice.severity !== 'error'));
});

test('cancellation after a tag page stops before another page or tag creation', async (t) => {
  const controller = jobSignal();
  const existingTags = Array.from({ length: 201 }, (_, i) => ({ id: `tag-${i}`, name: `other_${i}` }));
  const h = await fixture(t, { existingTags, onListTags: () => controller.abort() });
  await assert.rejects(() => h.runJob(['first', 'second'], controller.signal), { name: 'AbortError' });
  assert.equal(h.calls.tagLists.length, 1);
  assert.equal(h.calls.creates.length, 0);
  assert.equal(h.calls.assignments.length, 0);
});

test('cancellation after creating one tag prevents subsequent tag creations', async (t) => {
  const controller = jobSignal();
  const h = await fixture(t, { existingTags: [], onCreateTag: () => controller.abort() });
  await assert.rejects(() => h.runJob(['first', 'second'], controller.signal), { name: 'AbortError' });
  assert.equal(h.calls.creates.length, 1);
  assert.equal(h.calls.assignments.length, 0);
  assert.equal(h.calls.reads.length, 1);
});

test('stop command cancels the current library during inference and permits a later fresh job', async (t) => {
  const entered = deferred();
  const release = deferred();
  t.after(() => release.resolve());
  let runs = 0;
  const h = await fixture(t, { async onRun() {
    if (++runs === 1) { entered.resolve(); await release.promise; }
  } });
  const running = h.runJob(['first', 'second']);
  const outcome = assert.rejects(running, { name: 'AbortError' });
  await entered.promise;
  const status = await h.commands.get('tagging-status')(commandContext([]));
  assert.equal(status[0].status, 'running');
  assert.equal(status[0].completed, 0);
  assert.match(status[0].message, /第 1\/2 张/);
  const otherLibrary = commandContext([]);
  otherLibrary.invocation.libraryId = otherLibrary.targetLibraryId = 'other-library';
  assert.equal((await h.commands.get('stop-tagging')(otherLibrary)).cancelled, 0);
  assert.equal(h.calls.cancels.length, 0);
  const stopped = await h.commands.get('stop-tagging')(commandContext([]));
  assert.equal(stopped.cancelled, 1);
  allLibraryScoped(h.calls.cancels, 'jobs.cancel');
  assert.equal(h.calls.cancels[0].input.jobId, JOB_ID);
  assert.equal(h.calls.cancels[0].input.reason, 'user-requested');
  release.resolve();
  await outcome;
  assert.equal(h.calls.reads.length, 1);
  assert.equal(h.calls.creates.length, 0);
  assert.equal(h.calls.assignments.length, 0);
  const cancelledStatus = await h.commands.get('tagging-status')(commandContext([]));
  assert.equal(cancelledStatus[0].status, 'cancelled');
  assert.match(cancelledStatus[0].message, /已停止/);
  const resumed = await h.runJob(['fresh'], undefined, undefined, 'new-job');
  assert.equal(resumed.tagged, 1);
  assert.equal(h.calls.sessions.length, 1, 'A stopped task must leave the model usable by the next task');
});

test('stopping after the first image preserves its tags and reports the partial count', async (t) => {
  let stopped = false;
  const h = await fixture(t, { async onProgress(progress) {
    if (progress.completed === 1 && !stopped) {
      stopped = true;
      await h.commands.get('stop-tagging')(commandContext([]));
    }
  } });
  await assert.rejects(() => h.runJob(['first', 'second', 'third']), { name: 'AbortError' });
  assert.equal(stopped, true);
  assert.deepEqual(h.calls.reads.map((call) => call.assetId), ['first']);
  assert.equal(h.calls.assignments.length, 1);
  assert.deepEqual(h.calls.assignments[0].assetIds, ['first']);
  assert.ok(h.calls.notifications.some((notice) => /已停止.*已完成 1\/3 张，已打标 1 张/.test(notice.message)));
  assert.ok(h.calls.notifications.every((notice) => !/打标完成/.test(notice.message)));
});

test('stop cancels queued host jobs even when their handlers never start', async (t) => {
  const h = await fixture(t);
  for (const id of ['first', 'second']) {
    await h.commands.get('tag-selection')(commandContext([imageAsset(id, `${id}.png`)]));
  }
  assert.equal(h.calls.enqueues.length, 2);
  const stopped = await h.commands.get('stop-tagging')(commandContext([]));
  assert.equal(stopped.cancelled, 2);
  assert.deepEqual(h.calls.cancels.map((call) => call.input.jobId), h.calls.enqueues.map((call) => call.jobId));
  assert.equal(h.calls.sessions.length, 0);
  const status = await h.commands.get('tagging-status')(commandContext([]));
  assert.equal(status[0].status, 'cancelled');
  assert.match(status[0].message, /已停止排队/);
  assert.equal((await h.commands.get('stop-tagging')(commandContext([]))).cancelled, 0);
  assert.equal(h.calls.cancels.length, 2, 'Never wait for a cancelled queued handler to clean up tracking');
});

test('stop cancels both the running job and another handler waiting for its model session', async (t) => {
  const entered = deferred();
  const release = deferred();
  t.after(() => release.resolve());
  const h = await fixture(t, { async onRun() { entered.resolve(); await release.promise; } });
  const firstOutcome = assert.rejects(h.runJob(['first']), { name: 'AbortError' });
  await entered.promise;
  const secondOutcome = assert.rejects(h.runJob(['second'], undefined, undefined, 'second-job'), { name: 'AbortError' });
  const stopped = await h.commands.get('stop-tagging')(commandContext([]));
  assert.equal(stopped.cancelled, 2);
  assert.deepEqual(h.calls.cancels.map((call) => call.input.jobId), ['second-job', JOB_ID],
    'Cancel the waiting handler before cancellation can release the running model session');
  release.resolve();
  await Promise.all([firstOutcome, secondOutcome]);
  assert.deepEqual(h.calls.reads.map((call) => call.assetId), ['first']);
  assert.equal(h.calls.runs.length, 1);
  assert.equal(h.calls.assignments.length, 0);
});

test('host cancellation failure is reported and does not silently stop a still-running task', async (t) => {
  const entered = deferred();
  const release = deferred();
  t.after(() => release.resolve());
  const h = await fixture(t, { cancelError: true, async onRun() { entered.resolve(); await release.promise; } });
  const running = h.runJob(['first', 'second']);
  await entered.promise;
  await assert.rejects(() => h.commands.get('stop-tagging')(commandContext([])), /cancellation failure/);
  errorNotification(h.calls);
  release.resolve();
  const result = await running;
  assert.equal(result.tagged, 2);
  assert.equal(h.calls.assignments.length, 2);
});

test('null cancellation result does not claim that a queued task was cancelled', async (t) => {
  const h = await fixture(t, { cancelReturnsNull: true });
  await h.commands.get('tag-selection')(commandContext([imageAsset('first', 'first.png')]));
  const stopped = await h.commands.get('stop-tagging')(commandContext([]));
  assert.equal(stopped.cancelled, 0);
  const status = await h.commands.get('tagging-status')(commandContext([]));
  assert.equal(status[0].status, 'finished');
  assert.ok(h.calls.notifications.every((notice) => !/已请求停止/.test(notice.message)));
});

test('cancellation during model loading stops before reading or inferring any image', async (t) => {
  const controller = jobSignal();
  const h = await fixture(t, { onSessionCreate: () => controller.abort() });
  await assert.rejects(() => h.runJob(['first', 'second'], controller.signal), { name: 'AbortError' });
  assert.equal(h.calls.sessions.length, 1);
  assert.equal(h.calls.reads.length, 0);
  assert.equal(h.calls.runs.length, 0);
  assert.ok(h.calls.notifications.some((notice) => /已停止.*0\/2/.test(notice.message)));
});

test('cancellation during inference prevents starting translation after the run returns', async (t) => {
  const controller = jobSignal();
  const h = await fixture(t, { settings: { 'settings.output-language': 'chinese' }, onRun: () => controller.abort() });
  let translated = false;
  h.runtime.__internals.setTranslatorBackend({ async translate(tags) { translated = true; return tags; } });
  await assert.rejects(() => h.runJob(['first'], controller.signal), { name: 'AbortError' });
  assert.equal(translated, false);
  assert.equal(h.calls.creates.length, 0);
});

test('cancellation acknowledgement cannot replace finished running-task statistics with a queued message', async (t) => {
  const entered = deferred();
  const release = deferred();
  t.after(() => release.resolve());
  const controller = jobSignal();
  const h = await fixture(t, {
    async onRun() { entered.resolve(); await release.promise; },
    async onCancel() { controller.abort(); release.resolve(); await outcome; },
  });
  const outcome = assert.rejects(h.runJob(['first', 'second'], controller.signal), { name: 'AbortError' });
  await entered.promise;
  assert.equal((await h.commands.get('stop-tagging')(commandContext([]))).cancelled, 1);
  const status = await h.commands.get('tagging-status')(commandContext([]));
  assert.equal(status[0].status, 'cancelled');
  assert.match(status[0].message, /已停止。已完成 0\/2 张/);
  assert.doesNotMatch(status[0].message, /已停止排队/);
});

test('a higher host attempt can retry a cancelled job id without clearing cancellation for the old attempt', async (t) => {
  const entered = deferred();
  const release = deferred();
  t.after(() => release.resolve());
  let runs = 0;
  const h = await fixture(t, { async onRun() {
    if (++runs === 1) { entered.resolve(); await release.promise; }
  } });
  const cancelled = assert.rejects(h.runJob(['old-first', 'old-second']), { name: 'AbortError' });
  await entered.promise;
  await h.commands.get('stop-tagging')(commandContext([]));
  release.resolve();
  await cancelled;
  await assert.rejects(() => h.runJob(['stale-attempt'], undefined, undefined, JOB_ID, 1), { name: 'AbortError' });
  const retried = await h.runJob(['retried'], undefined, undefined, JOB_ID, 2);
  assert.equal(retried.completed, 1);
  assert.equal(retried.tagged, 1);
  assert.deepEqual(h.calls.reads.map((call) => call.assetId), ['old-first', 'retried']);
  assert.deepEqual(h.calls.assignments.map((call) => call.assetIds), [['retried']]);
  assert.equal(h.calls.sessions.length, 1);
  const status = await h.commands.get('tagging-status')(commandContext([]));
  assert.equal(status[0].status, 'completed');
  assert.equal(status[0].total, 1);
  assert.equal(status[0].attemptCount, 2);
});

test('a queued job cancelled before its first claim can later retry on its first host attempt', async (t) => {
  const h = await fixture(t);
  await h.commands.get('tag-selection')(commandContext([imageAsset('queued', 'queued.png')]));
  assert.equal((await h.commands.get('stop-tagging')(commandContext([]))).cancelled, 1);
  const result = await h.runJob(['queued'], undefined, undefined, JOB_ID, 1);
  assert.equal(result.tagged, 1);
  assert.equal(h.calls.reads.length, 1);
  assert.equal(h.calls.assignments.length, 1);
});

test('finished jobs remain queryable but are excluded from future stop commands', async (t) => {
  const h = await fixture(t);
  await h.runJob(['first']);
  const status = await h.commands.get('tagging-status')(commandContext([]));
  assert.equal(status[0].status, 'completed');
  assert.equal(status[0].completed, 1);
  assert.equal(status[0].tagged, 1);
  assert.equal((await h.commands.get('stop-tagging')(commandContext([]))).cancelled, 0);
  assert.equal(h.calls.cancels.length, 0);
});
