/* * AIUB Portal Helper - Data Fetching Module
 * This module contains functions to fetch data from the AIUB portal, including the student's class routine,
 * enrolled courses, completed courses, and the list of unlocked courses.
 * It uses Chrome's scripting API to inject scripts into the portal page and extract the required information
 * from the DOM.
 */






/**
 * Fetches the student's current class routine and enrolled courses from the AIUB portal.
 * Ensures the user is on the correct Student page, injects a script to extract routine and course data from the DOM,
 * and returns a Promise that resolves with the routine and current courses.
 * @returns {Promise<Array|null>} - Resolves with [routine, currentCourses] or null on failure.
 */
function getRoutine() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const tab = tabs[0];
            if (tab.url !== "https://portal.aiub.edu/Student") {
                if (tab.url.includes("portal.aiub.edu/Student")) {
                    chrome.tabs.update(tab.id, { url: "https://portal.aiub.edu/Student" });
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } else {
                    chrome.tabs.create({ url: "https://portal.aiub.edu/Student" });
                    return;
                }
            }
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                args: [],
                func: () => {

                    const rows = document.querySelectorAll('.scheduleTable .row');
                    const planMap = {};
                    rows.forEach(row => {
                        const entries = row.querySelectorAll('.col-md-10 .col-md-6');
                        entries.forEach(entry => {
                            const courseLink = entry.querySelector('a');
                            if (!courseLink) return;

                            const courseName = courseLink.innerText.trim();
                            const timeRoomText = entry.querySelector('div')?.innerText || '';
                            const timeMatch = timeRoomText.match(/Time:\s*(.*?)\s*Room:/i);
                            const roomMatch = timeRoomText.match(/Room:\s*(.*)/i);

                            if (timeMatch && roomMatch) {
                                const timeStr = timeMatch[1].trim();
                                const room = roomMatch[1].trim();
                                const dayMatch = timeStr.match(/^(Sat|Sun|Mon|Tue|Wed|Thu|Fri)/i);
                                if (!dayMatch) return;

                                const day = dayMatch[1];
                                if (!planMap[day]) planMap[day] = [];

                                const exists = planMap[day].some(item =>
                                    item.course === courseName && item.time === timeStr && item.room === room
                                );
                                if (!exists) {
                                    planMap[day].push({ course: courseName, time: timeStr, room });
                                }
                            }
                        });
                    });

                    const orderedDays = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
                    const routine = orderedDays
                        .filter(day => planMap[day])
                        .map(day => ({
                            day,
                            classes: planMap[day]
                        }));
                    var currentCourses = [];

                    document.querySelectorAll('.StudentCourseList .panel.panel-primary').forEach(panel => {
                        const body = panel.querySelector('.panel-body');

                        const rawCourseLine = body.childNodes[0].textContent.trim().match(/^(\d+)\s*-\s*(.*?)\s*\[(\w+)\]$/);
                        const name = rawCourseLine[2];
                        const code = rawCourseLine[1];
                        const section = rawCourseLine[3];
                        const sectionStatus = body.querySelectorAll('label.label-info')[0]?.textContent.trim() || '';
                        const status = body.querySelectorAll('label.label-success')[0]?.textContent.trim() || '';
                        const resultText = [...body.querySelectorAll('div')].find(div => div.textContent.includes('Result'))?.innerText.trim().replace('Result :', '').trim() || '';

                        currentCourses.push({
                            name,
                            code,
                            section,
                            sectionStatus: sectionStatus.replace(/[()]/g, ''),
                            status,
                            result: resultText
                        });
                    });
                    return { routine, currentCourses };
                }
            }, (results) => {
                if (results && results[0]?.result) {
                    resolve(results[0].result);
                } else {
                    resolve(null);
                }
            });
        });
    });
}

/**
 * Fetches the list of completed courses, program, and credits from the AIUB portal.
 * Ensures the user is on the correct Grade Report page, injects a script to extract completed course data from the DOM,
 * and returns a Promise that resolves with the completed courses, program, and credits.
 * @returns {Promise<Object>} - Resolves with { completedCourseList, program, craditCompleted } or rejects on failure.
 */
function getCompletedCourseList() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab.url.includes("portal.aiub.edu/Student")) {
                chrome.tabs.create({ url: "https://portal.aiub.edu/Student" });
                return;
            }
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async () => {
                    let html = "";
                    try {
                        const response = await fetch("https://portal.aiub.edu/Student/GradeReport/ByCurriculum");
                        if (!response.ok) {
                            throw new Error(`Response status: ${response.status}`);
                        }

                        html = await response.text();
                    } catch (error) {
                        console.error(error.message);
                    }
                    if (html === "") return [];

                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, "text/html");


                    const tables = doc.querySelectorAll(".grade-report table") || [];

                    const courseList = [];
                    const semesterMap = {
                        "Spring": 0,
                        "Summer": 1,
                        "Fall": 2,
                        0: "Spring",
                        1: "Summer",
                        2: "Fall"
                    };
                    let currentYear = null;
                    let currentSemester;
                    const getLatestGrade = (grade) => {
                        const matches = grade.match(/\[\w\]/g);
                        if (matches && matches.length > 0) {
                            const lastMatch = matches[matches.length - 1];
                            if (lastMatch === "[W]") return null;
                            return lastMatch;
                        }
                        return null;
                    };
                    for (let i = 1; i < tables.length; i++) {
                        const rows = tables[i].getElementsByTagName("tr");
                        for (let j = 1; j < rows.length; j++) {
                            const cells = rows[j].getElementsByTagName("td");
                            if (cells.length > 2) {
                                const courseCode = cells[0].innerText.trim();
                                const courseName = cells[1].innerText.trim();
                                let grade = ((str) => {
                                    const match = str.match(/\([^()]+\)\s+\[[^\[\]]+\](?=\s*$)/);
                                    return match ? match[0] : null;
                                })(cells[2].innerText.trim());
                                if (grade === null) continue;
                                if (grade.includes("[ - ]")) {
                                    const year = parseInt(grade.split("-")[1]);
                                    const semester = grade.split(",")[1].split(")")[0].trim();

                                    if (currentYear === null) {
                                        currentYear = year;
                                        currentSemester = semesterMap[semester];
                                    } else if (currentYear > year) currentYear = year;
                                    else if (currentYear === year && currentSemester > semesterMap[semester]) currentSemester = semesterMap[semester];
                                    if (currentYear === year && currentSemester + 1 === semesterMap[semester]) continue;
                                    const res = [courseCode, courseName, year + "-" + semester];
                                    courseList.push(res);
                                    console.log(res);
                                    continue;
                                }
                                if (grade.includes("[W]")) grade = getLatestGrade(grade);
                                if (!grade) continue; else if (grade.includes("[D]")) courseList.push([courseCode, courseName, "Retake"]);
                                else courseList.push([courseCode, courseName, ""]);
                            }
                        }
                    }
                    const nextSemster = (currentSemester + 1 > 2) ? semesterMap[0] : semesterMap[currentSemester + 1];
                    const completedCourseList = [];

                    for (const course of courseList) {
                        if (course[2] === "" || course[2] === "Retake") {
                            completedCourseList.push(course);
                            continue;
                        }
                        else if (course[2].includes(nextSemster)) continue;
                        course[2] = "";
                        completedCourseList.push(course);
                    }
                    let program = "";
                    let craditCompleted = 0;
                    try {
                        const firstTable = doc.querySelector(".grade-report table");
                        const lastCellText = firstTable?.querySelector("tr:nth-child(1) td:nth-child(6)")?.innerText?.trim();
                        const match = lastCellText?.includes("BSc") ? lastCellText?.match(/BSc(.*?),/)[1] : (lastCellText.split(",")[0]);
                        craditCompleted = parseInt(firstTable?.querySelector("tr:nth-child(3) td:nth-child(3)")?.innerText?.trim());
                        if (match) program = match.trim();

                    } catch (err) {
                        console.error("Failed to extract program:", err);
                    }
                    return { completedCourseList, program, craditCompleted };
                }
            }, (results) => {
                if (results && results[0]?.result) {
                    resolve(results[0].result);
                } else {
                    reject("Failed to retrieve results");
                }
            });
        });
    });
}



/**
 * Fetches the student's current class routine and enrolled courses from the AIUB portal.
 * Ensures the user is on the correct Student page, injects a script to extract routine and course data from the DOM,
 * and returns a Promise that resolves with the routine and current courses.
 * @returns {Promise<Array|null>} - Resolves with [routine, currentCourses] or null on failure.
 */
function getExamRoutine() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const tab = tabs[0];
            if (tab.url !== "https://portal.aiub.edu/Student") {
                if (tab.url.includes("portal.aiub.edu/Student")) {
                    chrome.tabs.update(tab.id, { url: "https://portal.aiub.edu/Student" });
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } else {
                    chrome.tabs.create({ url: "https://portal.aiub.edu/Student" });
                    return;
                }
            }
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                args: [],
                func: async () => {
                    let html = "";

                    try {
                        const response = await fetch("https://portal.aiub.edu/Student/ExamRoutineSchedule");
                        if (!response.ok) {
                            throw new Error(`Response status: ${response.status}`);
                        }

                        html = await response.text();
                    } catch (error) {
                        console.error(error.message);
                    }

                    if (html === "") return [];

                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, "text/html");

                    const rows = doc.querySelectorAll("#routineBody tr");

                    const result = [];

                    rows.forEach(row => {
                        const cells = row.querySelectorAll("td");

                        result.push({
                            section: cells[0]?.textContent.trim(),
                            examDate: cells[1]?.textContent.trim(),
                            examTime: cells[2]?.textContent.trim(),
                            roomNo: cells[3]?.textContent.trim(),
                            columnNo: cells[4]?.textContent.trim(),
                            seatNo: cells[5]?.textContent.trim()
                        });
                    });

                    return result;
                }
            }, (results) => {
                if (results && results[0]?.result) {
                    resolve(results[0].result);
                } else {
                    resolve(null);
                }
            });
        });
    });
}
