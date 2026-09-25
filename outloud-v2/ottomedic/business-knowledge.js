/* ===============================================================
   OutLoud for OTTOMEDIC — BUSINESS KNOWLEDGE LAYER (CONTEXT 1 of 3)
   "What does this business know?" — STRICT BOUNDARY (spec):
     • This layer never sees customer/session data.
     • Customer data never gets written here.
     • Response logic (planner) only receives answers through
       retrieve(), never raw internals.

   Retrieval order (live brain first, catalog as safety net):
     1. BlueColumn RAG /recall with a constructed query
        (persona prefix + cleaned topic). The namespace holds the
        "OttoMedic product knowledge base v2 — Marina brain" doc;
        verified answering live 2026-09-21 with grounded pricing.
        Answers that come back "not in available context" are
        filtered out — the runtime never repeats that line.
     2. Static catalog (instant, offline-safe).
     3. Honest fallback that invites the next question.
   The RAG call is raced against a timeout so a slow brain never
   stalls the conversation.

   Catalog source material — ALL of it from the existing OttoMedic
   landing page in this repo:
     • showcase/project-home-spark/widget/site-avatar.js (Marina's
       INTENTS — the avatar agent already used for OttoMedic content)
     • showcase/project-home-spark/assets/index-CBXRDVSP.js (the
       landing page bundle: models, specs, guarantees, testimonials)
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;
  var SECRETS = window.OUTLOUD.SECRETS;
  var RAG = CONFIG.rag || { timeoutMs: 5000, minAnswerChars: 8, notInContext: /not in available context/i };

  /* --- Static catalog: instant, offline-safe fallback.
         Mirrors Marina's agent knowledge and the published landing
         page copy. --- */
  var CATALOG = [
    {
      id: 'what-is',
      k: ['what is ottomedic', 'ottomedic', 'otto medic', 'whats', 'what\u2019s', 'about', 'tell me about', 'skimmer', 'product'],
      t: "OttoMedic is the only skimmer that thinks for itself. It continuously monitors and adjusts to maintain optimal foam height — no sensors to calibrate, no controllers to tune. Install it, set your target foam height once, and never touch it again."
    },
    {
      id: 'how-it-works',
      k: ['how does it work', 'how it works', 'mechanical', 'electronic', 'controller', 'sensor', 'technology', 'automation', 'how do', 'what can you do', 'capab', 'under the hood', 'built'],
      t: "This is not software automation. OttoMedic uses a purely mechanical system to adjust water level automatically. Electronic controllers need calibration and fail. OttoMedic's mechanical regulation works perfectly from day one, and adapts to feeding, bioload, and temperature changes on its own. The patented valve system is purely mechanical — it can't lose calibration, doesn't need updates, and works identically on day 1 and day 1,000."
    },
    {
      id: 'prevents',
      k: ['prevent', 'overflow', 'problem', 'flood', 'fail', 'crash', 'risk', 'worry', 'disaster'],
      t: "I've analyzed thousands of reef system failures. The big three: five gallons of skimmate on your floor from overflow, a pump running dry, and stressed corals that stop growing. OttoMedic eliminates all three. It prevents catastrophic overflow events before they happen."
    },
    {
      id: 'pricing',
      k: ['price', 'cost', 'how much', 'models', 'model', 'evo', 'fee', 'expensive', 'budget', 'buy'],
      t: "Three models. The EVO 5000Z1 handles 100 to 200 heavily stocked gallons for $899. The EVO 7000Z1 covers 200 to 400 gallons for $1,149. And the EVO 9000Z1 runs 400 to 600 gallons for $1,399. Every model carries a 60-day performance guarantee and a 5-year warranty. Tell me your tank size and I'll point you at the right one."
    },
    {
      id: 'setup',
      k: ['setup', 'set up', 'install', 'fitting', 'water level', 'start', 'begin', 'calibrate', 'how long', 'how fast', 'sump', 'external'],
      t: "Setup is simple: install it, set your target foam height once, done. No sensors to calibrate or fail. It installs external or in-sump, with a 12 by 8 by 24 inch footprint and a 7 to 9.5 inch water level range. Tell me your tank and I'll walk you through the exact fittings and water level requirements for your build."
    },
    {
      id: 'bioload',
      k: ['bioload', 'feeding', 'feed', 'stock', 'temperature', 'adapt', 'change', 'heavy', 'coral growth'],
      t: "Bioload is exactly where OttoMedic shines. It automatically adapts to feeding schedules, bioload, and water temperature changes. Heavy feeding protocols, big stocking lists — it handles it, and stays steady when your system changes."
    },
    {
      id: 'keepers',
      k: ['who', 'keeper', 'reef', 'coral', 'sps', 'livestock', 'quality', 'built', 'who uses', 'proof', 'results', 'reviews', 'testimon'],
      t: "OttoMedic is built for reef keepers who understand that stability is survival — over 2,000 of them run it today, protecting livestock worth $40,000 and up. Marine-grade stainless fittings, cast acrylic body, built to last decades. If your livestock costs more than most people's entire tanks, this is the skimmer for you."
    },
    {
      id: 'guarantee',
      k: ['warranty', 'guarantee', 'return', 'refund', 'risk free', 'support', 'made in', 'germany', 'iso'],
      t: "Two promises. One: a 60-day performance guarantee — if it doesn't outperform your current skimmer, return it for a full refund, no questions asked. Two: a 5-year limited warranty on the valve system and acrylic components, 2 years on the pump. Made in Germany, ISO 9001 certified, free technical support."
    },
    {
      id: 'specs',
      k: ['spec', 'specification', 'dimensions', 'footprint', 'power', 'watt', 'material', 'acrylic', 'pump', 'impeller'],
      t: "Complete technical specs, for the buyer who does their homework: external or in-sump installation, 12 by 8 by 24 inch footprint, 7 to 9.5 inch water level range, 25 to 45 watts, needle wheel impeller pump. The reaction chamber is quarter-inch cast acrylic with marine-grade stainless fittings and HDPE valve components."
    },
    {
      id: 'comparison',
      k: ['manual', 'electronic', 'compare', 'versus', 'vs', 'difference', 'gimmick'],
      t: "Manual skimmers add labor. Electronic controllers need calibration, need updates, and eventually fail. OttoMedic eliminates both problems — the patented valve system is purely mechanical, so it works identically on day 1 and day 1,000. No app, no WiFi, no firmware updates. Built to last decades, not years."
    },
    {
      id: 'cost-of-not',
      k: ['worth it', 'expensive', 'cheap', 'value', 'stake', 'bad day'],
      t: "OttoMedic costs $900 to $1,400. The alternative: you wake up to five gallons of skimmate on your floor, a pump running dry, and corals stressed to the point they stop growing. What's the cost of not having it?"
    },
    {
      id: 'outloud',
      k: ['outloud', 'out loud', 'this page', 'what is this page', 'bluecolumn', 'blue column', 'who built this'],
      t: "I'm Marina, OttoMedic's live talking specialist. I answer every visitor out loud — how the skimmer works, models, specs, setup. The live-agent stack behind me is built by BlueColumn."
    },
    {
      id: 'booking-flow',
      k: ['book', 'demo', 'walkthrough', 'schedule', 'sign up', 'talk to someone', 'get started', 'contact', 'email', 'phone', 'buy', 'where'],
      t: "Easy. For OttoMedic itself: support@ottomedic.com or 1-800-OTTOMEDIC, Hamburg Germany, Monday to Friday 9 to 6 Eastern. And if you want a page like this one for your business, I'll take your name, business, and best phone number, and the team that built this page can walk you through it."
    },
    {
      id: 'voice-avatar',
      k: ['voice', 'avatar', 'mascot', 'lip', 'speak', 'robot', 'animation', 'orange', 'marina', 'who are you', 'your name'],
      t: "I'm Marina, OttoMedic's talking specialist. I speak with an ElevenLabs voice, answer from OttoMedic's own knowledge, and appear as a real-time video avatar — the same Marina who lives on the OttoMedic site."
    }
  ];

  function score(low, entry) {
    var s = 0, i;
    for (i = 0; i < entry.k.length; i++) {
      if (low.indexOf(entry.k[i]) !== -1) { s += entry.k[i].length; }
    }
    return s;
  }

  function fromCatalog(text) {
    /* Speech writes "out loud" (two words); the brand is "outloud".
     Normalize so spoken queries hit the catalog like typed ones. */
    var low = String(text || '').toLowerCase().replace(/out[ ]+loud/g, 'outloud');
    var best = null, bestS = 0, i, s;
    for (i = 0; i < CATALOG.length; i++) {
      s = score(low, CATALOG[i]);
      if (s > bestS) { bestS = s; best = CATALOG[i]; }
    }
    if (best && bestS >= 4) {
      return { text: best.t, source: 'catalog', knowledgeId: best.id, _score: bestS };
    }
    return null;
  }

  /* Clean the visitor's message into a good brain query: persona
     prefix + topic, minus greeting filler that wastes retrieval. */
  function buildQuery(text) {
    var q = String(text || '').trim()
      .replace(/^(hi|hey|hello|yo|ok|okay|so|um|uh)[,!. ]+/i, '')
      .replace(/\b(can you|could you|please|tell me|do you know|i want to know|whats|what's)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (q.length < 3) { q = String(text || '').trim(); }
    return CONFIG.business.ragPrefix + q;
  }

  function ragFetch(query) {
    /* Quota-aware short-circuit: when the brain is unreachable (quota
       exhausted, network down), skip the wire entirely for a while so
       catalog answers land instantly instead of waiting on timeouts. */
    try {
      var downUntil = Number(sessionStorage.getItem('ol-rag-down-until') || 0);
      if (downUntil && Date.now() < downUntil) { return Promise.resolve(null); }
    } catch (e) {}
    /* Repeat questions answer from the session cache instantly. */
    try {
      var cached = sessionStorage.getItem('ol-rag:' + query);
      if (cached) {
        var c = JSON.parse(cached);
        if (c && c.text) { return Promise.resolve({ text: c.text, source: 'rag', knowledgeId: 'rag:cached' }); }
      }
    } catch (e) {}
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, RAG.timeoutMs);
    var url = CONFIG.endpoints.blueColumnBase + '/recall';
    return fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SECRETS.blueColumnKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: query }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (res.status === 401 || res.status === 402 || res.status === 429 || res.status === 403) {
        try { sessionStorage.setItem('ol-rag-down-until', String(Date.now() + (res.status === 401 ? 60 * 60 * 1000 : 30 * 1000))); } catch (e) {}
        return null;
      }
      return res.json();
    }).then(function (d) {
      clearTimeout(timer);
      if (!d) { return null; }
      var a = (d && d.answer ? String(d.answer) : '').trim();
      if (!a || RAG.notInContext.test(a) || a.length < RAG.minAnswerChars) { return null; }
      try { sessionStorage.setItem('ol-rag:' + query, JSON.stringify({ text: a })); } catch (e) {}
      return { text: a, source: 'rag', knowledgeId: 'rag:' + Date.now() };
    }).catch(function () {
      clearTimeout(timer);
      /* Network failure/timeout: treat the brain as down briefly. */
      try { sessionStorage.setItem('ol-rag-down-until', String(Date.now() + 2 * 60 * 1000)); } catch (e) {}
      return null;
    });
  }

  var STRONG = 4;

  window.OUTLOUD.knowledge = {
    retrieve: function (query) {
      var local = fromCatalog(query);
      if (local && local._score >= STRONG) {
        return Promise.resolve({ text: local.text, source: 'catalog', knowledgeId: local.knowledgeId });
      }
      return ragFetch(buildQuery(query)).then(function (r) {
        if (r) { return r; }
        if (local) { return { text: local.text, source: 'catalog', knowledgeId: local.knowledgeId }; }
        return {
          text: "That one’s not in my head yet. I can cover how the skimmer works, what it prevents, specs, or which model fits your tank — or leave your name and number and we follow up.",
          source: 'fallback'
        };
      });
    },
    peek: fromCatalog
  };
})();