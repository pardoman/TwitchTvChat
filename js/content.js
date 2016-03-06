/* Listen for messages */
/* full access to the page's DOM. */

// ***********************************
// ********** Variables **************
// ***********************************
var gPrevTimestamp = null;
var gTextTime = 10;             // Time in seconds that a text takes to scroll through the screen (right to left).
var gMaxTextIndex = 7;          // Maximum lines of text we support.
var gTextTopMargin = 57;        // vertical margin from video player's top to first text line.
var gTextVerticalSpacing = 26;  // vertical distance in pixels between 2 consecutive text lines.
var gUrlReplacement = "<url>";  // replacement for URLs (so comments are not that long)
var gMaxTextChars = 90;         // In characters, not in pixels.
var gEllipsizedText = "...";    // gets concatenated at the end of text that gets cut (cuz they are too long)
var gTabActive = true;          // Keeps track whether the tab we injected is active or not.
var gTabAwayTime = null;        // Keeps track of the time since the user tabbed away
var gMainLoopId = -1;           // Interval id of the main loop
var gInjectOnUpdate = false;    // Whether when navigating to another url (through ajax or whatnot) the overlay should
                                // be injected or not.
var gRenderIndicator = false;   // Whether canvas-present ui should be rendered or not.
var gRolloverOpacity = 1.0;
var gRolloutOpacity = 0.5;
var gEventsHooked = [];         // Array containing { target:Object, event:String, callback:Function }
var gLastCheckedFullscreen;     // Stores fullscreen value

var myTextLayer = null;         // Div containing all bullet texts
var myTextMeasureCanvas;        // <canvas> element for measuring text
var myTextMeasureContext;       // 2d context of <canvas> above
var myResizeTimer = null;       // Timeout id for window resize. Delaying for performance reasons.
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
        gPrevTimestamp = null;
    }
    else if (bTabActive && !gTabActive) {
        //tabbing in, update timers and remove expired texts
        var elapsedSecs = (new Date().getTime() - gTabAwayTime) / 1000;

        gMainLoopId = window.requestAnimationFrame(tick);
    }

    gTabActive = bTabActive;
}

function checkTheaterMode(removeListener) {
    var exitTheaterQuery = document.getElementsByClassName("exit-theatre");
    if (exitTheaterQuery.length > 0) {
        var exitTheaterBtn = exitTheaterQuery[0];
        // Not using hookEvent() because the lifespan of exitTheaterBtn is only until
        // theater mode exits.  Upon reentry another 'exit theater mode' button is created.
        if (removeListener) {
            exitTheaterBtn.removeEventListener('click', onWindowResized);
        } else {
            exitTheaterBtn.addEventListener('click', onWindowResized, false);
        }
    }
}

function onWindowResized(event) {

return;

    // abort if we are not created yet
    if (!twitchVideoPlayer) return;

    // We need to delay a bit because twitch does the
    // same for its video player.
    if (myResizeTimer) clearTimeout(myResizeTimer);
    myResizeTimer = setTimeout(function(){
        myCanvas.width = twitchVideoPlayer.offsetWidth;
        myCanvas.height = twitchVideoPlayer.offsetHeight;
        checkTheaterMode();
    }, 500);
}

function onWindowKeyDown(event) {
    if (event.altKey && event.keyCode === 84) { // ALT+T
        onWindowResized(event);
    }
    else if (event.keyCode === 27 ) { // ESC key
        onWindowResized(event);
    }
}

function hookEvent(targetObject, eventType, callback) {
    targetObject.addEventListener(eventType, callback, false);
    gEventsHooked.push({
        target: targetObject,
        event: eventType,
        callback: callback
    });
}

function clearHookedEvents() {
    gEventsHooked.map(function(eventData){
        eventData.target.removeEventListener(eventData.event, eventData.callback);
    });
    gEventsHooked = [];
}

function onTwitchVideoPlayerEnter() {
    gRenderIndicator = true;
    myTextLayer.style.opacity = gRolloverOpacity;
}

function onTwitchVideoPlayerLeave() {
    gRenderIndicator = false;
    myTextLayer.style.opacity = gRolloutOpacity;
}

var gTotalTexts = 0;

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

    // Ignore text if TAB is currently not active
    if (!gTabActive)
        return;


    gTotalTexts++;
    console.log('nText:('+text+') c:'+gTotalTexts);

    var canvasWidth = myTextLayer.parentElement.clientWidth;
    var canvasHeight = myTextLayer.parentElement.clientHeight;
    var textWidth = myTextMeasureContext.measureText(text).width;
    var xPos = canvasWidth;
    var yPos = Math.random() * canvasHeight;  // gTextTopMargin + (textObj.index * gTextVerticalSpacing);
    var xTranslate = Math.round(canvasWidth + textWidth) + 10;

    var sampleText = document.createElement('div');
    sampleText.innerText = text;
    sampleText.style.position = "absolute";
    sampleText.style.left = xPos+"px";
    sampleText.style.top = yPos+"px";
    sampleText.style.color = 'red';
    sampleText.style['white-space'] = 'nowrap';

    // To get the animation to trigger, transition needs to be applied later...
    requestAnimationFrame(function(){
        myTextLayer.appendChild(sampleText);

        // and maybe later again? I just don't know any more.
        requestAnimationFrame(function(){
            sampleText.style['transition'] = 'linear transform 5s';
            sampleText.style['transform'] = 'translateX(-' + xTranslate +'px)';

            // For some reason the 'transitioned' event does not get fired.
            // So, resolve it with a simple timeout...
            setTimeout(function(){
                myTextLayer.removeChild(sampleText);
                gTotalTexts--;
                console.log('byeText:('+text+') c:'+gTotalTexts);
            }, 5000);

        });

    });
}

function processNewChatMessages() {

    var chatIdsAdded = [];
    var entries = twitchChatLines.childNodes;
    for (var i=entries.length-1; i>0; --i) {
        var child = entries[i];
        if (!child || child.nodeType !== 1 || !('id' in child))
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
    var playerQuery = document.getElementById("player");
    if (!playerQuery) return false;

    playerQuery = playerQuery.getElementsByClassName('player')[0];
    if (!playerQuery) return false;

    // try to get the chat object
    // fetch chat lines dom container
    var chatQuery = document.getElementsByClassName("chat-lines");
    if (chatQuery.length == 0) return false;

    // keep a reference to video player and chat
    twitchVideoPlayer = playerQuery;
    twitchChatLines = chatQuery[0];

    myTextLayer = document.createElement('div');
    myTextLayer.id = "MyTwitchChatTextOverlay";
    myTextLayer.width = '100%';
    myTextLayer.height = '100%';
    myTextLayer.style.position = "absolute";
    myTextLayer.style.top = "0";
    myTextLayer.style.left = "0";
    myTextLayer.style["pointer-events"] = "none";
    myTextLayer.style.visibility = "visible";
    //// For actual text being rendered
    myTextLayer.style.font = "normal 20pt Verdana";
    myTextLayer.style['text-shadow'] = "2px 2px 5px black";
    myTextLayer.style.opacity = gRolloutOpacity;


    myTextMeasureCanvas = document.createElement('canvas');
    myTextMeasureContext = myTextMeasureCanvas.getContext('2d');
    myTextMeasureContext.font = "normal 20pt Verdana";

    // Add 2d canvas to child of twitchVideoPlayer which gets used for
    // fullscreen HTML5
    var hookedTo = twitchVideoPlayer.getElementsByClassName('player-fullscreen-overlay')[0];
    hookedTo.appendChild(myTextLayer);

    // Detect full screen
    gLastCheckedFullscreen = twitchVideoPlayer.getAttribute('data-fullscreen');
    domHelper.observe(twitchVideoPlayer, checkToggleFullscreen);    // helpers.js

    // Draw some indicator that the chat overlay is present, but only when
    // the mouse cursor is over the video player.
    hookEvent(twitchVideoPlayer, 'mouseenter', onTwitchVideoPlayerEnter);
    hookEvent(twitchVideoPlayer, 'mouseleave', onTwitchVideoPlayerLeave);

    // Listen to new incoming chats
    domHelper.observe(twitchChatLines, processNewChatMessages);    // helpers.js
    observeTab(onTabChanged);                               // helpers.js
    processNewChatMessages(); // We find the id of the last chat message already present,
    myNextTextIndex = 1;

    // resize handler
    hookEvent(window, 'resize', onWindowResized);

    // A video canvas resize also happens when clicking the toggle chat button.
    // No 'resize' event is dispatched, so we need to hook ourselves there.
    var chatToggleBtn = document.getElementById("right_close");
    if (chatToggleBtn) {
        hookEvent(chatToggleBtn, 'click', onWindowResized);
    }
    // Same for the left button that toggles the left large navigation panel.
    var navToggleBtn = document.getElementById("left_close");
    if (navToggleBtn) {
        hookEvent(navToggleBtn, 'click', onWindowResized);
    }
    // Same for Theater Mode button
    var theaterQuery = document.getElementsByClassName("theatre-button");
    if (theaterQuery.length > 0) {
        var theaterBtn = theaterQuery[0];
        hookEvent(theaterBtn, 'click', onWindowResized);
    }
    // We must check if injection is happening while in Theater Mode.
    checkTheaterMode();

    // Theater mode can be accessed/disabled through HotKey ALT + T
    // Also disabled with ESC key.
    hookEvent(window, 'keydown', onWindowKeyDown);

    // other initialization
    twitchUrl = tabUrl;

    // Our main loop
    gMainLoopId = window.requestAnimationFrame(tick);
    return true;
}

function removeChatOverlay() {
    clearHookedEvents();
    checkTheaterMode(true);

    if (twitchVideoPlayer) {
        domHelper.disconnect(twitchVideoPlayer, checkToggleFullscreen);
        twitchVideoPlayer = null;
    }
    if (twitchChatLines) {
        domHelper.disconnect(twitchChatLines, processNewChatMessages);
        twitchChatLines = null;
    }
    gMainLoopId = -1;
    twitchUrl = null;
    twitchLastChatId = 0;
    gRenderIndicator = false;
    twitchVideoPlayer = null;
}

function tick(timestamp) {
    if (gMainLoopId === -1) return;
    if (!gTabActive) {
        gMainLoopId = -1;
        return;
    }
    if (!gPrevTimestamp) gPrevTimestamp = timestamp;
    var deltaT = timestamp - gPrevTimestamp;
    gPrevTimestamp = timestamp;
    gMainLoopId = window.requestAnimationFrame(tick);
}

function checkToggleFullscreen() {
    var currentFullscreen = twitchVideoPlayer.getAttribute('data-fullscreen');
    if (currentFullscreen !== gLastCheckedFullscreen) {
        gLastCheckedFullscreen = currentFullscreen;
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
