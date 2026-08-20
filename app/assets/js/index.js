document.addEventListener("DOMContentLoaded", async () => {
  const isEmpty =
    Object.keys(await chrome.storage.local.get(null)).length === 0;
  if (isEmpty) {
    document.getElementById("init-data-load").classList.add("show");
    return;
  }
  const { ["tools-metadata"]: toolsData = [] } =
    await chrome.storage.local.get("tools-metadata");
  let isToolsPageLoaded = false;
  if (toolsData.length !== 0) {
    const windowHost = await getCurrentTabUrl();

    if (windowHost) {
      console.log(windowHost.host);
      const tool = toolsData.find(
        (tool) => new URL(tool.host).host === windowHost.host,
      )?.path;

      console.log(tool);

      if (tool) {
        loadHTML("show-page-content", "tools", tool, toolsData);
        isToolsPageLoaded = true;
      }
    }
  }

  await setupNavigation();
  if (!isToolsPageLoaded) {
    
    loadHTML("show-page-content", "home");
    updateHoliday();
    showIndicator();
  }
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
function loadHTML(id, file, tool = null, toolsData = null) {
  const container = document.getElementById(id);
  container.classList.remove("active");

  setTimeout(() => {
    const path = `app/pages/${file}.html`;
    fetch(chrome.runtime.getURL(path))
      .then((response) => response.text())
      .then((data) => {
        container.innerHTML = data;

        // Initialize scripts based on the loaded page

        deactivateToolStorage();
        if (file === "other") {
          setupOtherMenu();
        } else if (file === "home") {
          setUpHome();
        } else if (file === "settings") {
          setupSettingsPage();
        } else if (file === "notice") {
          setupNoticePage();
        } else if (file === "tools") {
          setupToolsMenu(tool, toolsData);
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
 * Reads notice metadata from local storage, updates the browser action badge,
 * and renders or removes the notice count indicator in the navigation.
 */
async function showIndicator() {
  const { data_notice } = await chrome.storage.local.get("data_notice");
  const count = data_notice?.new_count ?? 0;
  updateBadge(count);

  const element = document.querySelector(`.nav-item[data-page="notice"]`);
  if (!element) return;

  const existingIndicator = element.querySelector("#indicator");
  if (existingIndicator) {
    existingIndicator.remove();
  }

  if (count > 0) {
    const indicator = document.createElement("div");
    indicator.innerText = count;
    indicator.classList.add("indicator");
    indicator.setAttribute("id", "indicator");
    element.appendChild(indicator);
  }
}

/**
 * Updates the extension action badge text and background color.
 * @param {number} count - The number of unread notices to display.
 */
function updateBadge(count) {
  chrome.action.setBadgeText({
    text: count > 0 ? String(count) : "",
  });

  chrome.action.setBadgeBackgroundColor({
    color: "#d93025",
  });
}

async function updateHoliday() {
  const { holiday_data } = await chrome.storage.local.get("holiday_data");
  if (holiday_data) {
    const nextParseDate = new Date(holiday_data.next_parse);
    if (!isNaN(nextParseDate.getTime())) {
      nextParseDate.setMinutes(nextParseDate.getMinutes() + 10);
      if (new Date() <= nextParseDate) {
        return;
      }
    }
  }

  const data = await fetchParsedData("holidays");

  if (data) {
    await chrome.storage.local.set({ holiday_data: data });
  }
}

//TPE Skip Code

// const getWeightedRandom = (p = 0.8) => (Math.random() < p ? 0 : 1);

// // Select every question
// document.querySelectorAll("form > ul > li > ul > li").forEach(question => {
//     const radios = question.querySelectorAll("input[type='radio']");

//     if (radios.length >= 2) {
//         radios[getWeightedRandom()].click();
//     }
// });
// document.getElementById("Comment").value="Best Teacher!"
