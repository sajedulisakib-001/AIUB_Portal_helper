// Set by initSite() on load; other popup scripts (home.js, settings.js, ...)
// read this to know which storage namespace they are allowed to use.
let CURRENT_SITE = null;

document.addEventListener("DOMContentLoaded", async () => {
  CURRENT_SITE = await getActiveTabSite();

  if (!CURRENT_SITE) {
    showUnsupportedSiteMessage();
    return;
  }

  const { namespace, defaultPage } = CURRENT_SITE.config;
  const hasData = await namespaceHasCoreData(namespace);

  if (!hasData) {
    document.getElementById("init-data-load").classList.add("show");
    return;
  }

  buildNavBar(CURRENT_SITE.config);
  loadHTML("show-page-content", defaultPage);
  await setupNavigation();
  updateHoliday();
  showIndicator();
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
    const namespace = CURRENT_SITE.config.namespace;
    await nsSet(namespace, {
      routine: data.routine,
      currentCourses: data.currentCourses,
      completedInfo: data.completedInfo,
      unlockedCoursesList: unlockedCourseList,
    });
    const routine = (await nsGet(namespace, ["routine"])).routine || null;
    const currentCourses =
      (await nsGet(namespace, ["currentCourses"])).currentCourses || null;
    const completedInfo =
      (await nsGet(namespace, ["completedInfo"])).completedInfo || null;
    const unlockedCoursesList =
      (await nsGet(namespace, ["unlockedCoursesList"])).unlockedCoursesList ||
      null;

    if (routine && currentCourses && completedInfo && unlockedCoursesList) {
      document.getElementById("init-data-loading").classList.remove("show");
      buildNavBar(CURRENT_SITE.config);
      loadHTML("show-page-content", CURRENT_SITE.config.defaultPage);
      await setupNavigation();
    } else {
      document.getElementById("init-data-load").classList.remove("show");
    }
  });

/**
 * Determines which configured site (see siteConfig.js) the currently
 * active browser tab belongs to. Returns null when the active tab
 * isn't one of this extension's supported tools.
 * @returns {Promise<{hostname:string, config:object}|null>}
 */
async function getActiveTabSite() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      resolve(resolveSiteFromUrl(tab?.url));
    });
  });
}

/**
 * A namespace is considered "initialized" once it holds at least one
 * of its core keys. Used to decide whether to show the first-run
 * "Load Data" screen.
 */
async function namespaceHasCoreData(namespace) {
  const stored = await chrome.storage.local.get(null);
  const prefix = `${SITE_STORAGE_PREFIX}${namespace}__`;
  return Object.keys(stored).some((k) => k.startsWith(prefix));
}

/**
 * Shows a friendly fallback when the popup is opened while the active
 * tab isn't one of the extension's supported sites.
 */
function showUnsupportedSiteMessage() {
  const container = document.getElementById("show-page-content");
  container.innerHTML = `
    <div class="header">
      <h2>👋 Hi there</h2>
      <p class="text-muted">This tool works on supported portals only. Open a supported site's tab and reopen this popup.</p>
    </div>`;
  container.classList.add("active");
  document.getElementById("navBar").innerHTML = "";
}

/**
 * Builds the nav bar for whichever site is currently active, using
 * that site's navItems from siteConfig.js.
 */
function buildNavBar(siteConfigEntry) {
  const navBar = document.getElementById("navBar");
  navBar.innerHTML = "";
  siteConfigEntry.navItems.forEach((item, i) => {
    const el = document.createElement("div");
    el.className = "nav-item" + (i === 0 ? " active" : "");
    el.setAttribute("data-page", item.page);
    el.innerText = item.label;
    navBar.appendChild(el);
  });
}

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

  const namespace = CURRENT_SITE.config.namespace;

  try {
    const u = (await nsGet(namespace, ["updateUnlocked"])).updateUnlocked || false;
    if (u) {
      const routine = (await nsGet(namespace, ["routine"])).routine || null;
      const currentCourses =
        (await nsGet(namespace, ["currentCourses"])).currentCourses || null;
      const completedInfo =
        (await nsGet(namespace, ["completedInfo"])).completedInfo || null;
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
      await nsSet(namespace, {
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
 * data_notice is a shared/global feature (not tied to any single site),
 * so it intentionally lives outside the per-site namespaces.
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