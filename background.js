

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["app/assets/js/toInject/autologin.js",
            "app/assets/js/toInject/parseAllData.js",
            "app/assets/js/toInject/parseExamSchedule.js",
            "app/assets/js/toInject/autoupdate.js"
            
        ],
      });
    } catch {
      console.log("Failed to inject autologin script");
    }
  }
});
