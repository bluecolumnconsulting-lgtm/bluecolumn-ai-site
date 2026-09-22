/* ===============================================================
   OutLoud 2.0 — SIMLI DIRECTOR (live video avatar)
   The video path the 2.0 spec deferred: a real-time Simli talking
   head that replaces the sprite stage when the visitor taps in.

   Pattern ported from bc-ai-site/outloud/star-jetski/marina-agent.js
   (proven in production on client demo pages):
     • POST api.simli.ai/startAudioToVideoSession → session_token
     • SimliLib.SimliClient over WebRTC (livekit transport, p2p
       fallback) bound to a <video> + hidden <audio> element
     • Speech audio is streamed into the session as PCM16/16kHz —
       Simli does the lip-sync server-side; no sprite analyser.

   The sprite rig stays mounted underneath as the honest fallback:
   if Simli cannot start (no WebRTC, in-app browser, provider
   error), the stage keeps the 2D mascot and voice still works.

   Voice never runs through two channels at once: while a Simli
   feed is active the SpeechDirector routes blobs here instead of
   to an <audio> element; barge-in clears the feed interval.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;
  var SECRETS = window.OUTLOUD.SECRETS;

  function SimliDirector(bus) {
    this.bus = bus;
    this.videoEl = null;
    this.audioEl = null;
    this.stage = null;
    this.client = null;
    this.live = false;
    this.starting = false;
    this.feed = null;          /* { iv, doneTimer, done } active feed */
    this.lastError = null;
  }

  SimliDirector.prototype.ready = function () {
    return !!(this.live && this.client);
  };

  SimliDirector.prototype.capable = function () {
    var ua = navigator.userAgent || '';
    var inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|TikTok/i.test(ua);
    return {
      ok: !inApp && !!window.RTCPeerConnection && !!window.SimliLib && !!SECRETS.simliKey,
      why: inApp ? 'in-app browser blocks WebRTC'
         : !window.RTCPeerConnection ? 'no WebRTC support'
         : !window.SimliLib ? 'simli-client did not load'
         : !SECRETS.simliKey ? 'no Simli key in config' : null
    };
  };

  /* ---------- mount: video rides inside the gaze wrapper so the
     existing gesture/gaze transforms still lean the live face ---------- */
  SimliDirector.prototype.attach = function (stageHost) {
    this.stage = stageHost;
    var wrap = stageHost.querySelector('#mascot-gaze') || stageHost;
    this.videoEl = document.createElement('video');
    this.videoEl.className = 'ol-simli-video';
    this.videoEl.setAttribute('playsinline', '');
    this.videoEl.setAttribute('autoplay', '');
    this.audioEl = document.createElement('audio');
    this.audioEl.className = 'ol-simli-audio';
    wrap.appendChild(this.videoEl);
    wrap.appendChild(this.audioEl);
  };

  /* ---------- session lifecycle ---------- */
  SimliDirector.prototype.start = function () {
    var self = this;
    if (this.live || this.starting) { return Promise.resolve(true); }
    var cap = this.capable();
    if (!cap.ok) {
      this.lastError = cap.why;
      this.bus.publish('simli.failed', { message: cap.why });
      return Promise.resolve(false);
    }
    this.starting = true;
    this.bus.publish('simli.starting', {});
    if (this.stage) { this.stage.classList.add('connecting'); }  /* hide sprite during handshake */

    function makeClient(token, ice, transport) {
      return new SimliLib.SimliClient(
        token, self.videoEl, self.audioEl, ice,
        SimliLib.LogLevel ? SimliLib.LogLevel.WARN : undefined, transport
      );
    }

    return fetch('https://api.simli.ai/startAudioToVideoSession', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: SECRETS.simliKey,
        faceId: CONFIG.simli.faceId,
        handleSilence: true,
        maxSessionLength: CONFIG.simli.maxSessionLength,
        maxIdleTime: CONFIG.simli.maxIdleTime
      })
    }).then(function (res) {
      if (!res.ok) { throw new Error('Simli session ' + res.status); }
      return res.json();
    }).then(function (data) {
      var ice = null;
      try { ice = SimliLib.generateIceServers(SECRETS.simliKey); } catch (e) { ice = null; }
      if (ice && typeof ice.then === 'function') {
        return ice.then(function (srv) { return { token: data.session_token, ice: srv }; });
      }
      return { token: data.session_token, ice: ice };
    }).then(function (s) {
      /* livekit first; p2p fallback — same order as star-jetski. */
      return new Promise(function (resolve, reject) {
        var c1 = makeClient(s.token, s.ice, 'livekit');
        c1.start().then(function () { resolve(c1); }).catch(function (e1) {
          try { if (c1.stop) { c1.stop(); } if (c1.close) { c1.close(); } } catch (e) {}
          var c2 = makeClient(s.token, s.ice, 'p2p');
          c2.start().then(function () { resolve(c2); }).catch(reject);
        });
      });
    }).then(function (client) {
      self.client = client;
      return Promise.all([
        self.videoEl.play().catch(function () {}),
        self.audioEl.play().catch(function () {})
      ]).then(function () { return client; });
    }).then(function () {
      self.live = true;
      self.starting = false;
      if (self.stage) { self.stage.classList.remove('connecting'); }
      self.stage.classList.add('video-mode');
      self.bus.publish('simli.live', {});
      return true;
    }).catch(function (e) {
      self.starting = false;
      if (self.stage) { self.stage.classList.remove('connecting'); }
      self.lastError = (e && e.message) || 'unknown';
      try { if (self.client && self.client.close) { self.client.close(); } } catch (e2) {}
      self.client = null;
      self.bus.publish('simli.failed', { message: self.lastError });
      return false;
    });
  };

  SimliDirector.prototype.stop = function () {
    this.cancelFeed();
    try { if (this.client && this.client.close) { this.client.close(); } } catch (e) {}
    this.client = null;
    if (this.live) {
      this.live = false;
      if (this.stage) { this.stage.classList.remove('video-mode'); }
      this.bus.publish('simli.stopped', {});
    }
  };

  /* ---------- speech sink interface (SpeechDirector calls this) ---------- */
  SimliDirector.prototype.playBlob = function (blob, chunkText) {
    var self = this;
    if (!this.live || !this.client) { return Promise.reject(new Error('simli not live')); }
    if (this.feed) { this.cancelFeed(); }
    /* Transcript walk is owned by SpeechDirector (it calls the hook
       before delegating here) — this method only feeds audio. */
    return blob.arrayBuffer().then(function (ab) {
      var AC = window.AudioContext || window.webkitAudioContext;
      var decodeCtx = new AC();
      return decodeCtx.decodeAudioData(ab).then(function (decoded) {
        if (decodeCtx.close) { decodeCtx.close(); }
        var durMs = decoded.duration * 1000;
        var len = Math.max(1, Math.ceil(decoded.duration * 16000));
        var off = new OfflineAudioContext(1, len, 16000);
        var src = off.createBufferSource();
        src.buffer = decoded;
        src.connect(off.destination);
        src.start();
        return off.startRendering().then(function (rendered) {
          var ch = rendered.getChannelData(0);
          var pcm = new Int16Array(ch.length);
          var i, v;
          for (i = 0; i < ch.length; i++) {
            v = Math.max(-1, Math.min(1, ch[i]));
            pcm[i] = v < 0 ? v * 32768 : v * 32767;
          }
          var bytes = new Uint8Array(pcm.buffer);
          var CHUNK = 6000, pos = 0;
          var feed = { iv: null, doneTimer: null, done: null, active: true };
          self.feed = feed;
          var p = new Promise(function (resolve) { feed.done = resolve; });
          var iv = setInterval(function () {
            if (self.feed !== feed || !feed.active) { clearInterval(iv); return; }
            if (!self.live) { clearInterval(iv); self.cancelFeed(); return; }
            if (pos >= bytes.length) { clearInterval(iv); return; }
            var end = Math.min(pos + CHUNK, bytes.length);
            try { self.client.sendAudioData(bytes.slice(pos, end)); }
            catch (e) { clearInterval(iv); self.cancelFeed(); return; }
            pos = end;
          }, 175);
          feed.iv = iv;
          /* completion: full duration + a settle buffer, like marina. */
          feed.doneTimer = setTimeout(function () {
            if (self.feed === feed) {
              clearInterval(iv);
              self.feed = null;
            }
            feed.active = false;
            if (feed.done) { feed.done(); }
          }, durMs + 900);
          return p;
        });
      }, function (e) { decodeCtx.close && decodeCtx.close(); throw e; });
    });
  };

  /* ---------- cancellation (barge-in / sound off) ---------- */
  SimliDirector.prototype.cancelFeed = function () {
    var f = this.feed;
    if (!f) { return; }
    this.feed = null;
    f.active = false;
    if (f.iv) { clearInterval(f.iv); }
    if (f.doneTimer) { clearTimeout(f.doneTimer); }
    if (f.done) { f.done(); }
  };

  window.OUTLOUD = window.OUTLOUD || {};
  window.OUTLOUD.SimliDirector = SimliDirector;
})();
