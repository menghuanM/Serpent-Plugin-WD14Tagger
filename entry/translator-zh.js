'use strict';

// Loaded only for Chinese output; inference and translation need no network.
let dictionary;

function normalizeTag(tag) {
  return tag.trim().toLowerCase().replace(/\\([()])/g, '$1').replace(/\s+/g, '_');
}

exports.normalizeTag = normalizeTag;

exports.translate = function translate(tags) {
  if (!dictionary) dictionary = require('../data/tags-zh-CN.json');
  return tags.map((tag) => {
    const key = normalizeTag(tag);
    return Object.hasOwn(dictionary, key) ? dictionary[key] : tag;
  });
};
