'use strict';

// Maintainer-only import. Runtime translation reads the generated JSON offline.
// Change REVISION and the source hashes deliberately when adopting a new snapshot.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { normalizeTag } = require('../entry/translator-zh');

const REPOSITORY = 'amenorira/danbooru-tags-data-zh';
const REVISION = '8e73f3b1c15b30f873c11a8c65d2d8264cdf0224';
const LICENSE_SHA256 = 'd9db28b2e55ae4694f7ec9b38c3849cc604366a97470d347e7ef7d4e9e73e940';
const SOURCES = [
  { path: 'tags/general.csv', category: '0', sha256: '4df46d24d61ee32b96d9aa79ae390b0c35bdd99ce15d591b617dc949e92c4240' },
  { path: 'tags/character.csv', category: '4', sha256: 'f77948b3d882641a65af37305f5a052257f841e259d7cc95c22163daa0146fe3' },
];
const dataDirectory = path.resolve(__dirname, '../data');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Handles quoted commas, escaped quotes and newlines in upstream notes.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  const endRow = () => {
    row.push(value);
    if (row.some((column) => column.length > 0)) rows.push(row);
    row = [];
    value = '';
  };
  text = text.replace(/^\uFEFF/u, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (quoted) value += char;
    else if (char === ',') { row.push(value); value = ''; }
    else if (char === '\r' || char === '\n') {
      endRow();
      if (char === '\r' && text[i + 1] === '\n') i++;
    } else value += char;
  }
  if (quoted) throw new Error('Unclosed quote in upstream CSV');
  if (value.length > 0 || row.length > 0) endRow();
  return rows;
}

async function readSource(relative, sourceDirectory) {
  let bytes;
  if (sourceDirectory) {
    // The cache contains general.csv and character.csv from the pinned revision.
    // Its license is already bundled with the plugin, so no network is required.
    const filename = relative === 'LICENSE'
      ? path.join(dataDirectory, 'LICENSE.danbooru-tags-data-zh.txt')
      : path.join(sourceDirectory, path.basename(relative));
    bytes = fs.readFileSync(filename);
  } else {
    const url = `https://raw.githubusercontent.com/${REPOSITORY}/${REVISION}/${relative}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Could not download ${url}: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  return { text: bytes.toString('utf8'), sha256: sha256(bytes) };
}

function applyLocalTranslations(upstream, overrides, additions) {
  const dictionary = new Map(upstream);
  for (const [kind, values] of [['override', overrides], ['addition', additions]]) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      throw new Error(`Local translation ${kind}s must be an object`);
    }
    for (const [key, value] of Object.entries(values)) {
      if (!key || key !== normalizeTag(key) || /[\u0000-\u001f\u007f]/u.test(key)) {
        throw new Error(`Unnormalized local translation ${kind}: ${key}`);
      }
      if (kind === 'override' && !upstream.has(key)) {
        throw new Error(`Unknown local translation override: ${key}; use tags-zh-CN.additions.json for new keys`);
      }
      if (kind === 'addition' && dictionary.has(key)) {
        throw new Error(`Local translation addition already exists upstream: ${key}; review it as an override`);
      }
      if (typeof value !== 'string' || !value.trim() || value !== value.trim()
        || value.length > 255 || /[\u0000-\u001f\u007f]/u.test(value)) {
        throw new Error(`Invalid local translation ${kind}: ${key}`);
      }
      dictionary.set(key, value);
    }
  }
  return dictionary;
}

function parseOptions(argv) {
  const options = { check: false, sourceDirectory: undefined };
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--check') options.check = true;
    else if (argv[index] === '--source-dir' && argv[index + 1] && !argv[index + 1].startsWith('--')) {
      options.sourceDirectory = path.resolve(argv[++index]);
    } else throw new Error('Usage: node scripts/update-translations.cjs [--source-dir <cached-csv-directory>] [--check]');
  }
  return options;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseOptions(argv);
  const downloads = await Promise.all(SOURCES.map((source) => readSource(source.path, options.sourceDirectory)));
  const license = await readSource('LICENSE', options.sourceDirectory);
  if (license.sha256 !== LICENSE_SHA256) throw new Error('Pinned source SHA-256 mismatch: LICENSE');
  if (!license.text.startsWith('MIT License') || !license.text.includes('Copyright (c) 2026 amenorira')) {
    throw new Error('Review upstream license before importing this snapshot');
  }
  const canonical = new Map();
  const aliases = new Map();
  const sources = [];
  for (let index = 0; index < SOURCES.length; index++) {
    const source = SOURCES[index];
    const downloaded = downloads[index];
    if (downloaded.sha256 !== source.sha256) throw new Error(`Pinned source SHA-256 mismatch: ${source.path}`);
    const [header, ...rows] = parseCsv(downloaded.text);
    if (header.join(',') !== 'tag,category,aliases,zh,count,notes' || rows.length < 1000) {
      throw new Error(`Unexpected upstream schema or row count: ${source.path}`);
    }
    for (const row of rows) {
      const [original, category, alternateNames, chinese] = row;
      if (row.length !== 6 || category !== source.category) throw new Error(`Invalid row in ${source.path}`);
      const key = normalizeTag(original);
      const value = chinese.trim();
      if (!key || !value || value.length > 255 || /[\u0000-\u001f\u007f]/u.test(value)) {
        throw new Error(`Invalid tag or translation: ${original}`);
      }
      if (canonical.has(key) && canonical.get(key) !== value) throw new Error(`Conflicting canonical tag: ${key}`);
      canonical.set(key, value);
      for (const alternate of alternateNames.split('|')) {
        // Model tags use English aliases; leave ambiguous short names unmapped.
        if (!/^[\x20-\x7e]+$/.test(alternate)) continue;
        const alias = normalizeTag(alternate);
        if (!alias) continue;
        if (!aliases.has(alias)) aliases.set(alias, new Set());
        aliases.get(alias).add(value);
      }
    }
    sources.push({ path: source.path, sha256: downloaded.sha256, rows: rows.length });
  }
  const upstream = new Map(canonical);
  let aliasCount = 0;
  for (const [alias, values] of aliases) {
    if (!upstream.has(alias) && values.size === 1) {
      upstream.set(alias, [...values][0]);
      aliasCount++;
    }
  }
  const local = (filename) => {
    const bytes = fs.readFileSync(path.join(dataDirectory, filename));
    const values = JSON.parse(bytes.toString('utf8'));
    return { values, metadata: { path: filename, sha256: sha256(bytes), entries: Object.keys(values || {}).length } };
  };
  const overrides = local('tags-zh-CN.overrides.json');
  const additions = local('tags-zh-CN.additions.json');
  const dictionary = applyLocalTranslations(upstream, overrides.values, additions.values);
  const sorted = Object.fromEntries([...dictionary].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
  const metadata = {
    repository: `https://github.com/${REPOSITORY}`,
    revision: REVISION,
    license: 'MIT',
    licenseSha256: license.sha256,
    sources,
    localOverrides: overrides.metadata,
    localAdditions: additions.metadata,
    canonicalTags: canonical.size,
    aliases: aliasCount,
    entries: dictionary.size,
    entriesWithHanCharacters: [...dictionary.values()].filter((value) => /\p{Script=Han}/u.test(value)).length,
  };
  // Validate all inputs before changing or checking any generated files.
  const outputs = [
    ['tags-zh-CN.json', `${JSON.stringify(sorted, null, 2)}\n`],
    ['source.json', `${JSON.stringify(metadata, null, 2)}\n`],
    ['LICENSE.danbooru-tags-data-zh.txt', license.text],
  ];
  for (const [filename, text] of outputs) {
    const destination = path.join(dataDirectory, filename);
    if (options.check) {
      if (fs.readFileSync(destination, 'utf8') !== text) throw new Error(`Generated translation data is stale: ${filename}`);
    } else fs.writeFileSync(destination, text);
  }
  console.log(JSON.stringify(metadata, null, 2));
  if (options.check) console.log('Generated translation data matches all pinned and local inputs.');
}

module.exports = { applyLocalTranslations, parseCsv, main };
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
