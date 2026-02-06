/**
 * Initializes the "Other" menu functionality.
 * Handles menu transitions, loads content dynamically based on user selection,
 * and manages the back button to return to the menu.
 */
function setupOtherMenu() {
    const menu = document.getElementById("otherMenu");
    const contentBox = document.getElementById("otherContent");
    const topicContent = document.getElementById("topicContent");
    const backBtn = document.getElementById("backToMenu");
    const options = document.querySelectorAll(".option-btn");

    options.forEach(option => {
        option.addEventListener("click", async () => {
            const topic = option.getAttribute("data-topic");
            const loadedHtml = await loadOtherContent(topic);
            const title = option.innerText.trim();

            menu.classList.add("fade-out");
            menu.addEventListener("animationend", () => {
                menu.style.display = "none";
                menu.classList.remove("fade-out");
                backBtn.style.display = "block";
                contentBox.style.display = "block";
                contentBox.classList.add("fade-in");
                backBtn.classList.add("fade-in");
                topicContent.innerHTML = `<h2 class="mb-3 none">${title}</h2>${loadedHtml}`;
                if (topic === "unlockedCourse") {
                    setupUnlockedCoursePage();
                    setTimeout(loadUnlockedCourses, 1000);
                }
                if (topic=== "examSchedule"){
                    setupExamSchedulePage();
                    setTimeout()
                }
                
            }, { once: true });
        });
    });

    backBtn.addEventListener("click", () => {
        contentBox.classList.add("fade-out");
        contentBox.addEventListener("animationend", () => {
            contentBox.style.display = "none";
            contentBox.classList.remove("fade-out");
            backBtn.style.display = "none";
            backBtn.classList.remove("fade-in");
            menu.style.display = "block";
            menu.classList.add("fade-in");
        }, { once: true });
    });
}

/**
 * Loads HTML content for a given topic from the extension's pages.
 * @param {string} file - The topic or filename to load.
 * @returns {Promise<string>} - The loaded HTML as a string.
 */
async function loadOtherContent(file) {
    const path = `app/pages/other/${file}.html`;
    try {
        const response = await fetch(chrome.runtime.getURL(path));
        return await response.text();
    } catch (err) {
        console.error(`Error loading ${file}:`, err);
        return "";
    }
}

/**
 * Sets up the unlocked course page.
 * Adds a click event listener to the 'unlocked' button to reload unlocked courses.
 */
async function setupUnlockedCoursePage() {
    document.getElementById('unlocked').addEventListener('click', async () => {
        loadUnlockedCourses(true);
    });
}

/**
 * Sets up the exam schedule page.
 * Adds a click event listener to the 'reload' button to refresh the exam schedule.
 */
async function setupExamSchedulePage() {
    document.getElementById('reload').addEventListener('click', async () => {
        displayExamSchedule(true);
    });
}