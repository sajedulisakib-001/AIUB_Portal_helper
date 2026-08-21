/**
 * Returns a promise that resolves after a specified delay.
 * @param {number} ms - The number of milliseconds to delay.
 * @returns {Promise<void>} - A promise that resolves after the delay.
 */
async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


/**
 * Gets the URL of the currently active Chrome tab.
 *
 * Returns the URL as a JavaScript URL object, allowing properties
 * such as `href`, `origin`, `hostname`, `pathname`, `search`, and `hash`.
 *
 * @returns {Promise<URL|null>} The current tab URL as a URL object.
 */
async function getCurrentTabUrl() {
    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    if (!tab?.url) {
        return null;
    }

    try {
        return new URL(tab.url);
    } catch (error) {
        return null;
    }
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
