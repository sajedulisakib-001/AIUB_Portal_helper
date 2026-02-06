/**
 * Fetches and constructs the exam schedule for the user's current courses.
 * Matches courses and sections from the user's list with the exam routine data.
 * @param {boolean} reload - Whether to force reload the schedule from the server.
 * @returns {Promise<Object|null>} - An object with the schedule and term, or null on error.
 */
async function getExamSchedule(reload) {
    try {
        var schedule = [];
        const courseList = JSON.parse(localStorage.getItem("currentCourses"));

        if (courseList === null) {
            return null;
        }
        const response = await fetch("app/assets/json/example_Exam_Routine.json");
        const data = await response.json();
        if (data === null) return null;
        const term = data["term"];
        for (const day of data["exam_schedule"]) {
            const date = day["date"];
            const dayName = day["day"];
            for (const slot of day["slots"]) {
                const time = slot["time"];
                const slotNo = slot["slot"];
                for (const course of slot["courses"]) {
                    const courseName = course["course_title"];
                    const sections = course["sections"];
                    for (const coursefromList of courseList) {

                        if (coursefromList["name"].toLowerCase() === courseName.toLowerCase()) {
                            for (const section of sections) {
                                if (section === coursefromList["section"]) {
                                    schedule.push({
                                        date,
                                        dayName,
                                        time,
                                        slotNo,
                                        courseName
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
        return { "schedule": schedule, "term": term };
    } catch (e) {
        return null;
    }
}

/**
 * Displays the exam schedule in the UI.
 * Loads from localStorage if not reloading, otherwise fetches new data and updates the table.
 * @param {boolean} reload - Whether to reload the schedule from the server.
 */
async function displayExamSchedule(reload = false) {

    const tbody = document.getElementById("exam-items");
    const show = (newSchedule) => {

        const term = document.getElementById("term");
        term.innerText = newSchedule["term"];
        for (const exam of newSchedule["schedule"]) {
            const tr = document.createElement("tr");
            const td1 = document.createElement("td");
            const td2 = document.createElement("td");
            const td3 = document.createElement("td");

            td1.innerText = `${exam["date"]}\n${exam["dayName"]}\nSlot-${exam["slotNo"]}`;
            td2.innerText = exam["time"];
            td3.innerText = exam["courseName"];
            tr.append(td1, td2, td3);
            tbody.append(tr);
        }
    };
    tbody.innerHTML = "";
    if (!reload) {
        schedule = localStorage.getItem("examSchedule");
        if (schedule !== null) {
            show(JSON.parse(schedule));
            return;
        }
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.setAttribute("colspan", "3");
        td.innerText = "Please Reload the page to see the\nlatest exam schedule";
        tr.append(td);
        tbody.append(tr);
        return;
    }
    localStorage.removeItem("examSchedule");
    var newSchedule = await getExamSchedule(reload);

    if (newSchedule !== null) {
        show(newSchedule);
        localStorage.setItem("examSchedule", JSON.stringify(newSchedule));
    } else {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.setAttribute("colspan", "3");
        td.innerText = "No Exam Found";
        tr.append(td);
        tbody.append(tr);
        return;
    }
}