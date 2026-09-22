/* ===============================================================
   OutLoud for AUTOMATTIC — RUNTIME CONFIG (load FIRST, before any layer)
   Prospect demo build, 2026-09-21. Cloned from outloud-v2 (spec
   sess_q6q730f3) and re-branded for Automatic.com → Automattic.

   Differences from the OutLoud product page:
     • Avatar = the orange mascot (sprite viseme rig), sprite-only —
       no Simli video session on this page.
     • Live RAG is OFF: the BlueColumn namespace holds OutLoud
       product knowledge, not Automattic knowledge. The Automattic
       catalog below (sourced from automattic.com, 2026-09-21) is
       the single knowledge source, so answers stay accurate.

   ⚠️ SECRETS BLOCK — same edge-proxy TODO as outloud-v2.
   =============================================================== */
(function () {
  'use strict';

  /* ============ ⚠️ SECRETS — MOVE TO EDGE PROXY ⚠️ ============ */
  var SECRETS = {
    blueColumnKey: 'bc_live_p3NlMdAVuCXATRiffBsQLDTRy6p_cUPy',
    elevenLabsKey: 'sk_6b9aa7c4edd19c804554e48fd48dac0dc3686a3fb49cc843'
  };

  var CONFIG = {
    protocolVersion: '2.0',

    endpoints: {
      blueColumnBase: 'https://xkjkwqbfvkswwdmbtndo.supabase.co/functions/v1',
      ttsBase: 'https://api.elevenlabs.io/v1/text-to-speech/'
    },

    /* --- Voice stack (Speech Director) --- */
    voice: {
      provider: 'elevenlabs',
      model: 'eleven_flash_v2_5',
      voiceId: 'iLVmqjzCGGvqtMCk6vVQ', // same verified OutLoud voice
      outputFormat: 'mp3_44100_128',
      streamChunks: true
    },

    /* --- Live RAG — DISABLED on this page (see header note).
         The catalog is the brain. --- */
    rag: {
      disabled: true,
      timeoutMs: 650,
      minAnswerChars: 8,
      notInContext: /not in available context/i
    },

    /* --- Business identity (Context 1 prefix) --- */
    business: {
      name: 'OutLoud for Automattic',
      ragPrefix: 'Automattic company and product question: '
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
    session: { storageKey: 'outloud20-session-automatic' }
  };

  window.OUTLOUD = window.OUTLOUD || {};
  window.OUTLOUD.CONFIG = CONFIG;
  window.OUTLOUD.SECRETS = SECRETS;
})();