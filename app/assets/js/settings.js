/**
 * Default tools bundled with the extension.
 *
 * If the user has never configured tools before,
 * these tools will be used.
 */
const DEFAULT_TOOLS = defaultTools();

/**
 * Initializes and sets up the settings page functionality.
 *
 * Handles:
 * - Auto-login toggle
 * - Settings form
 * - Tool management
 * - Save button
 * - Success alert
 */
async function setupSettingsPage() {
  const toggle = document.getElementById("autoLogin");
  const settingsFields = document.getElementById("settingsFields");

  const alertBox = document.getElementById("alertContainer");
  const closeBtn = document.getElementById("btnclose");

  const addToolBtn = document.getElementById("add-tool");
  const toolFolderInput = document.getElementById("tool-folder");

  /*
   * Auto-login toggle
   */
  toggle.addEventListener("change", function () {
    if (toggle.checked) {
      settingsFields.classList.add("show");
    } else {
      settingsFields.classList.remove("show");
    }
  });

  /*
   * Add new tool.
   *
   * Both the button click and the Enter key go through the same
   * handler so the tool list is always refreshed after a
   * successful add, and the input is cleared either way.
   */
  addToolBtn.addEventListener("click", handleAddToolRequest);

  toolFolderInput.addEventListener("keydown", async function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      await handleAddToolRequest();
    }
  });

  /*
   * Save settings
   */
  const btn = document.getElementById("save-settings");

  btn.addEventListener("click", () => {
    const res = saveSettingsInStorage();

    if (res) {
      alertBox.style.display = "block";

      setTimeout(() => {
        alertBox.style.display = "none";
      }, 1000);
    }
  });

  /*
   * Close success alert
   */
  closeBtn.addEventListener("click", () => {
    alertBox.style.display = "none";
  });

  /*
   * Load saved settings.
   */
  await showSavedSettings();

  /*
   * Load current tools.
   */
  await loadCurrentTools();
}

/**
 * Shared handler for both the "Add" button and pressing Enter
 * in the tool-folder input. Adds the tool and, on success,
 * refreshes the rendered tool list and clears the input.
 */
async function handleAddToolRequest() {
  const result = await addNewTool();

  if (result.success) {
    await loadCurrentTools();

    const input = document.getElementById("tool-folder");
    input.value = "";
  }

  return result;
}

/**
 * Adds a new tool folder.
 *
 * A valid tool folder must:
 *
 * - contain only one folder name
 * - contain letters, numbers, _ or -
 * - not contain spaces
 * - not contain /
 * - not contain \
 * - not contain ..
 */
async function addNewTool() {
  const input = document.getElementById("tool-folder");
  const error = document.getElementById("toolError");

  const folderName = input.value.trim();

  /*
   * Clear previous error.
   */
  error.style.display = "none";
  error.textContent = "";

  /*
   * Empty input.
   */
  if (folderName === "") {
    const result = {
      success: false,
      error: "EMPTY_TOOL_NAME",
      message: "Please enter a tool folder name.",
      tool: folderName,
    };

    showToolError(result);

    return result;
  }

  /*
   * Folder name validation.
   *
   * Allowed:
   * A-Z
   * a-z
   * 0-9
   * _
   * -
   */
  const validFolderName = /^[A-Za-z0-9_-]+$/;

  if (!validFolderName.test(folderName)) {
    const result = {
      success: false,
      error: "INVALID_FOLDER_NAME",
      message: "Invalid folder name. Use only letters, numbers, _ or -.",
      tool: folderName,
    };

    showToolError(result);

    return result;
  }

  /*
   * Store and validate the tool metadata.
   *
   * IMPORTANT:
   * This preserves the existing logic where adding the folder
   * and storing its metadata are separate operations.
   */
  const metadataResult = await storeMetadataInStorage(folderName);

  /*
   * If metadata validation failed, return the actual reason.
   */
  if (!metadataResult.success) {
    showToolError(metadataResult);

    return metadataResult;
  }

  /*
   * Everything succeeded.
   */
  return {
    success: true,
    error: null,
    message: `Tool "${folderName}" was added successfully.`,
    tool: folderName,
    metadata: metadataResult.metadata,
  };
}

/**
 * Shows an error below the tool input.
 */
function showToolError(result) {
  const error = document.getElementById("toolError");

  /*
   * Normal string error.
   */
  if (typeof result === "string") {
    error.textContent = result;
    error.style.display = "block";
    return;
  }

  /*
   * No error.
   */
  if (!result || result.success) {
    error.style.display = "none";
    return;
  }

  /*
   * Display actual validation error.
   */
  error.innerHTML = `
    <strong>Tool Validation Failed</strong><br>
    ${result.message}
    ${result.path ? `<br><small>Path: ${result.path}</small>` : ""}
  `;

  error.style.display = "block";

  console.error("Tool validation failed:", result);
}

/**
 * Loads the current tools from Chrome Storage.
 * Adds any missing default tools and then renders all tools.
 *
 * NOTE: missing default tools are added one at a time (sequentially),
 * not with Promise.all. storeMetadataInStorage() does a
 * read-modify-write on chrome.storage.local, so running several
 * of those concurrently causes a race condition where each write
 * clobbers the previous one and tools silently disappear.
 */
async function loadCurrentTools() {
  let tools = await getAllToolPaths();

  const missingTools = DEFAULT_TOOLS.filter((tool) => !tools.includes(tool));

  for (const tool of missingTools) {
    const result = await storeMetadataInStorage(tool);

    if (!result.success) {
      showToolError(result);
      console.error("Failed to add default tool:", result);
      // Keep going so one bad default tool doesn't block the others.
    }
  }

  // Always re-read from storage so any tools that *did* save
  // successfully show up, even if a different one failed above.
  tools = await getAllToolPaths();

  renderTools(tools);
}

async function getAllToolPaths() {
  const { ["tools-metadata"]: tools = [] } =
    await chrome.storage.local.get("tools-metadata");

  if (!Array.isArray(tools)) {
    return [];
  }

  return tools
    .map((tool) => tool.path)
    .filter((path) => typeof path === "string");
}

/**
 * Displays current tools in the Settings page.
 */
function renderTools(tools) {
  const container = document.getElementById("currentTools");

  container.innerHTML = "";

  if (!Array.isArray(tools) || tools.length === 0) {
    const empty = document.createElement("div");

    empty.textContent = "No tools configured.";

    empty.style.cssText = `
            font-size: 12px;
            color: #6c757d;
            padding: 5px;
        `;

    container.appendChild(empty);

    return;
  }

  tools.forEach((tool) => {
    const item = document.createElement("div");

    item.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 7px 8px 7px 10px;
            margin-bottom: 6px;
            background: #ffffff;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            font-size: 13px;
        `;

    const toolInfo = document.createElement("div");

    toolInfo.style.cssText = `
            display: flex;
            align-items: center;
            min-width: 0;
        `;

    const icon = document.createElement("span");

    icon.textContent = "🧰";

    icon.style.cssText = `
            margin-right: 8px;
            font-size: 13px;
        `;

    const name = document.createElement("span");

    name.textContent = tool;

    name.style.cssText = `
            color: #333;
            font-weight: 500;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        `;

    const deleteButton = document.createElement("button");

    deleteButton.type = "button";
    deleteButton.textContent = "Delete";

    deleteButton.style.cssText = `
            border: none;
            background: transparent;
            color: #dc3545;
            font-size: 12px;
            font-weight: 500;
            padding: 4px 7px;
            margin-left: 8px;
            border-radius: 5px;
            cursor: pointer;
            flex-shrink: 0;
        `;

    deleteButton.addEventListener("mouseenter", () => {
      deleteButton.style.backgroundColor = "#fff0f1";
    });

    deleteButton.addEventListener("mouseleave", () => {
      deleteButton.style.backgroundColor = "transparent";
    });

    deleteButton.addEventListener("click", async () => {
      await deleteTool(tool);
    });

    toolInfo.appendChild(icon);
    toolInfo.appendChild(name);

    item.appendChild(toolInfo);
    item.appendChild(deleteButton);

    container.appendChild(item);
  });
}

/**
 * Removes a tool from chrome.storage.local and refreshes the list.
 *
 * NOTE: this was referenced by the delete button but was not defined
 * anywhere in the original file, so clicking "Delete" would throw a
 * ReferenceError. If you already have a deleteTool() implementation
 * elsewhere in the extension, remove this one to avoid duplication.
 */
async function deleteTool(tool) {
  const { ["tools-metadata"]: existingTools = [] } =
    await chrome.storage.local.get("tools-metadata");

  const remainingTools = (
    Array.isArray(existingTools) ? existingTools : []
  ).filter((item) => item.path !== tool);

  await chrome.storage.local.set({ "tools-metadata": remainingTools });

  await loadCurrentTools();
}

/**
 * Saves user settings.
 *
 * Existing settings are preserved and the tools list
 * is saved together with them.
 */
async function saveSettingsInStorage() {
  const autoLogin = document.getElementById("autoLogin").checked;

  const apiKey = document.getElementById("apiKey").value.trim();

  const username = document.getElementById("username").value;

  const password = document.getElementById("password").value;

  if (autoLogin && apiKey === "") {
    document.getElementById("wrongApi").style = "display:block;";

    return false;
  }

  document.getElementById("wrongApi").style = "display:none;";

  const showTomorrowsRoutineAt = getSelectedTimeforT();

  if (showTomorrowsRoutineAt === "error") {
    return false;
  }

  const data = {
    autoLogin,

    apiKey,

    showTomorrowsRoutineAt,
  };

  if (username !== "") {
    data.username = username;
  }

  if (password !== "") {
    data.password = password;
  }

  await chrome.storage.local.set({
    settings: data,
  });
  return true;
}

/**
 * Displays previously saved settings.
 */
async function showSavedSettings() {
  const result = await chrome.storage.local.get(["settings"]);

  const settings = result.settings || null;

  if (settings !== null) {
    document.getElementById("autoLogin").checked = !!settings.autoLogin;
    if (settings.apiKey) {
      document.getElementById("apiKey").value = settings.apiKey;
    }
    if (settings.username) {
      document.getElementById("username").value = settings.username;
    }
    if (settings.password) {
      document.getElementById("password").value = settings.password;
    }

    showSelectedTimeforT(settings.showTomorrowsRoutineAt);
    if (settings.autoLogin) {
      document.getElementById("settingsFields").classList.add("show");
    }
  }
}

/**
 * Retrieves selected time.
 */
function getSelectedTimeforT() {
  const hour = document.getElementById("hour").value;

  const minute = document.getElementById("minute").value;

  const ampm = document.getElementById("ampm").value;

  let res = null;

  /*
   * Partially selected time is invalid.
   */
  if (
    (hour === "Hour" || minute === "Min" || ampm === "AM/PM") &&
    !(hour === "Hour" && minute === "Min" && ampm === "AM/PM")
  ) {
    document.getElementById("wrongtime").style = "display:block;";

    return "error";
  }

  document.getElementById("wrongtime").style = "display:none;";

  res = {
    hour,
    minute,
    ampm,
  };

  return res;
}

/**
 * Displays saved routine time.
 */
function showSelectedTimeforT(time) {
  if (time === null || time === undefined) {
    return;
  }

  document.getElementById("hour").value = time.hour;

  document.getElementById("minute").value = time.minute;

  document.getElementById("ampm").value = time.ampm;
}

/**
 * Fetches app/tools/{tool}/metadata.json for a tool folder.
 * Returns the parsed metadata (with `path` attached) or null
 * if it could not be loaded.
 */
async function fetchToolMetadata(tool) {
  const path = `app/tools/${tool}/metadata.json`;

  try {
    const response = await fetch(chrome.runtime.getURL(path));

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();

    return {
      ...json,
      path: tool,
    };
  } catch (error) {
    console.error(`Error loading ${path}:`, error);

    return null;
  }
}

// `tool` is the actual folder name and the tool nickname.
async function storeMetadataInStorage(tool) {
  const { ["tools-metadata"]: existingTools = [] } =
    await chrome.storage.local.get("tools-metadata");

  const currentTools = Array.isArray(existingTools) ? existingTools : [];

  /*
   * Check for a duplicate first, before doing any of the more
   * expensive metadata fetching / file validation work below.
   */
  if (currentTools.some((item) => item.path === tool)) {
    return {
      success: false,
      error: "DUPLICATE_METADATA",
      message: `Tool "${tool}" already exists in tools-metadata.`,
      tool,
    };
  }

  const newTool = await fetchToolMetadata(tool);

  /*
   * Metadata file could not be loaded.
   */
  if (!newTool) {
    return {
      success: false,
      error: "METADATA_LOAD_FAILED",
      message: `Could not load metadata.json for tool "${tool}".`,
      tool,
    };
  }

  /*
   * Validate metadata and all referenced tool files.
   */
  const validation = await validateAllFiles(newTool, tool);

  if (!validation.success) {
    return validation;
  }

  /*
   * Save the validated tool metadata.
   *
   * NOTE: this is a read-modify-write against chrome.storage.local.
   * Callers must not invoke storeMetadataInStorage() for multiple
   * tools concurrently (e.g. via Promise.all) or later writes will
   * silently clobber earlier ones. Add tools one at a time instead.
   */
  await chrome.storage.local.set({
    "tools-metadata": [...currentTools, newTool],
  });

  return {
    success: true,
    error: null,
    message: `Tool "${tool}" was successfully stored.`,
    tool,
    metadata: newTool,
  };
}

async function validateAllFiles(metadata, path) {
  /*
   * Validate metadata object.
   */
  if (!metadata || typeof metadata !== "object") {
    return {
      success: false,
      error: "INVALID_METADATA",
      message: "Tool metadata is missing or is not an object.",
      path,
    };
  }

  /*
   * Validate tool path.
   */
  if (!path || typeof path !== "string") {
    return {
      success: false,
      error: "INVALID_TOOL_PATH",
      message: "Tool path is missing or is not a string.",
      path,
    };
  }

  const base = `app/tools/${path}`;
  const actions = metadata.actions || {};

  /*
   * Test whether a file exists and optionally return its content.
   */
  const fileExists = async (filePath) => {
    try {
      const response = await fetch(chrome.runtime.getURL(filePath));

      if (!response.ok) {
        return { exists: false, content: null };
      }

      return { exists: true, content: await response.text() };
    } catch (error) {
      return { exists: false, content: null };
    }
  };

  /*
   * Detect real <script> tags while ignoring HTML comments.
   */
  const hasScript = (html) => {
    if (typeof html !== "string") {
      return false;
    }

    const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");

    return /<script\b[^>]*>/i.test(withoutComments);
  };

  /*
   * ============================================================
   * Validate JavaScript action
   * ============================================================
   */

  if (actions.run) {
    /*
     * actions.script must exist.
     */
    if (!actions.script || typeof actions.script !== "string") {
      return {
        success: false,
        error: "INVALID_SCRIPT_PROPERTY",
        message:
          "actions.run is enabled, but actions.script is missing or is not a string.",
        path,
      };
    }

    /*
     * metadata.entry is required when run action is enabled.
     */
    if (!metadata.entry) {
      return {
        success: false,
        error: "MISSING_ENTRY",
        message: "metadata.entry is required when actions.run is enabled.",
        path,
      };
    }

    const scriptPath = `${base}/${actions.script}.js`;

    try {
      /*
       * Check whether JavaScript file exists.
       */
      const script = await fileExists(scriptPath);

      if (!script.exists) {
        return {
          success: false,
          error: "SCRIPT_NOT_FOUND",
          message: `JavaScript file was not found: ${scriptPath}`,
          path: scriptPath,
        };
      }

      /*
       * Validate JavaScript file integrity (hash check).
       */
      const integrityChecker = await import(
        chrome.runtime.getURL(
          "app/assets/js/lib/tools_integrity_checker.js",
        )
      );

      if (!(await integrityChecker.validateScript(scriptPath))) {
        return {
          success: false,
          error: "SCRIPT_VALIDATION_FAILED",
          message: `JavaScript validation failed for: ${scriptPath}`,
          path: scriptPath,
        };
      }

      /*
       * Import JavaScript module.
       */
      const module = await import(chrome.runtime.getURL(scriptPath));

      /*
       * Make sure tool() exists.
       */
      if (typeof module.tool !== "function") {
        return {
          success: false,
          error: "TOOL_FUNCTION_MISSING",
          message: `The JavaScript module does not export a tool() function: ${scriptPath}`,
          path: scriptPath,
        };
      }
    } catch (error) {
      console.error(`Failed to load tool script: ${scriptPath}`, error);

      return {
        success: false,
        error: "SCRIPT_LOAD_FAILED",
        message: `Failed to load JavaScript file: ${scriptPath}`,
        path: scriptPath,
        details: error.message,
      };
    }
  }

  /*
   * ============================================================
   * Validate entry HTML
   * ============================================================
   */

  if (metadata.entry) {
    /*
     * Entry must be a string.
     */
    if (typeof metadata.entry !== "string") {
      return {
        success: false,
        error: "INVALID_ENTRY",
        message: "metadata.entry must be a string.",
        path,
      };
    }

    const htmlPath = `${base}/${metadata.entry}.html`;

    const entry = await fileExists(htmlPath);

    /*
     * Entry HTML does not exist.
     */
    if (!entry.exists) {
      return {
        success: false,
        error: "ENTRY_HTML_NOT_FOUND",
        message: `Entry HTML file was not found: ${htmlPath}`,
        path: htmlPath,
      };
    }

    /*
     * Tool HTML must not contain executable script tags.
     */
    if (hasScript(entry.content)) {
      return {
        success: false,
        error: "SCRIPT_TAG_IN_HTML",
        message: `Executable <script> tag detected in tool HTML: ${htmlPath}`,
        path: htmlPath,
      };
    }
  }

  /*
   * ============================================================
   * Validate CSS action
   * ============================================================
   */

  if (actions.css) {
    /*
     * CSS value must be a string.
     */
    if (typeof actions.css !== "string") {
      return {
        success: false,
        error: "INVALID_CSS_PROPERTY",
        message: "actions.css must be a string.",
        path,
      };
    }

    const cssPath = `${base}/${actions.css}.css`;

    const css = await fileExists(cssPath);

    /*
     * CSS file does not exist.
     */
    if (!css.exists) {
      return {
        success: false,
        error: "CSS_NOT_FOUND",
        message: `CSS file was not found: ${cssPath}`,
        path: cssPath,
      };
    }
  }

  /*
   * ============================================================
   * Everything passed
   * ============================================================
   */

  return {
    success: true,
    error: null,
    message: "All tool validation checks passed.",
    path,
  };
}