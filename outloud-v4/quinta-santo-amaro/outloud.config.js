/* ===============================================================
   Quinta de Santo Amaro — OutLoud v4 RUNTIME CONFIG
   Same v4 stack as bluecolumn.ai/outloud/ (protocol 2.0). Client-
   branded: no OutLoud branding, no BlueColumn chrome. Brain, voice,
   and video sessions all run through the secure backend function —
   no keys in page files.

   BILINGUAL: the page ships a PT / EN switch (see lang.js). The face
   is language-neutral; the VOICE is a native European Portuguese
   voice (Joana, eleven_multilingual_v2), so the Portuguese reading is
   native and the English reading carries a Portuguese accent. The
   active language drives the answer language via CONFIG.business.ragPrefix
   and the static catalog via window.OUTLOUD.CONFIG.client.language.

   Per-page options (URL):
     ?client=quintasantoamaro   which business brain answers (default)
     ?avatar=<id>               which avatar speaks
     ?lang=pt|en                initial language (default pt)
   =============================================================== */
(function () {
  'use strict';

  var qs = new URLSearchParams(location.search);
  var SECRETS = {};   /* kept empty for backwards compatibility */

  /* ---------- avatar catalog ---------- */
  var AVATARS = [
    { id: 'charlotte', name: 'Charlotte', type: 'video', faceId: 'b1f6ad8f-ed78-430b-85ef-2ec672728104', voiceId: 'nJ5NFqyKb8kn9JBPmo6i' }
  ];
  (window.OUTLOUD_STOCK_FACES || []).forEach(function (f) {
    if (!AVATARS.some(function (a) { return a.faceId === f.faceId; })) { AVATARS.push(f); }
  });

  var PT = {
    chips: ['O que é a Quinta?', 'Quero organizar um evento', 'Fale-me dos vinhos', 'Como faço uma visita?'],
    greeting: "Bem-vindo à Quinta de Santo Amaro, uma casa com história desde 1544, no coração da Bairrada. Pergunte-me pelos eventos, os vinhos, os jardins ou como planear a sua celebração.",
    ragPrefix: "Responde sempre em português de Portugal, com um tom caloroso e elegante. Pergunta sobre a Quinta de Santo Amaro: "
  };
  var EN = {
    chips: ['What is the Quinta?', 'I want to plan an event', 'Tell me about the wines', 'How can I visit?'],
    greeting: "Welcome to Quinta de Santo Amaro, a house with history dating back to 1544, in the heart of Bairrada. Ask me about events, the wines, the gardens, or how to plan your celebration.",
    ragPrefix: "Answer in English. The speaker is Portuguese, so keep a warm, natural Portuguese accent. Question about Quinta de Santo Amaro: "
  };

  /* ---------- client profiles (page-side: greeting + defaults) ---------- */
  var CLIENTS = {
    quintasantoamaro: {
      name: 'Quinta de Santo Amaro',
      avatar: 'charlotte',
      voiceId: 'nJ5NFqyKb8kn9JBPmo6i',
      language: 'pt-PT',
      useCatalog: true,
      i18n: { pt: PT, en: EN },
      chips: PT.chips,
      greeting: PT.greeting
    }
  };

  var OUTLOUD_FN = 'https://xkjkwqbfvkswwdmbtndo.supabase.co/functions/v1/outloud';
  var clientId = (qs.get('client') || 'quintasantoamaro').toLowerCase().replace(/[^a-z0-9-]/g, '');
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
        var prof = { name: d.name, avatar: d.avatar || 'charlotte', voiceId: d.voiceId || null,
          useCatalog: false,
          i18n: { pt: PT, en: EN },
          chips: (d.chips || []).slice(0, 4),
          greeting: d.greeting || ('Olá, bem-vindo à ' + d.name + '. Em que posso ajudar?'),
          paused: d.active === false };
        CLIENTS[clientId] = prof;
      }
    } catch (e) { /* fall back to default */ }
  }
  if (!CLIENTS[clientId]) { clientId = 'quintasantoamaro'; }
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

    /* --- Voice stack (Speech Director) ---
       Native European Portuguese voice + multilingual model:
       PT reads native, EN reads with a Portuguese accent. */
    voice: {
      provider: 'elevenlabs',
      model: 'eleven_multilingual_v2',
      voiceId: avatarId === client.avatar && client.voiceId ? client.voiceId : (avatar.voiceId || client.voiceId),
      outputFormat: 'mp3_44100_128',
      streamChunks: true
    },

    /* --- Live brain (backend agent; catalog is the instant fallback) --- */
    rag: {
      timeoutMs: 20000,
      minAnswerChars: 8,
      notInContext: /not in available context|não (?:está|consta|aparece) no contexto|sem contexto|not available/i
    },

    /* --- Business identity (Context 1 prefix for RAG) --- */
    business: {
      name: 'Quinta de Santo Amaro',
      ragPrefix: PT.ragPrefix
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
      o.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#1e2a1c;color:#e9dfc7;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px';
      o.innerHTML = '<div><div style="font-size:22px;font-weight:600;margin-bottom:8px">' + String(client.name).replace(/[<>&"]/g, '') + '</div>This assistant is paused right now.<br/>Please contact the business directly.</div>';
      document.body.appendChild(o);
    });
  }
})();
