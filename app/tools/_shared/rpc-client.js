/**
 * app/tools/_shared/rpc-client.js
 *
 * Runs INSIDE the sandboxed tool iframe. This is the only thing standing
 * between a tool and the privileged popup — it exposes a single global,
 * `callParent(action, args, timeoutMs)`, and nothing else.
 *
 * This file never touches chrome.* APIs (it can't — the sandboxed iframe
 * has no bindings for them). It is inlined into the tool's srcdoc by the
 * trusted popup (see app/assets/js/tools.js) before the tool's own
 * script.js runs, so every tool can simply call:
 *
 *   const { value } = await callParent("getStorage", { key: "foo" });
 *
 * without knowing or caring how the popup implements it.
 */
(function () {
    const pending = new Map(); // requestId -> { resolve, reject, timeoutId }
    let counter = 0;

    function nextRequestId() {
        counter += 1;
        return `${Date.now()}-${counter}-${Math.random().toString(36).slice(2)}`;
    }

    window.addEventListener("message", (event) => {
        // Only ever accept responses that came from our direct parent window.
        if (event.source !== window.parent) return;

        const message = event.data;
        if (!message || typeof message !== "object") return;
        if (message.type !== "TOOL_RESPONSE") return;
        if (typeof message.requestId !== "string") return;

        const entry = pending.get(message.requestId);
        if (!entry) return; // unknown / already-settled / timed-out request

        clearTimeout(entry.timeoutId);
        pending.delete(message.requestId);

        if (message.success) entry.resolve(message.result);
        else entry.reject(new Error(message.error || "Tool request failed"));
    });

    /**
     * Calls a privileged, parent-registered action and returns its result.
     *
     * @param {string} action - must match one of the parent's registered
     *   TOOL_API actions (e.g. "getStorage", "saveStorage", "openTool").
     * @param {object} [args] - action-specific arguments.
     * @param {number} [timeoutMs=10000] - rejects if the parent never responds.
     * @returns {Promise<*>}
     */
    window.callParent = function callParent(action, args, timeoutMs) {
        const timeout = typeof timeoutMs === "number" ? timeoutMs : 10000;

        return new Promise((resolve, reject) => {
            const requestId = nextRequestId();

            const timeoutId = setTimeout(() => {
                pending.delete(requestId);
                reject(new Error(`callParent("${action}") timed out after ${timeout}ms`));
            }, timeout);

            pending.set(requestId, { resolve, reject, timeoutId });

            window.parent.postMessage(
                { type: "TOOL_REQUEST", requestId, action, args: args ?? null },
                "*"
            );
        });
    };
})();
