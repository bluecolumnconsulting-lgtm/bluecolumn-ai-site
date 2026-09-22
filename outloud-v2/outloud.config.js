/* ===============================================================
   OutLoud 2.0 — RUNTIME CONFIG (load FIRST, before any layer)
   Part of the Response Plan Runtime (spec sess_q6q730f3, 2026-09-17).

   ⚠️ ⚠️ ⚠️  SECRETS BLOCK — MOVE TO EDGE PROXY  ⚠️ ⚠️ ⚠️
   EVERY secret the client needs lives in this ONE object. When the
   edge proxy (Cloudflare Worker) is ready:
     1. Delete SECRETS below.
     2. Point CONFIG.endpoints.* at same-origin /api/* proxy routes.
   No other file changes. The live 1.0 page scatters keys across
   files; this build deliberately does not.
   =============================================================== */
(function () {
  'use strict';

  /* ============ ⚠️ SECRETS — MOVE TO EDGE PROXY ⚠️ ============ */
  var SECRETS = {
    blueColumnKey: 'bc_live_p3NlMdAVuCXATRiffBsQLDTRy6p_cUPy',
    elevenLabsKey: 'sk_6b9aa7c4edd19c804554e48fd48dac0dc3686a3fb49cc843',
    simliKey: '5e2ucmvyrlmkapwg4hzyf'   // verified live 2026-09-21 (session token issued)
  };

  var CONFIG = {
    protocolVersion: '2.0',

    endpoints: {
      blueColumnBase: 'https://xkjkwqbfvkswwdmbtndo.supabase.co/functions/v1',
      /* TODO(edge-proxy): replace direct provider URLs with same-origin
         /api/tts and /api/rag routes so keys never reach the browser. */
      ttsBase: 'https://api.elevenlabs.io/v1/text-to-speech/'
    },

    /* --- Voice stack (Speech Director) --- */
    voice: {
      provider: 'elevenlabs',
      model: 'eleven_flash_v2_5',
      voiceId: 'iLVmqjzCGGvqtMCk6vVQ', // verified working 2026-08-24
      outputFormat: 'mp3_44100_128',
      streamChunks: true   // plan-level chunk streaming; true token streaming is TODO(edge-proxy)
    },

    /* --- Live RAG (BlueColumn /recall) is the PRIMARY brain.
         Catalog below is the instant fallback when the brain has no
         grounded answer or the network is down. --- */
    rag: {
      timeoutMs: 2500,          // quota-aware: brain down → instant catalog fallback, not a 6.5s hang
      minAnswerChars: 8,        // shorter = junk
      notInContext: /not in available context/i
    },

    /* --- Business identity (Context 1 prefix for RAG) --- */
    business: {
      name: 'OutLoud by BlueColumn',
      ragPrefix: 'OutLoud by BlueColumn product question: '
    },

    /* --- Avatar (Avatar Director, sprite adapter) --- */
    /* --- Simli video avatar (Simli Director) — sprite stays as fallback --- */
    simli: {
      faceId: '7e74d6e7-d559-4394-bd56-4923a3ab75ad',   // Joe's face — verified via session token 2026-09-21
      maxSessionLength: 600,
      maxIdleTime: 180
    },

    avatar: {
      sprite: 'mascot-sprites.png',
      cols: 4,
      rows: 3,
      baseline: { emotion: 'friendly', energy: 0.55, posture: 'idle', initialGaze: 'user' },
      constraints: {
        allowGestures: ['present_right', 'present_left', 'present_center', 'nod', 'lean_in'],
        maxGestureIntensity: 0.8,
        avoidPointing: true,   // sprite rig has no arm layer; validator degrades point_* → present_*
        keepEyeContact: true   // gaze leaves user only briefly, then returns
      }
    },

    /* --- Content Director (SDK-style config, per spec) --- */
    content: {
      host: '#outloud-content-panel',
      allowTakeover: true
    },

    /* --- Realtime input --- */
    vad: { rmsThreshold: 0.035, hangoverMs: 700 },

    /* --- Session --- */
    session: { storageKey: 'outloud20-session' }
  };

  window.OUTLOUD = window.OUTLOUD || {};
  window.OUTLOUD.CONFIG = CONFIG;
  window.OUTLOUD.SECRETS = SECRETS;
})();
