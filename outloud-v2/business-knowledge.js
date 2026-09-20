/* ===============================================================
   OutLoud 2.0 — BUSINESS KNOWLEDGE LAYER   (CONTEXT 1 of 3)
   "What does this business know?" — services, pricing, policies,
   FAQs, proof. STRICT BOUNDARY (spec: three-context rule):
     • This layer never sees customer/session data.
     • Customer data never gets written here.
     • Response logic (planner) only receives answers through
       retrieve(), never raw internals.

   Retrieval order:
     1. Static catalog below (instant, offline-safe).
     2. BlueColumn RAG /recall for open questions (live brain).
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;
  var SECRETS = window.OUTLOUD.SECRETS;

  /* --- Static catalog: the business's own knowledge, hand-curated.
         Mirrors facts already published on the OutLoud product page. --- */
  var CATALOG = [
    {
      id: 'what-is',
      k: ['what is outloud', 'what does outloud', 'outloud do', 'tell me about', 'who are you', 'what is this'],
      t: "OutLoud is BlueColumn's AlwaysOn conversational website. Your site talks with every visitor the moment they land — answering questions, quoting work, and booking appointments — 24/7. This page is the product: the agent you're talking to is the demo."
    },
    {
      id: 'pricing',
      k: ['price', 'cost', 'how much', 'pricing', 'plans', 'fee'],
      t: "AlwaysOn Essential is $497 setup plus $97 per month: an OutLoud site that answers customer questions, captures leads, and books on a live calendar. AlwaysOn Lead Engine is $997 setup plus $197 per month and adds a managed lead list for your trade and service area. Setups are one-time; no contracts, month to month."
    },
    {
      id: 'how-it-works',
      k: ['how does it work', 'how it works', 'how do', 'brain', 'stack', 'under the hood', 'built'],
      t: "Every OutLoud page carries an agent like me. A live BlueColumn brain answers from the business's own knowledge, an ElevenLabs voice speaks the answer, and the mascot moves while it talks. Mic in, voice out, calendar connected."
    },
    {
      id: 'live-sites',
      k: ['client', 'example', 'live page', 'sites', 'who uses', 'demo pages', 'customers'],
      t: "Six live client pages right now: Star Jet Ski Rentals, Vulcan Fence, HomeSpark, OttoMedic, Adventure Club, and Venture Club. At Arcadia Fence & Gate, booked jobs went up 40% in the first month on OutLoud."
    },
    {
      id: 'timeline',
      k: ['how long', 'timeline', 'when can', 'launch', 'get started how fast', 'turnaround'],
      t: "A live OutLoud site takes about 30 days. We build it, run it, and manage it — you show up to the booked jobs."
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
      return { text: best.t, source: 'catalog', knowledgeId: best.id };
    }
    return null;
  }

  /* --- Live RAG (BlueColumn /recall). Failure falls back to the
         catalog / honest fallback — the runtime never blocks on it. --- */
  function fromRag(text) {
    var url = CONFIG.endpoints.blueColumnBase + '/recall';
    return fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SECRETS.blueColumnKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: CONFIG.business.ragPrefix + text })
    }).then(function (res) { return res.json(); }).then(function (d) {
      var a = (d && d.answer ? String(d.answer) : '').trim();
      if (!a || /not in available context/i.test(a) || a.length < 8) { return null; }
      return { text: a, source: 'rag', knowledgeId: 'rag:' + Date.now() };
    }).catch(function () { return null; });
  }

  /* Public API (Context 1 boundary — callers only ever see answers). */
  window.OUTLOUD.knowledge = {
    retrieve: function (query) {
      var local = fromCatalog(query);
      if (local) { return Promise.resolve(local); }
      return fromRag(query).then(function (r) {
        return r || {
          text: "I can answer questions about OutLoud — what it does, what it costs, how it works — or book you a live walkthrough. What would you like to know?",
          source: 'fallback'
        };
      });
    },
    /* Fast synchronous path for the planner's intent routing. */
    peek: fromCatalog
  };
})();
