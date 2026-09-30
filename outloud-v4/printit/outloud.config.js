/* ===============================================================
   Print It Prints — OutLoud v4 RUNTIME CONFIG
   Same v4 stack as bluecolumn.ai/outloud/ (protocol 2.0, spec
   sess_q6q730f3). Client-branded: no OutLoud branding, no
   BlueColumn chrome. Brain, voice, and video sessions all run
   through the secure backend function — no keys in page files.

   Per-page options (URL):
     ?client=printit      which business brain answers (default printit)
     ?avatar=kate         which avatar speaks
   =============================================================== */
(function () {
  'use strict';

  var qs = new URLSearchParams(location.search);
  var SECRETS = {};   /* kept empty for backwards compatibility */

  /* ---------- avatar catalog ---------- */
  var AVATARS = [
    { id: 'kate', name: 'Kate', type: 'video', faceId: 'd2a5c7c6-fed9-4f55-bcb3-062f7cd20103', voiceId: 'EXAVITQu4vr4xnSDxMaL' },
    { id: 'mascot', name: 'Animated mascot', type: 'animated', voiceId: 'TX3LPaxmHKxFdv7VOQHJ' }
  ];
  (window.OUTLOUD_STOCK_FACES || []).forEach(function (f) {
    if (!AVATARS.some(function (a) { return a.faceId === f.faceId; })) { AVATARS.push(f); }
  });

  /* ---------- client profiles (page-side: greeting + defaults) ---------- */
  var CLIENTS = {
    printit: {
      name: 'Print It Prints',
      avatar: 'kate',
      voiceId: 'EXAVITQu4vr4xnSDxMaL',
      useCatalog: true,
      chips: ['What do you print?', 'How fast is turnaround?', 'How much are business cards?', 'Get a free quote'],
      greeting: "Hey, welcome to Print It — we print everything under the sun. What are you looking to get printed today?"
    }
  };

  var OUTLOUD_FN = 'https://xkjkwqbfvkswwdmbtndo.supabase.co/functions/v1/outloud';
  var clientId = (qs.get('client') || 'printit').toLowerCase().replace(/[^a-z0-9-]/g, '');
  var fetchSlug = clientId;

  /* Load a signed-up client's public profile if one exists; otherwise
     the built-in profile above drives the page. */
  if (fetchSlug) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', OUTLOUD_FN, false);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify({ action: 'client-config', client: fetchSlug }));
      var d = xhr.status === 200 ? JSON.parse(xhr.responseText) : null;
      if (d && d.found) {
        if (d.customImage) { AVATARS.push({ id: 'custom', name: d.name, type: 'animated', image: d.customImage, voiceId: 'TX3LPaxmHKxFdv7VOQHJ' }); }
        if (d.ownFaceId) { AVATARS.push({ id: 'ownface', name: d.name, type: 'video', faceId: d.ownFaceId, voiceId: d.voiceId || 'EXAVITQu4vr4xnSDxMaL' }); }
        var prof = { name: d.name, avatar: d.avatar || 'kate', voiceId: d.voiceId || null,
          useCatalog: false,
          chips: (d.chips || []).slice(0, 4),
          greeting: d.greeting || ('Hi, welcome to ' + d.name + '! How can I help?'),
          paused: d.active === false };
        CLIENTS[clientId] = prof;
      }
    } catch (e) { /* fall back to default */ }
  }
  if (!CLIENTS[clientId]) { clientId = 'printit'; }
  var client = CLIENTS[clientId];
  var savedAvatar = null;
  try { savedAvatar = localStorage.getItem('outloud-avatar:' + clientId); } catch (e) {}
  var avatarId = qs.get('avatar') || savedAvatar || client.avatar;
  var avatar = AVATARS.filter(function (a) { return a.id === avatarId; })[0] || AVATARS[0];

  var CONFIG = {
    protocolVersion: '2.0',
    clientId: clientId,
    client: client,
    avatars: AVATARS,
    selectedAvatar: avatar,

    endpoints: {
      /* Secure backend function: tts | simli-session | agent | lead */
      outloud: OUTLOUD_FN,
      publishableKey: ''
    },

    /* --- Voice stack (Speech Director) --- */
    voice: {
      provider: 'elevenlabs',
      model: 'eleven_flash_v2_5',
      voiceId: avatarId === client.avatar && client.voiceId ? client.voiceId : (avatar.voiceId || client.voiceId),
      outputFormat: 'mp3_44100_128',
      streamChunks: true
    },

    /* --- Live brain (backend agent; catalog is the instant fallback) --- */
    rag: {
      timeoutMs: 20000,
      minAnswerChars: 8,
      notInContext: /not in available context/i
    },

    /* --- Business identity (Context 1 prefix for RAG) --- */
    business: {
      name: 'Print It Prints',
      ragPrefix: 'Print It Prints product question: '
    },

    /* --- Simli video avatar --- */
    simli: {
      faceId: avatar.faceId || null,
      maxSessionLength: 600,
      maxIdleTime: 180
    },

    avatar: {
      faceCatalog: 'avatar-catalog.js',
      sprite: 'mascot-sprites.png',
      image: avatar.image || null,
      cols: 4,
      rows: 3,
      baseline: { emotion: 'friendly', energy: 0.55, posture: 'idle', initialGaze: 'user' },
      constraints: {
        allowGestures: ['present_right', 'present_left', 'present_center', 'nod', 'lean_in'],
        maxGestureIntensity: 0.8,
        avoidPointing: true,
        keepEyeContact: true
      },
      providers: {
        anam: { enabled: false, selected: false, tokenEndpoint: '', connectTimeoutMs: 12000 },
        beyond: { enabled: false, tokenEndpoint: '', avatarId: '' },
        liveavatar: { enabled: false, tokenEndpoint: '', avatarId: '', connectTimeoutMs: 12000 },
        did: { enabled: false, agentId: '', speakMode: 'text', connectTimeoutMs: 12000 }
      }
    },

    /* --- Content Director --- */
    content: {
      host: '#outloud-content-panel',
      allowTakeover: true
    },

    /* --- Realtime input --- */
    vad: { rmsThreshold: 0.035, hangoverMs: 700 },

    /* --- Conversation controller --- */
    controller: {
      enabled: true,
      maxAnswerWords: 90,
      historyLimit: 8
    },

    /* --- Session --- */
    session: { storageKey: 'outloud20-session:' + clientId }
  };

  window.OUTLOUD = window.OUTLOUD || {};
  window.OUTLOUD.CONFIG = CONFIG;
  window.OUTLOUD.SECRETS = SECRETS;

  if (client.paused) {
    document.addEventListener('DOMContentLoaded', function () {
      var o = document.createElement('div');
      o.setAttribute('role', 'status');
      o.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#101820;color:#eef4f8;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px';
      o.innerHTML = '<div><div style="font-size:22px;font-weight:600;margin-bottom:8px">' + String(client.name).replace(/[<>&"]/g, '') + '</div>This assistant is paused right now.<br/>Please contact the business directly.</div>';
      document.body.appendChild(o);
    });
  }
})();
