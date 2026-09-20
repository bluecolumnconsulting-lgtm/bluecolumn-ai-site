/* ===============================================================
   OutLoud 2.0 — BUSINESS KNOWLEDGE LAYER   (CONTEXT 1 of 3)
   "What does this business know?" — services, pricing, policies,
   FAQs, proof. STRICT BOUNDARY (spec: three-context rule):
     • This layer never sees customer/session data.
     • Customer data never gets written here.
     • Response logic (planner) only receives answers through
       retrieve(), never raw internals.

   Retrieval order (live brain first, catalog as safety net):
     1. BlueColumn RAG /recall with a constructed query
        (persona prefix + cleaned topic). The namespace holds the
        canonical OutLoud product knowledge doc ingested 2026-09-20.
        Answers that come back "not in available context" are
        filtered out — the runtime never repeats that line.
     2. Static catalog (instant, offline-safe).
     3. Honest fallback that invites the next question.
   The RAG call is raced against a timeout so a slow brain never
   stalls the conversation.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;
  var SECRETS = window.OUTLOUD.SECRETS;
  var RAG = CONFIG.rag || { timeoutMs: 5000, minAnswerChars: 8, notInContext: /not in available context/i };

  /* --- Static catalog: instant, offline-safe fallback.
         Mirrors facts already published on the OutLoud product page
         and in the canonical knowledge doc ingested in BlueColumn. --- */
  var CATALOG = [
    {
      id: 'what-is',
      k: ['what is outloud', 'what does outloud', 'outloud do', 'tell me about', 'who are you', 'what is this'],
      t: "OutLoud is BlueColumn's AlwaysOn conversational website. Your site talks with every visitor the moment they land, answering questions, quoting work, and booking appointments around the clock. This page is the product: the agent you're talking to is the demo."
    },
    {
      id: 'pricing',
      k: ['price', 'cost', 'how much', 'plans', 'fee', 'expensive', 'budget'],
      t: "AlwaysOn Essential is $497 setup plus $97 per month: an OutLoud site that answers customer questions, captures leads, and books on a live calendar. AlwaysOn Lead Engine is $997 setup plus $197 per month and adds a managed lead list for your trade and service area. Setups are one-time; no contracts, month to month."
    },
    {
      id: 'how-it-works',
      k: ['how does it work', 'how it works', 'how do', 'brain', 'stack', 'under the hood', 'built', 'what can you do', 'capab'],
      t: "Every OutLoud page carries an agent like me. A live BlueColumn brain answers from the business's own knowledge, an ElevenLabs voice speaks the answer, and the mascot moves while it talks. Mic in, voice out, calendar connected."
    },
    {
      id: 'live-sites',
      k: ['client', 'example', 'live page', 'sites', 'who uses', 'demo pages', 'customers', 'references', 'portfolio'],
      t: "Six live client pages right now: Star Jet Ski Rentals, Vulcan Fence, HomeSpark, OttoMedic, Adventure Club, and Venture Club. At Arcadia Fence & Gate, booked jobs went up 40% in the first month on OutLoud."
    },
    {
      id: 'timeline',
      k: ['how long', 'timeline', 'when can', 'launch', 'get started how fast', 'turnaround', 'how fast'],
      t: "A live OutLoud site takes about 30 days. We build it, run it, and manage it. You show up to the booked jobs."
    },
    {
      id: 'booking-flow',
      k: ['book', 'demo', 'walkthrough', 'schedule', 'sign up', 'talk to someone', 'get started'],
      t: "Happy to set that up. I'll take your name, business, and the best phone number, and a BlueColumn strategist schedules the walkthrough. You can also email hello@bluecolumn.ai."
    },
    {
      id: 'voice-avatar',
      k: ['voice', 'avatar', 'mascot', 'lip', 'speak', 'robot', 'animation'],
      t: "I speak with an ElevenLabs voice, think with a live BlueColumn brain, and move as a sprite-animated mascot whose lip-sync runs independently of my gestures. On client pages the same stack runs as a real-time video avatar."
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
    var low = String(text || '').toLowerCase();
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
    }).then(function (res) { return res.json(); }).then(function (d) {
      clearTimeout(timer);
      var a = (d && d.answer ? String(d.answer) : '').trim();
      if (!a || RAG.notInContext.test(a) || a.length < RAG.minAnswerChars) { return null; }
      try { sessionStorage.setItem('ol-rag:' + query, JSON.stringify({ text: a })); } catch (e) {}
      return { text: a, source: 'rag', knowledgeId: 'rag:' + Date.now() };
    }).catch(function () { clearTimeout(timer); return null; });
  }

  /* Public API (Context 1 boundary — callers only ever see answers).

     Latency policy (measured 2026-09-20: /recall round-trip ~4s):
       • STRONG catalog match (core demo questions: pricing, what
         OutLoud is, how it works, live sites, timeline) answers
         instantly — the visitor never waits on the wire for a fact
         the business already published.
       • EVERYTHING ELSE goes to the live brain first: constructed
         query, context filter, honest fallback. The brain is the
         only source for the long tail, and every brain answer is
         wrapped into a full Response Plan.
       • Repeats hit the session cache instantly.
     When /recall latency drops (edge proxy), raise STRONG to 999
     and the brain takes back every question. */
  var STRONG = 8;

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
          text: "I don't have that one yet. I can answer questions about OutLoud, like what it does, what it costs, or how it works. If it's something specific to your business, leave your email and a strategist will follow up. What else can I help with?",
          source: 'fallback'
        };
      });
    },
    peek: fromCatalog
  };
})();