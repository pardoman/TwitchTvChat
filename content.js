/* Listen for messages */
/* full access to the page's DOM. */

// ***********************************
// ********** Variables **************
// ***********************************
var myCanvas = null;
var myContext2d = null;
var myResizeTimer = null;
var myChatsToRender = [];

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
function processNewChat() {
	
	// TODO: This technique may skip chat messages that are pushed
	// "at the same time". Meh, should be good enough for now.
	
	// We actually need to get the last element from the list.
	var newChatComment = twitchChatLines.querySelector("li:last-of-type");
	if (newChatComment === twitchLastChatComment) return;
	twitchLastChatComment = newChatComment;
	
	var msgQuery = newChatComment.getElementsByClassName("message");
	if (msgQuery.length === 0) return; // no chat
	
	var msgNode = msgQuery[0];
	// console.log(msgNode.innerText);
	
	myChatsToRender.push( {
		text: msgNode.innerText
	});
	
	draw(); // TODO: Remove
}

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
	myContext2d = canvas.getContext("2d"); // TODO: This could fail, so check for null.
	myContext2d.fillStyle = "#53EFE7";
	myContext2d.fillRect(50, 25, 150, 100);
	
	// Listen to new incoming chats
	observeDOM(twitchChatLines, processNewChat);
}

function draw() {

	myContext2d.clearRect(0, 0, myCanvas.width, myCanvas.height)
	
	// draw something.
	myContext2d.fillStyle = "#53EFE7";
	myContext2d.fillRect(50, 25, 150, 100);
	
	// Render just 1 text for now, the last one.
	if (myChatsToRender.length === 0) return;
	
	var lastChat = myChatsToRender[myChatsToRender.length-1];
	myContext2d.font = "normal 36px Verdana";
	myContext2d.fillStyle = "#FFFF69";
	myContext2d.fillText(lastChat.text, 50, 200);
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