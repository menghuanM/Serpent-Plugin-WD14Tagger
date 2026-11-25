'use strict';
// Copy runtime files into dist/ and optionally zip it.
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const dist = path.join(root, 'dist', 'serpent-plugin-wd14tagger');

// Catch local edits that have not been regenerated before touching the staged package.
const { createHash } = require('node:crypto');
const translationSource = require('./data/source.json');
const dictionary = require('./data/tags-zh-CN.json');
for (const [filename, record] of [
  ['tags-zh-CN.overrides.json', translationSource.localOverrides],
  ['tags-zh-CN.additions.json', translationSource.localAdditions],
]) {
  const bytes = fs.readFileSync(path.join(root, 'data', filename));
  const values = JSON.parse(bytes.toString('utf8'));
  if (!record || record.sha256 !== createHash('sha256').update(bytes).digest('hex')
    || Object.entries(values).some(([key, value]) => !Object.hasOwn(dictionary, key) || dictionary[key] !== value)) {
    throw new Error(`Translation data is stale (${filename}); run node scripts/update-translations.cjs before building.`);
  }
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const f of ['serpent-plugin.json', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) {
  if (fs.existsSync(path.join(root, f))) fs.copyFileSync(path.join(root, f), path.join(dist, f));
}
// Copy the complete production dependency closure, including nested packages.
function copyDir(src, dst, filter, relative = '') {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name === '.bin') continue;
    const s = path.join(src, e.name); const d = path.join(dst, e.name);
    const childRelative = relative ? `${relative}/${e.name}` : e.name;
    const stat = fs.lstatSync(s);
    if (stat.isSymbolicLink()) continue;
    if (filter && !filter(childRelative, stat.isDirectory())) continue;
    if (stat.isDirectory()) copyDir(s, d, filter, childRelative);
    else if (stat.isFile()) fs.copyFileSync(s, d);
  }
}
copyDir(path.join(root, 'entry'), path.join(dist, 'entry'));
copyDir(path.join(root, 'data'), path.join(dist, 'data'));
const copied = new Set();
function copyDependency(name, optional = false) {
  if (copied.has(name)) return;
  const src = path.join(root, 'node_modules', name);
  if (!fs.existsSync(src)) {
    if (optional) return;
    throw new Error(`Missing installed runtime dependency: ${name}`);
  }
  const packageJson = JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf8'));
  copied.add(name);
  if (name === 'onnxruntime-web') {
    const nodeEntry = packageJson.exports?.['.']?.node?.require || packageJson.main;
    if (nodeEntry !== './dist/ort.node.min.js' && nodeEntry !== 'dist/ort.node.min.js') {
      throw new Error(`Unsupported onnxruntime-web Node entry: ${nodeEntry}`);
    }
    const runtimeFiles = new Set([
      'dist/ort.node.min.js',
      'dist/ort-wasm-simd-threaded.mjs',
      'dist/ort-wasm-simd-threaded.wasm',
    ]);
    for (const file of runtimeFiles) {
      if (!fs.existsSync(path.join(src, file))) {
        throw new Error(`Missing onnxruntime-web runtime file: ${file}`);
      }
    }
    copyDir(src, path.join(dist, 'node_modules', name), (relative, isDirectory) =>
      isDirectory ? relative === 'dist' : runtimeFiles.has(relative));
    // Keep CommonJS resolution metadata without exports for omitted browser builds.
    fs.writeFileSync(path.join(dist, 'node_modules', name, 'package.json'), JSON.stringify({
      name: packageJson.name,
      version: packageJson.version,
      license: packageJson.license,
      main: 'dist/ort.node.min.js',
    }, null, 2));
  } else {
    copyDir(src, path.join(dist, 'node_modules', name));
  }
  for (const dep of Object.keys(packageJson.dependencies || {})) copyDependency(dep);
  for (const dep of Object.keys(packageJson.optionalDependencies || {})) copyDependency(dep, true);
}
const runtimeDependencies = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).dependencies;
for (const dependency of Object.keys(runtimeDependencies)) copyDependency(dependency);
// package.json with only runtime deps
fs.writeFileSync(path.join(dist, 'package.json'), JSON.stringify({
  name: 'serpent-plugin-wd14tagger',
  version: JSON.parse(fs.readFileSync(path.join(root, 'serpent-plugin.json'), 'utf8')).version,
  type: 'commonjs',
}, null, 2));

// Create a ZIP whose file entries are relative POSIX paths at the package root.
if (process.argv.includes('--zip')) {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip();
  function addFiles(directory, relative = '') {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const packagePath = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) addFiles(absolute, packagePath);
      else if (entry.isFile()) zip.addFile(packagePath, fs.readFileSync(absolute));
    }
  }
  addFiles(dist);
  const version = JSON.parse(fs.readFileSync(path.join(root, 'serpent-plugin.json'), 'utf8')).version;
  const zipPath = path.join(root, 'dist', `serpent-plugin-wd14tagger-${version}.zip`);
  zip.writeZip(zipPath);
  console.log('zip written:', zipPath);
}
console.log('dist ready:', dist);
