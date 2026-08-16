/**
 * Immediately Invoked Function Expression (IIFE) to encapsulate auto-login logic.
 */
(async () => {    

    const classScaduleTitle = await document.querySelector("#main-content .panel-heading h5").innerText;
    if(classScaduleTitle!=='Class Schedule') return;
    console.log("Trying to update data if Available!!!");
    
    const newExamSchedule = await parseExamSchadule();
    console.log(newExamSchedule);
    if (newExamSchedule.schedule.length!==0 ) {
        chrome.storage.local.set({
            examSchedule: newExamSchedule
        });
    }else{
        console.log("No New exam Routine!!");
    }
    const routine = (await chrome.storage.local.get("routine")).routine||null;
    if(routine!==null){
        const course = routine[0].classes[0].course;
        const courses = Array.from(
            document.querySelectorAll(".scheduleTable .col-md-6 a")
        ).map(el => el.textContent.trim());

        if(courses.includes(course)) {
            console.log("No Updates are Available!!!");
            return;
        }
    }
    console.log("Update Availaable!!!");
    console.log("Trying to Update");
    const data = await parseAllData();
    if(data.completedInfo === null){
        console.log("Faild to update!")
        return;
    }

    await chrome.storage.local.set({
        routine: data.routine.map(day => ({
          ...day,
          classes: [...day.classes].sort(
              (a, b) => _getMinutes(a.time) - _getMinutes(b.time)
          )
      })),
        currentCourses: data.currentCourses,
        completedInfo: data.completedInfo,
        
    });
    await chrome.storage.local.set({
      updateUnlocked: true,
    });
    console.log("Auto Update Finished!!!!");

})();


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