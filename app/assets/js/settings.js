


/**
 * Initializes and sets up the settings page functionality
 * Handles auto-login toggle, form visibility, save button events, and alert notifications
 * @async
 * @function setupSettingsPage
 * @returns {Promise<void>} Promise that resolves when setup is complete
 */
async function setupSettingsPage() {
    const toggle = document.getElementById("autoLogin");
    const settingsFields = document.getElementById("settingsFields");
    const alertBox = document.getElementById('alertContainer');
    const closeBtn = document.getElementById('btnclose');

    toggle.addEventListener("change", function () {
        if (toggle.checked) {
            settingsFields.classList.add("show");
        } else {
            settingsFields.classList.remove("show");
        }
    });
    const btn = document.getElementById("save-settings");
    btn.addEventListener("click", () => {
        const res = saveSettingsInStorage();
        if (res) {
            alertBox.style.display = 'block';
            setTimeout(() => {
                alertBox.style.display = 'none';
            }, 1000);
        }
    });

    closeBtn.addEventListener('click', () => {
        alertBox.style.display = 'none';
    });
    showSavedSettings();
}

/**
 * Saves user settings to local storage and chrome storage
 * Validates input fields and handles error display for invalid data
 * @function saveSettingsInStorage
 * @returns {boolean} Returns true if settings are saved successfully, false if validation fails
 * @throws {Error} May throw error if storage operations fail
 */
function saveSettingsInStorage() {
    const autoLogin = document.getElementById("autoLogin").checked;
    const apiKey = document.getElementById("apiKey").value;

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;


    if (autoLogin && apiKey === "") {
        document.getElementById("wrongApi").style = "display:block;";
        return false;
    }
    document.getElementById("wrongApi").style = "display:none;";
    const showTomorrowsRoutineAt = getSelectedTimeforT();
    if (showTomorrowsRoutineAt === "error") return false;
    const data = {
        autoLogin,
        apiKey,
        showTomorrowsRoutineAt
    };
    if(username !== "") data.username = username;
    if(password !== "") data.password = password;

    localStorage.setItem("settings", JSON.stringify(data));
    chrome.storage.local.set({ settings: data}, () => {

    });
    return true;
}

/**
 * Displays previously saved settings in the settings form
 * Retrieves settings from localStorage and populates form fields
 * Shows settings fields if auto-login is enabled
 * @function showSavedSettings
 * @returns {void}
 */
function showSavedSettings() {
    const settings = JSON.parse(localStorage.getItem("settings"));
    if (settings !== null) {
        document.getElementById("autoLogin").checked = settings.autoLogin;
        document.getElementById("apiKey").value = settings.apiKey;
        if(settings.username)document.getElementById("username").value = settings.username;
        if(settings.password)document.getElementById("password").value = settings.password;
        showSelectedTimeforT(settings.showTomorrowsRoutineAt);
        if (settings.autoLogin) {
            document.getElementById("settingsFields").classList.add("show");
        }

    }
}

/**
 * Retrieves and validates the selected time values for tomorrow's routine notification
 * Validates that hour, minute, and AM/PM selections are properly set
 * @function getSelectedTimeforT
 * @returns {Object|string} Returns time object with hour, minute, ampm properties if valid, 
 *                          returns "error" string if validation fails
 * @example
 * // Returns: { hour: "09", minute: "30", ampm: "AM" }
 * const time = getSelectedTimeforT();
 */
function getSelectedTimeforT() {
    const hour = document.getElementById("hour").value;
    const minute = document.getElementById("minute").value;
    const ampm = document.getElementById("ampm").value;
    let res = null;
    if ((hour === "Hour" || minute === "Min" || ampm === "AM/PM") &&
        !(hour === "Hour" && minute === "Min" && ampm === "AM/PM")) {
        document.getElementById("wrongtime").style = "display:block;";
        return "error";
    } else {
        document.getElementById("wrongtime").style = "display:none;";
        res = { hour, minute, ampm };
    }
    return res;
}

/**
 * Displays the selected time values in the time picker form elements
 * Populates hour, minute, and AM/PM dropdowns with provided time object
 * @function showSelectedTimeforT
 * @param {Object|null|undefined} time - Time object containing hour, minute, and ampm properties
 * @param {string} time.hour - Hour value to be displayed
 * @param {string} time.minute - Minute value to be displayed  
 * @param {string} time.ampm - AM/PM value to be displayed
 * @returns {void} Returns early if time parameter is null or undefined
 * @example
 * // Display time in form elements
 * showSelectedTimeforT({ hour: "09", minute: "30", ampm: "AM" });
 */
function showSelectedTimeforT(time) {
    if (time === null || time === undefined) return;
    document.getElementById("hour").value = time.hour;
    document.getElementById("minute").value = time.minute;
    document.getElementById("ampm").value = time.ampm;

}