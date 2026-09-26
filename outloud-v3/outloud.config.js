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
    openaiKey: '',   // runtime key was auto-revoked by OpenAI minutes after GitHub saw it — brain key must live server-side in the proxy   // owner directive 2026-09-25: OpenAI runs the avatar brain   // key is NOT stored in the repo (GitHub push protection) — the brain proxy injects it server-side   // owner directive 2026-09-25: OpenAI runs the avatar brain (runtime fallback-provider key)   // DROP-IN: paste the OpenAI key here — owner directive 2026-09-25: OpenAI runs the avatar brain
    simliKey: '',   // DISABLED 2026-09-25 per Joe: OpenAI is the only allowed avatar provider; no third-party runs the face

    /* --- Additional avatar providers (added 2026-09-25, all empty until
        a human pastes a credential; adapters fail gracefully) ---
        anamKey:       Anam API key. Browser must NOT ship this raw in
                       prod: create session tokens server-side and point
                       CONFIG.avatar.providers.anam.tokenEndpoint at the
                       same-origin route. The raw-key path in
                       anam-director.js is a localhost dev fallback only.
        liveavatarKey: LiveAvatar (HeyGen) API key. Server-side only; the
                       browser gets session-scoped credentials from
                       liveavatar.tokenEndpoint (LITE mode).
        didClientKey:  D-ID CLIENT key (browser-safe, domain-restricted).
                       Created server-side via POST /agents/client-key
                       (the Basic API key stays server-side). Existing
                       account has ~12 credits — DO NOT spend (Joe
                       2026-09-21).
        beyondKey:     Deferred provider (needs a server-side LiveKit
                       worker; see RESEARCH.md in the avatar-providers
                       workspace). Placeholder for the future proxy. */
    anamKey: '',
    liveavatarKey: '',
    didClientKey: '',
    beyondKey: ''
  };

  var CONFIG = {
    protocolVersion: '2.0',

    endpoints: {
      blueColumnBase: 'https://api.bluecolumn.ai',
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

    /* --- Brain (owner directive 2026-09-25 16:10: OpenAI RUNS the
         avatar — it is the reasoning brain, not the face. BlueColumn
         /recall grounds it with the business's own knowledge; the
         static catalog answers only when OpenAI is unavailable. ---) */
    brain: {
      endpoint: 'https://cggcqzncdoyenlgrwnpf.supabase.co/functions/v1/agent-proxy',   // Supabase edge proxy — holds OPENAI_API_KEY server-side, origin-gated to bluecolumn.ai; demo brain is OPENAI-RUN (owner directive)
      provider: 'openai',
      model: 'gpt-4o-mini',
      timeoutMs: 9000,
      maxTokens: 220,
      groundTimeoutMs: 2500   // recall grounding never stalls the OpenAI call longer than this
    },

    /* --- Live RAG (BlueColumn /recall) is the PRIMARY brain.
         Catalog below is the instant fallback when the brain has no
         grounded answer or the network is down. --- */
    rag: {
      timeoutMs: 6000,           // brain answers land in 0.4-0.8s measured 2026-09-24; 650ms raced and lost, causing repeated canned fallbacks
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
      enabled: false,   // owner directive 2026-09-25: avatar face/motion must come from OpenAI-generated assets + in-house rig only
      faceId: '7e74d6e7-d559-4394-bd56-4923a3ab75ad',   // Joe's face — RETIRED from the live path 2026-09-25
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
      },
      /* --- Additional avatar video providers (added 2026-09-25) ---
         Feature-flagged per provider, ALL disabled. Each adapter
         implements the SimliDirector contract (capable/attach/unmute/
         start/stop/playBlob/cancelFeed) and emits its own bus events
         (anam.*, liveavatar.*, did.*). The sprite rig stays the
         always-on fallback; nothing activates without a credential AND
         an enabled:true flip. Research + activation guide live in the
         avatar-providers agent workspace (RESEARCH.md, INTEGRATION.md). */
      providers: {
        /* --- Anam (anam.ai): session-token WebRTC + audio passthrough ---
           Feed our ElevenLabs blobs as PCM16/16kHz via the SDK's
           createAgentAudioInputStream. Free tier: 30 min/mo, 3-min
           conversation cap, 1 concurrent session (anam.ai/pricing). */
        anam: {
          enabled: false,          // flip only after anamKey or tokenEndpoint exists
          esmUrl: 'https://esm.sh/@anam-ai/js-sdk@latest',  // SDK loader; vendor locally for prod
          avatarId: '',            // stock avatar id from the Anam dashboard
          avatarModel: 'cara-4',   // persona model name used at token creation
          tokenEndpoint: '',       // same-origin route issuing Anam session tokens (preferred); empty = dev raw-key path
          connectTimeoutMs: 12000
        },
        /* --- Beyond Presence (bey.dev): DEFERRED, no adapter ---
           Their browser path needs a server-side LiveKit Agents worker
           (docs.bey.dev/get-started/quickstart/speech-to-video); a
           static demo page cannot drive it. Revisit when the edge
           proxy ships. Full rationale in RESEARCH.md. */
        beyond: {
          enabled: false,          // no adapter exists for this provider
          tokenEndpoint: '',       // would issue LiveKit room credentials from the future proxy
          avatarId: ''
        },
        /* --- LiveAvatar by HeyGen: LITE mode (bring your own TTS) ---
           Command WebSocket (agent.speak / speak_end / interrupt,
           PCM16/24kHz mono base64) + LiveKit room for the video.
           tokenEndpoint must return { wsUrl, liveKitUrl, liveKitToken }.
           Free test path: Sandbox Mode (Wayne avatar, no credits,
           docs.liveavatar.com/docs/sandbox-mode). LITE costs 1 credit/min. */
        liveavatar: {
          enabled: false,          // flip only after tokenEndpoint exists
          tokenEndpoint: '',       // same-origin route: POST /v1/sessions/token + /v1/sessions/start (LITE mode)
          avatarId: '',            // sandbox: dd73ea75-1218-4ef3-92ce-606d5f7fbc0a (Wayne, no credits)
          livekitGlobal: 'LivekitClient',  // window global of the vendored livekit-client UMD build
          connectTimeoutMs: 12000
        },
        /* --- D-ID Agents SDK ---
           speakMode 'text': D-ID renders its own voice from chunk text
           (consumes D-ID credits per speak). speakMode 'audio': speaks
           our ElevenLabs mp3 via speak({type:'audio', audio_url}) but
           needs an upload proxy returning { audioUrl }. EXISTING ACCOUNT
           HAS ~12 CREDITS (Joe 2026-09-21) — DO NOT SPEND; test only with
           Joe's approval or on a fresh trial account. */
        did: {
          enabled: false,          // flip only after a client key exists AND credit spend is approved
          agentId: '',             // D-ID agent id from the dashboard
          sdkSrc: 'vendor/d-id-client-sdk.js',   // vendored UMD build (documented in INTEGRATION.md)
          sdkGlobal: 'DID',        // window global exposed by the vendored build (verify after vendoring)
          speakMode: 'text',       // 'text' (D-ID voice, credit-consuming) | 'audio' (needs audioUploadEndpoint)
          audioUploadEndpoint: '', // same-origin route: accepts the mp3, returns { audioUrl } (audio mode only)
          connectTimeoutMs: 12000
        }
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
