/**
 * Initializes the home page by setting the greeting, attaching event listeners,
 * and loading the routine data.
 */
async function setUpHome() {
    setGreeting();
    
    const reloadBtn = document.getElementById("reloadRoutine");
    
    if (reloadBtn) {
        reloadBtn.addEventListener("click", () => reloadHomePage(true));
    }
    reloadHomePage(false);
    const showUpdatePopUp = document.getElementById("showUpdatePopUp");
    showUpdatePopUp.addEventListener("click", () => {
        const popup = document.getElementById("updatePopUpBox");
        popup.classList.add("show");
        setTimeout(() => {
            popup.classList.remove("show");
        }, 10000);
    });
    document.getElementById("reload_extension").addEventListener("click", (e) => {
        chrome.runtime.reload();
    });
    document.getElementById("closePopup").addEventListener("click", () => {
        document.getElementById('updatePopUpBox').classList.remove('show');
    });

    const _isUpdateAvailable = await isUpdateAvailable();
    if(_isUpdateAvailable.isAvailable){
        showUpdatePopUp.style.display = "block";
        document.getElementById("updateType").innerText = _isUpdateAvailable.updateType;
        document.getElementById("version").innerText = _isUpdateAvailable.latestVersion;
    }
    
}

/**
 * Sets a greeting message based on the current time of day.
 */
function setGreeting() {
    const greetingEl = document.getElementById('greeting');
    if (!greetingEl) return;

    const hour = new Date().getHours();
    let greetingText = '👋 Hello!';
    if (hour >= 5 && hour < 12) greetingText = '🌅 Good Morning!';
    else if (hour >= 12 && hour < 17) greetingText = '☀️ Good Afternoon!';
    else if (hour >= 17 && hour < 21) greetingText = '🌇 Good Evening!';
    else greetingText = '🌙 Good Night!';

    greetingEl.textContent = greetingText;
}

/**
 * Loads and displays the routine data. If reload is true, fetches new data from the server.
 * Otherwise, loads from localStorage if available.
 * @param {boolean} reload - Whether to force reload the routine data.
 */
async function reloadHomePage(reload = false) {

    const show = async (data) => {
        await delay(500);
        showRoutine(data);
    }
    if (!reload) {
        let data = JSON.parse(localStorage.getItem("routine"));
        if (data === null || data.length === 0) {
            await delay(500);
            showNoRoutineMessage();
        } else {
            setCurrentDates();
            show(data);
        }
        return;
    }
    localStorage.removeItem("routine");
    localStorage.removeItem("currentCourses");

    data = await getRoutine();
    if (data !== null) {
        show(data.routine);
        setCurrentDates();
        console.log("Routine: ", data.routine);
        localStorage.setItem("routine", JSON.stringify(data.routine));
        localStorage.setItem("currentCourses", JSON.stringify(data.currentCourses));
        

    } else {
        showNoRoutineMessage();
        return;
    }
}

/**
 * Determines whether to show tomorrow's routine based on the current time and user settings.
 * @param {number} hour - Current hour.
 * @param {number} minute - Current minute.
 * @returns {boolean} - True if tomorrow's routine should be shown.
 */
function shouldShowTomorrowRoutine(hour, minute) {
    const settings= localStorage.getItem("settings");
    if (settings === null) 
        if (hour >= 16) return true;
    const time = JSON.parse(settings).showTomorrowsRoutineAt;
    if ((time === null||time.hour==="Hour") && hour >= 16) {
        return true;
    }else if (time !== null) {
        let h = parseInt(time.hour);
        if (time.ampm === "PM" && h !== 12) {
            h += 12;
        }
        if (h === hour && parseInt(time.minute) <= minute) {

            return true;
        } else if (h < hour) {
            return true;
        }
    }
    return false;
}

/**
 * Sets the current date and (optionally) tomorrow's date on the page.
 * Also checks for holidays and displays them if applicable.
 */
async function setCurrentDates() {
    const dateEl = document.getElementById('currentDate');
    const dateELNext = document.getElementById('currentDate-next');
    const dates = getDateTime();
    const showTomorrowRoutine = shouldShowTomorrowRoutine(dates.hours, dates.minutes);
    if (showTomorrowRoutine) {
        dateELNext.style.display = "block";
        dateELNext.textContent = "Tomorrow : " + dates.nextDay;
    }

    dateEl.textContent = "Today : " + dates.today;
    document.getElementById("currentDate").style.display = "block";
    const fetchedHolidays = await fetch("app/assets/json/holidays.json");
    const holidays = await fetchedHolidays.json();

    for (const holiday of holidays) {
        const holidayDate = new Date(holiday.date);
        if (formatDate(holidayDate) === dates.today.split(",")[1]) {
            const holidayText = document.createElement("span");
            const br = document.createElement("br");
            dateEl.appendChild(br);
            const style = "color: #ff0000; font-weight: bold; margin-left: 5px; font-size: 0.8em;";
            holidayText.style = style;
            holidayText.textContent = `Possible Holiday - (${holiday.name})`;
            dateEl.appendChild(holidayText);
        } else if (showTomorrowRoutine && formatDate(holidayDate).split(",")[1] == dates.nextDay.split(",")[1]) {
            const holidayText = document.createElement("span");
            const br = document.createElement("br");
            dateELNext.appendChild(br);
            const style = "color: #ff0000; font-weight: bold; margin-left: 5px; font-size: 0.8em;";
            holidayText.style = style;
            holidayText.textContent = `Possible Holiday - (${holiday.name})`;
            dateELNext.appendChild(holidayText);
        }
    }

}

/**
 * Displays a message when no routine data is found.
 */
function showNoRoutineMessage() {
    const list = document.getElementById("routineList");
    if (list) {
        list.innerHTML = "<center><strong>No Routine was found.</strong><br><p>Please, Click on Reload</p></center>";
        document.getElementById("currentDate-next").style.display = "none";
        document.getElementById("currentDate").style.display = "none";
    }
}

/**
 * Displays the routine for today and, if applicable, for tomorrow.
 * @param {Array} routine - The routine data to display.
 */
function showRoutine(routine) {
    const list = document.getElementById("routineList");
    if (!list) return;
    list.innerHTML = "";
    if (!routine) {
        list.innerHTML = "<li>No Routine was found.</li>";
        return;
    }
    const dates = getDateTime();
    if (shouldShowTomorrowRoutine(dates.hours, dates.minutes)) {
        displayRoutine(routine, dates.nextDay, true);
        document.getElementById("routineList-next").style.removeProperty("display");
    }
    displayRoutine(routine, dates.today);

}

/**
 * Renders the routine for a specific date (today or tomorrow).
 * @param {Array} routine - The routine data.
 * @param {string} date - The date string to match.
 * @param {boolean} [next=false] - Whether this is for tomorrow.
 */
function displayRoutine(routine, date, next = false) {
    const list = next ? document.getElementById("routineList-next") : document.getElementById("routineList");
    list.innerHTML = "";
    let found = false;
    for (const day of routine) {
        if (day["day"] !== date.substring(0, 3)) continue;
        for (const todaysClass of day["classes"]) {
            const item = document.createElement("div");
            item.className = "routine-item";

            const time = document.createElement("span");
            time.className = "time";
            time.innerText = todaysClass["time"];

            const subject = document.createElement("span");
            subject.className = "subject";
            subject.innerHTML = `${todaysClass["course"]} <strong>Room: ${todaysClass["room"]}</strong>`;

            item.appendChild(time);
            item.appendChild(subject);
            list.appendChild(item);
        }
        found = true;
        break;
    }
    if (!found) {

        list.innerHTML = "<center><h5>No Class for " + (next ? "Tomorrow" : "Today") + ".</h5></center>";
    }
}

