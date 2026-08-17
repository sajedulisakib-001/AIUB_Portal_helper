/**
 * app/assets/js/lib/tool-rpc.js
 *
 * Parent-side ("popup") privileged API layer for sandboxed tool iframes.
 *
 * A tool loaded into an iframe (see app/assets/js/tools.js) can NEVER call
 * chrome.tabs / chrome.scripting / chrome.storage directly — the sandboxed
 * iframe has no such bindings. The only way in is a validated postMessage
 * RPC to this file, and only through the fixed set of actions registered in
 * TOOL_API below. Nothing else is reachable, and nothing is looked up
 * dynamically by name from iframe-supplied strings.
 *
 * Storage isolation:
 * Every tool's chrome.storage.local access is automatically namespaced by
 *   1. toolId   - which tool this is. Bound by the popup when the iframe is
 *                 created (app/assets/js/tools.js), NEVER supplied by the
 *                 iframe itself, so a tool cannot pretend to be another tool.
 *   2. host     - the host of the tab the popup is currently open on, so
 *                 data stays scoped to "the website it was collected for".
 * A tool can only ever read/write keys under its own (toolId, host) bucket.
 */

// ---------------------------------------------------------------------------
// Storage isolation helpers
// ---------------------------------------------------------------------------

const TOOL_STORAGE_PREFIX = "toolStorage";
const MAX_STORAGE_KEY_LENGTH = 200;
const MAX_STORAGE_VALUE_BYTES = 500_000; // 500KB per value, keeps chrome.storage.local healthy

/**
 * Builds the real, isolated chrome.storage.local key for a tool's logical key.
 * toolId and host are both parent-controlled (never iframe-controlled), so
 * this is what actually enforces "a tool can only touch its own data".
 *
 * @param {string} toolId
 * @param {string} host
 * @param {string} key
 * @returns {string}
 */
function _buildStorageKey(toolId, host, key) {
    return `${TOOL_STORAGE_PREFIX}::${toolId}::${host}::${key}`;
}

/**
 * Resolves the "current host" that tool data should be scoped to — i.e. the
 * site the active tab is on. Falls back to a fixed bucket when unavailable.
 *
 * @returns {Promise<string>}
 */
async function _getActiveHost() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) return "unscoped";
        return new URL(tab.url).host || "unscoped";
    } catch {
        return "unscoped";
    }
}

/**
 * Privileged handler: read one value from the calling tool's own storage bucket.
 * @param {{ key: string }} args
 * @param {{ toolId: string }} ctx
 */
async function getStorage(args, ctx) {
    const host = await _getActiveHost();
    const storageKey = _buildStorageKey(ctx.toolId, host, args.key);
    const result = await chrome.storage.local.get([storageKey]);
    return { value: result[storageKey] ?? null };
}

/**
 * Privileged handler: write one value into the calling tool's own storage bucket.
 * @param {{ key: string, value: * }} args
 * @param {{ toolId: string }} ctx
 */
async function saveStorage(args, ctx) {
    const host = await _getActiveHost();
    const storageKey = _buildStorageKey(ctx.toolId, host, args.key);
    await chrome.storage.local.set({ [storageKey]: args.value });
    return { saved: true };
}

/**
 * Privileged handler: remove one value from the calling tool's own storage bucket.
 * @param {{ key: string }} args
 * @param {{ toolId: string }} ctx
 */
async function removeStorage(args, ctx) {
    const host = await _getActiveHost();
    const storageKey = _buildStorageKey(ctx.toolId, host, args.key);
    await chrome.storage.local.remove([storageKey]);
    return { removed: true };
}

/**
 * Privileged handler: list the calling tool's own keys for the current host
 * (returned WITHOUT the internal toolId/host prefix — the tool never sees
 * the real storage key, or anyone else's data).
 * @param {*} _args
 * @param {{ toolId: string }} ctx
 */
async function listStorageKeys(_args, ctx) {
    const host = await _getActiveHost();
    const prefix = _buildStorageKey(ctx.toolId, host, "");
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all)
        .filter((k) => k.startsWith(prefix))
        .map((k) => k.slice(prefix.length));
    return { keys };
}

// ---------------------------------------------------------------------------
// Example privileged action: visit / read the tool's own homepage tab
// ---------------------------------------------------------------------------

/**
 * Privileged handler: opens (or reads) the tool's configured homepage.
 * `ctx.homepage` comes from the tool's own info.json, resolved by the popup
 * when the iframe was created — again, never supplied by the iframe itself.
 * @param {*} _args
 * @param {{ homepage: string|null }} ctx
 */
async function openTool(_args, ctx) {
    if (!ctx.homepage) {
        throw new Error("This tool has no homepage configured.");
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab?.url) {
        throw new Error("Unable to find active tab.");
    }

    const targetHost = new URL(ctx.homepage).host;
    const currentHost = (() => {
        try {
            return new URL(tab.url).host;
        } catch {
            return null;
        }
    })();

    if (currentHost !== targetHost) {
        await chrome.tabs.create({ url: ctx.homepage });
        return { openedNewTab: true, html: null };
    }

    const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.documentElement.outerHTML,
    });

    return { openedNewTab: false, html: results?.[0]?.result ?? null };
}

// ---------------------------------------------------------------------------
// TOOL_API registry — the ONLY actions an iframe may ever invoke.
// Every entry needs both a handler AND an argument validator; there is no
// path that calls a handler without first passing validateArgs.
// ---------------------------------------------------------------------------

const TOOL_API = {
    openTool: {
        handler: openTool,
        validateArgs: (args) =>
            args === undefined || args === null || typeof args === "object",
    },
    getStorage: {
        handler: getStorage,
        validateArgs: (args) =>
            !!args &&
            typeof args.key === "string" &&
            args.key.length > 0 &&
            args.key.length <= MAX_STORAGE_KEY_LENGTH,
    },
    saveStorage: {
        handler: saveStorage,
        validateArgs: (args) => {
            if (!args || typeof args.key !== "string") return false;
            if (args.key.length === 0 || args.key.length > MAX_STORAGE_KEY_LENGTH) return false;
            if (args.value === undefined) return false;
            try {
                return JSON.stringify(args.value).length <= MAX_STORAGE_VALUE_BYTES;
            } catch {
                return false; // non-serializable value
            }
        },
    },
    removeStorage: {
        handler: removeStorage,
        validateArgs: (args) =>
            !!args && typeof args.key === "string" && args.key.length <= MAX_STORAGE_KEY_LENGTH,
    },
    listStorageKeys: {
        handler: listStorageKeys,
        validateArgs: (args) =>
            args === undefined || args === null || typeof args === "object",
    },
};

// ---------------------------------------------------------------------------
// Channel — one is created per mounted tool iframe (see tools.js)
// ---------------------------------------------------------------------------

/**
 * Opens a secure RPC channel bound to exactly one iframe instance.
 *
 * @param {HTMLIFrameElement} iframe - the sandboxed tool iframe. Must already
 *   be attached to the document (so `iframe.contentWindow` exists).
 * @param {{ toolId: string, homepage: string|null }} toolCtx - trusted,
 *   parent-known metadata for this tool. NEVER built from iframe-supplied data.
 * @returns {{ destroy: () => void }}
 */
function createToolChannel(iframe, toolCtx) {
    function onMessage(event) {
        // Rule #1: only ever accept messages that came from THIS iframe's
        // window. This is the actual security boundary — event.origin is
        // not trustworthy here since sandboxed srcdoc iframes report "null".
        if (event.source !== iframe.contentWindow) return;

        const message = event.data;

        // Rule #2: structural validation. Never trust the shape of anything
        // that arrives from the iframe.
        if (!message || typeof message !== "object") return;
        if (message.type !== "TOOL_REQUEST") return;
        if (typeof message.requestId !== "string" || message.requestId.length === 0) return;
        if (typeof message.action !== "string") return;

        handleRequest(message, toolCtx).then((response) => {
            // The iframe may have been torn down while the handler ran.
            if (!iframe.isConnected) return;
            iframe.contentWindow.postMessage(response, "*");
        });
    }

    window.addEventListener("message", onMessage);

    return {
        destroy() {
            window.removeEventListener("message", onMessage);
        },
    };
}

/**
 * Validates the action + args and runs the matching TOOL_API handler.
 * Always resolves (never throws) — every outcome, including failures, is
 * turned into a TOOL_RESPONSE so the iframe's pending Promise is settled.
 *
 * @param {{ requestId: string, action: string, args: * }} message
 * @param {{ toolId: string, homepage: string|null }} toolCtx
 */
async function handleRequest(message, toolCtx) {
    const { requestId, action, args } = message;

    // Rule #3: only explicitly registered actions may run — no
    // window[name](...) style dynamic lookup, no eval, no Function().
    const api = TOOL_API[action];
    if (!api) {
        return { type: "TOOL_RESPONSE", requestId, success: false, error: `Unknown action: ${action}` };
    }

    // Rule #4: validate arguments against that action's own schema before
    // the handler ever sees them.
    if (!api.validateArgs(args)) {
        return {
            type: "TOOL_RESPONSE",
            requestId,
            success: false,
            error: `Invalid arguments for action: ${action}`,
        };
    }

    try {
        const result = await api.handler(args ?? {}, toolCtx);
        return { type: "TOOL_RESPONSE", requestId, success: true, result };
    } catch (err) {
        return { type: "TOOL_RESPONSE", requestId, success: false, error: err?.message || String(err) };
    }
}
