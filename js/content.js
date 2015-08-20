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
var gInitCanvasSize = -1;       // Interval id of the canvas resize init function (which addresses an edge case)
var gInjectOnUpdate = false;    // Whether when navigating to another url (through ajax or whatnot) the overlay should
                                // be injected or not.
var gRenderIndicator = false;   // Whether canvas-present ui should be rendered or not.
var gEventsHooked = [];         // Array containing { target:Object, event:String, callback:Function }

var myContainer = null;         // Container for scrolling text
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
        gPrevTimestamp = null;
    }
    else if (bTabActive && !gTabActive) {
        //tabbing in, update timers and remove expired texts
        var elapsedSecs = (new Date().getTime() - gTabAwayTime) / 1000;
        updateSimulation(elapsedSecs);
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

    // abort if we are not created yet
    if (!twitchVideoPlayer) return;

    // We need to delay a bit because twitch does the
    // same for its video player.
    if (myResizeTimer) clearTimeout(myResizeTimer);
    myResizeTimer = setTimeout(function(){
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
        time: gTextTime,
        domElem: null
    });

    // To give a little bit more fluidity, keep pushing texts when
    // tab is not active. However, each time a new chat is pushed in,
    // make sure we update (but not render) the simulation.
    if (!gTabActive) {
        var currDate = new Date();
        var elapsedSecs = (currDate.getTime() - gTabAwayTime) / 1000;
        updateSimulation(elapsedSecs);
        gTabAwayTime = currDate;
        // console.log("pushed text: " + text + ", at: " + currDate);
    }
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

function injectCss(cssFile) {

    var cssRoute = "css/" + cssFile;
    var href = chrome.extension.getURL(cssRoute);

    var existingLinks = document.getElementsByTagName('link');
    for (var i=0; i<existingLinks.length; ++i) {
        var someLink = existingLinks[i];
        if (someLink.href === href) {
            return false; // It already exists, get out.
        }
    }

    // http://stackoverflow.com/questions/9721344/my-css-is-not-getting-injected-through-my-content-script
    var style = document.createElement('link');
    style.rel = 'stylesheet';
    style.type = 'text/css';
    style.href = href;
    (document.head||document.documentElement).appendChild(style);
    return true;
}

function injectChatOverlay(tabUrl) {

    // try to get the player
    var playerQuery = document.getElementById("player");
    if (!playerQuery) return false;
    
    // try to get the chat object
    // fetch chat lines dom container
    var chatQuery = document.getElementsByClassName("chat-lines");
    if (chatQuery.length == 0) return false;

    // Things should work from here on.
    injectCss("content.css");
    
    // keep a reference to video player and chat
    twitchVideoPlayer = playerQuery;
    twitchChatLines = chatQuery[0];

    myContainer = document.createElement('div');
    myContainer.className = "TwitchTvChatExt--Container";
    twitchVideoPlayer.appendChild(myContainer);

    var indicator = document.createElement('div');
    indicator.className = "TwitchTvChatExt--Container--TopLeft";
    myContainer.appendChild(indicator);
    indicator = document.createElement('div');
    indicator.className = "TwitchTvChatExt--Container--TopRight";
    myContainer.appendChild(indicator);
    indicator = document.createElement('div');
    indicator.className = "TwitchTvChatExt--Container--BottomLeft";
    myContainer.appendChild(indicator);
    indicator = document.createElement('div');
    indicator.className = "TwitchTvChatExt--Container--BottomRight";
    myContainer.appendChild(indicator);
    
    // Listen to new incoming chats
    domHelper.observe(twitchChatLines, processNewChatMessages);    // helpers.js
    observeTab(onTabChanged);                               // helpers.js
    processNewChatMessages(); // We find the id of the last chat message already present,
    myChatsToRender = [];     // and then we just flush the list.
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
    if (myContainer) {
        myContainer.parentNode && myContainer.parentNode.removeChild(myContainer);
        myContainer = null;
    }
    if (twitchChatLines) {
        domHelper.disconnect(twitchChatLines, processNewChatMessages);
        twitchChatLines = null;
    }
    if (gInitCanvasSize !== -1) {
        clearInterval(gInitCanvasSize);
        gInitCanvasSize = -1;
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
    updateSimulation(deltaT * 0.001);
    render();
    gMainLoopId = window.requestAnimationFrame(tick);
}

function updateSimulation(elapsedtime) {
    for (var i = myChatsToRender.length-1; i >= 0; --i) {
        var textObj = myChatsToRender[i];
        textObj.time -= elapsedtime;
        if (textObj.time <= 0) {
            if (textObj.domElem && textObj.domElem.parentNode) {
                textObj.domElem.parentNode.removeChild(textObj.domElem);
            }
            myChatsToRender.splice(i,1);
        }
    }
}

function render() {

    // Just to make sure that no render is done when tab is not active.
    if (!gTabActive) return;

    var areaWidth = myContainer.clientWidth;

    // There's not a real reason for this loop to go backwards.
    for (var i = myChatsToRender.length-1; i >= 0; --i) {
        var textObj = myChatsToRender[i];
        if (textObj.isNew) {
            textObj.isNew = false;

            var textLine = document.createElement('div');
            textLine.className = "TwitchTvChatExt--Container--TextLine";
            textLine.style.top = Math.floor(Math.random() * 90) + "%"; // TODO: Come up with better math for this
            textLine.textContent = textObj.text;
            textObj.domElem = textLine;

            myContainer.appendChild(textObj.domElem);
            textObj.width = textObj.domElem.clientWidth;
            textObj.index = myNextTextIndex;
            myNextTextIndex = (myNextTextIndex + 1) % gMaxTextIndex;
        }

        // Draw it
        var xPos = (areaWidth + textObj.width) * textObj.time / gTextTime - textObj.width;
        //var yPos = gTextTopMargin + (textObj.index * gTextVerticalSpacing);

        // Update dom position
        var domElem = textObj.domElem;
        domElem.style.left = xPos + "px";
        //domElem.style.top = yPos + "px";
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
