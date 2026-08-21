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
  let msg = message;
  if (message === "VERROR") {
    msg = `
      Adding New tool Faild! Due to Velaidation Error!
      <span class="info-icon text-info">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                  fill="#fd350d"
                >
                  <path
                    transform="scale(0.03125)"
                    d="M356.004,61.156c-81.37-81.47-213.377-81.551-294.848-0.182c-81.47,81.371-81.552,213.379-0.181,294.85 
    c81.369,81.47,213.378,81.551,294.849,0.181C437.293,274.636,437.375,142.626,356.004,61.156z M237.6,340.786 
    c0,3.217-2.607,5.822-5.822,5.822h-46.576c-3.215,0-5.822-2.605-5.822-5.822V167.885c0-3.217,2.607-5.822,5.822-5.822h46.576 
    c3.215,0,5.822,2.604,5.822,5.822V340.786z M208.49,137.901c-18.618,0-33.766-15.146-33.766-33.765 
    c0-18.617,15.147-33.766,33.766-33.766c18.619,0,33.766,15.148,33.766,33.766C242.256,122.755,227.107,137.901,208.49,137.901z"
                  />
                </svg>

                <span class="tooltip-text">
                  <p id="read-v-error">
                    <u>Click here</u>
                  </p>
                  to read About Validation errors!
                </span>
              </span>
      
      `;
  }

  const error = document.getElementById("toolError");

  error.textContent = msg;
  error.style.display = "block";
  if (message === "VERROR") {
    document.getElementById("read-v-error").addEventListener("click", () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL("app/pages/other/validationError.html"),
      });
    });
  }
}

/**
 * Loads the current tools from Chrome Storage.
 * Adds any missing default tools and then renders all tools.
 */
async function loadCurrentTools() {
  let tools = await getAllToolPaths();

  // Find default tools that are not currently stored.
  const missingTools = DEFAULT_TOOLS.filter((tool) => !tools.includes(tool));

  // Add missing default tools.
  if (missingTools.length > 0) {
    const isStored = await Promise.all(
      missingTools.map((tool) => storeMetadataInStorage(tool)),
    );
    if (isStored) {
      // Get the updated tool list.
      tools = await getAllToolPaths();
    } else {
      showToolError("VERROR");
    }
  }

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

// `tool` is the actual folder name and the tool nickname.
async function storeMetadataInStorage(tool) {
  const { ["tools-metadata"]: oldData = [] } =
    await chrome.storage.local.get("tools-metadata");

  const fetchData = async (tool) => {
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
  };

  const newTool = await fetchData(tool);

  if (!newTool) {
    return false;
  }

  // Validate metadata and tool files.
  const isValidTool = await validateAllFiles(newTool, tool);

  if (!isValidTool) {
    return false;
  }

  // Prevent the same tool folder from being added twice.
  if (Array.isArray(oldData) && oldData.some((item) => item.path === tool)) {
    return false;
  }

  await chrome.storage.local.set({
    "tools-metadata": [...(Array.isArray(oldData) ? oldData : []), newTool],
  });

  return true;
}

async function validateAllFiles(metadata, path) {
  if (!metadata || typeof metadata !== "object") {
    return false;
  }

  if (!path || typeof path !== "string") {
    return false;
  }

  const base = `app/tools/${path}`;
  const actions = metadata.actions || {};

  // Test whether a file exists and optionally return its content.
  const test = async (filePath) => {
    try {
      const response = await fetch(chrome.runtime.getURL(filePath));

      if (!response.ok) {
        return [false, null];
      }

      return [true, await response.text()];
    } catch (error) {
      return [false, null];
    }
  };

  // Detect real <script> tags while ignoring HTML comments.
  const hasScript = (html) => {
    if (typeof html !== "string") {
      return false;
    }

    const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");

    return /<script\b[^>]*>/i.test(withoutComments);
  };

  /*
   * Validate JavaScript action
   */
  if (actions.run) {
    if (!actions.script || typeof actions.script !== "string") {
      return false;
    }

    if (!metadata.entry) {
      return false;
    }

    const scriptPath = `${base}/${actions.script}.js`;

    try {
      const scriptExists = await test(scriptPath);

      if (!scriptExists[0]) {
        return false;
      }

      if (!validateScript(scriptPath)) {
        return false;
      }

      const module = await import(chrome.runtime.getURL(scriptPath));

      // Make sure tool() exists.
      if (typeof module.tool !== "function") {
        return false;
      }
    } catch (error) {
      console.error(`Failed to load tool script: ${scriptPath}`, error);

      return false;
    }
  }

  /*
   * Validate entry HTML
   */
  if (metadata.entry) {
    if (typeof metadata.entry !== "string") {
      return false;
    }

    const htmlPath = `${base}/${metadata.entry}.html`;
    const data = await test(htmlPath);

    if (!data[0]) {
      return false;
    }

    // Tool HTML must not contain executable script tags.
    if (hasScript(data[1])) {
      return false;
    }
  }

  /*
   * Validate CSS action
   */
  if (actions.css) {
    if (typeof actions.css !== "string") {
      return false;
    }

    const cssPath = `${base}/${actions.css}.css`;
    const cssExists = await test(cssPath);

    if (!cssExists[0]) {
      return false;
    }
  }

  return true;
}
