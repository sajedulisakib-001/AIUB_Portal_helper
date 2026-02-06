/**
 * Returns a promise that resolves after a specified delay.
 * @param {number} ms - The number of milliseconds to delay.
 * @returns {Promise<void>} - A promise that resolves after the delay.
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    const options = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    };
    return new Intl.DateTimeFormat("en-US", options).format(date);
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
        latestVersion: currentVersion
    };
    try {
        const res = await fetch('https://raw.githubusercontent.com/sajedulsakib001/AIUB_Portal_helper/main/manifest.json');
        const latestVersion = (await res.json()).version;
        result.latestVersion = latestVersion;
        const toNumbers = v => v.split('.').map(n => parseInt(n) || 0);
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
