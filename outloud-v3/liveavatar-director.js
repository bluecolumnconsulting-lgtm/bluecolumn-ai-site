/* ===============================================================
   OutLoud 2.0 - LIVEAVATAR DIRECTOR (live video avatar, flagged)
   LiveAvatar by HeyGen, Avatar Only (LITE) mode behind a feature
   flag. Follows the SimliDirector contract exactly:
     capable() / attach(stage) / unmute() / start() / stop()
     playBlob(blob, chunkText) / cancelFeed()
   plus bus events prefixed liveavatar.*.

   How LITE mode works
   (docs.liveavatar.com/docs/lite-mode/lifecycle + events):
     - The backend creates a session token configured for LITE
       (POST /v1/sessions/token) and starts the session
       (POST /v1/sessions/start), then hands the frontend the
       command WebSocket url plus LiveKit room credentials.
     - LiveAvatar sends the avatar into the LiveKit room; the
       browser subscribes with the vendored livekit-client and
       renders the remote video track into a <video> element.
     - Speech audio (our ElevenLabs blobs) is decoded to PCM16,
       24 kHz, mono, Base64, and pushed as agent.speak chunks over
       the WebSocket; agent.speak_end seals the utterance and
       agent.interrupt is the barge-in. LiveAvatar renders the
       lip-synced face and voice into the room.

   KEY SAFETY: raw LiveAvatar keys never ship in client JS. The
   adapter requires CONFIG.avatar.providers.liveavatar.tokenEndpoint
   (same-origin proxy that returns the WS url + LiveKit creds).
   SECRETS.liveavatarKey exists only so the future proxy has one
   documented home for it; the browser never reads it.

   Free test path: Sandbox Mode (is_sandbox on the token call) runs
   the Wayne avatar with no credit usage and about 1-minute sessions
   (docs.liveavatar.com/docs/sandbox-mode).

   The sprite rig stays mounted underneath as the honest fallback.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;
  var P = (CONFIG.avatar && CONFIG.avatar.providers && CONFIG.avatar.providers.liveavatar) || { enabled: false };

  function LiveAvatarDirector(bus) {
    this.bus = bus;
    this.videoEl = null;
    this.audioEl = null;
    this.stage = null;
    this.room = null;          /* LiveKit Room */
    this.ws = null;            /* command WebSocket */
    this.wsReady = false;
    this.live = false;
    this.starting = false;
    this.feed = null;          /* { iv, doneTimer, done } active feed */
    this.keepAlive = null;
    this.lastError = null;
  }

  LiveAvatarDirector.prototype.ready = function () {
    return !!(this.live && this.wsReady && this.room);
  };

  LiveAvatarDirector.prototype.capable = function () {
    if (!P || P.enabled === false) {
      return { ok: false, why: 'liveavatar provider disabled (flag off, no key configured)' };
    }
    var ua = navigator.userAgent || '';
    var inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|TikTok/i.test(ua);
    return {
      ok: !inApp && !!window.RTCPeerConnection && !!window.WebSocket && !!P.tokenEndpoint && !!this.livekitGlobal(),
      why: inApp ? 'in-app browser blocks WebRTC'
         : !window.RTCPeerConnection ? 'no WebRTC support'
         : !window.WebSocket ? 'no WebSocket support'
         : !P.tokenEndpoint ? 'no liveavatar token endpoint in config'
         : !this.livekitGlobal() ? 'livekit-client did not load' : null
    };
  };

  LiveAvatarDirector.prototype.livekitGlobal = function () {
    var names = [P.livekitGlobal || 'LivekitClient', 'LivekitClient', 'LiveKit'];
    for (var i = 0; i < names.length; i++) {
      if (window[names[i]] && window[names[i]].Room) { return window[names[i]]; }
    }
    return null;
  };

  /* Session details from the proxy: { wsUrl, liveKitUrl, liveKitToken }.
     The proxy performs POST /v1/sessions/token + POST /v1/sessions/start
     with the LITE-mode token and returns these three values
     (docs.liveavatar.com/docs/lite-mode/lifecycle). */
  LiveAvatarDirector.prototype.getSession = function () {
    return fetch(P.tokenEndpoint, { method: 'POST' }).then(function (res) {
      if (!res.ok) { throw new Error('liveavatar token endpoint ' + res.status); }
      return res.json();
    }).then(function (data) {
      if (!data.wsUrl || !data.liveKitUrl || !data.liveKitToken) {
        throw new Error('liveavatar token endpoint missing wsUrl/liveKitUrl/liveKitToken');
      }
      return data;
    });
  };

  /* ---------- mount: video rides inside the gaze wrapper so the
     existing gesture/gaze transforms still lean the live face ---------- */
  LiveAvatarDirector.prototype.attach = function (stageHost) {
    if (!P || P.enabled === false) { return; }  /* keep stage clean */
    this.stage = stageHost;
    var wrap = stageHost.querySelector('#mascot-gaze') || stageHost;
    this.videoEl = document.createElement('video');
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

  LiveAvatarDirector.prototype.unmute = function () {
    try {
      this.videoEl.muted = false;
      this.audioEl.muted = false;
      if (this.videoEl.play) { this.videoEl.play().catch(function () {}); }
      if (this.audioEl.play) { this.audioEl.play().catch(function () {}); }
    } catch (e) {}
  };

  /* ---------- room + command channel ---------- */
  LiveAvatarDirector.prototype.connectRoom = function (s) {
    var self = this;
    var LK = this.livekitGlobal();
    var room = new LK.Room({ adaptiveStream: true, dynacast: true });
    this.room = room;
    room.on('trackSubscribed', function (track) {
      try {
        if (track.kind === 'video' && self.videoEl) { track.attach(self.videoEl); }
        else if (track.kind === 'audio' && self.audioEl) { track.attach(self.audioEl); }
      } catch (e) {
        /* older livekit-client builds return a new element instead of
           attaching in place; fall back to a MediaStream handoff */
        try {
          var msTrack = track.mediaStreamTrack;
          if (msTrack && self.videoEl) {
            self.videoEl.srcObject = new MediaStream([msTrack]);
          }
        } catch (e2) {}
      }
    });
    room.on('disconnected', function () {
      if (self.live) { self.stop(); }
    });
    return room.connect(s.liveKitUrl, s.liveKitToken).then(function () { return room; });
  };

  LiveAvatarDirector.prototype.connectWs = function (wsUrl) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var ws = new WebSocket(wsUrl);
      var settled = false;
      var timer = setTimeout(function () {
        if (!settled) { settled = true; try { ws.close(); } catch (e) {} reject(new Error('liveavatar ws timeout')); }
      }, P.connectTimeoutMs || 12000);
      ws.onmessage = function (ev) {
        var msg = null;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg && msg.type === 'session.state_updated') {
          var st = (msg.payload && msg.payload.state) || msg.state;   /* docs merge fields at the top level; nested read is a version safety net */
          if (st === 'connected') {
            /* docs: wait for state "connected" before any command events */
            self.wsReady = true;
            if (!settled) { settled = true; clearTimeout(timer); resolve(ws); }
          }
        } else if (msg && msg.type === 'agent.speak_finished') {
          self.bus.publish('liveavatar.silent', {});
        } else if (msg && msg.type === 'error') {
          console.warn('[outloud] liveavatar ws error event', msg);
        }
      };
      ws.onerror = function () {
        if (!settled) { settled = true; clearTimeout(timer); reject(new Error('liveavatar ws error')); }
      };
      ws.onclose = function () {
        self.wsReady = false;
        if (self.live) { self.stop(); }
      };
    });
  };

  /* ---------- session lifecycle ---------- */
  LiveAvatarDirector.prototype.start = function () {
    var self = this;
    if (this.live || this.starting) { return Promise.resolve(true); }
    var cap = this.capable();
    if (!cap.ok) {
      this.lastError = cap.why;
      this.bus.publish('liveavatar.failed', { message: cap.why });
      return Promise.resolve(false);
    }
    this.starting = true;
    this.bus.publish('liveavatar.starting', {});
    if (this.stage) { this.stage.classList.add('connecting'); }  /* hide sprite during handshake */

    return this.getSession()
      .then(function (s) { return self.connectRoom(s).then(function () { return s; }); })
      .then(function (s) { return self.connectWs(s.wsUrl); })
      .then(function (ws) {
        self.ws = ws;
        return Promise.all([
          self.videoEl.play().catch(function () {}),
          self.audioEl.play().catch(function () {})
        ]);
      })
      .then(function () {
        self.live = true;
        self.starting = false;
        /* LITE sessions idle out after 5 minutes without a heartbeat
           (docs.lite-mode/events): session.keep_alive */
        self.keepAlive = setInterval(function () {
          self.sendCommand({ type: 'session.keep_alive' });
        }, 60000);
        if (self.stage) { self.stage.classList.remove('connecting'); }
        self.stage.classList.add('video-mode');
        self.bus.publish('liveavatar.live', {});
        return true;
      })
      .catch(function (e) {
        self.starting = false;
        if (self.stage) { self.stage.classList.remove('connecting'); }
        self.lastError = (e && e.message) || 'unknown';
        try { if (self.room) { self.room.disconnect(); } } catch (e2) {}
        self.room = null;
        self.bus.publish('liveavatar.failed', { message: self.lastError });
        return false;
      });
  };

  LiveAvatarDirector.prototype.sendCommand = function (obj) {
    try {
      if (this.ws && this.wsReady) { this.ws.send(JSON.stringify(obj)); return true; }
    } catch (e) {}
    return false;
  };

  LiveAvatarDirector.prototype.stop = function () {
    this.cancelFeed();
    if (this.keepAlive) { clearInterval(this.keepAlive); this.keepAlive = null; }
    try { if (this.ws) { this.ws.close(); } } catch (e) {}
    this.ws = null;
    this.wsReady = false;
    try { if (this.room) { this.room.disconnect(); } } catch (e) {}
    this.room = null;
    if (this.live) {
      this.live = false;
      if (this.stage) { this.stage.classList.remove('video-mode'); }
      this.bus.publish('liveavatar.stopped', {});
    }
  };

  /* ---------- speech sink interface (SpeechDirector calls this) ----------
     Decode the ElevenLabs mp3 blob, resample to PCM16/24kHz mono
     (LiveAvatar LITE requires 24 kHz; we synthesize at 44.1 kHz), then
     push ~1s agent.speak chunks over the WebSocket and seal the
     utterance with agent.speak_end. Finish detection prefers the
     agent.speak_finished response event; a duration-based settle timer
     is the fallback because event names may vary across API versions. */
  LiveAvatarDirector.prototype.playBlob = function (blob, chunkText) {
    var self = this;
    if (!this.ready()) { return Promise.reject(new Error('liveavatar not live')); }
    if (this.feed) { this.cancelFeed(); }
    return blob.arrayBuffer().then(function (ab) {
      var AC = window.AudioContext || window.webkitAudioContext;
      var decodeCtx = new AC();
      return decodeCtx.decodeAudioData(ab).then(function (decoded) {
        var sr = 24000;
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
          /* ~1 second of 24kHz PCM16 = 48000 bytes, well under the 1MB
             WS packet cap from the docs */
          var CHUNK = 48000, pos = 0;
          var feed = { iv: null, doneTimer: null, done: null, active: true, sentAll: false, utterance: null };
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

          var onFinish = function () {
            if (self.feed === feed && feed.sentAll) { finishFeed(); }
          };
          self.bus.on('liveavatar.silent', onFinish);

          var iv = setInterval(function () {
            if (self.feed !== feed || !feed.active) { clearInterval(iv); return; }
            if (!self.live || !self.wsReady) { clearInterval(iv); self.cancelFeed(); return; }
            if (pos >= bytes.length) {
              clearInterval(iv);
              feed.iv = null;
              feed.sentAll = true;
              /* seal the utterance; docs allow a trailing audio chunk */
              /* on speak_end, we keep it empty */
              self.sendCommand({ type: 'agent.speak_end' });
              feed.doneTimer = setTimeout(finishFeed, Math.min(durMs + 300, 2200));
              return;
            }
            var end = Math.min(pos + CHUNK, bytes.length);
            var cmd = { type: 'agent.speak', audio: b64(bytes.slice(pos, end)) };
            if (pos === 0) {
              feed.utterance = 'u-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
              cmd.event_id = feed.utterance;   /* names the utterance */
            }
            if (!self.sendCommand(cmd)) { clearInterval(iv); self.cancelFeed(); return; }
            pos = end;
          }, 110);
          feed.iv = iv;
          return p;
        });
      }, function (e) { if (decodeCtx.close) { decodeCtx.close(); } throw e; });
    });
  };

  /* ---------- cancellation (barge-in / sound off) ----------
     agent.interrupt clears buffered audio and pending video generation
     and seals the current utterance (docs.lite-mode/events). */
  LiveAvatarDirector.prototype.cancelFeed = function () {
    var f = this.feed;
    if (!f) { return; }
    this.feed = null;
    f.active = false;
    if (f.iv) { clearInterval(f.iv); }
    if (f.doneTimer) { clearTimeout(f.doneTimer); }
    if (f.done) { f.done(); }
    if (this.live && this.wsReady) { this.sendCommand({ type: 'agent.interrupt' }); }
  };

  window.OUTLOUD = window.OUTLOUD || {};
  window.OUTLOUD.LiveAvatarDirector = LiveAvatarDirector;
})();
