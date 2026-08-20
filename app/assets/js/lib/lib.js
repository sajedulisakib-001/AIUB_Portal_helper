/**
 * Returns a promise that resolves after a specified delay.
 * @param {number} ms - The number of milliseconds to delay.
 * @returns {Promise<void>} - A promise that resolves after the delay.
 */
async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


/**
 * Returns Default tools list.
 * @returns {Array<String>} - Array of the default tools.
 */
function defaultTools() {
  return ["geogebra"];
}

/**
 * Retrieves the current date and time details, including today's and the next day's formatted dates.
 *
 * @returns {Object} An object containing:
 *   - {number} date - The current day of the month.
 *   - {number} hours - The current hour (0-23).
 *   - {number} minutes - The current minute (0-59).
 *   - {string} today - The formatted string of today's date.
 *   - {string} nextDay - The formatted string of the next day's date.
 *   - {number} month - The current month (0-11).
 */
function getDateTime() {
  const T = new Date();
  const date = T.getDate();
  const hours = T.getHours();
  const minutes = T.getMinutes();
  const today = formatDate(T);
  const nextDay = new Date(T);
  nextDay.setDate(T.getDate() + 1);
  const formatedNextDay = formatDate(nextDay);
  const month = T.getMonth();
  return { date, hours, minutes, today, nextDay: formatedNextDay, month };
}

/**
 * Formats a given Date object into a human-readable string with the format:
 * "Weekday, Month Day, Year" (e.g., "Monday, January 1, 2024").
 *
 * @param {Date} date - The Date object to format.
 * @returns {string} The formatted date string in English (US) locale.
 */
function formatDate(date) {
  try {
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return new Intl.DateTimeFormat("en-US", options).format(date);
  } catch (e) {
    console.error("Error formatting date:", e);
    return date.toDateString(); // Fallback to a simpler format
  }
}

/**
 * Checks if a newer version of the Chrome extension is available by comparing
 * the current version from the manifest with the latest version available online.
 *
 * Fetches the latest manifest file from the specified GitHub repository,
 * extracts the version, and compares it to the currently installed version.
 *
 * @async
 * @function
 * @returns {Promise<boolean>} Resolves to true if an update is available, false otherwise.
 * @throws Will log an error and return false if the fetch or comparison fails.
 */
async function isUpdateAvailable() {
  const currentVersion = chrome.runtime.getManifest().version;
  const result = {
    isAvailable: false,
    updateType: "No Update",
    currentVersion,
    latestVersion: currentVersion,
  };
  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/sajedulisakib-001/AIUB_Portal_helper/main/manifest.json",
    );
    const latestVersion = (await res.json()).version;
    result.latestVersion = latestVersion;
    const toNumbers = (v) => v.split(".").map((n) => parseInt(n) || 0);
    const [cMajor, cMinor, cPatch] = toNumbers(currentVersion);
    const [lMajor, lMinor, lPatch] = toNumbers(latestVersion);
    if (lMajor > cMajor) {
      result.updateType = "Major";
      result.isAvailable = true;
    } else if (lMinor > cMinor) {
      result.updateType = "Minor";
      result.isAvailable = true;
    } else if (lPatch > cPatch) {
      result.updateType = "Patch";
      result.isAvailable = true;
    }
  } catch (e) {
    console.error("Error checking for update:", e);
  }
  return result;
}

/**
 * Converts a date string from the format "DD/MON/YYYY" to "YYYY-MM-DD".
 * @param {string} input - The date string to convert.
 * @returns {string} The converted Exam date string.
 */
function convertExamDate(input) {
  const [day, mon, year] = input.split("/");

  const months = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };

  return `${year}-${months[mon]}-${day}`;
}

/**
 * Fetch parsed data from the remote API based on the provided action.
 *
 * @async
 * @param {string} action - The API action parameter used to determine which data to fetch.
 * @returns {Promise<Object|null>} Returns the parsed JSON response on success, or null if the request fails.
 *
 * @example
 * const notices = await fetchParsedData("notices");
 */
async function fetchParsedData(action) {
  const API_URL = `https://24562381.wasmer.app/?action=${action}`;

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
    console.error("Failed to fetch parsed data:", error);
    return null;
  }
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
  if (await deleteToolMetadata(toolName)) {
    renderTools(tools);
  }
}

async function deleteToolMetadata(tool) {
  if (DEFAULT_TOOLS.includes(tool)) return true;
  const { ["tools-metadata"]: oldData = [] } =
    await chrome.storage.local.get("tools-metadata");

  if (!Array.isArray(oldData)) {
    return false;
  }

  const newData = oldData.filter((item) => item.path !== tool);

  // Tool didn't exist
  if (newData.length === oldData.length) {
    return false;
  }

  await chrome.storage.local.set({
    "tools-metadata": newData,
  });

  return true;
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
