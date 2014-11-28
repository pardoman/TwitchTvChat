// ***********************************
// ********* Aux functions ***********
// ***********************************

// Source: http://stackoverflow.com/questions/1500260/detect-urls-in-text-with-javascript
function removeUrlFromText(text, replacement) {
    var urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, replacement);
}

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

// Source: http://stackoverflow.com/questions/1060008/is-there-a-way-to-detect-if-a-browser-window-is-not-currently-active
var observeTab = (function() {
    var hidden = "hidden";

    // Standards:
    if (hidden in document)
        document.addEventListener("visibilitychange", onchange);
    else if ((hidden = "mozHidden") in document)
        document.addEventListener("mozvisibilitychange", onchange);
    else if ((hidden = "webkitHidden") in document)
        document.addEventListener("webkitvisibilitychange", onchange);
    else if ((hidden = "msHidden") in document)
        document.addEventListener("msvisibilitychange", onchange);
    // IE 9 and lower:
    else if ("onfocusin" in document)
        document.onfocusin = document.onfocusout = onchange;
    // All others:
    else {
        window.onpageshow = window.onpagehide
            = window.onfocus = window.onblur = onchange;
    }

    var clientCallback;
    function onchange (evt) {
        if (!clientCallback) return;
        var evtMap = {
            focus:true,
            focusin:true,
            pageshow:true,
            blur:false,
            focusout:false,
            pagehide:false
        };
        evt = evt || window.event;
        if (evt.type in evtMap) {
            clientCallback(evtMap[evt.type]);
        } else {
            clientCallback(this[hidden] ? false : true); //lol
        }
    }

    return function (callback) {
        clientCallback = callback;
    }
})();