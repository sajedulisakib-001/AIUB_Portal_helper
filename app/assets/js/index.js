document.addEventListener("DOMContentLoaded", async () => {
  const isEmpty =
    Object.keys(await chrome.storage.local.get(null)).length === 0;
  if (isEmpty) {
    document.getElementById("init-data-load").classList.add("show");
    return;
  }

  loadHTML("show-page-content", "home");
  await setupNavigation();
});

document.getElementById("showPopup").addEventListener("click", () => {
  document.getElementById("popupBox").classList.add("show");
  setTimeout(() => {
    document.getElementById("popupBox").classList.remove("show");
  }, 10000);
});
document.getElementById("closePopup").addEventListener("click", () => {
  document.getElementById("popupBox").classList.remove("show");
});
/*
 */
document
  .getElementById("initDataLoadBtn")
  .addEventListener("click", async () => {
    document.getElementById("init-data-load").classList.remove("show");
    document.getElementById("init-data-loading").classList.add("show");
    const data = await getalldata();
    let unlockedCourseList = [];
    if (
      data.completedInfo.completedCourseList &&
      data.completedInfo.program &&
      data.completedInfo.craditCompleted
    ) {
      unlockedCourseList = await getUnlockedCourseList(
        data.completedInfo.program,
        data.completedInfo.completedCourseList,
        data.completedInfo.craditCompleted,
      );
    }
    chrome.storage.local.set({
      routine: data.routine,
      currentCourses: data.currentCourses,
      completedInfo: data.completedInfo,
      unlockedCoursesList: unlockedCourseList,
    });
    const routine =
      (await chrome.storage.local.get(["routine"])).routine || null;
    const currentCourses =
      (await chrome.storage.local.get(["currentCourses"])).currentCourses ||
      null;
    const completedInfo =
      (await chrome.storage.local.get(["completedInfo"])).completedInfo || null;
    const unlockedCoursesList =
      (await chrome.storage.local.get(["unlockedCoursesList"]))
        .unlockedCoursesList || null;

    if (routine && currentCourses && completedInfo && unlockedCoursesList) {
      document.getElementById("init-data-loading").classList.remove("show");
      loadHTML("show-page-content", "home");
      await setupNavigation();
    } else {
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
  container.classList.remove("active");

  setTimeout(() => {
    const path = `app/pages/${file}.html`;
    fetch(chrome.runtime.getURL(path))
      .then((response) => response.text())
      .then((data) => {
        container.innerHTML = data;

        // Initialize scripts based on the loaded page
        if (file === "other") {
          setupOtherMenu();
        } else if (file === "home") {
          setUpHome();
        } else if (file === "settings") {
          setupSettingsPage();
        } else if (file === "notice") {
          setupNoticePage();
        }

        setTimeout(() => {
          container.classList.add("active");
        }, 50);
      })
      .catch((err) => console.error(`Error loading ${file}:`, err));
  }, 150);
}

/**
 * Sets up navigation for the main menu.
 * Handles click events for navigation items, loads the corresponding page,
 * and manages the active state of navigation items.
 */
async function setupNavigation() {
  document.getElementsByClassName("wrapper")[0].classList.add("show");
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const targetPage = item.getAttribute("data-page");
      if (!targetPage) return;

      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");
      loadHTML("show-page-content", targetPage);
    });
  });

  // Set the default active navigation item
  const defaultItem = document.querySelector('.nav-item[data-page="home"]');
  if (defaultItem) defaultItem.classList.add("active");

  try {
    const u =
      (await chrome.storage.local.get(["updateUnlocked"])).updateUnlocked ||
      false;
    if (u) {
      const routine =
        (await chrome.storage.local.get(["routine"])).routine || null;
      const currentCourses =
        (await chrome.storage.local.get(["currentCourses"])).currentCourses ||
        null;
      const completedInfo =
        (await chrome.storage.local.get(["completedInfo"])).completedInfo ||
        null;
      let unlockedCourseList = [];
      if (
        completedInfo.completedCourseList &&
        completedInfo.program &&
        completedInfo.craditCompleted
      ) {
        unlockedCourseList = await getUnlockedCourseList(
          completedInfo.program,
          completedInfo.completedCourseList,
          completedInfo.craditCompleted,
        );
      }
      console.log("Updated Unlocked: ", unlockedCourseList);
      await chrome.storage.local.set({
        unlockedCoursesList: unlockedCourseList,
        updateUnlocked: false,
      });
    }
  } catch {
    console.log("Error updating unlocked Courses");
  }
}

/**
 * Synchronizes locally cached notices with the latest data fetched from the server.
 *
 * If cached notice data exists, the function checks for newly published notices,
 * preserves existing notice properties (such as `viewed`), prepends new notices,
 * and removes the oldest entries to keep the cache limited to the latest 10 notices.
 * The unread/new notice count is also updated while preventing invalid values.
 *
 * If no cached data exists, the fetched notice data is stored as the initial cache.
 */
(async () => {
  const { data_notice } = await chrome.storage.local.get("data_notice");
    if (data_notice != null) {

      const nextParseDate = new Date(new Date(data_notice.next_parse).getTime() + 10 * 60 * 1000);
      const isExpired = new Date() > nextParseDate;

      if(!isExpired){
        showIndicator(data_notice.new_count);
        return;
      }
    }
      const data = await fetchNotices();
      let newCount = 0;
      if (data !== null) {
        if (data_notice != null) {
          const storedNewCount = data_notice.new_count || 0;
          const diff = Math.max(0, data.last_id - data_notice.last_id);
          newCount = Math.min(diff + storedNewCount, 10);
            
          if (newCount !== 0) {
            data_notice.notice.splice(10 - newCount, 10);
            data_notice.notice.unshift(...data.notice.slice(0, newCount));
          }
          data_notice.last_update = data.last_update;
          data_notice.last_id = data.last_id;
          data_notice.new_count = newCount;
          chrome.storage.local.set({ data_notice: data_notice });
        } else {
          newCount = 10;
          chrome.storage.local.set({ data_notice: data });
        }
      }
      showIndicator(newCount);
})();

/**
 * Retrieves the latest notice data from the remote API.
 *
 * @returns {Promise<Object|null>}
 * A notice object containing the latest notices, last_id, and last_update,
 * or `null` if the request fails or the response cannot be parsed.
 */
async function fetchNotices() {
  const API_URL = "https://24562381.wasmer.app/?action=get";

  try {
    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch notices:", error);
    return null;
  }
}

/**
 * Shows a notification indicator with the given notice count.
 * @param {number} count - Number of new notices to display.
 */
function showIndicator(count){
  if (count > 0) {
      const element = document.querySelector(`.nav-item[data-page="notice"]`);
      const indicator = document.createElement("div");
      indicator.innerText = count;
      indicator.classList.add("indicator");
      indicator.setAttribute("id","indicator");
      element.appendChild(indicator);
    }
}