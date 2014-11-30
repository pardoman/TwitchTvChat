TwitchTvChat
============

A 2d canvas overlay that display chat text scrolling horizontally from right to left.

Installation for development
============================
1. Clone repo to your computer. For example: c:\projects\TwitchTvChat
2. Open Chrome, go to Settings, click on Extensions and then "Load unpacked extension..."
3. Locate the folder cloned in your computer. For example: c:\projects\TwitchTvChat
4. Open a tab onto  http://www.twitch.tv/  - Notice the extension is now available there.

![Icon in address bar](https://raw.githubusercontent.com/pardoman/TwitchTvChat/master/docs/chatWaiting.png)

How to use it
=============
- Click on the Twitch icon added to the address bar.
- If there is a video stream on the page AND a chat widget, then the Twitch icon will turn green letting the user know that the chat overlay has been injected to the page.

![Icon extension injected](https://raw.githubusercontent.com/pardoman/TwitchTvChat/master/docs/chatInjected.png)

- If the extension fails to inject, the icon will turn yellow and will enter a pending state where it will wait for the page to udpate itself (probably through ajax). If an update brings in a video stream AND a chat widget, the extension will auto inject itself and turn the icon green again.

![Icon extension inject-pending](https://raw.githubusercontent.com/pardoman/TwitchTvChat/master/docs/chatInjectPending.png)

- To remove the chat overlay, juts click on the address bar icon. Notice how it turns white again.

Why?
====
I saw this once in http://www.bilibili.com/ and thought to myself: "Oh wow, that is cool.  I can make that."

Testing & Development
=====================
Tested on Chrome Version 38.0.2125.111 m

So how does it look?
=====================
Screenshot here: http://snag.gy/jW7NL.jpg
Old screenshot here: http://snag.gy/rRFHy.jpg

Sorry for the actual content, I have no control over people's freedom of speech (of writing?). Ugh.
