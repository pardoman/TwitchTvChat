/* Listen for messages */
/* full access to the page's DOM. */

// ***********************************
// ********** Variables **************
// ***********************************
var gFps = 60;                  // 60 fps cuz that's what cool kids do.
var gTextTime = 10;             // Time in seconds that a text takes to scroll through the screen (right to left).
var gTickElapsedTime = 1/gFps;  // Given the framerate defined above, we use this value as the elapsed time.
var gMaxTextIndex = 7;          // Maximum lines of text we support.
var gTextTopMargin = 57;        // vertical margin from video player's top to first text line.
var gTextVerticalSpacing = 26;  // vertical distance in pixels between 2 consecutive text lines.
var gUrlReplacement = "<url>";  // replacement for URLs (so comments are not that long)
var gMaxTextChars = 90;         // In characters, not in pixels.
var gEllipsizedText = "...";    // gets concatenated at the end of text that gets cut (cuz they are too long)
var gTabActive = true;          // Keeps track whether the tab we injected is active or not.
var gTabAwayTime = null;        // Keeps track of the time since the user tabbed away
var gMainLoolId = -1;           // Interval id of the main loop
var gInitCanvasSize = -1;       // Interval id of the canvas resize init function (which addresses an edge case)
var gInjectOnUpdate = false;    // Whether when navigating to another url (through ajax or whatnot) the overlay should
                                // be injected or not.
var gRenderIndicator = false;   // Whether canvas-present ui should be rendered or not.
var gRolloverOpacity = 1.0;
var gRolloutOpacity = 0.5;

var myCanvas = null;            // The 2d canvas reference
var myContext2d = null;         // The canvas drawing context
var myResizeTimer = null;       // Timeout id for window resize. Delaying for performance reasons.
var myChatsToRender = [];       // Tracks chats to draw
var myNextTextIndex = 0;        // Tracks which line is the next to draw into

var twitchVideoPlayer = null;   // Reference to Twitch's video player (DOM element)
var twitchChatLines = null;     // Reference to Twitch's chat (DOM element)
var twitchLastChatId = 0;       // Id of the last chat detected
var twitchUrl = null;           // URL where we injected the chat overlay

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

function delayedCanvasSizeInit() {
    myCanvas.width = twitchVideoPlayer.offsetWidth;
    myCanvas.height = twitchVideoPlayer.offsetHeight;
    if (myCanvas.width != 0 || myCanvas.height != 0) {
        clearInterval(gInitCanvasSize);
        gInitCanvasSize = -1;
    }
}

function onTwitchVideoPlayerEnter() {
    gRenderIndicator = true;
    myCanvas.style.opacity = gRolloverOpacity;
}

function onTwitchVideoPlayerLeave() {
    gRenderIndicator = false;
    myCanvas.style.opacity = gRolloutOpacity;
}

function pushComment(text) {

    if (!text) return;
    text = text.trim();
    if (text.length === 0) return;

    // limit the amount of chats onscreen
    if (myChatsToRender.length > gMaxTextIndex * 2) return;
    
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
        time: gTextTime
    });

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

    var chatIdsAdded = [];
    var entries = twitchChatLines.childNodes;
    for (var i=entries.length-1; i>0; --i) {
        var child = entries[i];
        if (!child || child.tagName != "LI" || !('id' in child))
            continue;
        if (child.id.substr(0,5) !== "ember") // Chat messages have ids 'ember1734', 'ember1889', etc.
            continue;

        // At this point we have a candidate for chat message.
        var childId = parseInt(child.id.substr(5));
        if (childId > twitchLastChatId) {
            chatIdsAdded.push(childId);
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
    if (chatIdsAdded.length) {
        twitchLastChatId = chatIdsAdded[0];
    }
}

function injectChatOverlay(tabUrl) {

    // try to get the player
    var playerQuery = document.getElementsByClassName("js-player");
    if (playerQuery.length == 0) return false;
    
    // try to get the chat object
    // fetch chat lines dom container
    var chatQuery = document.getElementsByClassName("chat-lines");
    if (chatQuery.length == 0) return false;
    
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
    myCanvas.style.opacity = gRolloutOpacity;
    twitchVideoPlayer.appendChild(myCanvas);

    // Draw some indicator that the chat overlay is present, but only when
    // the mouse cursor is over the video player.
    twitchVideoPlayer.addEventListener('mouseenter', onTwitchVideoPlayerEnter, false);
    twitchVideoPlayer.addEventListener('mouseleave', onTwitchVideoPlayerLeave, false);

    // It may happen that twitch video player is not yet full initialized
    // thus, attempt to get its width/height some time later. Repeat until success.
    if (myCanvas.width == 0 || myCanvas.height == 0) {
        gInitCanvasSize = setInterval(delayedCanvasSizeInit,500);
    }
    
    // keep reference to context-2d
    myContext2d = myCanvas.getContext("2d"); // TODO: Can this fail? check for null?
    
    // Listen to new incoming chats
    domHelper.observe(twitchChatLines, processNewChatMessages);    // helpers.js
    observeTab(onTabChanged);                               // helpers.js
    processNewChatMessages(); // We find the id of the last chat message already present,
    myChatsToRender = [];     // and then we just flush the list.
    myNextTextIndex = 1;

    // resize handler
    window.addEventListener('resize', onWindowResized, false);

    // A video canvas resize also happens when clicking the toggle chat button.
    // No 'resize' event is dispatched, so we need to hook ourselves there.
    var chatToggleBtn = document.getElementById("right_close");
    if (chatToggleBtn) {
        chatToggleBtn.addEventListener('click', onWindowResized, false);
    }

    // other initialization
    twitchUrl = tabUrl;

    // Our main loop
    gMainLoolId = setInterval(tick,1000/gFps);
    return true;
}

function removeChatOverlay() {
    window.removeEventListener('resize', onWindowResized);
    if (myCanvas) {
        if (myCanvas.parentNode) {
            myCanvas.parentNode.removeChild(myCanvas);
        }
        myCanvas = null;
    }
    if (twitchChatLines) {
        domHelper.disconnect(twitchChatLines, processNewChatMessages);
        twitchChatLines = null;
    }
    if (twitchVideoPlayer) {
        twitchVideoPlayer.removeEventListener('mouseenter', onTwitchVideoPlayerEnter);
        twitchVideoPlayer.removeEventListener('mouseleave', onTwitchVideoPlayerLeave);
        twitchVideoPlayer = null;
    }
    if (gMainLoolId !== -1) {
        clearInterval(gMainLoolId);
        gMainLoolId = -1;
    }
    if (gInitCanvasSize !== -1) {
        clearInterval(gInitCanvasSize);
        gInitCanvasSize = -1;
    }
    myContext2d = null;
    twitchUrl = null;
    twitchLastChatId = 0;
    gRenderIndicator = false;
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

    if (gRenderIndicator) {
        var margin = 7;
        var extraBottomMargin = 29; // due to playback controls
        var length = 15;

        var top = margin;
        var bottom = canvasH-(margin)-extraBottomMargin;
        var left = margin;
        var right =  canvasW-(margin);

        myContext2d.lineWidth = 3;
        myContext2d.strokeStyle = "#FF0000";
        myContext2d.beginPath();

        // TOP LEFT
        myContext2d.moveTo(left, top + length);
        myContext2d.lineTo(left, top);
        myContext2d.lineTo(left + length, top);

        // TOP RIGHT
        myContext2d.moveTo(right - length, top);
        myContext2d.lineTo(right, top);
        myContext2d.lineTo(right, top + length);

        // BOTTOM RIGHT
        myContext2d.moveTo(right, bottom - length);
        myContext2d.lineTo(right, bottom);
        myContext2d.lineTo(right - length, bottom);

        // BOTTOM LEFT
        myContext2d.moveTo(left, bottom - length);
        myContext2d.lineTo(left, bottom);
        myContext2d.lineTo(left + length, bottom);

        // Draw!
        myContext2d.stroke();
    }

    // Initialize text font
    myContext2d.font = "normal 20pt Verdana";
    myContext2d.fillStyle = "#FFFFFF";
    myContext2d.lineWidth = 3;
    myContext2d.strokeStyle = 'black';

    // There's not a real reason for this loop to go backwards.
    for (var i = myChatsToRender.length-1; i >= 0; --i) {
        var textObj = myChatsToRender[i];
        if (textObj.isNew) {
            textObj.isNew = false;
            textObj.width = myContext2d.measureText(textObj.text).width;
            textObj.index = myNextTextIndex;
            myNextTextIndex = (myNextTextIndex + 1) % gMaxTextIndex;
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
        case "toggle_chat_overlay":
            gInjectOnUpdate = !gInjectOnUpdate;
            removeChatOverlay();
            var injected = false;
            if (gInjectOnUpdate) {
                injected = injectChatOverlay(msg.tabData.url);
            }
            if (sendResponse) {
                sendResponse({isActive: gInjectOnUpdate, isInjected: injected});
            }
            break;
        case "update_chat_overlay":
            if (gInjectOnUpdate && twitchUrl !== msg.tabData.url) {
                removeChatOverlay();
                var injected = injectChatOverlay(msg.tabData.url);
                if (sendResponse) {
                    sendResponse({isActive: gInjectOnUpdate, isInjected: injected});
                }
            }
            break;
    }
});
