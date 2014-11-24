/* Listen for messages */
/* full access to the page's DOM. */

// ***********************************
// ********** Variables **************
// ***********************************
var gFps = 60;		// 60 fps cuz that's what cool kids do.
var gTextTime = 10; // Time in seconds that a text takes to scroll through the screen (right to left).
var gTickElapsedTime = 1/gFps;
var gMaxTextIndex = 5;
var gTextTopMargin = 57;		// vertical margin from video player's top to first text line.
var gTextVerticalSpacing = 26; 	// vertical distance in pixels between 2 consecutive text lines.
var gUrlReplacement = "<url>";
var gMaxTextChars = 90;			// In characters, not in pixels.
var gElpsizedText = "...";

var myCanvas = null;
var myContext2d = null;
var myResizeTimer = null;
var myChatsToRender = [];
var myNextTextIndex = 0;

var twitchVideoPlayer = null;
var twitchChatLines = null;
var twitchLastChatComment = null;

// ***********************************
// ********* Aux functions ***********
// ***********************************
// Source: http://stackoverflow.com/questions/3219758/detect-changes-in-the-dom
var observeDOM = (function(){
    var MutationObserver = window.MutationObserver || window.WebKitMutationObserver,
        eventListenerSupported = window.addEventListener;

    return function(obj, callback){
        if( MutationObserver ){
            // define a new observer
            var obs = new MutationObserver(function(mutations, observer){
                if( mutations[0].addedNodes.length || mutations[0].removedNodes.length )
                    callback();
            });
            // have the observer observe foo for changes in children
            obs.observe( obj, { childList:true, subtree:true });
        }
        else if( eventListenerSupported ){
            obj.addEventListener('DOMNodeInserted', callback, false);
            // obj.addEventListener('DOMNodeRemoved', callback, false);
        }
    }
})();

// ***********************************
// ******** Event Hooks **************
// ***********************************
window.addEventListener('resize', function resized(e) {

	// abort if we are not created yet
	if (!twitchVideoPlayer || !myCanvas) return;

	// We need to delay a bit because twitch does the 
	// same for its video player.
	if (myResizeTimer) clearTimeout(myResizeTimer);
	myResizeTimer = setTimeout(function(){			
		myCanvas.width = twitchVideoPlayer.offsetWidth;
		myCanvas.height = twitchVideoPlayer.offsetHeight;
	}, 500);
}, false);


// ***********************************
// ********** Functions **************
// ***********************************
// Source: http://stackoverflow.com/questions/1500260/detect-urls-in-text-with-javascript
function removeUrlFromText(text) {
	var urlRegex = /(https?:\/\/[^\s]+)/g;
	return text.replace(urlRegex, gUrlReplacement);
}

function pushComment(text) {
	
	if (!text) return;
	text = text.trim();
	if (text.length === 0) return;
	
	// remove urls cuz they are super annoying
	text = removeUrlFromText(text);
	if (text == gUrlReplacement) return;
	
	// text that is too long really brings the experience down.
	if (text.length > gMaxTextChars) {
		text = text.substr(0, gMaxTextChars) + gElpsizedText;
	}
	
	//console.log(text);
	myChatsToRender.push( {
		isNew: true,
		text: text,
		time: gTextTime,
		index: myNextTextIndex
	});
	
	myNextTextIndex = (myNextTextIndex + 1) % gMaxTextIndex;
}

function processNewChat() {
	
	// TODO: This technique may skip chat messages that are pushed
	// "at the same time". Meh, should be good enough for now.
	
	// We actually need to get the last element from the list.
	var newChatComment = twitchChatLines.querySelector("li:last-of-type");
	if (newChatComment === twitchLastChatComment) return;
	twitchLastChatComment = newChatComment;
	
	var msgQuery = newChatComment.getElementsByClassName("message");
	if (msgQuery.length === 0) return; // no chat
	
	pushComment(msgQuery[0].innerText);
}

function injectChatOverlay(msg, sender, sendResponse) {

	// Toggle canvas visibility if already created.
	if (myCanvas) {
		var visibleStyle = myCanvas.style.visibility;
		myCanvas.style.visibility = visibleStyle === "visible" ? "hidden" : "visible";
		return;
	}

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
	
	// create 2d canvas (and keep a reference)
	myCanvas = document.createElement('canvas');
	myCanvas.id = "MyTwitchChatOverlay";
	myCanvas.width = twitchVideoPlayer.offsetWidth;
	myCanvas.height = twitchVideoPlayer.offsetHeight;
	myCanvas.style.position = "absolute";
	myCanvas.style.top = "0px";
	myCanvas.style.left = "0px";
	myCanvas.style["pointer-events"] = "none";
	myCanvas.style.visibility = "visible";
	twitchVideoPlayer.appendChild(myCanvas);
	
	// keep reference to context-2d
	myContext2d = myCanvas.getContext("2d"); // TODO: Can this fail? check for null?
	
	// Listen to new incoming chats
	observeDOM(twitchChatLines, processNewChat);
	pushComment("TwitchTvChat plugin enabled!");
	
	// Our main loop
	setInterval(tick,1000/gFps);
}

// In a better world, we should have an update and render functions. 
// Here we just content with a tick() method that does both. Deal with it.
function tick() {

	var canvasW = myCanvas.width;
	var canvasH = myCanvas.height;
	myContext2d.clearRect(0, 0, canvasW, canvasH);
	
	// Initialize text font
	myContext2d.font = "normal 20pt Verdana";
	myContext2d.fillStyle = "#FFFF69";
	myContext2d.lineWidth = 3;
	myContext2d.strokeStyle = 'black';
	for (var i = myChatsToRender.length-1; i >= 0; --i) {
		var textObj = myChatsToRender[i];
		if (textObj.isNew) {
			textObj.isNew = false;
			textObj.width = myContext2d.measureText(textObj.text).width;
		}
		textObj.time -= gTickElapsedTime;
		if (textObj.time <= 0) {
			myChatsToRender.splice(i,1);
		} else {
			// Draw it
			var xPos = (canvasW + textObj.width) * textObj.time / gTextTime - textObj.width;
			var yPos = gTextTopMargin + (textObj.index * gTextVerticalSpacing);
			
			myContext2d.strokeText(textObj.text, xPos, yPos);
			myContext2d.fillText(textObj.text, xPos, yPos);
		}
	}
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