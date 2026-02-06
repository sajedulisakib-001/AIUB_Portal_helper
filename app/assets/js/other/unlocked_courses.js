
/**
 * This script handles the loading and displaying of unlocked courses
 * It retrieves the list of unlocked courses from the server or localStorage
 * and displays them in the UI.
 * It also manages the prerequisites and completed courses
 * to determine which courses are available for the user to take.
 * 
 */




/**
 * Loads and displays the list of unlocked courses.
 * If reload is false, loads from localStorage; otherwise, fetches fresh data.
 * @param {boolean} reload - Whether to reload data from the server.
 */
async function loadUnlockedCourses(reload = false) {
    let completedInfo = null;
    let unlockedCoursesList = null;
    let program = null;

    if (!reload) {
        completedInfo = JSON.parse(localStorage.getItem("completedInfo"));
        unlockedCoursesList = JSON.parse(localStorage.getItem("unlockedCoursesList"));
        if (!unlockedCoursesList || !completedInfo) {
            showCourseListMessage("No data found! Please reload the page.");
            return;
        }
        displayUnlockedCourseList(unlockedCoursesList, completedInfo.program);
        return;
    }

    completedInfo = await getCompletedCourseList();
    if (!completedInfo) {
        showCourseListMessage("Something went wrong! Please try again later.");
        return;
    }
    localStorage.setItem("completedInfo", JSON.stringify(completedInfo));
    program = completedInfo.program;

    unlockedCoursesList = await getUnlockedCourseList(program, completedInfo.completedCourseList, completedInfo.craditCompleted);
    if (!unlockedCoursesList) {
        showCourseListMessage("Something went wrong! Please try again later.");
        return;
    }
    localStorage.setItem("unlockedCoursesList", JSON.stringify(unlockedCoursesList));
    displayUnlockedCourseList(unlockedCoursesList, program);
}

/**
 * Displays a message in the course list container.
 * @param {string} message - The message to display.
 */
function showCourseListMessage(message) {
    const list = document.getElementById("courseList");
    if (list) {
        list.innerHTML = `<h4><strong>${message}</strong></h4>`;
    }
}

/**
 * Renders the unlocked course list in the UI.
 * @param {Array} results - The unlocked courses to display.
 * @param {string} programName - The name of the program.
 */
function displayUnlockedCourseList(results, programName) {
    const list = document.getElementById("courseList");
    if (!list) return;
    list.innerHTML = "";
    if (programName) {
        const header = document.getElementById("program");
        if (header) header.textContent = "Program: BSc " + programName;
    }

    results.forEach((unlockedCourses, i) => {
        if (!unlockedCourses.length) return;

        const title = document.createElement("h4");
        title.className = "course-list-title";
        title.textContent = (i === 0) ? "Main Courses:" : "Elective/Major Courses:";
        list.appendChild(title);

        unlockedCourses.forEach(([code, name, status]) => {
            const card = document.createElement("div");
            card.className = "list-group-item";

            const cardBody = document.createElement("div");
            cardBody.className = "d-flex justify-content-between align-items-center";

            const titleSpan = document.createElement("span");
            titleSpan.className = "course-title";
            titleSpan.textContent = `${code}: ${name}`;
            if (status === "Retake") {
                const message = "You’ve already completed this course, but you can retake it anytime if you wish.";

                const badge = document.createElement("span");
                const text = document.createElement("div");
                const tooltip = document.createElement("span");

                badge.className = "badge badge-warning show-tooltip";
                tooltip.className = "tooltip";

                text.innerText = "Retake";
                tooltip.innerText = message;

                tooltip.style.width = "300px";

                badge.append(text, tooltip);
                titleSpan.append(" ", badge);
            }


            cardBody.appendChild(titleSpan);
            card.appendChild(cardBody);
            list.appendChild(card);
        });
    });
}

/**
 * Fetches and determines the list of unlocked courses based on completed courses and prerequisites.
 * @param {string} program - The program name.
 * @param {Array} completedCourseList - List of completed courses.
 * @param {number} craditCompleted - Number of credits completed.
 * @returns {Promise<Array|null>} - The unlocked course list or null on error.
 */
async function getUnlockedCourseList(program, completedCourseList, craditCompleted) {
    let unlockedCourseList = [[], []];
    const completedCodes = completedCourseList.map(([code]) => code);

    // Add retake courses to unlocked list
    completedCourseList.forEach(([code, name, status]) => {
        if (status === "Retake") {
            unlockedCourseList[0].push([code, name, status]);
        }
    });
    try {
        const formateCode = (code) => code.split("-")[0];
        const response = await fetch(`app/assets/json/${program}.json`);
        const data = await response.json();
        let courseData = data;
        for (const [c, value] of Object.entries(courseData["main"])) {
            const code = formateCode(c);
            const prereqs = value[0];
            const courseName = value[1];
            // Check if all prerequisites are completed and course is not already completed
            const allPrereqsCompleted = prereqs.every(p => completedCodes.includes(p));
            const alreadyCompleted = completedCodes.includes(code);
            const isCraditGreater = prereqs[0].includes("Credits") ? parseInt(prereqs[0]) <= craditCompleted : false;
            if ((allPrereqsCompleted || isCraditGreater || prereqs[0] === "Nil") && !alreadyCompleted) {
                unlockedCourseList[0].push([code, courseName, ""]);
            }

        }
        for (const [c, value] of Object.entries(courseData["elective"])) {
            const code = formateCode(c);
            const prereqs = value[0];
            const courseName = value[1];
            // Check if all prerequisites are completed and course is not already completed
            const allPrereqsCompleted = prereqs.every(p => completedCodes.includes(p));
            const alreadyCompleted = completedCodes.includes(code);
            const isCraditGreater = prereqs[0].includes("Credits") ? parseInt(prereqs[0]) <= craditCompleted : false;
            if ((allPrereqsCompleted || isCraditGreater || prereqs[0] === "Nil") && !alreadyCompleted) {
                unlockedCourseList[1].push([code, courseName, ""]);
            }

        }
    } catch (error) {
        console.error('Error loading course data:', error);
        return null;
    }
    return unlockedCourseList;
}