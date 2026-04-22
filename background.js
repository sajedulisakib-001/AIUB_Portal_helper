chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["app/assets/js/toInject/autologin.js"],
      });
    } catch {
      console.log("Failed to inject autologin script");
    }
  }
});
