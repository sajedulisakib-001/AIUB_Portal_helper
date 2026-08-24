import {
  delay,
  isUpdateAvailable,
  getDateTime,
  formatDate,
  convertExamDate,
} from "./lib/lib.js";

/**
 * Initializes the home page by setting the greeting, attaching event listeners,
 * and loading the routine data.
 */
export async function setUpHome() {
  setGreeting();

  loadHomePage();
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
    document.getElementById("updatePopUpBox").classList.remove("show");
  });

  const _isUpdateAvailable = await isUpdateAvailable();
  if (_isUpdateAvailable.isAvailable) {
    showUpdatePopUp.style.display = "block";
    document.getElementById("updateType").innerText =
      _isUpdateAvailable.updateType;
    document.getElementById("version").innerText =
      _isUpdateAvailable.latestVersion;
  }
}

/**
 * Sets a greeting message based on the current time of day.
 */
function setGreeting() {
  const greetingEl = document.getElementById("greeting");
  if (!greetingEl) return;

  const hour = new Date().getHours();
  let greetingText = "👋 Hello!";
  if (hour >= 5 && hour < 12) greetingText = "🌅 Good Morning!";
  else if (hour >= 12 && hour < 17) greetingText = "☀️ Good Afternoon!";
  else if (hour >= 17 && hour < 21) greetingText = "🌇 Good Evening!";
  else greetingText = "🌙 Good Night!";

  greetingEl.textContent = greetingText;
}

/**
 * Loads and displays the routine data.
 * If an exam is available, it shows a greeting message and the exam routine.
 * If no routine data is found, it displays a message indicating that.
 */
async function loadHomePage() {
  const show = async (data) => {
    await delay(500);
    showRoutine(data);
  };
  const examData = await isExamAvailable();

  if (examData.isExamAvailable) {
    showGreeting(examData);
  }

  let data = (await chrome.storage.local.get(["routine"])).routine || null;
  if (data === null || data.length === 0) {
    await delay(500);
    showNoRoutineMessage();
  } else {
    setCurrentDates();
    show({ isExamAvailable: false, routine: data, lastExam: false });
  }
}


/**
 * Shows a greeting message on the page.
 * If the current exam is the last exam, it displays a special message.
 * Also updates the current date and displays the exam information.
 * @param {*} examData Data containing exam schedule information.
 */
function showGreeting(examData) {
    setCurrentDates();
    document.getElementById("homeTitle").style.display = "none";
    const p1 = document.getElementById("lastUpdated");
    p1.style.display = "block";
    p1.textContent =
      "Best of luck with your exams! Remember to take breaks and stay hydrated. You've got this! 💪";
    if (examData.lastExam) {
      p1.textContent =
        "This is the last exam in your schedule. Best of luck! 🎉";
    }
    show(examData);
}

/**
 * Determines whether to show tomorrow's routine based on the current time and user settings.
 * @param {number} hour - Current hour (0-23).
 * @param {number} minute - Current minute (0-59).
 * @returns {boolean} - True if tomorrow's routine should be shown.
 */
async function shouldShowTomorrowRoutine(hour, minute) {
  const DEFAULT_HOUR = 16;
  const { settings } = await chrome.storage.local.get(["settings"]);

  const timeCfg = settings?.showTomorrowsRoutineAt;
  if (!timeCfg || timeCfg.hour === "Hour") {
    return hour >= DEFAULT_HOUR;
  }

  try {
    let targetHour = parseInt(timeCfg.hour);
    const isPM = timeCfg.ampm === "PM";

    if (isPM && targetHour !== 12) targetHour += 12;
    if (!isPM && targetHour === 12) targetHour = 0;

    const currentTotalMinutes = hour * 60 + minute;
    const targetTotalMinutes = targetHour * 60 + parseInt(timeCfg.minute || 0);

    return currentTotalMinutes >= targetTotalMinutes;
  } catch (error) {
    console.error("Error calculating routine time:", error);
    return hour >= DEFAULT_HOUR;
  }
}

/**
 * Sets the current date and (optionally) tomorrow's date on the page.
 * Also checks for holidays and displays them if applicable.
 */
async function setCurrentDates() {
  const dateEl = document.getElementById("currentDate");
  const dateELNext = document.getElementById("currentDate-next");
  const dates = getDateTime();
  const showTomorrowRoutine = await shouldShowTomorrowRoutine(
    dates.hours,
    dates.minutes,
  );
  if (showTomorrowRoutine) {
    dateELNext.style.display = "block";
    dateELNext.textContent = "Tomorrow : " + dates.nextDay;
  }

  dateEl.textContent = "Today : " + dates.today;
  document.getElementById("currentDate").style.display = "block";

  const { holiday_data } = await chrome.storage.local.get("holiday_data");
  if (holiday_data) {
    const holidays = holiday_data.holidays;
    if (Array.isArray(holidays)) {
      for (const holiday of holidays) {
        const holidayDate = new Date(holiday.date);
        if (formatDate(holidayDate) === dates.today.split(",")[1]) {
          showHoliday(dateEl, holiday);
          if (!showTomorrowRoutine) return;
        } else if (
          showTomorrowRoutine &&
          formatDate(holidayDate).split(",")[1] == dates.nextDay.split(",")[1]
        ) {
          showHoliday(dateELNext, holiday);
        }
      }
    }
  }
}

/**
 * Displays a holiday notice inside the given container.
 *
 * @param {HTMLElement} container - Element where the holiday text will be added.
 * @param {Object} holiday - The holiday data to display.
 */
function showHoliday(container, holiday) {
  const holidayText = document.createElement("span");
  const br = document.createElement("br");
  container.appendChild(br);
  const style =
    "color: #ff0000; font-weight: bold; margin-left: 5px; font-size: 0.8em;";
  holidayText.style = style;
  holidayText.textContent = `Possible Holiday - (${holiday.name})`;
  container.appendChild(holidayText);
}

/**
 * Displays a message when no routine data is found.
 */
function showNoRoutineMessage() {
  const list = document.getElementById("routineList");
  if (list) {
    list.innerHTML =
      "<center><strong>No Routine was found.</strong><br><p>Please, Click on Reload</p></center>";
    document.getElementById("currentDate-next").style.display = "none";
    document.getElementById("currentDate").style.display = "none";
  }
}

/**
 * Displays the routine for today and, if applicable, for tomorrow.
 * @param {object} data - The routine data to display.
 */
async function showRoutine(data) {
  const list = document.getElementById("routineList");
  if (!list) return;
  list.innerHTML = "";
  if (!data) {
    list.innerHTML = "<li>No Routine was found.</li>";
    return;
  }
  const dates = getDateTime();
  if (await shouldShowTomorrowRoutine(dates.hours, dates.minutes)) {
    displayRoutine(data, dates.nextDay, true);
    document.getElementById("routineList-next").style.removeProperty("display");
  }
  displayRoutine(data, dates.today, false);
}

/**
 * Renders the routine for a specific date (today or tomorrow).
 * @param {object} data - The routine data.
 * @param {string} date - The date string to match.
 * @param {boolean} [next=false] - Whether this is for tomorrow.
 */
function displayRoutine(data, date, next = false) {
  const list = next
    ? document.getElementById("routineList-next")
    : document.getElementById("routineList");
  list.innerHTML = "";
  let found = false;
  for (const day of data.routine) {
    if (day["day"] !== date.substring(0, 3)) continue;
    for (const todaysClass of day["classes"]) {
      const item = document.createElement("div");
      item.className = "routine-item";
      const time = document.createElement("span");
      time.className = "time";
      time.innerHTML = `${todaysClass["room"] === "exam" ? "<strong style='color: #ff0000;'> (Exam Time)</strong>" : "<strong style='color: #30d453;'> (Regular Class)</strong>"} ${todaysClass["time"]}`;

      const subject = document.createElement("span");
      subject.className = "subject";
      if (todaysClass["room"] === "exam") {
        subject.innerText = `${todaysClass["course"]}`;
      } else {
        subject.innerHTML = `${todaysClass["course"]} </br><strong>Room: ${todaysClass["room"]}</strong>`;
      }

      item.appendChild(time);
      item.appendChild(subject);
      list.appendChild(item);
    }
    found = true;
    break;
  }
  if (!found) {
    list.innerHTML =
      "<center><h5>No " +
      (data.isExamAvailable ? "Exam" : "Class") +
      " for " +
      (next ? "Tomorrow" : "Today") +
      ".</h5></center>";
  }
}

/**
 * Checks if there are any exams available based on the exam schedule stored in Chrome Storage.
 * It determines if today's or tomorrow's exam is available and returns the relevant data.
 * @returns {Object} - An object containing the availability status and the exam data for today or tomorrow.
 */

async function isExamAvailable() {
  let lastExam = false;

  let examData = null;
  try {
    examData =
      (await chrome.storage.local.get(["examSchedule"])).examSchedule || null;
    if (!examData || !examData.schedule?.length) {
      return { isExamAvailable: false, routine: [], lastExam: false };
    }
  } catch (error) {
    return { isExamAvailable: false, routine: [], lastExam: false };
  }

  const normalize = (d) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const today = normalize(new Date());
  const tomorrow = normalize(new Date());
  tomorrow.setDate(tomorrow.getDate() + 1);

  const firstExamDate = normalize(examData.startDate);
  const lastDateRaw = normalize(convertExamDate(examData.lastDate));

  //delete examScahedule from Chrome Storage if lastDate has passed 3 days ago.
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 3);

  if (lastDateRaw < cutoffDate) {
    await chrome.storage.local.remove(["examSchedule"]);
    return { isExamAvailable: false, routine: [], lastExam: false };
  }
  if (
    (today < firstExamDate || today > lastDateRaw) &&
    firstExamDate.getTime() !== tomorrow.getTime()
  ) {
    return { isExamAvailable: false, routine: [], lastExam: false };
  }

  const schedule = examData.schedule;

  // Find today's exam (There can be multiple exams in a day, and we will show all of them in the routine)
  const todayExam = schedule.filter(
    (e) =>
      e.examDate !== "TBA" &&
      normalize(convertExamDate(e.examDate)).getTime() === today.getTime(),
  );

  // Find immediate next exam (There can be multiple exams in a day, and we will show all of them in the routine)
  const nextExam = schedule.filter(
    (e) =>
      e.examDate !== "TBA" &&
      normalize(convertExamDate(e.examDate)).getTime() === tomorrow.getTime(),
  );

  let routine = [];

  if (todayExam) {
    const examDateFormatted = formatDate(today);
    for (const exam of todayExam) {
      routine.push({
        classes: [
          {
            course: exam.courseName,
            time: exam.examTime,
            room: "exam",
          },
        ],
        day: examDateFormatted.substring(0, 3),
      });
    }

    // If today is last exam day → add next routine

    if (formatDate(today) === formatDate(lastDateRaw)) {
      lastExam = true;
      const r = (await chrome.storage.local.get(["routine"])).routine || [];
      const nextDay = getDateTime().nextDay.substring(0, 3);
      const nextClass = r.find((c) => c.day === nextDay);
      if (nextClass) routine.push(nextClass);
    }
  }
  if (nextExam) {
    const tomorrow = normalize(new Date());
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (const exam of nextExam) {
      if (
        normalize(convertExamDate(exam.examDate)).getTime() ===
        tomorrow.getTime()
      ) {
        const examDateFormatted = formatDate(tomorrow);

        routine.push({
          classes: [
            {
              course: exam.courseName,
              time: exam.examTime,
              room: "exam",
            },
          ],
          day: examDateFormatted.substring(0, 3),
        });
      }
    }
  } else {
  }

  return { isExamAvailable: true, routine: routine, lastExam };
}

function _getMinutes(timeStr) {
  let start = timeStr.split(" - ")[0];
  start = start.replace(/^[A-Za-z]{3}\s+/, "");

  let hours, minutes;

  if (/AM|PM/.test(start)) {
    const [time, period] = start.split(" ");
    [hours, minutes] = time.split(":").map(Number);

    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
  } else {
    [hours, minutes] = start.split(":").map(Number);
  }

  return hours * 60 + minutes;
}
