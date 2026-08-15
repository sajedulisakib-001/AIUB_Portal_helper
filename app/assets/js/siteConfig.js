/**
 * siteConfig.js
 * ------------------------------------------------------------------
 * SINGLE SOURCE OF TRUTH for every website ("tool") this extension
 * talks to.
 *
 * WHY THIS FILE EXISTS
 * A Chrome extension's chrome.storage.local is one shared bucket for
 * the whole extension - it is NOT automatically split per host. If we
 * inject content scripts into several different websites, ALL of
 * those scripts would technically be able to read/write the same
 * storage bucket unless we actively stop them.
 *
 * This file is the allow-list that the storage gateway in
 * background.js uses to:
 *   1. Recognize which real, physical website a message came from
 *      (derived from `sender.tab.url`, which content scripts cannot
 *      fake).
 *   2. Map that website to its own private data "namespace".
 *   3. Restrict that namespace to a small list of allowed key names.
 *
 * A content script running on site A can therefore NEVER read or
 * write site B's namespace - even if site A's code is malicious or
 * compromised - because the background service worker (which is the
 * only code with unrestricted storage access) enforces the mapping
 * server-side, not the content script itself.
 *
 * HOW TO ADD A NEW TOOL / WEBSITE
 *   1. Add a new entry below, keyed by the site's hostname.
 *   2. Add the same hostname to `host_permissions` in manifest.json.
 *   3. Add a `web_accessible_resources` entry in manifest.json that
 *      exposes ONLY that tool's own toInject scripts/pages to that
 *      hostname (never reuse another tool's resource block).
 *   4. Create `app/pages/<popupPage>.html` and a matching
 *      `app/assets/js/<popupPage>.js` for the popup UI.
 *   5. Any content script you inject into that site that needs to
 *      persist data must use `secureStorageClient.js` helpers
 *      (__secureStorageGet/Set/Remove) - never chrome.storage.local
 *      directly.
 */

const SITE_CONFIG = {
  "portal.aiub.edu": {
    // Internal id used to prefix this site's storage keys.
    namespace: "aiub",
    // Human readable name, shown in the popup when useful.
    label: "AIUB Portal",
    // Popup page (app/pages/<popupPage>.html) shown by default when
    // the active tab belongs to this site.
    defaultPage: "home",
    // Nav bar shown in the popup while this site is active.
    navItems: [
      { page: "home", label: "🏠 Home" },
      { page: "other", label: "📚 Others" },
      { page: "notice", label: "🗒️ Notice" },
      { page: "settings", label: "⚙️ Settings" },
    ],
    // Only these keys can ever be read/written by a content script
    // injected into this site. Anything else is rejected even if the
    // origin check above passes.
    allowedKeys: [
      "routine",
      "currentCourses",
      "completedInfo",
      "unlockedCoursesList",
      "settings",
      "examSchedule",
      "updateUnlocked",
    ],
  },

  // ------------------------------------------------------------------
  // EXAMPLE — copy this block for a new tool and fill in real values.
  // Left disabled (not a real hostname) so it grants no permissions
  // until you rename it and add it to manifest.json.
  // ------------------------------------------------------------------
  // "example-tool.com": {
  //   namespace: "exampleTool",
  //   label: "Example Tool",
  //   defaultPage: "exampleHome",
  //   navItems: [
  //     { page: "exampleHome", label: "🏠 Home" },
  //   ],
  //   allowedKeys: ["someSetting", "someCachedData"],
  // },
};

/**
 * Resolves a SITE_CONFIG entry (plus its hostname) from a URL string.
 * Matches the exact hostname or any subdomain of a configured host.
 * @param {string|undefined|null} url
 * @returns {{hostname: string, config: object}|null}
 */
function resolveSiteFromUrl(url) {
  if (!url) return null;
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }
  for (const [host, config] of Object.entries(SITE_CONFIG)) {
    if (hostname === host || hostname.endsWith("." + host)) {
      return { hostname, config };
    }
  }
  return null;
}

// Expose to both classic-script contexts (popup, background via
// importScripts) - no module system is used on purpose so the same
// file works everywhere without a build step.
if (typeof self !== "undefined") {
  self.SITE_CONFIG = SITE_CONFIG;
  self.resolveSiteFromUrl = resolveSiteFromUrl;
}
