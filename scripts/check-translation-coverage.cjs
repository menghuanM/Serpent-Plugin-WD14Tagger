'use strict';

// Compare model vocabularies with the exact dictionary shipped at runtime.
// No ONNX model, inference, network, or library access is needed.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { normalizeTag } = require('../entry/translator-zh');
const { loadSelectedTags } = require('../entry/main.js').__internals;

function analyzeTags(entries, dictionary) {
  const tags = entries.filter((tag) => tag.category === 0 || tag.category === 4);
  const missing = [];
  const unchanged = [];
  const withoutHan = [];
  let withHan = 0;
  for (const tag of tags) {
    const key = normalizeTag(tag.name);
    if (!Object.hasOwn(dictionary, key)) {
      missing.push(tag);
      continue;
    }
    const translation = dictionary[key];
    if (translation === tag.name) unchanged.push(tag);
    if (/\p{Script=Han}/u.test(translation)) withHan++;
    else withoutHan.push({ ...tag, translation });
  }
  const mapped = tags.length - missing.length;
  return {
    tags: tags.length,
    generalTags: tags.filter((tag) => tag.category === 0).length,
    characterTags: tags.filter((tag) => tag.category === 4).length,
    mapped,
    missingCount: missing.length,
    mappedPercent: tags.length ? Number((100 * mapped / tags.length).toFixed(2)) : null,
    withHan,
    withHanPercent: tags.length ? Number((100 * withHan / tags.length).toFixed(2)) : null,
    // A deliberate identity translation (brand, emoticon, etc.) is still mapped.
    unchanged,
    withoutHan,
    missing,
  };
}

function checkCoverage(modelDirectory) {
  const dictionary = require('../data/tags-zh-CN.json');
  const directory = path.resolve(modelDirectory);
  const files = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.csv'))
    .map((entry) => entry.name).sort();
  if (!files.length) throw new Error(`No model CSV files found: ${directory}`);
  const models = files.map((file) => {
    const filename = path.join(directory, file);
    return {
      file,
      sha256: createHash('sha256').update(fs.readFileSync(filename)).digest('hex'),
      ...analyzeTags(loadSelectedTags(filename), dictionary),
    };
  });
  const missing = new Map();
  for (const model of models) {
    for (const tag of model.missing) {
      const key = normalizeTag(tag.name);
      if (!missing.has(key)) missing.set(key, { name: key, category: tag.category, models: [] });
      missing.get(key).models.push(model.file);
    }
  }
  return {
    pluginVersion: require('../package.json').version,
    modelDirectory: directory,
    dictionaryEntries: Object.keys(dictionary).length,
    modelFiles: models.length,
    uniqueMissingCount: missing.size,
    // Key coverage and the fraction containing Chinese characters are different.
    // Neither metric establishes semantic translation accuracy.
    models,
    missing: [...missing.values()].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  };
}

function main(argv = process.argv.slice(2)) {
  let directory;
  let reportPath;
  let strict = false;
  const usage = 'Usage: node scripts/check-translation-coverage.cjs --model-dir <models> [--report <report.json>] [--strict]';
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--strict') strict = true;
    else if (argument === '--help') { console.log(usage); return; }
    else if (['--model-dir', '--report'].includes(argument) && argv[index + 1] && !argv[index + 1].startsWith('--')) {
      const value = argv[++index];
      if (argument === '--model-dir') directory = value;
      else reportPath = path.resolve(value);
    } else throw new Error(usage);
  }
  if (!directory) throw new Error(usage);
  const report = checkCoverage(directory);
  if (reportPath) fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  for (const model of report.models) {
    console.log(`${model.file}: ${model.mapped}/${model.tags} mapped (${model.mappedPercent}%), ${model.missingCount} missing; ${model.withHan} contain Chinese characters`);
  }
  console.log(`Unique missing tags: ${report.uniqueMissingCount}`);
  for (const tag of report.missing) console.log(`  [${tag.category === 0 ? 'general' : 'character'}] ${tag.name}`);
  if (reportPath) console.log(`Full coverage report: ${reportPath}`);
  if (strict && report.uniqueMissingCount) process.exitCode = 1;
  return report;
}

module.exports = { analyzeTags, checkCoverage, main };
if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
