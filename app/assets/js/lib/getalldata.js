
/**
 * Retrieves all relevant student data from the AIUB portal when the
 * extension is opened for the first time, including class routine, current courses,
 * and completed courses information. 
 *
 * 
 * @returns {Promise<Object|null>} A promise that resolves to an object containing:
 *   - {Array} routine: The student's class routine, grouped by day.
 *   - {Array} currentCourses: List of currently enrolled courses with details.
 *   - {Object} completedInfo: Information about completed courses, program, and credits.
 *   Returns null if data could not be fetched.
 */
async function getalldata() {
    return await new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const tab = tabs[0];
            if (tab.url !== "https://portal.aiub.edu/Student") {
                if (tab.url.includes("portal.aiub.edu/Student")) {
                    chrome.tabs.update(tab.id, { url: "https://portal.aiub.edu/Student" });
                    await new Promise(resolve => setTimeout(resolve, 2500));
                } else {
                    chrome.tabs.create({ url: "https://portal.aiub.edu/Student" });
                    return;
                }
            }

            chrome .scripting.executeScript({
                target: { tabId: tab.id },
                files: ["app/assets/js/toInject/parseAllData.js"],
            }).catch(console.error);
            await new Promise(resolve => setTimeout(resolve, 2500));
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                args: [],
                func: async() => {
                    return await parseAllData();
                },
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

