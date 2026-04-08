
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

            td1.innerText = exam["examDate"];
            td2.innerText = exam["examTime"];
            td3.innerText = exam["courseName"] + " [" + exam["section"] + "]";
            tr.append(td3, td1, td2);
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
    var newSchedule = await getExamRoutine();
    console.log(newSchedule);
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

