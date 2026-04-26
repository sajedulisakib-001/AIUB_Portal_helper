/**
 * Immediately Invoked Function Expression (IIFE) to encapsulate auto-login logic.
 */
(async () => {    

    const classScaduleTitle = await document.querySelector("#main-content .panel-heading h5").innerText;
    if(classScaduleTitle!=='Class Schedule') return;
    console.log("Trying to update data if Available!!!");
    const newSchedule = await getExamRoutine();
    if (newSchedule !== null) {
        chrome.storage.local.set({
            examSchedule: newSchedule
        });
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
        routine: data.routine,
        currentCourses: data.currentCourses,
        completedInfo: data.completedInfo,
        
    });
    await chrome.storage.local.set({
      updateUnlocked: true,
    });
    console.log("Auto Update Finished!!!!");

})();

