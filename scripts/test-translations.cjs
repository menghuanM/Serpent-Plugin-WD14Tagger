'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { applyLocalTranslations } = require('./update-translations.cjs');
const { analyzeTags } = require('./check-translation-coverage.cjs');
const { normalizeTag, translate } = require('../entry/translator-zh');

test('model vocabulary additions translate missing tags with the runtime normalization rules', () => {
  const input = ['pink_footwear', 'night_sky', ' PINK FOOTWEAR ', 'Night Sky', 'wd14_unknown_(character)'];
  assert.deepEqual(translate(input), ['粉色鞋类', '夜空', '粉色鞋类', '夜空', input[4]]);
  assert.deepEqual(input, ['pink_footwear', 'night_sky', ' PINK FOOTWEAR ', 'Night Sky', 'wd14_unknown_(character)']);
});

test('clothed and through-clothing labels retain distinct meanings', () => {
  assert.deepEqual(translate(['clothed_masturbation', 'masturbation_through_clothes', 'masturbation_under_clothes']), [
    '穿着衣物自慰', '隔着衣服自慰', '衣服内自慰',
  ]);
});

test('legacy character and group names retain their verified franchise meanings', () => {
  assert.deepEqual(translate(['bardiche', 'kooh', 'team_9', 'robin_(fire_emblem)']), [
    '雷光战斧（魔法少女奈叶）', '库（魔法飞球）', '⑨队（东方Project）', '鲁弗莱（火焰之纹章）',
  ]);
  // The runtime translator receives names only, without their model categories.
  assert.deepEqual(translate(['p90', 'x']), ['P90', 'x']);
});

test('translation import keeps upstream corrections separate from new model tag additions', () => {
  const upstream = new Map([['long_hair', '旧译文']]);
  const result = applyLocalTranslations(upstream, { long_hair: '长发' }, { pink_footwear: '粉色鞋类' });
  assert.equal(result.get('long_hair'), '长发');
  assert.equal(result.get('pink_footwear'), '粉色鞋类');
  assert.deepEqual([...upstream], [['long_hair', '旧译文']]);
  assert.throws(() => applyLocalTranslations(upstream, { night_sky: '夜空' }, {}), /Unknown.*override/);
  assert.throws(() => applyLocalTranslations(upstream, {}, { long_hair: '长发' }), /already exists upstream/);
});

test('translation additions reject malformed keys and invalid values before regeneration', () => {
  const upstream = new Map();
  for (const additions of [null, [], 'text']) {
    assert.throws(() => applyLocalTranslations(upstream, {}, additions), /must be an object/);
  }
  for (const key of ['', 'Pink_Footwear', 'pink footwear', 'night_sky ', '\u0000tag']) {
    assert.throws(() => applyLocalTranslations(upstream, {}, { [key]: '译文' }), /Unnormalized/);
  }
  for (const value of ['', '  ', ' 夜空', '夜空 ', '夜\n空', 123, null, '字'.repeat(256)]) {
    assert.throws(() => applyLocalTranslations(upstream, {}, { night_sky: value }), /Invalid/);
  }
});

test('coverage separates missing keys from deliberate identity translations and ignores ratings', () => {
  const tags = [
    { name: ' PINK FOOTWEAR ', category: 0 },
    { name: 'star_\\(symbol\\)', category: 0 },
    { name: '=3', category: 0 },
    { name: 'unknown_character', category: 4 },
    { name: 'safe', category: 9 },
  ];
  const result = analyzeTags(tags, { pink_footwear: '粉色鞋类', 'star_(symbol)': '星星（符号）', '=3': '=3' });
  assert.equal(result.tags, 4);
  assert.equal(result.generalTags, 3);
  assert.equal(result.characterTags, 1);
  assert.equal(result.mapped, 3);
  assert.equal(result.mappedPercent, 75);
  assert.equal(result.withHan, 2);
  assert.equal(result.withHanPercent, 50);
  assert.deepEqual(result.unchanged, [{ name: '=3', category: 0 }]);
  assert.deepEqual(result.withoutHan, [{ name: '=3', category: 0, translation: '=3' }]);
  assert.deepEqual(result.missing, [{ name: 'unknown_character', category: 4 }]);
});

test('offline translation maintenance verifies license bytes before checking or writing files', async () => {
  const { createRequire } = require('node:module');
  const { runInNewContext } = require('node:vm');
  const filename = path.join(__dirname, 'update-translations.cjs');
  const source = fs.readFileSync(filename, 'utf8');
  const realRequire = createRequire(filename);
  const completeLicense = fs.readFileSync(path.resolve(__dirname, '../data/LICENSE.danbooru-tags-data-zh.txt'));
  const truncatedLicense = Buffer.from('MIT License\n\nCopyright (c) 2026 amenorira\n');
  for (const check of [false, true]) {
    for (const licenseBytes of [completeLicense, truncatedLicense]) {
      let writes = 0;
      let fetches = 0;
      const isolatedModule = { exports: {} };
      const isolatedFs = {
        readFileSync(input) {
          const basename = path.basename(input);
          if (basename === 'LICENSE.danbooru-tags-data-zh.txt') return licenseBytes;
          if (['general.csv', 'character.csv'].includes(basename)) return Buffer.from('invalid CSV fixture');
          throw new Error(`Unexpected maintenance read: ${input}`);
        },
        writeFileSync() { writes++; },
      };
      runInNewContext(source, {
        module: isolatedModule, exports: isolatedModule.exports,
        require: (id) => id === 'node:fs' ? isolatedFs : realRequire(id),
        __dirname, Buffer, AbortSignal, console, process: { argv: [] },
        fetch() { fetches++; throw new Error('Offline maintenance must not fetch'); },
      }, { filename });
      // A complete license reaches CSV validation; truncation must fail earlier.
      const rejectedSource = licenseBytes === completeLicense ? 'tags/general.csv' : 'LICENSE';
      await assert.rejects(() => isolatedModule.exports.main([
        '--source-dir', path.join(__dirname, 'offline-cache-fixture'), ...(check ? ['--check'] : []),
      ]), { message: `Pinned source SHA-256 mismatch: ${rejectedSource}` });
      assert.equal(writes, 0);
      assert.equal(fetches, 0);
    }
  }
});

test('generated dictionary retains every local correction and addition with matching source hashes', () => {
  const directory = path.resolve(__dirname, '../data');
  const dictionary = require('../data/tags-zh-CN.json');
  const metadata = require('../data/source.json');
  assert.equal(metadata.licenseSha256, createHash('sha256')
    .update(fs.readFileSync(path.join(directory, 'LICENSE.danbooru-tags-data-zh.txt'))).digest('hex'));
  for (const [file, record] of [
    ['tags-zh-CN.overrides.json', metadata.localOverrides],
    ['tags-zh-CN.additions.json', metadata.localAdditions],
  ]) {
    const bytes = fs.readFileSync(path.join(directory, file));
    const values = JSON.parse(bytes.toString('utf8'));
    assert.equal(record.path, file);
    assert.equal(record.entries, Object.keys(values).length);
    assert.equal(record.sha256, createHash('sha256').update(bytes).digest('hex'));
    for (const [key, value] of Object.entries(values)) assert.equal(dictionary[key], value, key);
  }
  assert.equal(metadata.entries, Object.keys(dictionary).length);
  assert.equal(metadata.entries, metadata.canonicalTags + metadata.aliases + metadata.localAdditions.entries);
  assert.equal(metadata.entriesWithHanCharacters, Object.values(dictionary).filter((value) => /\p{Script=Han}/u.test(value)).length);
  for (const [key, value] of Object.entries(dictionary)) {
    assert.equal(key, normalizeTag(key), key);
    assert.equal(typeof value, 'string', key);
    assert.ok(value.length > 0 && value.length <= 255 && value === value.trim(), key);
    assert.doesNotMatch(value, /[\u0000-\u001f\u007f]/u, key);
  }
});
