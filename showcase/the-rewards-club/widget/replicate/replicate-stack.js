/* ===============================================================
   BC Replicate Avatar Stack loader — one-line include for index.html
   Loads tts.js + provider.js + avatar-bridge.js, then wires the
   bridge to the existing widget elements. No existing file changes.
   =============================================================== */
(function () {
  'use strict';
  function load(src, cb) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = cb;
    s.onerror = cb;
    document.head.appendChild(s);
  }
  var base = 'widget/replicate/';
  load(base + 'tts.js', function () {
    load(base + 'provider.js', function () {
      load(base + 'avatar-bridge.js', function () {
        if (root_bridge()) {
          /* Wire after the DOM elements exist (widget scripts load
             before this in the body, so the elements are present). */
          root_bridge().init({
            image: 'widget/lee-avatar.png',
            video: document.getElementById('bc-video-el'),
            audio: document.getElementById('bc-simli-audio'),
            avatar: document.getElementById('bc-avatar')
          });
        }
      });
    });
  });
  function root_bridge() { return window.BCReplicateBridge || null; }
})();
