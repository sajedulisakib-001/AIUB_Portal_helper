/**
 * Displays the exam schedule in the UI.
 * Loads from Chrome Storage if not reloading, otherwise fetches new data and updates the table.
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

      td1.style.width = "23%";
      td2.style.width = "27%";
      td3.style.width = "50%";

      td1.innerText = exam["examDate"];
      td2.innerText = exam["examTime"];
      td3.innerText = exam["courseName"] + " [" + exam["section"] + "]";

      tr.append(td1, td2, td3);
      tbody.append(tr);
    }
  };


  tbody.innerHTML = "";



  const noRoutine = (msg) => {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.setAttribute("colspan", "3");
    td.innerText = msg;
    tr.append(td);
    tbody.append(tr);
  };



  if (!reload) {

    const schedule = (await chrome.storage.local.get("examSchedule")).examSchedule || null;

    if (schedule === null) noRoutine("Please Reload the page to see the\nlatest exam schedule");

    show(schedule);

  } else {
    
    await chrome.storage.local.remove(["examSchedule"]);
    var newSchedule = await getExamRoutine();

    if (newSchedule !== null && newSchedule.schedule.length !== 0) {
      show(newSchedule);
      chrome.storage.local.set({
        examSchedule: newSchedule,
      });
    } else noRoutine("No Exam Found!");
  }
}
