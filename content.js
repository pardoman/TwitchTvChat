/* Listen for messages */
/* full access to the page's DOM. */

// ***********************************
// ********** Variables **************
// ***********************************
var myCanvas = null;
var myContext2d = null;
var myResizeTimer = null;
var twitchVideoPlayer = null;
var twitchChatLines = null;

// ***********************************
// ******** Event Hooks **************
// ***********************************
window.addEventListener('resize', function resized(e) {
	// We need to delay a bit because twitch does the 
	// same for its video player.
	if (myResizeTimer) clearTimeout(myResizeTimer);
	myResizeTimer = setTimeout(function(){			
		myCanvas.width = twitchVideoPlayer.offsetWidth;
		myCanvas.height = twitchVideoPlayer.offsetHeight;
		draw(); // TODO: remove
	}, 500);
}, false);


// ***********************************
// ********** Functions **************
// ***********************************
function injectChatOverlay(msg, sender, sendResponse) {

	// try to get the canvas. Abort if it is already there
	if (myCanvas) return;

	// try to get the player
	var playerQuery = document.getElementsByClassName("js-player");
	if (playerQuery.length == 0) return;
	
	// try to get the chat object
	// fetch chat lines dom container
	var chatQuery = document.getElementsByClassName("chat-lines");
	if (chatQuery.length == 0) return;
	
	// keep a reference to video player and chat
	twitchVideoPlayer = playerQuery[0];
	twitchChatLines = chatQuery[0];
	
	// create 2d canvas
	var canvas = myCanvas = document.createElement('canvas');
	canvas.id = "MyTwitchChatOverlay";
	canvas.width = twitchVideoPlayer.offsetWidth;
	canvas.height = twitchVideoPlayer.offsetHeight;
	canvas.style.position = "absolute";
	canvas.style.top = "0px";
	canvas.style.left = "0px";
	canvas.style["pointer-events"] = "none";
	twitchVideoPlayer.appendChild(canvas);
	
	// draw something
	myContext2d = canvas.getContext("2d");
	myContext2d.fillStyle = "#53EFE7";
	myContext2d.fillRect(50, 25, 150, 100);
	
	
}

function draw() {
	myContext2d.fillStyle = "#53EFE7";
	myContext2d.fillRect(50, 25, 150, 100);
}

// adding listeners
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	if (!msg.command) return;
	switch (msg.command) {
		case "inject_chat_overlay":
			injectChatOverlay(msg, sender, sendResponse);
			break;
	}
});