/**
 * secureStorageClient.js
 * ------------------------------------------------------------------
 * MUST be the first file injected into every website's content-script
 * context. Every other injected script that needs to persist data
 * (autologin.js, autoupdate.js, etc.) must use the functions below
 * instead of calling chrome.storage.local directly.
 *
 * A content script CAN technically still call chrome.storage.local
 * itself (it inherits the extension's "storage" permission) - that's
 * exactly the hole this file closes. By convention, every injected
 * script in this project reads/writes data ONLY through
 * __secureStorageGet / __secureStorageSet / __secureStorageRemove,
 * which relay the request to the background service worker.
 *
 * The background worker is the one place that actually decides what
 * this content script is allowed to touch: it looks at which real
 * tab/site the message came from (sender.tab.url - not spoofable by
 * page/content-script code) and only allows access to that site's
 * own namespace and its own allow-listed keys (see siteConfig.js).
 */

function __secureStorageGet(keys) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        __secureStorage: true,
        type: "get",
        keys: Array.isArray(keys) ? keys : [keys],
      },
      (response) => {
        if (chrome.runtime.lastError || !response || !response.ok) {
          resolve({});
          return;
        }
        resolve(response.data || {});
      },
    );
  });
}

function __secureStorageSet(obj) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { __secureStorage: true, type: "set", data: obj },
      (response) => {
        resolve(!!(response && response.ok));
      },
    );
  });
}

function __secureStorageRemove(keys) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        __secureStorage: true,
        type: "remove",
        keys: Array.isArray(keys) ? keys : [keys],
      },
      (response) => {
        resolve(!!(response && response.ok));
      },
    );
  });
}
