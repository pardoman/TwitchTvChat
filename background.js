/* When the browser-action button is clicked... */
chrome.browserAction.onClicked.addListener(function(tab) {
  chrome.tabs.sendMessage(tab.id, {
      command: "inject_chat_overlay"
    },
    function(msg) {
	console.log("TwitchTvChat Toggled!");
	//console.log("result message:", msg);
    });
});
