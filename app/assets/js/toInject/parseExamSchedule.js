
/**
 * Converts a date string from the format "DD/MON/YYYY" to "YYYY-MM-DD".
 * @param {string} input - The date string to convert.
 * @returns {string} The converted Exam date string.
 */
function convertExamDate(input) {
    const [day, mon, year] = input.split("/");

    const months = {
        Jan: "01", Feb: "02", Mar: "03", Apr: "04",
        May: "05", Jun: "06", Jul: "07", Aug: "08",
        Sep: "09", Oct: "10", Nov: "11", Dec: "12"
    };

    return `${year}-${months[mon]}-${day}`;
}


async function parseExamSchadule(){
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
    
    const result = { term: "", schedule: [], lastDate: null };
    if(rows.length ===0) return result;
    const nameOfTermAndYear = doc.querySelector("#main-content > div > h3")?.innerText.trim().split(" TERM EXAM SCHEDULE OF ");
    const term = nameOfTermAndYear[0]?.split(" ").pop() || "";
    const year = nameOfTermAndYear[1]?.split(" [")[0] || "";
    if (term) {
        result.term = term +" TERM EXAM SCHEDULE OF " + year;
    }
    rows.forEach(row => {
        const cells = row.querySelectorAll("td");
        const sctions = cells[0]?.innerText.trim().split("] ")[1]?.split(" [") || [];
        result.schedule.push({
            courseName: sctions[0],
            section: sctions[1]?.[0],
            examDate: cells[1]?.innerText.trim(),
            parsedDate: cells[1]?.innerText.trim() === "TBA" ? null : new Date(convertExamDate(cells[1]?.innerText.trim())),
            examTime: cells[2]?.innerText.trim(),
        });
    });
    result.schedule = result.schedule.sort((a, b) => {
        if (!a.parsedDate) return 1;   
        if (!b.parsedDate) return -1;
        return a.parsedDate - b.parsedDate;
    });
    
    for (let i = result.schedule.length - 1; i >= 0; i--) {
        if(result.schedule[i].parsedDate === null) continue;
        result.lastDate = result.schedule[i].examDate;
        break;
    }
    for(const schedule of result.schedule){
        if(schedule.examDate !== "TBA"){
            result.startDate = schedule.examDate;
            break;
        }
    }
    return result;
}