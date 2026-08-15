/**
 * dataStore.js
 * ------------------------------------------------------------------
 * Namespaced wrapper around chrome.storage.local.
 *
 * TRUSTED CONTEXTS ONLY. This file is loaded by the popup pages and
 * by background.js - both run inside the extension's own privileged
 * process, never inside a web page, so they are allowed direct,
 * unrestricted access to every namespace.
 *
 * Content scripts injected into a website must NEVER load this file.
 * They must go through secureStorageClient.js -> background.js's
 * message gateway instead, which enforces the per-site restrictions
 * defined in siteConfig.js.
 *
 * Every key belonging to a given site is stored under a prefixed top
 * level key: `site__<namespace>__<key>`. Prefixing (rather than one
 * big nested object) avoids read-modify-write races between
 * concurrent writers and lets the background gateway validate a
 * request by simple string prefix matching.
 */

const SITE_STORAGE_PREFIX = "site__";

function _nsKey(namespace, key) {
  return `${SITE_STORAGE_PREFIX}${namespace}__${key}`;
}

/**
 * Reads one or more keys from a site's namespace.
 * @param {string} namespace
 * @param {string|string[]} keys
 * @returns {Promise<Object>} plain object keyed by the ORIGINAL (unprefixed) key names
 */
async function nsGet(namespace, keys) {
  const keyList = Array.isArray(keys) ? keys : [keys];
  const prefixed = keyList.map((k) => _nsKey(namespace, k));
  const result = await chrome.storage.local.get(prefixed);
  const out = {};
  keyList.forEach((k, i) => {
    out[k] = result[prefixed[i]];
  });
  return out;
}

/**
 * Writes one or more keys into a site's namespace.
 * @param {string} namespace
 * @param {Object} obj - plain object of unprefixed key -> value
 */
async function nsSet(namespace, obj) {
  const toSet = {};
  for (const [k, v] of Object.entries(obj)) {
    toSet[_nsKey(namespace, k)] = v;
  }
  return chrome.storage.local.set(toSet);
}

/**
 * Removes one or more keys from a site's namespace.
 * @param {string} namespace
 * @param {string|string[]} keys
 */
async function nsRemove(namespace, keys) {
  const keyList = Array.isArray(keys) ? keys : [keys];
  return chrome.storage.local.remove(keyList.map((k) => _nsKey(namespace, k)));
}

if (typeof self !== "undefined") {
  self.nsGet = nsGet;
  self.nsSet = nsSet;
  self.nsRemove = nsRemove;
  self.SITE_STORAGE_PREFIX = SITE_STORAGE_PREFIX;
}
