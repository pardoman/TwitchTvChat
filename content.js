/* Listen for messages */
/* full access to the page's DOM. */

// ***********************************
// ********** Variables **************
// ***********************************
var gFps = 60;                  // 60 fps cuz that's what cool kids do.
var gTextTime = 10;             // Time in seconds that a text takes to scroll through the screen (right to left).
var gTickElapsedTime = 1/gFps;
var gMaxTextIndex = 5;
var gTextTopMargin = 57;        // vertical margin from video player's top to first text line.
var gTextVerticalSpacing = 26;  // vertical distance in pixels between 2 consecutive text lines.
var gUrlReplacement = "<url>";
var gMaxTextChars = 90;         // In characters, not in pixels.
var gEllipsizedText = "...";
var gTabActive = true;
var gTabAwayTime = null;

var myCanvas = null;
var myContext2d = null;
var myResizeTimer = null;
var myChatsToRender = [];
var myNextTextIndex = 0;

var twitchVideoPlayer = null;
var twitchChatLines = null;
var twitchLastChatId = "ember0";

// ***********************************
// ********** Functions **************
// ***********************************
function onTabChanged(bTabActive) {
    
    if (gTabActive && !bTabActive) {
        //tabbing away, save timer
        gTabAwayTime = new Date().getTime();
    }
    else if (bTabActive && !gTabActive) {
        //tabbing in, update timers and remove expired texts
        var elapsedSecs = (new Date().getTime() - gTabAwayTime) / 1000;
        update(elapsedSecs);
    }
    
    gTabActive = bTabActive;
}

function onWindowResized(event) {

    // abort if we are not created yet
    if (!twitchVideoPlayer || !myCanvas) return;

    // We need to delay a bit because twitch does the
    // same for its video player.
    if (myResizeTimer) clearTimeout(myResizeTimer);
    myResizeTimer = setTimeout(function(){
        myCanvas.width = twitchVideoPlayer.offsetWidth;
        myCanvas.height = twitchVideoPlayer.offsetHeight;
    }, 500);
}

function pushComment(text) {

    if (!text) return;
    text = text.trim();
    if (text.length === 0) return;
    
    // remove urls cuz they are super annoying
    text = removeUrlFromText(text, gUrlReplacement); // helper.js
    if (text == gUrlReplacement) return;
    
    // text that is too long really brings the experience down.
    if (text.length > gMaxTextChars) {
        text = text.substr(0, gMaxTextChars) + gEllipsizedText;
    }
    
    //console.log(text);
    myChatsToRender.push( {
        isNew: true,
        text: text,
        time: gTextTime,
        index: myNextTextIndex
    });
    
    myNextTextIndex = (myNextTextIndex + 1) % gMaxTextIndex;

    // To give a little bit more fluidity, keep pushing texts when
    // tab is not active. However, each time a new chat is pushed in,
    // make sure we update (but not render) the simulation.
    if (!gTabActive) {
        var currDate = new Date();
        var elapsedSecs = (currDate.getTime() - gTabAwayTime) / 1000;
        update(elapsedSecs);
        gTabAwayTime = currDate;
    }
}

function processNewChatMessages() {

    var chatsAdded = [];
    var entries = twitchChatLines.childNodes;
    for (var i=entries.length-1; i>0; --i) {
        var child = entries[i];
        if (!child || child.tagName != "LI" || !('id' in child))
            continue;
        if (child.id.substr(0,5) !== "ember") // Chat messages have ids 'ember1734', 'ember1889', etc.
            continue;

        // At this point we have a candidate for chat message.
        if (child.id > twitchLastChatId) {
            chatsAdded.push(child);
            var msgQuery = child.getElementsByClassName("message");
            if (msgQuery.length === 0)
                continue; // no chat
            pushComment(msgQuery[0].innerText);
        }
        else
        {
            break;
        }
    }
    if (chatsAdded.length) {
        twitchLastChatId = chatsAdded[0].id;
    }
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
    observeDOM(twitchChatLines, processNewChatMessages);    // helpers.js
    observeTab(onTabChanged);                               // helpers.js
    processNewChatMessages(); // We find the id of the last chat message already present,
    myChatsToRender = [];     // and then we just flush the list.
    myNextTextIndex = 1;
    pushComment("TwitchTvChat plugin enabled!");

    // resize handler
    window.addEventListener('resize', onWindowResized, false);

    // A video canvas resize also happens when clicking the toggle chat button.
    // No 'resize' event is dispatched, so we need to hook ourselves there.
    var chatToggleBtn = document.getElementById("right_close");
    if (chatToggleBtn) {
        chatToggleBtn.addEventListener('click', onWindowResized, false);
    }

    // Our main loop
    setInterval(tick,1000/gFps);
}

// TODO: Use this for something.
function removeChatInjection() {
    window.removeEventListener('resize', onWindowResized);
}

function tick() {
    update(gTickElapsedTime);
    render();
}

function update(elapsedtime) {
    for (var i = myChatsToRender.length-1; i >= 0; --i) {
        var textObj = myChatsToRender[i];
        textObj.time -= elapsedtime;
        if (textObj.time <= 0) {
            myChatsToRender.splice(i,1);
        }
    }
}

function render() {

    // Just to make sure that no render is done when tab is not active.
    if (!gTabActive) return;

    var canvasW = myCanvas.width;
    var canvasH = myCanvas.height;
    myContext2d.clearRect(0, 0, canvasW, canvasH);

    // Initialize text font
    myContext2d.font = "normal 20pt Verdana";
    myContext2d.fillStyle = "#FFFF69";
    myContext2d.lineWidth = 3;
    myContext2d.strokeStyle = 'black';

    // There's not a real reason for this loop to go backwards.
    for (var i = myChatsToRender.length-1; i >= 0; --i) {
        var textObj = myChatsToRender[i];
        if (textObj.isNew) {
            textObj.isNew = false;
            textObj.width = myContext2d.measureText(textObj.text).width;
        }

        // Draw it
        var xPos = (canvasW + textObj.width) * textObj.time / gTextTime - textObj.width;
        var yPos = gTextTopMargin + (textObj.index * gTextVerticalSpacing);

        myContext2d.strokeText(textObj.text, xPos, yPos);
        myContext2d.fillText(textObj.text, xPos, yPos);
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
