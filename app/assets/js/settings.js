/**
 * Default tools bundled with the extension.
 *
 * If the user has never configured tools before,
 * these tools will be used.
 */
const DEFAULT_TOOLS = ["geogebra"];

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
   * Add new tool
   */
  addToolBtn.addEventListener("click", addNewTool);

  /*
   * Allow Enter key to add a tool.
   */
  toolFolderInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();

      addNewTool();
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
    showToolError("Please enter a tool folder name.");

    return false;
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
    showToolError("Invalid folder name. Use only letters, numbers, _ or -.");

    return false;
  }

  /*
   * Read current tools.
   */
  const result = await chrome.storage.local.get(["tools"]);

  const tools = Array.isArray(result.tools) ? result.tools : [...DEFAULT_TOOLS];

  /*
   * Prevent duplicate tools.
   */
  if (tools.includes(folderName)) {
    showToolError(`"${folderName}" is already in your tools.`);

    return false;
  }

  /*
   * Add new tool.
   */
  tools.push(folderName);

  /*
   * Save tools immediately.
   */
  await chrome.storage.local.set({
    tools: tools,
  });

  /*
   * Clear input.
   */
  input.value = "";

  /*
   * Refresh tool list.
   */
  renderTools(tools);

  return true;
}

/**
 * Shows an error below the tool input.
 */
function showToolError(message) {
  const error = document.getElementById("toolError");

  error.textContent = message;
  error.style.display = "block";
}

/**
 * Loads the current tools from Chrome Storage.
 */
async function loadCurrentTools() {
  const result = await chrome.storage.local.get(["tools"]);

  let tools = result.tools;

  /*
   * If tools do not exist yet,
   * use the default tools.
   */
  if (!Array.isArray(tools)) {
    tools = [...DEFAULT_TOOLS];

    await chrome.storage.local.set({
      tools: tools,
    });
  }

  renderTools(tools);
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

  const toolResult = await chrome.storage.local.get(["tools"]);

  const tools = Array.isArray(toolResult.tools)
    ? toolResult.tools
    : [...DEFAULT_TOOLS];

  const data = {
    autoLogin,

    apiKey,

    showTomorrowsRoutineAt,

    tools,
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

  /*
   * Also keep tools as their own storage key.
   *
   * This makes it easy for the Tools menu to access
   * them without loading the entire settings object.
   */
  await chrome.storage.local.set({
    tools: tools,
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
 * Deletes a tool from the current tool list.
 *
 * Important:
 * DEFAULT_TOOLS is only used when the tools
 * storage key does not exist for the first time.
 *
 * Therefore, deleting "geogebra" is allowed.
 */
async function deleteTool(toolName) {
  try {
    /*
     * Get the current tools.
     */
    const result = await chrome.storage.local.get(["tools"]);

    /*
     * If the key somehow doesn't exist,
     * there is nothing to delete.
     */
    if (!Array.isArray(result.tools)) {
      return;
    }

    /*
     * Remove only the selected tool.
     */
    const tools = result.tools.filter((tool) => tool !== toolName);

    /*
     * Save the updated list.
     *
     * If this becomes [],
     * we intentionally keep [].
     *
     * We DO NOT restore geogebra here.
     */
    await chrome.storage.local.set({
      tools: tools,
    });

    /*
     * Keep settings.tools synchronized.
     */
    const settingsResult = await chrome.storage.local.get(["settings"]);

    if (settingsResult.settings) {
      const settings = settingsResult.settings;

      settings.tools = tools;

      await chrome.storage.local.set({
        settings: settings,
      });
    }

    /*
     * Update the UI immediately.
     */
    renderTools(tools);
  } catch (error) {
    console.error("Failed to delete tool:", error);
  }
}
