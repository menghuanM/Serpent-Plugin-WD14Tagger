'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');

const pluginRoot = path.resolve(__dirname, '..');
process.env.NODE_PATH = path.join(pluginRoot, 'node_modules');
Module._initPaths();
const ts = require(path.join(pluginRoot, 'node_modules', 'typescript'));
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  module._compile(output, filename);
};

const serpentRoot = path.resolve(__dirname, '..', '..', 'Serpent-0.3.8');
const manifestPath = path.resolve(__dirname, '..', 'serpent-plugin.json');
const packageDirectory = path.resolve(__dirname, '..', 'dist', 'serpent-plugin-wd14tagger');
const { pluginManifestSchema, formatPluginManifestValidationIssues } = require(path.join(serpentRoot, 'src/plugins/plugin-manifest.ts'));
const { validatePluginPackageSnapshot, defaultPluginPackageLimits } = require(path.join(serpentRoot, 'src/plugins/plugin-package.ts'));
const manifestBytes = fs.readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const manifestCheck = pluginManifestSchema.safeParse(manifest);
if (!manifestCheck.success) {
  console.error('manifest invalid:', formatPluginManifestValidationIssues(manifestCheck.error));
  process.exitCode = 1;
} else {
  console.log(`manifest valid: ${manifestCheck.data.id}@${manifestCheck.data.version}`);
}

const files = [];
function visit(directory, relative = '') {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(absolute, name);
    else if (entry.isFile()) {
      const contents = fs.readFileSync(absolute);
      files.push({ path: name, byteLength: contents.length, sha256: crypto.createHash('sha256').update(contents).digest('hex'), kind: 'file' });
    } else {
      throw new Error(`unexpected filesystem entry: ${name}`);
    }
  }
}
visit(packageDirectory);
const manifestInPackage = JSON.parse(fs.readFileSync(path.join(packageDirectory, 'serpent-plugin.json'), 'utf8'));
const packagedManifestBytes = fs.readFileSync(path.join(packageDirectory, 'serpent-plugin.json'));
const validation = validatePluginPackageSnapshot({
  manifest: manifestInPackage,
  manifestSha256: crypto.createHash('sha256').update(packagedManifestBytes).digest('hex'),
  source: { kind: 'local-package', fingerprint: 'local-validation' },
  archiveByteLength: 0,
  files,
}, defaultPluginPackageLimits);
console.log(`package files: ${files.length}`);
if (!validation.ok) {
  console.error(`package invalid: ${validation.code}: ${validation.message}`);
  process.exitCode = 1;
} else {
  console.log(`package valid: ${validation.manifest.id}@${validation.manifest.version}`);
}

// Exercise the real archive installation path in a separate test profile.
async function verifyArchiveInstallation() {
  const assert = require('node:assert/strict');
  assert.equal(manifestCheck.success, true, 'Source manifest must pass validation');
  assert.equal(validation.ok, true, 'Staged package must pass validation');
  const invalidRegression = structuredClone(manifest);
  invalidRegression.contributes.settings[0].id = 'modelDir';
  assert.equal(pluginManifestSchema.safeParse(invalidRegression).success, false,
    'Regression: uppercase setting IDs must still be rejected by the host');

  const { PluginPackageManager } = require(path.join(serpentRoot, 'src/main/plugin-package-manager.ts'));
  const archivePath = path.join(pluginRoot, 'dist', `serpent-plugin-wd14tagger-${manifest.version}.zip`);
  const archive = fs.readFileSync(archivePath);
  // Keep verification files outside the plugin so module resolution cannot
  // silently fall back to the developer node_modules directory.
  const testDirectory = fs.mkdtempSync(path.join(path.dirname(pluginRoot), '.wd14-install-check-'));
  console.log('verification profile:', testDirectory);
  const manager = new PluginPackageManager({
    userDataDirectory: testDirectory,
    deviceId: 'wd14-install-check',
    serpentVersion: '0.3.8',
    pluginApiVersion: 1,
    platform: 'win32',
    arch: 'x64',
    nodeAbi: Number(process.versions.modules),
  });
  const installed = await manager.installFromArchive({
    archive,
    scope: 'user',
    source: { kind: 'local-package', fingerprint: 'wd14-install-check' },
  });
  assert.equal(installed.package.manifest.version, manifest.version);
  const statuses = await manager.listInstalled({ scope: 'user', integrity: 'verify' });
  assert.equal(statuses.length, 1);
  assert.equal(statuses[0].status, 'valid');
  console.log(`archive installation and SHA-256 integrity valid: ${manifest.id}@${manifest.version}`);

  const installedRequire = Module.createRequire(path.join(installed.packageDirectory, 'entry/main.js'));
  const runtime = installedRequire('./main.js');
  assert.equal(typeof runtime.setup, 'function');
  assert.equal(typeof runtime.dispose, 'function');
  const chineseTags = await runtime.__internals.translateTags(['1girl', 'long_hair', 'pink_footwear', 'night_sky', 'wd14_unknown_tag'], 'chinese');
  assert.equal(chineseTags.length, 5);
  assert.match(chineseTags[0], /[\u3400-\u9fff]/u);
  assert.match(chineseTags[1], /[\u3400-\u9fff]/u);
  assert.equal(chineseTags[2], '粉色鞋类');
  assert.equal(chineseTags[3], '夜空');
  assert.equal(chineseTags[4], 'wd14_unknown_tag');
  console.log('installed Chinese backend and offline dictionary translate tags without developer files');
  for (const dependency of Object.keys(require(path.join(pluginRoot, 'package.json')).dependencies)) {
    const resolved = installedRequire.resolve(dependency);
    assert.ok(resolved.startsWith(`${installed.packageDirectory}${path.sep}`),
      `Runtime dependency must resolve inside installed package: ${dependency}`);
    installedRequire(dependency);
  }
  console.log('installed entry and runtime dependencies load without developer modules');

  const reads = [];
  const commands = new Map();
  const controller = new AbortController();
  const fakeModelDirectory = path.join(testDirectory, 'test-models');
  fs.mkdirSync(fakeModelDirectory);
  fs.writeFileSync(path.join(fakeModelDirectory, 'wd-vit-tagger-v3.onnx'), 'preflight-only');
  fs.writeFileSync(path.join(fakeModelDirectory, 'wd-vit-tagger-v3.csv'), 'tag_id,name,category,count\n1,solo,0,1\n');
  const enqueued = [];
  const cancelled = [];
  assert.equal(manifest.runtime.instanceScope, 'library');
  assert.deepEqual(
    manifest.contributes.commands.map((command) => command.id),
    ['tag-selection', 'tag-folder'],
    'Only tagging commands should be visible to the host',
  );
  assert.deepEqual(manifest.contributes.toolbar, [], 'WD14 should not add standalone toolbar buttons');
  for (const location of ['asset', 'folder', 'workspace']) {
    assert.equal(
      manifest.contributes.menus[location].some((item) => ['tagging-status', 'stop-tagging'].includes(item.command)),
      false,
      `Status/stop commands must be absent from the ${location} menu`,
    );
  }
  await runtime.setup({
    serpent: {
      storage: { get: async (key, options) => {
        reads.push(key);
        return key === 'settings.model-dir' && options.scope === 'library' ? fakeModelDirectory : null;
      } },
      commands: { register: (id, handler) => commands.set(id, handler) },
      jobs: { registerHandler() {}, enqueue: async () => { throw new Error('Unscoped enqueue must not be used'); } },
      forLibrary: (libraryId) => {
        assert.equal(libraryId, 'validation-library');
        return { jobs: {
          enqueue: async (input) => { enqueued.push(input); return { jobId: 'validation-job' }; },
          cancel: async (input) => {
            assert.equal(input.jobId, 'validation-job');
            cancelled.push(input);
            return { jobId: input.jobId, libraryId, status: 'cancelled' };
          },
        } };
      },
      ui: { notify: async () => undefined },
    },
    subscriptions: { add() {} },
    signal: controller.signal,
  });
  await commands.get('tag-selection')({
    targetLibraryId: 'validation-library',
    invocation: { libraryId: 'validation-library', selection: { assetIds: ['validation-asset'] } },
  });
  assert.equal(enqueued.length, 1, 'Selection command must enqueue a library-bound job');
  const taskContext = { targetLibraryId: 'validation-library', invocation: { libraryId: 'validation-library' } };
  const status = await commands.get('tagging-status')(taskContext);
  assert.equal(status[0].status, 'queued');
  assert.equal(status[0].total, 1);
  assert.equal((await commands.get('stop-tagging')(taskContext)).cancelled, 1);
  assert.equal(cancelled.length, 1);
  assert.equal((await commands.get('tagging-status')(taskContext))[0].status, 'cancelled');
  console.log('installed internal progress/status and stop handlers remain covered without visible contributions');
  for (const setting of manifest.contributes.settings) {
    assert.ok(reads.includes(`settings.${setting.id}`), `Setting read must match host mirror: ${setting.id}`);
  }
  await runtime.dispose('package-verification');
  console.log('setting IDs and host storage mirror keys match');
  console.log('verification passed; actual Serpent UI activation/tagging was not exercised');
}
verifyArchiveInstallation().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
