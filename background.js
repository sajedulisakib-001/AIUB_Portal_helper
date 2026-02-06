chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.id) return;
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["app/assets/js/autologin.js"],
    }).catch(console.error);
});
