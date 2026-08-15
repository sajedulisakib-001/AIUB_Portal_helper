// Classic (non-module) service worker - importScripts works here.
importScripts("app/assets/js/siteConfig.js", "app/assets/js/lib/dataStore.js");

let isUpdateFunctionCalled = false;

chrome.runtime.onStartup.addListener(() => {
  isUpdateFunctionCalled = true;
  updateNotice();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  if (!isUpdateFunctionCalled) updateNotice();
  else isUpdateFunctionCalled = false;

  const site = resolveSiteFromUrl(tab.url);
  if (!site) return; // Not one of our configured tools - inject nothing.

  try {
    if (site.config.namespace === "aiub") {
      // secureStorageClient MUST be first: every later file in this
      // list relies on the __secureStorage* helpers it defines.
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [
          "app/assets/js/toInject/secureStorageClient.js",
          "app/assets/js/toInject/autologin.js",
          "app/assets/js/toInject/parseAllData.js",
          "app/assets/js/toInject/parseExamSchedule.js",
          "app/assets/js/toInject/autoupdate.js",
        ],
      });
    }
    // Add an `else if (site.config.namespace === "...")` block here
    // for each new tool's own script set.
  } catch (error) {
    console.log("Failed to inject scripts:", error);
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.data_notice) return;

  updateBadge(changes.data_notice.newValue?.new_count ?? 0);
});

/* ============================================================
 * SECURE STORAGE GATEWAY
 * ------------------------------------------------------------
 * This is the ONLY place a content script's storage request is
 * actually fulfilled. It enforces two independent checks before
 * touching chrome.storage.local:
 *
 *   1. Namespace lock-in: the site's namespace is derived from
 *      `sender.tab.url`, which the page/content script cannot
 *      control or spoof. Whatever namespace a malicious message
 *      might try to claim is simply ignored.
 *
 *   2. Key allow-list: even inside its own namespace, a content
 *      script may only read/write the specific key names declared
 *      for that site in siteConfig.js.
 *
 * Requests from the extension's own pages (popup, options) do NOT
 * come through here - they use dataStore.js directly, since that
 * code runs in the extension's own trusted process and was never
 * exposed to a website.
 * ============================================================ */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.__secureStorage) return false;

  (async () => {
    const site = sender.tab && sender.tab.url ? resolveSiteFromUrl(sender.tab.url) : null;

    if (!site) {
      sendResponse({ ok: false, error: "Unrecognized or unauthorized origin" });
      return;
    }

    const { namespace, allowedKeys } = site.config;

    try {
      switch (message.type) {
        case "get": {
          const requested = (Array.isArray(message.keys) ? message.keys : []).filter((k) =>
            allowedKeys.includes(k),
          );
          const data = await nsGet(namespace, requested);
          sendResponse({ ok: true, data });
          break;
        }
        case "set": {
          const incoming = message.data && typeof message.data === "object" ? message.data : {};
          const filtered = {};
          for (const [k, v] of Object.entries(incoming)) {
            if (allowedKeys.includes(k)) filtered[k] = v;
          }
          await nsSet(namespace, filtered);
          sendResponse({ ok: true });
          break;
        }
        case "remove": {
          const requested = (Array.isArray(message.keys) ? message.keys : []).filter((k) =>
            allowedKeys.includes(k),
          );
          await nsRemove(namespace, requested);
          sendResponse({ ok: true });
          break;
        }
        default:
          sendResponse({ ok: false, error: "Unknown storage operation" });
      }
    } catch (error) {
      console.error("Secure storage gateway error:", error);
      sendResponse({ ok: false, error: "Internal error" });
    }
  })();

  return true; // keep the message channel open for the async sendResponse above
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
