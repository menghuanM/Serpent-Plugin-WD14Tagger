'use strict';
// Run the real local model against one image; library writes stay in memory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { performance } = require('node:perf_hooks');

const pluginRoot = path.resolve(__dirname, '..');
const options = {};
for (let i = 2; i < process.argv.length; i += 2) options[process.argv[i]] = process.argv[i + 1];
if (!options['--model-dir'] || !options['--image']) {
  console.error('Usage: node scripts/smoke-tagging.cjs --model-dir <directory> --image <image.jpg> [--model <name>] [--output-language english|chinese] [--copies <count>] [--stop-after <completed>] [--entry <main.js>] [--report <report.json>]');
  process.exitCode = 1;
} else {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}

async function main() {
  process.env.NODE_PATH = path.join(pluginRoot, 'node_modules');
  Module._initPaths();
  const ts = require('typescript');
  require.extensions['.ts'] = (module, filename) => {
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    module._compile(output, filename);
  };
  // Use Serpent's real guest projection and argument construction for content,
  // tags and notifications; execute against an isolated in-memory library.
  const { createSerpentGuestApi } = require(path.join(pluginRoot, '..', 'Serpent-0.3.8', 'src/scripting/serpent-guest-api.ts'));
  const plugin = require(path.resolve(options['--entry'] || path.join(pluginRoot, 'entry/main.js')));
  const imagePath = path.resolve(options['--image']);
  const image = fs.readFileSync(imagePath);
  const libraryId = 'wd14-local-model-verification';
  const assetId = 'verification-image';
  const copies = Number(options['--copies'] || 1);
  const stopAfter = options['--stop-after'] === undefined ? null : Number(options['--stop-after']);
  assert.ok(Number.isInteger(copies) && copies >= 1 && copies <= 100);
  assert.ok(stopAfter === null || Number.isInteger(stopAfter) && stopAfter >= 0 && stopAfter < copies);
  const assetIds = Array.from({ length: copies }, (_, i) => i === 0 ? assetId : `${assetId}-${i + 1}`);
  const reads = [];
  const tags = new Map();
  const assigned = new Set();
  const assignedAssets = new Set();
  const commands = new Map();
  const handlers = new Map();
  const queued = [];
  const progress = [];
  const notifications = [];
  const cleanups = [];
  const controller = new AbortController();
  const jobController = new AbortController();
  const jobRecord = { jobId: 'smoke-job', libraryId, status: 'queued' };
  const taskContext = { targetLibraryId: libraryId, invocation: { libraryId } };
  const model = options['--model'] || 'wd-vit-tagger-v3';
  const outputLanguage = options['--output-language'] || 'english';
  assert.ok(['english', 'chinese'].includes(outputLanguage), 'Output language must be english or chinese');
  let created = 0;
  const guest = createSerpentGuestApi({
    executeCommand: async (command, input, scope) => {
      if (command === 'ui.notify') { notifications.push(input); return {}; }
      assert.equal(scope.targetLibraryId, libraryId, `Explicit library binding required: ${command}`);
      switch (command) {
        case 'asset.content.read':
          assert.ok(assetIds.includes(input.assetId));
          reads.push(input.assetId);
          assert.ok(input.maxBytes >= image.length);
          return { assetId: input.assetId, revisionId: 'original', byteSize: image.length, dataBase64: image.toString('base64'), truncated: false, mimeType: null };
        case 'tag.list': {
          const items = [...tags.values()].slice(input.offset, input.offset + input.limit);
          return { items, total: tags.size, offset: input.offset, limit: input.limit, hasMore: input.offset + items.length < tags.size };
        }
        case 'tag.create': {
          assert.equal(typeof input.name, 'string');
          const tag = { id: `tag-${++created}`, name: input.name, assetCount: 0 };
          tags.set(tag.id, tag);
          return tag;
        }
        case 'tag.assign':
          assert.equal(input.assetIds.length, 1);
          assert.ok(assetIds.includes(input.assetIds[0]));
          assignedAssets.add(input.assetIds[0]);
          for (const id of input.tagIds) { assert.ok(tags.has(id)); assigned.add(id); }
          return { assignedCount: input.tagIds.length, skipped: [] };
        default: throw new Error(`Unexpected API call: ${command}`);
      }
    },
  });
  const api = {
    ...guest,
    forLibrary: (id) => {
      assert.equal(id, libraryId);
      return {
        ...guest.forLibrary(id),
        jobs: {
          enqueue: async (input) => { queued.push(input); return { jobId: 'smoke-job' }; },
          reportProgress: async (input) => {
            assert.equal(input.jobId, 'smoke-job');
            assert.equal(input.total, copies);
            assert.equal(input.progress, input.completed / copies);
            progress.push(input);
            if (stopAfter !== null && input.completed >= stopAfter && jobRecord.status === 'running') {
              const stopped = await commands.get('stop-tagging')(taskContext);
              assert.equal(stopped.cancelled, 1);
            }
          },
          cancel: async (input) => {
            assert.equal(input.jobId, 'smoke-job');
            if (!['queued', 'running'].includes(jobRecord.status)) return null;
            jobRecord.status = 'cancelled';
            jobController.abort('user-requested');
            return { ...jobRecord };
          },
        },
      };
    },
    storage: { get: async (key, scope) => {
      if (scope.scope !== 'library') return null;
      if (key === 'settings.model-dir') return path.resolve(options['--model-dir']);
      if (key === 'settings.model') return model;
      if (key === 'settings.output-language') return outputLanguage;
      return null;
    } },
    commands: { register: (id, handler) => commands.set(id, handler) },
    jobs: {
      registerHandler: (id, handler) => handlers.set(id, handler),
      enqueue: async () => { throw new Error('Unscoped enqueue'); },
      reportProgress: async () => { throw new Error('Unscoped progress'); },
    },
  };
  const start = performance.now();
  try {
    await plugin.setup({ serpent: api, signal: controller.signal, subscriptions: { add(value) { cleanups.push(value); } } });
    await commands.get('tag-selection')({
      targetLibraryId: libraryId,
      invocation: {
        libraryId,
        selection: { assetIds, assets: assetIds.map((id) => ({ id, name: path.basename(imagePath), relativeFilePath: `Assets/${path.basename(imagePath)}`, mediaType: 'image', byteSize: image.length })) },
      },
    });
    assert.equal(queued.length, 1);
    const job = queued[0];
    console.log(`Running ${model} against ${path.basename(imagePath)} (${copies} image(s))...`);
    jobRecord.status = 'running';
    let result;
    if (stopAfter === null) {
      result = await handlers.get(job.handlerId)(job.payload, jobRecord, jobController.signal);
      assert.equal(result.tagged, copies);
    } else {
      await assert.rejects(() => handlers.get(job.handlerId)(job.payload, jobRecord, jobController.signal), { name: 'AbortError' });
      [result] = await commands.get('tagging-status')(taskContext);
      assert.equal(result.status, 'cancelled');
      assert.equal(result.completed, stopAfter);
      assert.equal(result.tagged, stopAfter);
    }
    const expectedCompleted = stopAfter === null ? copies : stopAfter;
    assert.equal(assignedAssets.size, expectedCompleted);
    assert.equal(reads.length, expectedCompleted, 'Cancellation must prevent reading the next image');
    if (expectedCompleted > 0) assert.ok(assigned.size > 0, 'Real image must produce tags above the default threshold');
    assert.equal(progress.at(-1).completed, expectedCompleted);
    const report = {
      model, outputLanguage, image: imagePath, copies, stopAfter, entry: options['--entry'] || 'entry/main.js',
      elapsedSeconds: Number(((performance.now() - start) / 1000).toFixed(2)),
      result, progress, reads, assignedAssets: [...assignedAssets], tags: [...assigned].map((id) => tags.get(id).name), notifications,
      verified: 'Real ONNX inference and real Serpent guest API; job-control adapter and tag writes in isolated memory, user library untouched',
    };
    if (options['--report']) fs.writeFileSync(path.resolve(options['--report']), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    controller.abort();
    for (const cleanup of cleanups.reverse()) {
      if (typeof cleanup === 'function') await cleanup();
      else if (cleanup && typeof cleanup.dispose === 'function') await cleanup.dispose();
    }
    await plugin.dispose('smoke-verification');
  }
}
