/* Listen for messages */
/* full access to the page's DOM. */

// ***********************************
// ********** Variables **************
// ***********************************
var gUrlReplacement = "<url>";  // replacement for URLs (so comments are not that long)
var gMaxTextChars = 90;         // In characters, not in pixels.
var gEllipsizedText = "...";    // gets concatenated at the end of text that gets cut (cuz they are too long)
var gTabActive = true;          // Keeps track whether the tab we injected is active or not.
var gInjectOnUpdate = false;    // Whether when navigating to another url (through ajax or whatnot) the overlay should
                                // be injected or not.
var gRolloverOpacity = 1.0;
var gRolloutOpacity = 0.5;
var gEventsHooked = [];         // Array containing { target:Object, event:String, callback:Function }
var gLastRandomLine = -1;

var myTextLayer = null;         // Div containing all bullet texts
var myTextMeasureCanvas;        // <canvas> element for measuring text
var myTextMeasureContext;       // 2d context of <canvas> above

var twitchVideoPlayer = null;   // Reference to Twitch's video player (DOM element)
var twitchChatLines = null;     // Reference to Twitch's chat (DOM element)
var twitchLastChatId = 0;       // Id of the last chat detected
var twitchUrl = null;           // URL where we injected the chat overlay



// ***********************************
// ********** Functions **************
// ***********************************
function onTabChanged(bTabActive) {

    gTabActive = bTabActive;
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
    gEventsHooked.forEach(function(eventData){
        eventData.target.removeEventListener(eventData.event, eventData.callback);
    });
    gEventsHooked = [];
}

function onTwitchVideoPlayerEnter() {
    myTextLayer.style.opacity = gRolloverOpacity;
}

function onTwitchVideoPlayerLeave() {
    myTextLayer.style.opacity = gRolloutOpacity;
}

/*
 * Returns time in milliseconds. travelDistance is in pixels.
*/
function getTravelTimeMs(travelDistance) {

    // The idea is to resolve the following linear equation:
    //
    // 5000 ms --- works well with ---- 900 pixels
    // ???? ms --- works well with ---- travelDistance pixels
    //
    // So the simple math here is:
    //
    // ???? = 5000 * travelDistance / 900

    return Math.round(5000 * travelDistance / 900);
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

    // Ignore text if TAB is currently not active
    if (!gTabActive)
        return;

    // x-math
    var canvasWidth = myTextLayer.parentElement.clientWidth;
    var textMeasurement = myTextMeasureContext.measureText(text);
    var textWidth = textMeasurement.width;
    var xPos = canvasWidth;
    var xTranslate = Math.round(canvasWidth + textWidth) + 10;
    // To make long text scroll faster, apply a scale to them
    var xTranslateScaled = canvasWidth + textWidth * 0.3;
    var travelTime = getTravelTimeMs(xTranslateScaled);

    // y-math
    var LINE_HEIGHT = 40; // px - add some padding between text
    var canvasHeight = myTextLayer.parentElement.clientHeight - LINE_HEIGHT;
    var possibleLines = Math.floor(canvasHeight / LINE_HEIGHT) - 1;
    // Limitting lines to the top tends to be a good thing
    if (possibleLines > 10) {
        possibleLines = 10;
    }
    var randomLine = Math.round( Math.random() * possibleLines );
    // Avoid repeating the same line twice in a row.
    if (randomLine === gLastRandomLine) {
        randomLine = randomLine > possibleLines/2 ? randomLine-1 : randomLine+1;
    }
    gLastRandomLine = randomLine;
    var yPos = LINE_HEIGHT + (randomLine * LINE_HEIGHT); // Skip topmost line

    // Create the div!
    var sampleText = document.createElement('div');
    sampleText.innerText = text;
    sampleText.style.position = "absolute";
    sampleText.style.left = xPos+"px";
    sampleText.style.top = yPos+"px";
    sampleText.style.color = 'white';
    sampleText.style['white-space'] = 'nowrap';

    // To get the animation to trigger, transition needs to be applied later...
    requestAnimationFrame(function(){
        myTextLayer.appendChild(sampleText);

        // and maybe later again? I just don't know any more.
        requestAnimationFrame(function(){
            sampleText.style['transition'] = 'linear transform ' + travelTime + 'ms';
            sampleText.style['transform'] = 'translateX(-' + xTranslate +'px)';

            // For some reason the 'transitioned' event does not get fired.
            // So, resolve it with a simple timeout...
            setTimeout(function(){
                myTextLayer.removeChild(sampleText);
            }, travelTime);

        });

    });
}

function processNewChatMessages(dryRun) {

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
            if (!dryRun) {
                pushComment(msgQuery[0].innerText);
            }
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

    // Add 2d canvas to child of twitchVideoPlayer which gets used for fullscreen HTML5
    var hookedTo = playerQuery.getElementsByClassName('player-fullscreen-overlay')[0];
    if (!hookedTo) {
        // Little hack in the making here.
        // hookedTo may actually be undefined for a couple of frames.
        // But the rest of the page elements are there.
        // So the trick is to return TRUE and try again in a couple frames...
        setTimeout(function(){
            injectChatOverlay(tabUrl);
        }, 100);
        return true;
    };

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

    hookedTo.appendChild(myTextLayer);

    myTextMeasureCanvas = document.createElement('canvas');
    myTextMeasureContext = myTextMeasureCanvas.getContext('2d');
    myTextMeasureContext.font = "normal 20pt Verdana";


    // Draw some indicator that the chat overlay is present, but only when
    // the mouse cursor is over the video player.
    hookEvent(twitchVideoPlayer, 'mouseenter', onTwitchVideoPlayerEnter);
    hookEvent(twitchVideoPlayer, 'mouseleave', onTwitchVideoPlayerLeave);

    // Listen to new incoming chats
    domHelper.observe(twitchChatLines, processNewChatMessages);    // helpers.js
    observeTab(onTabChanged);                               // helpers.js
    processNewChatMessages(true); // Skip all messages already present

    // other initialization
    twitchUrl = tabUrl;

    return true;
}

function removeChatOverlay() {
    clearHookedEvents();

    myTextMeasureContext = null;
    myTextMeasureCanvas = null;
    if (myTextLayer) {
        if (myTextLayer.parentElement) {
            myTextLayer.parentElement.removeChild(myTextLayer);
        }
        myTextLayer = null;
    }

    if (twitchChatLines) {
        domHelper.disconnect(twitchChatLines, processNewChatMessages);
        twitchChatLines = null;
    }
    twitchUrl = null;
    twitchLastChatId = 0;
    twitchVideoPlayer = null;
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
