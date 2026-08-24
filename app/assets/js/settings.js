/**
 * Default tools bundled with the extension.
 *
 * If the user has never configured tools before,
 * these tools will be used.
 */
import { defaultTools } from "./lib/lib.js";
import { storeMetadataInStorage } from "./lib/tool_setup.js";

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
export async function setupSettingsPage() {
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
    const isDefault = DEFAULT_TOOLS.includes(tool);
    deleteButton.disabled = isDefault;
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";

    deleteButton.style.cssText = `
            border: none;
            background: transparent;
            color: ${isDefault?"#281313":"#dc3545"};
            font-size: 12px;
            font-weight: 500;
            padding: 4px 7px;
            margin-left: 8px;
            border-radius: 5px;
            cursor: ${isDefault?"not-allowed":"pointer"};
            flex-shrink: 0;
        `;

    deleteButton.addEventListener("mouseenter", () => {
      deleteButton.style.backgroundColor = "#fff0f1";
    });

    deleteButton.addEventListener("mouseleave", () => {
      deleteButton.style.backgroundColor = "transparent";
    });

    deleteButton.addEventListener("click", async () => {
      if(DEFAULT_TOOLS.includes(tool)) return;
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



