import { validateFile } from "./app/assets/js/lib/tools_integrity_checker.js";


let isUpdateFunctionCalled = false;



chrome.runtime.onStartup.addListener(()=>{
  isUpdateFunctionCalled = true;
  updateNotice()
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    validateFile("app/tools/geogebra/script.js");
    if (changeInfo.status !== "complete" || !tab.url) return;
    if (!isUpdateFunctionCalled) updateNotice();
    else isUpdateFunctionCalled=false;
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: [
                "app/assets/js/toInject/autologin.js",
                "app/assets/js/toInject/parseAllData.js",
                "app/assets/js/toInject/parseExamSchedule.js",
                "app/assets/js/toInject/autoupdate.js",
            ],
        });
    } catch (error) {
        console.log("Failed to inject scripts:", error);
    }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.data_notice) return;

    updateBadge(changes.data_notice.newValue?.new_count ?? 0);
});

/**
 * Synchronizes the locally cached notices with the latest data available
 * from the remote API.
 *
 * The function:
 * - Uses the cached data when the configured refresh interval has not expired.
 * - Fetches new notice data after the cache expires.
 * - Preserves locally stored notice properties (such as `viewed`).
 * - Prepends newly published notices and removes the oldest notices to keep
 *   the cache limited to the latest ten entries.
 * - Updates the stored metadata including `last_id`, `last_update`,
 *   `next_parse`, and `new_count`.
 *
 * @returns {Promise<void>}
 */
async function updateNotice() {
    const { data_notice } = await chrome.storage.local.get("data_notice");

    let newCount = data_notice?.new_count || 0;

    if (data_notice) {
        const nextParseDate = new Date(data_notice.next_parse);
        if (!isNaN(nextParseDate.getTime())) {
            nextParseDate.setMinutes(nextParseDate.getMinutes() + 10);

            if (new Date() <= nextParseDate) {
                updateBadge(newCount);
                return;
            }
        }
    }

    const data = await fetchNotices();

    if (!data) {
        updateBadge(newCount);
        return;
    }

    if (data_notice) {
        const storedNewCount = data_notice.new_count || 0;
        const diff = Math.max(0, data.last_id - data_notice.last_id);

        newCount = Math.min(diff + storedNewCount, 10);

        if (newCount > 0) {
            data_notice.notice.splice(10 - newCount, 10);
            data_notice.notice.unshift(...data.notice.slice(0, newCount));
        }

        data_notice.last_update = data.last_update;
        data_notice.next_parse = data.next_parse;
        data_notice.last_id = data.last_id;
        data_notice.new_count = newCount;

        await chrome.storage.local.set({ data_notice });
    } else {
        data.new_count = 10;
        await chrome.storage.local.set({ data_notice: data });
    }

    updateBadge(newCount);
}

/**
 * Fetches the latest notice data from the remote API.
 *
 * @returns {Promise<Object|null>}
 * Resolves with the notice payload when the request succeeds, otherwise
 * resolves with `null` if the request fails or the response cannot be parsed.
 */
async function fetchNotices() {
    const API_URL = "https://24562381.wasmer.app/?action=get";

    try {
        const response = await fetch(API_URL, {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Failed to fetch notices:", error);
        return null;
    }
}

/**
 * Updates the extension action badge with the current number of unread notices.
 *
 * A value greater than zero is displayed as badge text. Otherwise, the badge
 * text is cleared. The badge background color is always set to red.
 *
 * @param {number} count - Number of unread notices.
 */
function updateBadge(count) {
    chrome.action.setBadgeText({
        text: count > 0 ? String(count) : "",
    });

    chrome.action.setBadgeBackgroundColor({
        color: "#d93025",
    });
}


async function colorPicker() {
    try {
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        if (!tab?.id) {
            console.error("No active tab found.");
            return;
        }

        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: async () => {
                // Shared notification helper so success/error/unsupported
                // states all give the user visible feedback instead of
                // silently doing nothing.
                function showNotification(text, isError) {
                    const notification = document.createElement("div");
                    notification.textContent = text;

                    Object.assign(notification.style, {
                        position: "fixed",
                        top: "20px",
                        right: "20px",
                        zIndex: "2147483647",
                        padding: "10px 16px",
                        background: isError ? "#b91c1c" : "#222",
                        color: "#fff",
                        borderRadius: "8px",
                        fontFamily: "Arial, sans-serif",
                        fontSize: "14px",
                        boxShadow: "0 4px 15px rgba(0,0,0,.3)"
                    });

                    document.documentElement.appendChild(notification);
                    setTimeout(() => notification.remove(), isError ? 2500 : 1500);
                }

                if (!window.EyeDropper) {
                    showNotification(
                        "Color picker isn't supported in this browser.",
                        true
                    );
                    return;
                }

                try {
                    const eyeDropper = new EyeDropper();
                    const result = await eyeDropper.open();
                    const color = result.sRGBHex;

                    try {
                        await navigator.clipboard.writeText(color);
                        showNotification(`Color Value: ${color} copied!`, false);
                    } catch (clipboardError) {
                        showNotification(
                            `Picked ${color}, but couldn't copy it automatically.`,
                            true
                        );
                    }
                } catch (error) {
                    // AbortError = user pressed Escape / clicked away to
                    // cancel -- that's expected, stay silent.
                    if (error && error.name === "AbortError") {
                        return;
                    }

                    // Anything else (e.g. the shortcut didn't carry a
                    // strong enough user gesture) is a real failure --
                    // surface it instead of swallowing it, and point the
                    // user at the reliable fallback.
                    showNotification(
                        "Color picker shortcut failed to start. Open the extension popup and use \"Pick Color from Screen\" instead.",
                        true
                    );
                }
            }
        });
    } catch (error) {
        console.error("Color picker failed:", error);
    }
}

chrome.commands.onCommand.addListener((command) => {
    if (command === "pick_color") {
        colorPicker();
    }
});
