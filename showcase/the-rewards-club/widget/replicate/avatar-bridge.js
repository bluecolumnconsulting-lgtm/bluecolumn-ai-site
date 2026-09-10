/* ===============================================================
   BC Replicate Avatar Bridge v1 — drop-in replacement for the
   Simli video path on /showcase/the-rewards-club/.
   PURE ADDITION: loads after site-avatar.js; owns no existing
   element references at load time, only after wiring (below).

   ================================================================
   EXACT FUTURE WIRING DIFF (apply AFTER the parity agent finishes,
   ~5 lines total; do not apply while parity work is in flight):
   ================================================================
   1) index.html — after the existing
        <script src="widget/site-avatar.js?v=4"></script>
      add (one line, keep ?v= style fresh on each deploy):
        <script src="widget/replicate/replicate-stack.js?v=1"></script>

   2) site-avatar.js — two 2-line changes inside the VIDEO AVATAR
      section (replace Simli generation, keep everything else):

      a) In speakTextThroughSimli(text) — replace the body with:
           if (window.BCReplicateBridge && window.BCReplicateBridge.speakText(text)) { return; }
           // fall through to the original TTS+audio path

      b) In speakThroughSimli(url) — prepend the same guard:
           if (window.BCReplicateBridge && window.BCReplicateBridge.speakAudioUrl(url)) { return; }
           // fall through to the original Simli PCM streaming

      With this wiring the bridge is the ONLY voice in video mode:
      it returns true when it owns playback, false to let the
      original Simli code run (e.g. mock/offline mode disabled).
      The one-voice guard below cancels the previous clip exactly
      like the simliFeed pattern in site-avatar.js (newest speech
      wins; clearInterval + feed identity check), so no double
      audio is possible even if a user mashes the send button.

   3) Optional config before the stack script:
        window.BCReplicateConfig = {
          proxyUrl: 'https://bc-replicate-proxy.<account>.workers.dev',
          forceMock: false   // true => MockAvatarProvider (offline dev)
        };
   ================================================================ */
(function (root) {
  'use strict';

  var Providers = root.BCAvatarProviders;
  var TTS = root.BC_TTS;

  /* ---------------- State machine ----------------
     idle -> thinking -> generating -> speaking -> idle
                     \-> error -> idle
     ("listening" is owned by the Web Speech recognizer in
     site-avatar.js; the bridge treats it as read-only.) */
  var STATES = ['idle', 'listening', 'thinking', 'generating', 'speaking', 'error'];

  var state = {
    current: 'idle',
    /* newest-speech-wins token, mirrors the simliFeed pattern */
    feed: null,
    provider: null,
    cache: null,
    listeners: {},
    imageRef: null,   /* resolved mascot image reference for the cache key */
    elements: null,
    playingEl: null,
    playingUrl: null
  };

  function setState(s) {
    if (STATES.indexOf(s) === -1) { return; }
    state.current = s;
    emit('state', s);
    var host = state.elements && state.elements.avatar;
    if (host) {
      STATES.forEach(function (name) {
        if (s === name) { host.classList.add('bc-rp-' + name); }
        else { host.classList.remove('bc-rp-' + name); }
      });
      host.classList.toggle('bc-talking', s === 'speaking');
    }
  }

  function on(evt, cb) {
    (state.listeners[evt] = state.listeners[evt] || []).push(cb);
  }
  function emit(evt, data) {
    (state.listeners[evt] || []).forEach(function (cb) {
      try { cb(data); } catch (e) { /* listener errors never break playback */ }
    });
  }

  /* ---------------- One-voice guard ----------------
     Cancels any active clip/feed before a new one starts. The
     returned feed token must match for completion callbacks to run
     — identical semantics to site-avatar.js simliFeed. */
  function newFeed(reason) {
    if (state.feed) {
      state.feed.cancelled = true;
      stopPlayback();
      emit('cancelled', { reason: reason });
    }
    var feed = { id: Math.random().toString(36).slice(2), cancelled: false };
    state.feed = feed;
    return feed;
  }
  function feedActive(feed) { return !!(feed && !feed.cancelled && state.feed === feed); }

  function stopPlayback() {
    if (state.playingEl) {
      try { state.playingEl.pause(); } catch (e) {}
    }
    if (state.playingUrl && state.playingUrl.indexOf('blob:') === 0) {
      try { URL.revokeObjectURL(state.playingUrl); } catch (e) {}
    }
    state.playingEl = null;
    state.playingUrl = null;
  }

  /* ---------------- Provider selection ---------------- */
  var providerOverride = null; /* test hook: inject a probe provider */
  function pickProvider() {
    if (providerOverride) { return providerOverride; }
    if (state.provider) { return state.provider; }
    var cfg = root.BCReplicateConfig || {};
    if (cfg.provider === 'replicate' || (!cfg.provider && cfg.proxyUrl)) {
      state.provider = new Providers.ReplicateAvatarProvider({ proxyUrl: cfg.proxyUrl });
    } else {
      /* No proxy configured yet (Joe has not approved the Worker
         deploy): Mock provider keeps the full flow demoable. */
      state.provider = new Providers.MockAvatarProvider();
    }
    return state.provider;
  }

  /* ---------------- Playback contract ----------------
     clip: { videoUrl|null, audioUrl|null }
     videoUrl wins; audioUrl is the fallback that drives the
     existing mouth animation (bc-talking + analyser squish).
     Returns the element used, or null. */
  function decidePlayback(clip, feed, onDone) {
    var els = state.elements;
    if (!els || !feedActive(feed)) { if (onDone) { onDone('stale'); } return null; }

    if (clip.videoUrl && els.video) {
      var v = els.video;
      stopPlayback();
      state.playingEl = v;
      state.playingUrl = v.src;
      v.src = clip.videoUrl;
      v.loop = false;
      v.onended = function () { if (feedActive(feed)) { if (onDone) { onDone('ended'); } } };
      v.onerror = function () { if (feedActive(feed)) { audioFallback(clip, feed, onDone); } };
      v.play().catch(function () {
        /* autoplay blocked -> audio fallback keeps the voice alive */
        audioFallback(clip, feed, onDone);
      });
      return v;
    }
    return audioFallback(clip, feed, onDone);
  }

  function audioFallback(clip, feed, onDone) {
    var els = state.elements;
    var a = els && (els.audio || (typeof Audio !== 'undefined' ? new Audio() : null));
    if (!a || !clip.audioUrl || !feedActive(feed)) { if (onDone) { onDone('no-media'); } return null; }
    stopPlayback();
    state.playingEl = a;
    a.src = clip.audioUrl;
    a.loop = false;
    a.onended = function () { if (feedActive(feed)) { if (onDone) { onDone('ended'); } } };
    a.onerror = function () { if (feedActive(feed)) { if (onDone) { onDone('error'); } } };
    var p = a.play();
    if (p && p.catch) { p.catch(function () { if (feedActive(feed) && onDone) { onDone('blocked'); } }); }
    return a;
  }

  /* ---------------- Public surface (video-toggle compatible) --
     init({ image, video, audio, avatar, onDone })
     speakText(text)      -> boolean (true = bridge owns the speech)
     speakAudioUrl(url)   -> boolean (cached-greeting path)
     isReady() / stop() / getState()
     ------------------------------------------------------------ */
  function byId(id) {
    return (typeof document !== 'undefined' && id) ? document.getElementById(id) : null;
  }

  function init(opts) {
    opts = opts || {};
    state.elements = {
      video: opts.video || byId('bc-video-el'),
      audio: opts.audio || byId('bc-simli-audio'),
      avatar: opts.avatar || byId('bc-avatar')
    };
    /* Image reference for provider + cache key: prefer a stable URL
       over a data URL (identical replies must reuse cached clips). */
    state.imageRef = opts.image || 'widget/lee-avatar.png';
    setState('idle');
    return api;
  }

  /* text -> TTS -> provider -> playback. Returns true when the
     bridge accepted ownership of this utterance. */
  function speakText(text, opts) {
    opts = opts || {};
    if (!text) { return false; }
    var feed = newFeed('new-text');

    /* 1) Cache: identical (image, text) -> instant replay, no TTS */
    var cacheKey = state.cache.key(state.imageRef, text);
    var cached = state.cache.get(cacheKey);
    if (cached && !opts.force) {
      emit('cache-hit', { key: cacheKey });
      setState('speaking');
      decidePlayback(cached, feed, finish(feed));
      return true;
    }

    /* 2) TTS */
    setState('thinking');
    TTS.synthesize(text, opts.ttsOpts || {}).then(function (tts) {
      if (!feedActive(feed)) { return null; }
      setState('generating');
      return tts.blob
        ? toDataURL(tts.blob).then(function (dataUrl) { return { tts: tts, audioRef: dataUrl }; })
        : { tts: tts, audioRef: null };
    }).then(function (pack) {
      if (!pack || !feedActive(feed)) { return; }
      /* 3) Provider (mock returns the audio back as audioRef) */
      var request = {
        image: state.imageRef,
        audio: pack.audioRef || undefined,
        audioUrl: pack.audioRef || undefined,
        mockVideoUrl: opts.mockVideoUrl
      };
      /* When TTS was dry-run (tests) there is no audio — the mock
         provider contract check runs in tests/mock-flow.js instead. */
      if (!request.audio && !request.audioUrl) {
        finish(feed)('no-tts');
        return;
      }
      return pickProvider().generate(request).then(function (clip) {
        if (!feedActive(feed)) { return; }
        if (clip && clip.videoUrl) { state.cache.put(cacheKey, clip); }
        setState('speaking');
        decidePlayback(clip, feed, finish(feed));
      });
    }).catch(function (err) {
      if (!feedActive(feed)) { return; }
      setState('error');
      emit('error', err || new Error('speakText failed'));
      /* Reveal the error briefly, then settle back to idle so the
         widget can fall back to the audio-only path. */
      setTimeout(function () { if (feedActive(feed)) { setState('idle'); } }, 1200);
    });

    return true;
  }

  /* Pre-rendered audio (e.g. widget/audio/greet.mp3) — same guard,
     video only if a cached clip exists for it, else audio passthrough. */
  function speakAudioUrl(url, opts) {
    opts = opts || {};
    var feed = newFeed('new-audio-url');
    var clip = state.cache.get(state.cache.key(state.imageRef, url)) ||
               { videoUrl: null, audioUrl: url };
    setState('speaking');
    decidePlayback(clip, feed, finish(feed));
    return true;
  }

  function finish(feed) {
    return function (how) {
      if (!feedActive(feed)) { return; }
      state.feed = null;
      setState('idle');
      emit('done', { how: how });
    };
  }

  function toDataURL(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  function isReady() { return !!(state.elements && state.provider); }
  function stop() {
    if (state.feed) { state.feed.cancelled = true; state.feed = null; }
    stopPlayback();
    setState('idle');
  }
  function getState() { return state.current; }

  var api = {
    init: init,
    speakText: speakText,
    speakAudioUrl: speakAudioUrl,
    isReady: isReady,
    stop: stop,
    getState: getState,
    on: on,
    STATES: STATES,
    /* test hooks */
    _internal: {
      decidePlayback: decidePlayback,
      pickProvider: pickProvider,
      setProvider: function (p) { providerOverride = p; return p; },
      state: state,
      setCache: function (c) { state.cache = c; }
    }
  };

  /* Cache is per-bridge singleton */
  if (Providers) { state.cache = new Providers.ClipCache(); }

  root.BCReplicateBridge = api;
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
