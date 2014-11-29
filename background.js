/** Used to detect when the tab changes its own url. */
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo && changeInfo.status == "complete") {
        chrome.tabs.sendMessage(tabId, {
                command: "update_chat_overlay",
                tabData: tab
            },
        function (obj) {

            // TODO: Figure out why obj my be undefined
            if (typeof(obj) === "undefined") {
                return;
            }

            if (obj.isActive) {
                if (obj.isInjected) {
                    chrome.pageAction.setIcon({tabId: tab.id, path: 'icon19on.png'});
                } else {
                    chrome.pageAction.setIcon({tabId: tab.id, path: 'icon19idle.png'});
                }
            } else {
                chrome.pageAction.setIcon({tabId: tab.id, path: 'icon19.png'});
            }
        });
    }
});

/** Only show Twitch button when on twitch site. */
chrome.runtime.onInstalled.addListener(function() {
    // Replace all rules ...
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
        // With a new rule ...
        chrome.declarativeContent.onPageChanged.addRules([
	        {
                // That fires when a page's URL contains 'twitch' ...
                conditions: [
                    new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: { urlContains: 'twitch.tv' }
                })],
                // And shows the extension's page action.
                actions: [ new chrome.declarativeContent.ShowPageAction() ]
            }
        ]);
    });
});

/** When the page-action button is clicked... */
chrome.pageAction.onClicked.addListener(function(tab) {
    chrome.tabs.sendMessage(tab.id, {
        command: "toggle_chat_overlay",
        tabData: tab
    },
    function (obj) {
        // alert("isActive: " + obj.isActive + ", isInjected:" + obj.isInjected);
        if (obj.isActive) {
            if (obj.isInjected) {
                chrome.pageAction.setIcon({tabId: tab.id, path: 'icon19on.png'});
            } else {
                chrome.pageAction.setIcon({tabId: tab.id, path: 'icon19idle.png'});
            }
        } else {
            chrome.pageAction.setIcon({tabId: tab.id, path: 'icon19.png'});
        }
    });
});
