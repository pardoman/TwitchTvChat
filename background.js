/* When the browser-action button is clicked... */
chrome.browserAction.onClicked.addListener(function(tab) {
  chrome.tabs.sendMessage(tab.id, {
      command: "inject_chat_overlay",
      title: "Lulu"
    },
    function(msg) {
		console.log("hi Lulu");
		//console.log("result message:", msg);
    });
});