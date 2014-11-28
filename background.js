/* When the browser-action button is clicked... */
chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.tabs.sendMessage(tab.id, {
            command: "inject_chat_overlay",
            tabData: tab
        });
});

/* Used to detect when the tab changes its own url. */
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo && changeInfo.status == "complete") {
        chrome.tabs.sendMessage(tabId, {
                command: "update_chat_overlay",
                tabData: tab
            });
    }
});