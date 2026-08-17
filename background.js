let isUpdateFunctionCalled = false;

chrome.runtime.onStartup.addListener(()=>{
  isUpdateFunctionCalled = true;
  updateNotice()
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete" || !tab.url) return;
    if (!isUpdateFunctionCalled) updateNotice();
    else isUpdateFunctionCalled=false;

    // host_permissions is now "<all_urls>" (needed so individual tools can
    // reach whichever site they target), so this is no longer implicitly
    // blocked by Chrome on non-portal tabs. Guard it explicitly instead —
    // the portal content scripts must never run anywhere else.
    if (!isAiubPortalUrl(tab.url)) return;

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
/**
 * Whether a URL belongs to the AIUB portal.
 * Used to keep automatic content-script injection scoped to the portal only,
 * now that host_permissions covers all hosts.
 *
 * @param {string} url
 * @returns {boolean}
 */
function isAiubPortalUrl(url) {
    try {
        return new URL(url).host === "portal.aiub.edu";
    } catch {
        return false;
    }
}

function updateBadge(count) {
    chrome.action.setBadgeText({
        text: count > 0 ? String(count) : "",
    });

    chrome.action.setBadgeBackgroundColor({
        color: "#d93025",
    });
}