TwitchTvChat
============

A 2d canvas overlay that display chat text scrolling horizontally from right to left.

![how it looks mouseout](/docs/example_mouseout.jpg?raw=true)

Text becomes more visible when the mouse rolls over the stream video player.
![how it looks mouseover](/docs/example_mouseover.jpg?raw=true)

Some red indicator are drawn as well to signal that the overlay is injected and ready to draw text.

Installation for development
============================
1. Clone repo to your computer. For example: c:\projects\TwitchTvChat
2. Open Chrome, go to Settings, click on Extensions and then "Load unpacked extension..."
3. Locate the folder cloned in your computer. For example: c:\projects\TwitchTvChat
4. Open a tab onto  http://www.twitch.tv/  - Notice the extension is now available there.

![Icon in address bar](/docs/chatWaiting.png?raw=true)

How to use it
=============
- Click on the Twitch icon added to the address bar.
- If there is a video stream on the page AND a chat widget, then the Twitch icon will turn green letting the user know that the chat overlay has been injected to the page.

![Icon extension injected](/docs/chatInjected.png?raw=true)

- If the extension fails to inject, the icon will turn yellow and will enter a pending state where it will wait for the page to udpate itself (probably through ajax). If an update brings in a video stream AND a chat widget, the extension will auto inject itself and turn the icon green again.

![Icon extension inject-pending](/docs/chatInjectPending.png?raw=true)

- To remove the chat overlay, juts click on the address bar icon. Notice how it turns white again.

Why?
====
I saw this once in [BiliBili](http://www.bilibili.com/) and thought to myself: "Oh wow, that is cool.  I can make that."

This is how it look there:

![BiliBili reference](/docs/BiliBiliRef.jpg?raw=true)

Testing & Development
=====================
Tested on Chrome Version 38.0.2125.111 m

Some images of past iterations can be found [here](http://snag.gy/jW7NL.jpg) and [here](http://snag.gy/rRFHy.jpg).
