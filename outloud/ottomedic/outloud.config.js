/* ===============================================================
   OutLoud for OTTOMEDIC — RUNTIME CONFIG (load FIRST, before any layer)
   Client demo build, 2026-09-21. Cloned from outloud-v2 (spec
   sess_q6q730f3), re-branded for OttoMedic per Joe's direction:
   "look up the landing page you already built and use all of the
   information/content from that existing page as the source material."

   Source material (in-repo):
     • showcase/project-home-spark/ — the OttoMedic Lovable landing
       page bundle (models, specs, guarantees, testimonials) and
       Marina's widget agent (widget/site-avatar.js INTENTS).
     • Live BlueColumn brain: "OttoMedic product knowledge base v2 —
       Marina brain" namespace — verified answering live 2026-09-21.

   Differences from the OutLoud product page:
     • Avatar = the orange mascot (sprite viseme rig), sprite-only —
       no Simli video session on this page. Mascot persona: Otto.
     • Voice = the same OutLoud/client-page voice (iLVmqjz…, Antonio),
       matching the Arcadia client page convention.
     • Live RAG ON: brainPrefix targets the OttoMedic namespace;
       the OttoMedic catalog below is the instant fallback.

   ⚠️ SECRETS BLOCK — same edge-proxy TODO as outloud-v2.
   =============================================================== */
(function () {
  'use strict';

  /* ============ ⚠️ SECRETS — MOVE TO EDGE PROXY ⚠️ ============ */
  var SECRETS = {
    blueColumnKey: 'bc_live_p3NlMdAVuCXATRiffBsQLDTRy6p_cUPy',
    elevenLabsKey: 'sk_6b9…c843'
  };

  var CONFIG = {
    protocolVersion: '2.0',

    endpoints: {
      blueColumnBase: 'https://api.bluecolumn.ai',
      ttsBase: 'https://api.elevenlabs.io/v1/text-to-speech/'
    },

    /* --- Voice stack (Speech Director) --- */
    voice: {
      provider: 'elevenlabs',
      model: 'eleven_flash_v2_5',
      voiceId: 'iLVmqjzCGGvqtMCk6vVQ', // same voice as the Arcadia client page + OutLoud
      outputFormat: 'mp3_44100_128',
      streamChunks: true
    },

    /* --- Live RAG (BlueColumn /recall) is the PRIMARY brain —
         the namespace holds the OttoMedic "Marina brain" doc
         (verified live 2026-09-21). Catalog = instant fallback. --- */
    rag: {
      timeoutMs: 6000,
      minAnswerChars: 8,
      notInContext: /not in available context/i
    },

    /* --- Business identity (Context 1 prefix for RAG) --- */
    business: {
      name: 'OutLoud for OttoMedic',
      ragPrefix: 'OttoMedic customer question: '
    },

    /* --- Avatar: the orange mascot, sprite-only (no Simli) --- */
    avatar: {
      sprite: 'mascot-sprites.png',
      cols: 4,
      rows: 3,
      baseline: { emotion: 'friendly', energy: 0.55, posture: 'idle', initialGaze: 'user' },
      constraints: {
        allowGestures: ['present_right', 'present_left', 'present_center', 'nod', 'lean_in'],
        maxGestureIntensity: 0.8,
        avoidPointing: true,
        keepEyeContact: true
      }
    },

    /* --- Content Director (SDK-style config) --- */
    content: {
      host: '#outloud-content-panel',
      allowTakeover: true
    },

    /* --- Realtime input --- */
    vad: { rmsThreshold: 0.035, hangoverMs: 700 },

    /* --- Session --- */
    session: { storageKey: 'outloud20-session-ottomedic' }
  };

  window.OUTLOUD = window.OUTLOUD || {};
  window.OUTLOUD.CONFIG = CONFIG;
  window.OUTLOUD.SECRETS = SECRETS;
})();