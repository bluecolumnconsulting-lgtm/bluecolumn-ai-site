/* ===============================================================
   OutLoud 2.0 - D-ID DIRECTOR (live video avatar, feature-flagged)
   D-ID Agents SDK avatar behind a feature flag. Follows the
   SimliDirector contract exactly:
     capable() / attach(stage) / unmute() / start() / stop()
     playBlob(blob, chunkText) / cancelFeed()
   plus bus events prefixed did.*.

   How it works (docs.d-id.com/docs/agent-session-quickstart):
     - A server creates a domain-restricted client key
       (POST /agents/client-key, Basic auth, allowed_domains). That
       client key is the ONLY D-ID credential that belongs in the
       browser; the Basic API key stays server-side.
     - The vendored @d-id/client-sdk createAgentManager(agentId,
       { auth, callbacks }) opens the WebRTC stream; the SDK hands
       the video via callbacks.onSrcObjectReady.
     - playBlob(): default TEXT mode sends the chunk text with
       agent.speak({type:'text'}) and D-ID renders voice + lipsync.
       AUDIO mode (agent.speak({type:'audio', audio_url})) speaks
       OUR ElevenLabs blob but needs the mp3 at a public URL, so it
       requires a same-origin upload proxy
       (CONFIG.avatar.providers.did.audioUploadEndpoint) that
       accepts the mp3 and returns { audioUrl }. Without the proxy
       the adapter falls back to text mode.

   CREDIT WARNING: every D-ID stream session and every speak consumes
   D-ID credits. The existing account holds about 12 credits
   (Joe, 2026-09-21) and they must NOT be spent on automated tests.
   Keep this provider disabled until Joe approves a test spend or a
   fresh trial account exists.

   The sprite rig stays mounted underneath as the honest fallback.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;
  var SECRETS = window.OUTLOUD.SECRETS;
  var P = (CONFIG.avatar && CONFIG.avatar.providers && CONFIG.avatar.providers.did) || { enabled: false };

  function DidDirector(bus) {
    this.bus = bus;
    this.videoEl = null;
    this.audioEl = null;
    this.stage = null;
    this.agent = null;         /* SDK AgentManager */
    this.live = false;
    this.starting = false;
    this.feed = null;          /* { doneTimer, done, active } active feed */
    this.lastError = null;
    this.lastChunkText = '';
    this._pendingSpeak = null;
    this._onChunk = this._trackChunk.bind(this);
    if (this.bus && this.bus.on) { this.bus.on('speech.chunk.start', this._onChunk); }
  }

  /* SpeechDirector strips the text from the sink call
     (sink.playBlob(blob, '')) but walks the transcript first, so the
     chunk text is recoverable from the bus. */
  DidDirector.prototype._trackChunk = function (env) {
    if (env && env.payload && env.payload.text) { this.lastChunkText = env.payload.text; }
  };

  DidDirector.prototype.ready = function () {
    return !!(this.live && this.agent);
  };

  DidDirector.prototype.sdkGlobal = function () {
    var names = [P.sdkGlobal || 'DID', 'DID', 'DIdClient', 'DIDClientSDK'];
    for (var i = 0; i < names.length; i++) {
      if (window[names[i]]) { return window[names[i]]; }
    }
    return null;
  };

  DidDirector.prototype.capable = function () {
    if (!P || P.enabled === false) {
      return { ok: false, why: 'did provider disabled (flag off, no key configured)' };
    }
    var ua = navigator.userAgent || '';
    var inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|TikTok/i.test(ua);
    return {
      ok: !inApp && !!window.RTCPeerConnection && !!SECRETS.didClientKey && !!P.agentId && !!this.sdkGlobal(),
      why: inApp ? 'in-app browser blocks WebRTC'
         : !window.RTCPeerConnection ? 'no WebRTC support'
         : !SECRETS.didClientKey ? 'no D-ID client key in config (create server-side via POST /agents/client-key)'
         : !P.agentId ? 'no did agentId in config'
         : !this.sdkGlobal() ? 'd-id client-sdk did not load' : null
    };
  };

  /* ---------- mount: video rides inside the gaze wrapper so the
     existing gesture/gaze transforms still lean the live face ---------- */
  DidDirector.prototype.attach = function (stageHost) {
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

  DidDirector.prototype.unmute = function () {
    try {
      this.videoEl.muted = false;
      this.audioEl.muted = false;
      if (this.videoEl.play) { this.videoEl.play().catch(function () {}); }
      if (this.audioEl.play) { this.audioEl.play().catch(function () {}); }
    } catch (e) {}
  };

  /* ---------- session lifecycle ---------- */
  DidDirector.prototype.start = function () {
    var self = this;
    if (this.live || this.starting) { return Promise.resolve(true); }
    var cap = this.capable();
    if (!cap.ok) {
      this.lastError = cap.why;
      this.bus.publish('did.failed', { message: cap.why });
      return Promise.resolve(false);
    }
    this.starting = true;
    this.bus.publish('did.starting', {});
    if (this.stage) { this.stage.classList.add('connecting'); }  /* hide sprite during handshake */

    return new Promise(function (resolve, reject) {
      var did = self.sdkGlobal();
      var manager = did.createAgentManager || (did.default && did.default.createAgentManager);
      if (!manager) { reject(new Error('d-id sdk loaded but createAgentManager missing')); return; }
      resolve(manager(P.agentId, {
        auth: { type: 'key', clientKey: SECRETS.didClientKey },
        callbacks: {
          onSrcObjectReady: function (stream) {
            if (self.videoEl) { self.videoEl.srcObject = stream; }
            return stream;
          },
          onConnectionStateChange: function (state) {
            if (state === 'connected' || state === 'ready') { self.bus.publish('did.ack', {}); }
          }
        }
      }));
    }).then(function (agent) {
      self.agent = agent;
      return agent.connect();
    }).then(function () {
      return self.videoEl.play().catch(function () {});
    }).then(function () {
      self.live = true;
      self.starting = false;
      if (self.stage) { self.stage.classList.remove('connecting'); }
      self.stage.classList.add('video-mode');
      self.bus.publish('did.live', {});
      return true;
    }).catch(function (e) {
      self.starting = false;
      if (self.stage) { self.stage.classList.remove('connecting'); }
      self.lastError = (e && e.message) || 'unknown';
      try { if (self.agent && self.agent.disconnect) { self.agent.disconnect(); } } catch (e2) {}
      self.agent = null;
      self.bus.publish('did.failed', { message: self.lastError });
      return false;
    });
  };

  DidDirector.prototype.stop = function () {
    this.cancelFeed();
    try { if (this.agent && this.agent.disconnect) { this.agent.disconnect(); } } catch (e) {}
    this.agent = null;
    if (this.live) {
      this.live = false;
      if (this.stage) { this.stage.classList.remove('video-mode'); }
      this.bus.publish('did.stopped', {});
    }
  };

  /* ---------- speech sink interface (SpeechDirector calls this) ----------
     The transcript walk is owned by SpeechDirector (it walks the chunk
     text on the bus before delegating here). Two modes:

     TEXT (default): recover the chunk text from the bus and send
     agent.speak({type:'text'}). D-ID renders its own voice. Completion
     uses the same pacing heuristic SpeechDirector's silent walk uses
     (34ms per char, 900ms floor) plus render padding.

     AUDIO (needs audioUploadEndpoint): upload the mp3 blob, get a URL,
     agent.speak({type:'audio', audio_url}). The settle timer arms with
     an estimate, then re-arms with the real decoded duration when the
     decode lands, so a slow decode can never stall the next chunk.
  */
  DidDirector.prototype.playBlob = function (blob, chunkText) {
    var self = this;
    if (!this.live || !this.agent) { return Promise.reject(new Error('did not live')); }
    if (this.feed) { this.cancelFeed(); }

    var speakPromise;
    var estMs = 0;   /* settle-timer estimate in ms */
    var isAudio = false;

    if (P.speakMode === 'audio' && P.audioUploadEndpoint) {
      isAudio = true;
      speakPromise = blob.arrayBuffer().then(function (ab) {
        return fetch(P.audioUploadEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'audio/mpeg' },
          body: ab
        }).then(function (res) {
          if (!res.ok) { throw new Error('did audio upload ' + res.status); }
          return res.json();
        }).then(function (data) {
          if (!data.audioUrl) { throw new Error('did audio upload returned no audioUrl'); }
          return data.audioUrl;
        });
      });
      estMs = 2000;   /* replaced by the real decoded duration when it arrives */
    } else {
      if (P.speakMode === 'audio') {
        console.warn('[outloud] did: speakMode "audio" needs audioUploadEndpoint; falling back to text mode');
      }
      var text = chunkText || this.lastChunkText || '';
      if (!text) { return Promise.reject(new Error('did text mode has no chunk text')); }
      speakPromise = Promise.resolve();
      this._pendingSpeak = { type: 'text', input: text };
      estMs = Math.max(900, text.length * 34) + 900;
    }

    var feed = { doneTimer: null, done: null, active: true };
    this.feed = feed;
    var p = new Promise(function (resolve) { feed.done = resolve; });

    function finishFeed() {
      if (self.feed === feed) { self.feed = null; }
      feed.active = false;
      if (feed.doneTimer) { clearTimeout(feed.doneTimer); feed.doneTimer = null; }
      if (feed.done) { feed.done(); }
    }

    /* settle timer arms immediately with the estimate; audio mode may
       re-arm with the real decoded duration if it is longer */
    feed.doneTimer = setTimeout(finishFeed, estMs);

    speakPromise.then(function (audioUrl) {
      var speakArg = isAudio && audioUrl
        ? { type: 'audio', audio_url: audioUrl }
        : self._pendingSpeak;
      self._pendingSpeak = null;
      return self.agent.speak(speakArg);
    }).then(function () {
      if (!isAudio || !blob || !blob.arrayBuffer) { return; }
      try {
        blob.arrayBuffer().then(function (ab) {
          var AC = window.AudioContext || window.webkitAudioContext;
          var ctx = new AC();
          ctx.decodeAudioData(ab).then(function (decoded) {
            if (ctx.close) { ctx.close(); }
            if (self.feed !== feed || !feed.active) { return; }
            var real = decoded.duration * 1000 + 900;
            if (real > estMs) {
              if (feed.doneTimer) { clearTimeout(feed.doneTimer); }
              feed.doneTimer = setTimeout(finishFeed, real);
            }
          }, function () { if (ctx.close) { ctx.close(); } });
        }).catch(function () {});
      } catch (e) {}
    }).catch(function (e) {
      console.warn('[outloud] did speak failed:', (e && e.message) || e);
      finishFeed();
    });
    return p;
  };

  /* ---------- cancellation (barge-in / sound off) ---------- */
  DidDirector.prototype.cancelFeed = function () {
    var f = this.feed;
    if (!f) { return; }
    this.feed = null;
    f.active = false;
    if (f.doneTimer) { clearTimeout(f.doneTimer); }
    if (f.done) { f.done(); }
    /* The Agents SDK manager exposes no documented stop-speak primitive;
       a new speak replaces the current one. Barge-in here clears our
       timer and the next chunk takes over the face. */
  };

  window.OUTLOUD = window.OUTLOUD || {};
  window.OUTLOUD.DidDirector = DidDirector;
})();
