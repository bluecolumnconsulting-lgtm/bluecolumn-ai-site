/* ===============================================================
   OutLoud 2.0 - ANAM DIRECTOR (live video avatar, feature-flagged)
   Real-time conversational avatar from anam.ai behind a feature
   flag. Follows the SimliDirector contract exactly:
     capable() / attach(stage) / unmute() / start() / stop()
     playBlob(blob, chunkText) / cancelFeed()
   plus bus events prefixed anam.* instead of simli.*.

   How it works (per https://anam.ai/docs/javascript-sdk/examples/custom-tts):
     - A server exchanges the Anam API key for a short-lived session
       token (POST https://api.anam.ai/v1/auth/session-token with
       Bearer key, personaConfig.enableAudioPassthrough = true).
     - The browser connects @anam-ai/js-sdk with that token over
       WebRTC and renders the persona into a <video> element.
     - Speech audio (our ElevenLabs blobs) is decoded to PCM16/16kHz
       mono and pushed through the SDK audio passthrough stream;
       Anam does the lip-sync server-side.

   KEY SAFETY: raw Anam keys must NOT ship in client JS. The adapter
   prefers CONFIG.avatar.providers.anam.tokenEndpoint (same-origin
   proxy). A SECRETS.anamKey direct call exists only as a localhost
   dev path and emits a console warning when used. Empty key + no
   endpoint = capable() returns false and the sprite rig stays.

   The sprite rig stays mounted underneath as the honest fallback:
   if Anam cannot start, the stage keeps the 2D mascot and voice
   still works. Nothing here touches the simli block or runtime.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;
  var SECRETS = window.OUTLOUD.SECRETS;
  var P = (CONFIG.avatar && CONFIG.avatar.providers && CONFIG.avatar.providers.anam) || { enabled: false };

  function AnamDirector(bus) {
    this.bus = bus;
    this.videoEl = null;
    this.audioEl = null;
    this.stage = null;
    this.client = null;
    this.stream = null;        /* SDK agent audio input stream */
    this.live = false;
    this.starting = false;
    this.feed = null;          /* { iv, doneTimer, done } active feed */
    this.lastError = null;
  }

  AnamDirector.prototype.ready = function () {
    return !!(this.live && this.client);
  };

  AnamDirector.prototype.capable = function () {
    if (!P || P.enabled === false) {
      return { ok: false, why: 'anam provider disabled (flag off, no key configured)' };
    }
    var ua = navigator.userAgent || '';
    var inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|TikTok/i.test(ua);
    var hasAuth = !!P.tokenEndpoint || !!SECRETS.anamKey;
    return {
      ok: !inApp && !!window.RTCPeerConnection && !!hasAuth,
      why: inApp ? 'in-app browser blocks WebRTC'
         : !window.RTCPeerConnection ? 'no WebRTC support'
         : !hasAuth ? 'no anam token endpoint or key in config' : null
    };
  };

  /* ---------- session token (server-issued preferred) ---------- */
  AnamDirector.prototype.getSessionToken = function () {
    if (P.tokenEndpoint) {
      return fetch(P.tokenEndpoint, { method: 'POST' }).then(function (res) {
        if (!res.ok) { throw new Error('anam token endpoint ' + res.status); }
        return res.json();
      }).then(function (data) {
        if (!data.sessionToken) { throw new Error('anam token endpoint returned no sessionToken'); }
        return data.sessionToken;
      });
    }
    /* DEV-ONLY direct path: the Anam key reaches Anam from the browser.
       Console warning is deliberate so a forgotten dev key is visible. */
    console.warn('[outloud] anam: using raw SECRETS.anamKey in the browser. Dev only. Move to tokenEndpoint.');
    return fetch('https://api.anam.ai/v1/auth/session-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SECRETS.anamKey },
      body: JSON.stringify({
        personaConfig: {
          avatarId: P.avatarId,
          avatarModel: P.avatarModel || 'cara-4',
          enableAudioPassthrough: true
        }
      })
    }).then(function (res) {
      if (!res.ok) { throw new Error('anam session-token ' + res.status); }
      return res.json();
    }).then(function (data) {
      if (!data.sessionToken) { throw new Error('anam returned no sessionToken'); }
      return data.sessionToken;
    });
  };

  /* ---------- SDK loader (ESM; same pattern as Anam's own docs) ---------- */
  AnamDirector.prototype.loadSdk = function () {
    var src = P.esmUrl || 'https://esm.sh/@anam-ai/js-sdk@latest';
    /* dynamic import from a classic script: route through Function so
       old parsers never see the keyword as a statement. */
    var importSrc = new Function('u', 'return import(u);');
    return importSrc(src).then(function (mod) {
      var createClient = mod.createClient || (mod.default && mod.default.createClient);
      if (!createClient) { throw new Error('anam sdk loaded but createClient missing'); }
      return createClient;
    });
  };

  /* ---------- mount: video rides inside the gaze wrapper so the
     existing gesture/gaze transforms still lean the live face ---------- */
  AnamDirector.prototype.attach = function (stageHost) {
    if (!P || P.enabled === false) { return; }  /* keep stage clean */
    this.stage = stageHost;
    var wrap = stageHost.querySelector('#mascot-gaze') || stageHost;
    this.videoEl = document.createElement('video');
    this.videoEl.id = 'ol-anam-video';        /* SDK streamToVideoElement targets an id */
    this.videoEl.className = 'ol-simli-video';
    this.videoEl.setAttribute('playsinline', '');
    this.videoEl.setAttribute('autoplay', '');
    this.videoEl.muted = true;   /* muted autoplay: the face shows with no gesture */
    this.audioEl = document.createElement('audio');
    this.audioEl.className = 'ol-simli-audio';
    this.audioEl.muted = true;   /* voice unlocks on the visitor's first interaction */
    wrap.appendChild(this.videoEl);
    wrap.appendChild(this.audioEl);
  };

  AnamDirector.prototype.unmute = function () {
    try {
      this.videoEl.muted = false;
      this.audioEl.muted = false;
      if (this.videoEl.play) { this.videoEl.play().catch(function () {}); }
      if (this.audioEl.play) { this.audioEl.play().catch(function () {}); }
    } catch (e) {}
  };

  /* ---------- session lifecycle ---------- */
  AnamDirector.prototype.start = function () {
    var self = this;
    if (this.live || this.starting) { return Promise.resolve(true); }
    var cap = this.capable();
    if (!cap.ok) {
      this.lastError = cap.why;
      this.bus.publish('anam.failed', { message: cap.why });
      return Promise.resolve(false);
    }
    this.starting = true;
    this.bus.publish('anam.starting', {});
    if (this.stage) { this.stage.classList.add('connecting'); }  /* hide sprite during handshake */

    var createClient = null;

    return this.getSessionToken()
      .then(function (token) { return self.loadSdk().then(function (fn) { return { token: token, fn: fn }; }); })
      .then(function (s) {
        createClient = s.fn;
        self.client = createClient(s.token, { disableInputAudio: true });  /* our mic pipeline owns input */
        return self.client.streamToVideoElement('ol-anam-video');
      })
      .then(function () {
        /* Audio passthrough stream: same wire format Simli uses
           (PCM16, 16kHz, mono). Docs: anam.ai custom-tts example. */
        self.stream = self.client.createAgentAudioInputStream({
          encoding: 'pcm_s16le',
          sampleRate: 16000,
          channels: 1
        });
        return Promise.all([
          self.videoEl.play().catch(function () {}),
          self.audioEl.play().catch(function () {})
        ]);
      })
      .then(function () {
        self.live = true;
        self.starting = false;
        if (self.stage) { self.stage.classList.remove('connecting'); }
        self.stage.classList.add('video-mode');
        self.bus.publish('anam.live', {});
        return true;
      })
      .catch(function (e) {
        self.starting = false;
        if (self.stage) { self.stage.classList.remove('connecting'); }
        self.lastError = (e && e.message) || 'unknown';
        try { if (self.client && self.client.disconnect) { self.client.disconnect(); } } catch (e2) {}
        self.client = null;
        self.bus.publish('anam.failed', { message: self.lastError });
        return false;
      });
  };

  AnamDirector.prototype.stop = function () {
    this.cancelFeed();
    try {
      if (this.client && this.client.disconnect) { this.client.disconnect(); }
      else if (this.client && this.client.terminate) { this.client.terminate(); }
    } catch (e) {}
    this.client = null;
    this.stream = null;
    if (this.live) {
      this.live = false;
      if (this.stage) { this.stage.classList.remove('video-mode'); }
      this.bus.publish('anam.stopped', {});
    }
  };

  /* ---------- speech sink interface (SpeechDirector calls this) ----------
     Decode the ElevenLabs mp3 blob, resample to PCM16/16kHz mono (the
     exact OfflineAudioContext path SimliDirector uses), then push
     base64 chunks into the Anam passthrough stream and seal with
     endSequence(). Completion uses a duration-based settle timer; the
     Anam SDK emits persona talk events but they are numeric codes that
     vary by SDK version, so timers are the conservative default. */
  AnamDirector.prototype.playBlob = function (blob, chunkText) {
    var self = this;
    if (!this.live || !this.client || !this.stream) { return Promise.reject(new Error('anam not live')); }
    if (this.feed) { this.cancelFeed(); }
    return blob.arrayBuffer().then(function (ab) {
      var AC = window.AudioContext || window.webkitAudioContext;
      var decodeCtx = new AC();
      return decodeCtx.decodeAudioData(ab).then(function (decoded) {
        var sr = 16000;
        var len = Math.max(1, Math.ceil(decoded.duration * sr));
        var off = new OfflineAudioContext(1, len, sr);
        var src = off.createBufferSource();
        src.buffer = decoded;
        src.connect(off.destination);
        src.start();
        return off.startRendering().then(function (rendered) {
          if (decodeCtx.close) { decodeCtx.close(); }
          var durMs = decoded.duration * 1000;
          var ch = rendered.getChannelData(0);
          var pcm = new Int16Array(ch.length);
          var i, v;
          for (i = 0; i < ch.length; i++) {
            v = Math.max(-1, Math.min(1, ch[i]));
            pcm[i] = v < 0 ? v * 32768 : v * 32767;
          }
          var bytes = new Uint8Array(pcm.buffer);
          var CHUNK = 12000, pos = 0;
          var feed = { iv: null, doneTimer: null, done: null, active: true, sentAll: false };
          self.feed = feed;
          var p = new Promise(function (resolve) { feed.done = resolve; });

          function b64(u8) {
            var out = [], n = u8.length, j = 0;
            while (j < n) {
              out.push(String.fromCharCode.apply(null, u8.subarray(j, Math.min(j + 0x8000, n))));
              j += 0x8000;
            }
            return btoa(out.join(''));
          }

          function finishFeed() {
            if (self.feed === feed) { self.feed = null; }
            feed.active = false;
            if (feed.iv) { clearInterval(feed.iv); feed.iv = null; }
            if (feed.doneTimer) { clearTimeout(feed.doneTimer); feed.doneTimer = null; }
            if (feed.done) { feed.done(); }
          }

          var iv = setInterval(function () {
            if (self.feed !== feed || !feed.active) { clearInterval(iv); return; }
            if (!self.live) { clearInterval(iv); self.cancelFeed(); return; }
            if (pos >= bytes.length) {
              clearInterval(iv);
              feed.iv = null;
              feed.sentAll = true;
              try { self.stream.endSequence(); } catch (e) {}
              feed.doneTimer = setTimeout(finishFeed, Math.min(durMs + 300, 2200));
              return;
            }
            var end = Math.min(pos + CHUNK, bytes.length);
            try { self.stream.sendAudioChunk(b64(bytes.slice(pos, end))); }
            catch (e) { clearInterval(iv); self.cancelFeed(); return; }
            pos = end;
          }, 85);
          feed.iv = iv;
          return p;
        });
      }, function (e) { if (decodeCtx.close) { decodeCtx.close(); } throw e; });
    });
  };

  /* ---------- cancellation (barge-in / sound off) ---------- */
  AnamDirector.prototype.cancelFeed = function () {
    var f = this.feed;
    if (!f) { return; }
    this.feed = null;
    f.active = false;
    if (f.iv) { clearInterval(f.iv); }
    if (f.doneTimer) { clearTimeout(f.doneTimer); }
    if (f.done) { f.done(); }
    try { if (this.live && this.client && this.client.interruptPersona) { this.client.interruptPersona(); } } catch (e) {}
  };

  window.OUTLOUD = window.OUTLOUD || {};
  window.OUTLOUD.AnamDirector = AnamDirector;
})();
