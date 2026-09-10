/* ===============================================================
   BC Avatar Provider Layer (Replicate / MuseTalk) — v1 MVP
   Part of the Replicate-stack talking-avatar replacement for the
   Simli video path on /showcase/the-rewards-club/.

   Pure addition — no existing file is modified or referenced by
   cache-busted URL. Wiring steps: see replicate/README.md.

   VERIFIED MODEL SLUGS (checked 2026-09-10 on replicate.com):
   - PRIMARY : tmappdev/lipsync   (MuseTalk, image+audio -> video,
              ~$0.05-0.09 per run, A100 80GB, ~62s typical)
   - FALLBACK: cjwbw/sadtalker    (single-image talking face,
              ~$0.09 per run, ~66s typical)
   - DEAD (do NOT use): marvinhattie/wav2lip, cjwbw/wav2lip — both
     return 404 as of 2026-09-10.

   TOKEN POLICY: no Replicate token is hardcoded. In Node/tests the
   provider reads globalThis.REPLICATE_API_TOKEN. In the browser the
   provider NEVER sees a token — it calls the Cloudflare Worker proxy
   (worker/replicate-proxy.js, deployed separately with Joe's OK).
   =============================================================== */
(function (root) {
  'use strict';

  /* ------------------ CONFIG BLOCK ----------------------------
     Override any of these at runtime, before this file loads its
     consumers, via:  window.BCReplicateConfig = { proxyUrl: '...' }
     ------------------------------------------------------------ */
  var CONFIG = {
    /* Cloudflare Worker proxy base URL (set after Joe approves deploy).
       Example: 'https://bc-replicate-proxy.<account>.workers.dev' */
    proxyUrl: (root.BCReplicateConfig && root.BCReplicateConfig.proxyUrl) || '',
    /* Primary model: MuseTalk lipsync */
    model: 'tmappdev/lipsync',
    /* Fallback model (single image -> talking face) */
    fallbackModel: 'cjwbw/sadtalker',
    /* Poll interval + timeout for predictions (ms) */
    pollMs: 1500,
    timeoutMs: 180000,
    /* Timeout for the mock provider "generation" (ms) — simulates latency */
    mockLatencyMs: 250
  };

  function mergeConfig(extra) {
    if (extra) { for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) { CONFIG[k] = extra[k]; } } }
    return CONFIG;
  }

  /* ------------------ PHASE-2 INTERFACES (declared, not implemented)
     AvatarRenderer  — draws a video/audio stream into the stage DOM.
       contract: render(source) / clear() / isPlaying()
     AudioStream     — streaming PCM/MP3 source (Simli-style live feed
       or incremental TTS chunks). contract: open()/push(chunk)/end()
     VideoTransport  — delivery channel for generated clips (blob URL,
       HLS, WebRTC). contract: attach(el)/deliver(url)
     These are intentionally stubs for MVP; the concrete renderer used
     today lives in avatar-bridge.js (direct <video> playback).
     ------------------------------------------------------------ */
  function AvatarRenderer() {}
  AvatarRenderer.prototype.render = function () { throw new Error('AvatarRenderer.render: not implemented (phase 2)'); };
  function AudioStream() {}
  AudioStream.prototype.open = function () { throw new Error('AudioStream.open: not implemented (phase 2)'); };
  function VideoTransport() {}
  VideoTransport.prototype.deliver = function () { throw new Error('VideoTransport.deliver: not implemented (phase 2)'); };

  /* ------------------ SHARED: result contract -----------------
     generate({ image, audio, text }) resolves to:
       { videoUrl: string|null,   // playable mp4 (null => audio-only)
         audioUrl: string|null,   // playable mp3 fallback
         cached: boolean,
         provider: string,
         meta: object }
     Rejects with Error carrying .stage: 'validate'|'tts'|'generate'|'network'
     ------------------------------------------------------------ */
  function assertContract(request) {
    if (!request || (!request.image && !request.imageUrl)) {
      var e = new Error('AvatarProvider.generate requires image (dataURL/URL) or imageUrl');
      e.stage = 'validate'; throw e;
    }
    if (!request.audio && !request.audioUrl) {
      var e2 = new Error('AvatarProvider.generate requires audio (dataURL/URL) or audioUrl');
      e2.stage = 'validate'; throw e2;
    }
  }

  /* ================= AvatarProvider (interface) =============== */
  function AvatarProvider() {}
  AvatarProvider.prototype.generate = function () { throw new Error('AvatarProvider.generate: implement in subclass'); };
  AvatarProvider.prototype.warmup = function () { return Promise.resolve({ warmed: false }); };

  /* ================= ReplicateAvatarProvider ==================
     Talks to the Cloudflare Worker proxy (browser) or the Replicate
     API directly (Node/tests, when REPLICATE_API_TOKEN is present).
     The proxy holds the token server-side. Response contract from
     the proxy: 200 { videoUrl } | 202 { pollUrl } | 4xx { error }
     ------------------------------------------------------------ */
  function ReplicateAvatarProvider(opts) {
    opts = opts || {};
    this.proxyUrl = opts.proxyUrl || CONFIG.proxyUrl;
    this.model = opts.model || CONFIG.model;
    this.fallbackModel = opts.fallbackModel || CONFIG.fallbackModel;
    this.pollMs = opts.pollMs || CONFIG.pollMs;
    this.timeoutMs = opts.timeoutMs || CONFIG.timeoutMs;
    this._fetch = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    if (!this._fetch) { throw new Error('ReplicateAvatarProvider requires fetch'); }
  }
  ReplicateAvatarProvider.prototype = Object.create(AvatarProvider.prototype);
  ReplicateAvatarProvider.prototype.constructor = ReplicateAvatarProvider;

  ReplicateAvatarProvider.prototype.generate = function (request) {
    var self = this;
    assertContract(request);
    var body = {
      image: request.imageUrl || request.image,
      audio: request.audioUrl || request.audio,
      model: request.model || self.model
    };
    return self._post(self.proxyUrl.replace(/\/$/, '') + '/generate', body)
      .then(function (res) {
        if (res.status === 200) { return res.json(); }
        if (res.status === 202) { return self._poll(res); }
        return res.json().catch(function () { return {}; }).then(function (err) {
          var e = new Error(err.error || 'proxy ' + res.status);
          e.stage = 'generate'; throw e;
        });
      })
      .then(function (data) {
        return {
          videoUrl: data.videoUrl || null,
          audioUrl: request.audioUrl || (request.audio ? null : null),
          cached: !!data.cached,
          provider: 'replicate:' + (data.model || body.model),
          meta: { predictionId: data.predictionId || null, source: 'replicate' }
        };
      });
  };

  ReplicateAvatarProvider.prototype._post = function (url, body) {
    return this._fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  };

  ReplicateAvatarProvider.prototype._poll = function (initialRes) {
    var self = this;
    var pollUrl = null;
    return initialRes.json().then(function (first) {
      pollUrl = first.pollUrl;
      if (!pollUrl) { throw new Error('202 without pollUrl'); }
      var started = Date.now();
      function tick() {
        if (Date.now() - started > self.timeoutMs) {
          var te = new Error('generation timed out after ' + self.timeoutMs + 'ms');
          te.stage = 'generate'; return Promise.reject(te);
        }
        return self._fetch(pollUrl).then(function (r) { return r.json(); }).then(function (d) {
          if (d.status === 'done') { return d; }
          if (d.status === 'failed' || d.status === 'error') {
            var e = new Error(d.error || 'prediction failed'); e.stage = 'generate'; throw e;
          }
          return new Promise(function (resolve) { setTimeout(resolve, self.pollMs); }).then(tick);
        });
      }
      return tick();
    });
  };

  /* Node-only direct mode (tests / scripts): bypasses proxy, token from
     the environment. Never runs in the browser. */
  ReplicateAvatarProvider.prototype.generateDirect = function (request) {
    var token = root.REPLICATE_API_TOKEN || '';
    var self = this;
    if (!token) {
      var e = new Error('REPLICATE_API_TOKEN not set — direct mode unavailable (use proxy)');
      e.stage = 'validate'; return Promise.reject(e);
    }
    assertContract(request);
    var api = 'https://api.replicate.com/v1';
    var payload = { input: { image: request.imageUrl || request.image, audio: request.audioUrl || request.audio } };
    return self._fetch(api + '/models/' + (request.model || self.model) + '/predictions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) { var e = new Error('replicate ' + r.status); e.stage = 'network'; throw e; }
      return r.json();
    }).then(function (p) {
      var started = Date.now();
      function tick() {
        if (Date.now() - started > self.timeoutMs) {
          var te = new Error('generation timed out'); te.stage = 'generate'; return Promise.reject(te);
        }
        return self._fetch(api + '/predictions/' + p.id, { headers: { 'Authorization': 'Bearer ' + token } })
          .then(function (r2) { return r2.json(); })
          .then(function (st) {
            if (st.status === 'succeeded') { return st.output; }
            if (st.status === 'failed' || st.status === 'canceled') {
              var e = new Error('prediction ' + st.status); e.stage = 'generate'; throw e;
            }
            return new Promise(function (res) { setTimeout(res, self.pollMs); }).then(tick);
          });
      }
      return tick();
    }).then(function (output) {
      var url = Array.isArray(output) ? output[0] : output;
      return {
        videoUrl: typeof url === 'string' ? url : null,
        audioUrl: null,
        cached: false,
        provider: 'replicate-direct:' + (request.model || self.model),
        meta: { source: 'replicate-direct' }
      };
    });
  };

  /* ================= MockAvatarProvider =======================
     Fully functional without any token. Returns the ORIGINAL audio
     back as audioUrl with videoUrl=null; the bridge then plays the
     audio through the existing mouth-animation path. Simulates
     realistic latency so the state machine can be observed.
     ------------------------------------------------------------ */
  function MockAvatarProvider(opts) {
    opts = opts || {};
    this.latencyMs = opts.latencyMs != null ? opts.latencyMs : CONFIG.mockLatencyMs;
    this.label = 'mock';
  }
  MockAvatarProvider.prototype = Object.create(AvatarProvider.prototype);
  MockAvatarProvider.prototype.constructor = MockAvatarProvider;

  MockAvatarProvider.prototype.generate = function (request) {
    var self = this;
    assertContract(request); /* same validation as the real provider */
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve({
          videoUrl: request.mockVideoUrl || null,
          audioUrl: request.audioUrl || request.audio,
          cached: false,
          provider: 'mock',
          meta: { latencyMs: self.latencyMs, note: 'no Replicate token on this machine; mock path active' }
        });
      }, self.latencyMs);
    });
  };

  /* ================= Hash-based clip cache ====================
     Key = FNV-1a(image|audio-ref|text). In-memory Map for MVP.
     KV upgrade path: replace ClipCache.get/put bodies with
       env.CLIPS.get(key, 'json') / env.CLIPS.put(key, json)
     inside the Cloudflare Worker (worker/replicate-proxy.js), keyed
     the same way — the browser contract does not change.
     ------------------------------------------------------------ */
  function fnv1a(str) {
    var h = 0x811c9dc5, i;
    for (i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('00000000' + h.toString(36)).slice(-8);
  }

  function ClipCache() { this.map = new Map(); }
  ClipCache.prototype.key = function (image, text) {
    return 'clip_' + fnv1a(String(image) + '|' + String(text || ''));
  };
  ClipCache.prototype.get = function (key) {
    return this.map.has(key) ? this.map.get(key) : null;
  };
  ClipCache.prototype.put = function (key, value) {
    this.map.set(key, value);
    return key;
  };
  ClipCache.prototype.size = function () { return this.map.size; };

  /* ================= Exports ================================== */
  var api = {
    CONFIG: CONFIG,
    mergeConfig: mergeConfig,
    AvatarProvider: AvatarProvider,
    AvatarRenderer: AvatarRenderer,
    AudioStream: AudioStream,
    VideoTransport: VideoTransport,
    ReplicateAvatarProvider: ReplicateAvatarProvider,
    MockAvatarProvider: MockAvatarProvider,
    ClipCache: ClipCache,
    fnv1a: fnv1a
  };

  root.BCAvatarProviders = api;
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
