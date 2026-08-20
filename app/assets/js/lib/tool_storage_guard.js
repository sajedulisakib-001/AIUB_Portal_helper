/**
 * Tool Storage Guard
 * ------------------
 * Tools (app/tools/<name>/script.js) are dynamically `import()`-ed straight
 * into the popup's own JS realm, so they share the exact same global
 * `chrome` object as the rest of the extension. Left unguarded, a tool's
 * call to `chrome.storage.local.get(...)` can read -- and `.set(...)` can
 * overwrite -- ANY key the extension uses, including `settings` (portal
 * username/password + Gemini API key), `data_notice`, `routine`, `tools`,
 * etc. Any tool the user (or a future contributor) adds effectively has
 * full read/write access to every other tool's data too.
 *
 * This guard temporarily swaps out `chrome.storage.local`'s get/set/
 * remove/clear methods (and `chrome.storage.onChanged`'s listener methods)
 * for the duration a tool is mounted. Every key the tool touches is
 * transparently namespaced under a private, per-tool prefix -- from the
 * tool's point of view nothing changes (`chrome.storage.local.get(["foo"])`
 * still resolves to `{ foo: ... }`), but the real underlying key is
 * `__tool_data__::<toolName>::foo`, invisible to and untouchable by the
 * rest of the extension and by every other tool.
 *
 * Usage (wired in from app/assets/js/tools.js):
 *   activateToolStorage("geogebra");   // right before mounting a tool
 *   ...
 *   deactivateToolStorage();           // when the tool is unmounted
 *
 * This file does not change how tool scripts are imported/loaded -- it
 * only guards the storage surface they can see once running.
 */
(function () {
  "use strict";

  const NAMESPACE_PREFIX = "__tool_data__::";

  // Keep real, unwrapped references so we can always restore them exactly.
  const real = {
    get: chrome.storage.local.get.bind(chrome.storage.local),
    set: chrome.storage.local.set.bind(chrome.storage.local),
    remove: chrome.storage.local.remove.bind(chrome.storage.local),
    clear: chrome.storage.local.clear.bind(chrome.storage.local),
    addListener: chrome.storage.onChanged.addListener.bind(chrome.storage.onChanged),
    removeListener: chrome.storage.onChanged.removeListener.bind(chrome.storage.onChanged),
  };

  let activeTool = null;
  // Tracks onChanged listeners registered while a tool was active, so they
  // can be torn down automatically on deactivate (tools have no cleanup
  // hook of their own).
  let toolChangeListeners = [];

  function nsKey(tool, key) {
    return `${NAMESPACE_PREFIX}${tool}::${key}`;
  }

  // Returns the plain key if `fullKey` belongs to `tool`'s namespace,
  // otherwise null (i.e. "not yours, hide it").
  function stripNs(tool, fullKey) {
    const prefix = nsKey(tool, "");
    return typeof fullKey === "string" && fullKey.startsWith(prefix)
      ? fullKey.slice(prefix.length)
      : null;
  }

  function mapKeysIn(tool, keys) {
    if (typeof keys === "string") return nsKey(tool, keys);
    if (Array.isArray(keys)) return keys.map((k) => nsKey(tool, k));
    if (keys && typeof keys === "object") {
      const mapped = {};
      Object.keys(keys).forEach((k) => {
        mapped[nsKey(tool, k)] = keys[k];
      });
      return mapped;
    }
    return keys;
  }

  function unmapResultOut(tool, result) {
    const out = {};
    Object.keys(result).forEach((fullKey) => {
      const plain = stripNs(tool, fullKey);
      if (plain !== null) out[plain] = result[fullKey];
    });
    return out;
  }

  async function guardedGetAll(tool) {
    const all = await real.get(null);
    return unmapResultOut(tool, all);
  }

  function guardedGet(keysArg, callback) {
    const tool = activeTool;
    if (!tool) return real.get(keysArg, callback);

    const run = async () => {
      if (keysArg === null || keysArg === undefined) {
        return guardedGetAll(tool);
      }

      const mapped = mapKeysIn(tool, keysArg);
      const raw = await real.get(mapped);
      const stripped = unmapResultOut(tool, raw);

      // Honor default values passed via the object form, e.g.
      // get({ foo: "bar" }) should resolve foo -> "bar" if unset.
      if (keysArg && typeof keysArg === "object" && !Array.isArray(keysArg)) {
        Object.keys(keysArg).forEach((k) => {
          if (!(k in stripped)) stripped[k] = keysArg[k];
        });
      }

      return stripped;
    };

    if (typeof callback === "function") {
      run().then(callback);
      return;
    }
    return run();
  }

  function guardedSet(items, callback) {
    const tool = activeTool;
    if (!tool) return real.set(items, callback);
    return real.set(mapKeysIn(tool, items), callback);
  }

  function guardedRemove(keysArg, callback) {
    const tool = activeTool;
    if (!tool) return real.remove(keysArg, callback);
    return real.remove(mapKeysIn(tool, keysArg), callback);
  }

  function guardedClear(callback) {
    // A tool must never be able to wipe the whole extension's storage --
    // only its own namespaced keys.
    const tool = activeTool;
    if (!tool) return real.clear(callback);

    const run = async () => {
      const all = await real.get(null);
      const ownKeys = Object.keys(all).filter((k) => stripNs(tool, k) !== null);
      if (ownKeys.length) await real.remove(ownKeys);
    };

    if (typeof callback === "function") {
      run().then(callback);
      return;
    }
    return run();
  }

  function guardedAddListener(listener) {
    const tool = activeTool;
    if (!tool) return real.addListener(listener);

    // Only forward changes to keys that belong to this tool, and hide the
    // real (prefixed) key name so a tool can't even see that other data
    // exists or changed.
    const wrapped = (changes, areaName) => {
      if (areaName !== "local") return;

      const filtered = {};
      Object.keys(changes).forEach((fullKey) => {
        const plain = stripNs(tool, fullKey);
        if (plain !== null) filtered[plain] = changes[fullKey];
      });

      if (Object.keys(filtered).length) listener(filtered, areaName);
    };

    toolChangeListeners.push({ tool, original: listener, wrapped });
    real.addListener(wrapped);
  }

  function guardedRemoveListener(listener) {
    const tool = activeTool;
    const idx = toolChangeListeners.findIndex(
      (entry) => entry.tool === tool && entry.original === listener,
    );

    if (idx !== -1) {
      real.removeListener(toolChangeListeners[idx].wrapped);
      toolChangeListeners.splice(idx, 1);
      return;
    }

    real.removeListener(listener);
  }

  /**
   * Activates the storage sandbox for `toolName`. From this point on,
   * `chrome.storage.local.get/set/remove/clear` and
   * `chrome.storage.onChanged.addListener/removeListener` are transparently
   * confined to that tool's own private namespace, until
   * `deactivateToolStorage()` is called.
   */
  function activateToolStorage(toolName) {
    if (!toolName) return;

    activeTool = toolName;

    chrome.storage.local.get = guardedGet;
    chrome.storage.local.set = guardedSet;
    chrome.storage.local.remove = guardedRemove;
    chrome.storage.local.clear = guardedClear;
    chrome.storage.onChanged.addListener = guardedAddListener;
    chrome.storage.onChanged.removeListener = guardedRemoveListener;
  }

  /**
   * Restores unrestricted `chrome.storage.local` / `chrome.storage.onChanged`
   * access for the rest of the extension, and cleans up any listeners the
   * tool registered while it was mounted.
   */
  function deactivateToolStorage() {
    toolChangeListeners
      .filter((entry) => entry.tool === activeTool)
      .forEach((entry) => real.removeListener(entry.wrapped));
    toolChangeListeners = toolChangeListeners.filter(
      (entry) => entry.tool !== activeTool,
    );

    activeTool = null;

    chrome.storage.local.get = real.get;
    chrome.storage.local.set = real.set;
    chrome.storage.local.remove = real.remove;
    chrome.storage.local.clear = real.clear;
    chrome.storage.onChanged.addListener = real.addListener;
    chrome.storage.onChanged.removeListener = real.removeListener;
  }

  window.activateToolStorage = activateToolStorage;
  window.deactivateToolStorage = deactivateToolStorage;
})();
