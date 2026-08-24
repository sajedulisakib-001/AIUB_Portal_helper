# Creating Your Own Tool

This folder holds every "tool" (mini-app) that shows up in the extension's **Tools** menu. Each tool lives in its own folder here, e.g. `app/tools/geogebra/` or `app/tools/t1/`, and is loaded on demand — its HTML/CSS are injected into the popup and its script is dynamically `import()`-ed when the user opens it.

Use the existing `app/tools/t1/` folder as the simplest working example, and `app/tools/geogebra/` as a more complete real-world example.

---

## 1. Folder structure

A tool is just a folder under `app/tools/<your-tool-name>/`:

```text
app/tools/<your-tool-name>/
├── metadata.json     # Required. Describes the tool and points to its files.
├── index.html        # Required (or whatever name you set as "entry"). The tool's markup.
├── style.css          # Required if you reference a css action. The tool's styling.
├── script.js          # Required if you reference a script action. The tool's logic.
└── other/             # Optional. Anything else your tool needs (help pages, assets, etc.)
```

`<your-tool-name>` becomes the tool's **path** — it's used as the storage namespace, the folder name, and the identifier stored in `tools-metadata`. Keep it short, lowercase, and unique.

---

## 2. `metadata.json`

Every tool needs a `metadata.json` describing itself:

```json
{
    "name": "My Cool Tool",
    "description": "A short description of what this tool does.",
    "version": "1.0.0",
    "author": "Your Name",
    "license": "GPL-3.0",
    "host": "https://example.com/",
    "entry": "index",
    "repository": {
        "type": "git",
        "url": "https://github.com/your-username/"
    },
    "actions": {
        "script": "script",
        "css": "style",
        "run": true
    }
}
```

| Field | Required | Meaning |
|---|---|---|
| `name` | Yes | Display name shown in the Tools menu. |
| `description` | No | Short description of the tool. |
| `version` | No | Your own version number for the tool. |
| `author` | No | Your name / handle. |
| `license` | No | License for the tool's own code. |
| `host` | No | The site this tool is meant to be used on (informational only). |
| `entry` | Required if the tool has UI | Name (without `.html`) of the HTML file to load, e.g. `"index"` → `index.html`. |
| `repository` | No | Where the tool's source lives. |
| `actions.script` | Required if `actions.run` is `true` | Name (without `.js`) of the JS file to load, e.g. `"script"` → `script.js`. |
| `actions.css` | No | Name (without `.css`) of the stylesheet to load, e.g. `"style"` → `style.css`. |
| `actions.run` | No | Set to `true` if this tool has a `script.js` that should run when opened. |

---

## 3. The entry HTML (`index.html`)

- This is just a fragment (not a full `<html>` document) — it gets injected into the popup's tools container along with your CSS.
- **Never put a `<script>` tag in this file.** The loader scans every tool's HTML for real `<script>` tags and refuses to mount the tool if it finds one (`SCRIPT_TAG_IN_HTML`). All logic must live in `script.js` instead.
- Give your elements clear, tool-specific `id`s (the existing tools prefix theirs with `t-`, e.g. `id="t-output"`) so they don't collide with the rest of the popup's DOM.

---

## 4. The script (`script.js`)

Your script must be an ES module that exports a `tool(path)` function — this is the single entry point the extension calls once your HTML/CSS have been mounted:

```js
export function tool(path) {
  // `path` is something like "app/tools/<your-tool-name>/" — useful for
  // building URLs to your own files, e.g. a help page:
  //   chrome.runtime.getURL(`${path}other/help.html`)

  const button = document.getElementById("t-myButton");
  button.addEventListener("click", () => {
    console.log("Hello from my tool!");
  });
}
```

A few things to know about the environment your tool runs in:

- **Shared JS realm, sandboxed storage.** Your tool shares the popup's global `chrome` object, but `chrome.storage.local` is automatically namespaced per-tool while your tool is open (see `app/assets/js/lib/tool_storage_guard.js`). `chrome.storage.local.get(["foo"])` / `.set({ foo: ... })` will only ever see and touch your own tool's data — you don't need to (and can't) read or write another tool's or the extension's own storage (settings, credentials, notices, etc.).
- **Interacting with the active page.** Use `chrome.tabs.query(...)` and `chrome.scripting.executeScript(...)` the same way the `geogebra` tool does if you need to read from or act on the page the user currently has open.
- **No cleanup hook.** There's no `unmount()` call — if you register `chrome.storage.onChanged` listeners, they're automatically torn down for you when the user leaves the tool, but any other listeners/timers you create should be written defensively (e.g. avoid piling up duplicate listeners on repeated interactions).

---

## 5. Registering the tool

New tools aren't picked up automatically just by existing on disk — they need to be added to `tools-metadata` in storage. There are two ways this happens:

1. **Default tools**: folder names listed in `defaultTools()` (`app/assets/js/lib/lib.js`) are loaded automatically the first time the popup runs with no tools in storage.
2. **Manually**: call `storeMetadataInStorage("<your-tool-name>")` (`app/assets/js/lib/tool_setup.js`), which fetches your `metadata.json`, validates every file it references, and — if everything passes — adds it to `tools-metadata` in `chrome.storage.local`.

Either way, the tool won't be added if validation fails (e.g. missing `metadata.json`, missing `entry` HTML, a `<script>` tag inside the HTML, or a missing CSS/JS file).

---

## 6. Script integrity checking

If `actions.run` is `true`, your `script.js` isn't just loaded — it's first hashed (SHA-256) and checked against a remote allowlist service before it's allowed to execute (`app/assets/js/lib/tools_integrity_checker.js`). If the hash isn't recognized, loading the tool fails with `SCRIPT_VALIDATION_FAILED`, even though the file is otherwise perfectly valid.

**This means a brand-new or edited `script.js` will not run until its hash has been added to that integrity server.**

> ⚠️ **Once your tool's files are finished, please ask the person maintaining the integrity server to register your new `script.js`'s hash before you try to load the tool** — otherwise the tools menu will show a validation failure for it.

---

## 7. Checklist for a new tool

- [ ] Created `app/tools/<your-tool-name>/` with a unique, lowercase name.
- [ ] Added `metadata.json` with at least `name`, `entry` (if it has UI), and `actions` (if it has a script/css).
- [ ] Added the entry HTML — no `<script>` tags inside it.
- [ ] Added `style.css` if referenced in `actions.css`.
- [ ] Added `script.js` exporting `tool(path)` if referenced in `actions.script`/`actions.run`.
- [ ] Registered the tool (added to `defaultTools()` or called `storeMetadataInStorage`).
- [ ] Requested that the new `script.js` hash be added to the integrity server.
