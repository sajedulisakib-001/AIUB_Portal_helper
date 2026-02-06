document.addEventListener("DOMContentLoaded", () => {
    if(localStorage.length===0){
        document.getElementById("init-data-load").classList.add("show");
        return;
    }
    
    loadHTML("show-page-content", "home");
    setupNavigation();
   
});

document.getElementById("showPopup").addEventListener("click", () => {
    document.getElementById('popupBox').classList.add('show');
    setTimeout(() => {
        document.getElementById('popupBox').classList.remove('show');
    }, 10000);
});
document.getElementById("closePopup").addEventListener("click", () => {
    document.getElementById('popupBox').classList.remove('show');
});

document.getElementById("initDataLoadBtn").addEventListener("click",async ()=>{
    document.getElementById("init-data-load").classList.remove("show");
    document.getElementById("init-data-loading").classList.add("show");
    const data = await getalldata();
    let unlockedCourseList = [];
    if(data.completedInfo.completedCourseList&&data.completedInfo.program&&data.completedInfo.craditCompleted){
        unlockedCourseList = await getUnlockedCourseList(data.completedInfo.program,data.completedInfo.completedCourseList,data.completedInfo.craditCompleted);
    };
    localStorage.setItem("routine", JSON.stringify(data.routine));
    localStorage.setItem("currentCourses", JSON.stringify(data.currentCourses));
    localStorage.setItem("completedInfo", JSON.stringify(data.completedInfo));
    localStorage.setItem("unlockedCoursesList",JSON.stringify(unlockedCourseList));
    console.log(data);
    if(localStorage.getItem("routine") && localStorage.getItem("currentCourses") && localStorage.getItem("completedInfo") && localStorage.getItem("unlockedCoursesList")){
        document.getElementById("init-data-loading").classList.remove("show");
        loadHTML("show-page-content", "home");
        setupNavigation();
    }else{
        document.getElementById("init-data-load").classList.remove("show");
        
    }
});

/**
 * Loads HTML content into a specified container and initializes page-specific scripts.
 * @param {string} id - The ID of the container element to load content into.
 * @param {string} file - The name of the HTML file (without extension) to load.
 */
function loadHTML(id, file) {
    const container = document.getElementById(id);
    container.classList.remove('active');

    setTimeout(() => {
        const path = `app/pages/${file}.html`;
        fetch(chrome.runtime.getURL(path))
            .then(response => response.text())
            .then(data => {
                container.innerHTML = data;

                // Initialize scripts based on the loaded page
                if (file === "other") {
                    setupOtherMenu();
                } else if (file === "home") {
                    setUpHome();
                } else if (file === "settings") {
                    setupSettingsPage();
                }

                setTimeout(() => {
                    container.classList.add('active');
                }, 50);
            })
            .catch(err => console.error(`Error loading ${file}:`, err));
    }, 150);
}




/**
 * Sets up navigation for the main menu.
 * Handles click events for navigation items, loads the corresponding page,
 * and manages the active state of navigation items.
 */
function setupNavigation() {
    document.getElementsByClassName("wrapper")[0].classList.add("show");
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetPage = item.getAttribute("data-page");
            if (!targetPage) return;

            navItems.forEach(nav => nav.classList.remove("active"));
            item.classList.add("active");
            loadHTML("show-page-content", targetPage);
        });
    });

    // Set the default active navigation item
    const defaultItem = document.querySelector('.nav-item[data-page="home"]');
    if (defaultItem) defaultItem.classList.add('active');
}



