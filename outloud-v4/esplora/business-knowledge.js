/* ===============================================================
   Esplora Travel — BUSINESS KNOWLEDGE LAYER (Context 1 of 3)
   "Small group cultural & walking tours."

   Retrieval order:
     1. Live agent brain  → POST { action:'agent' } on OUTLOUD_FN
     2. Static catalog   → instant, offline-safe (facts below)
     3. Honest fallback  → invites the next question.

   Source: esplora.co.uk (home, who-we-are, questions, contact).
   Pulled 2026-09-29.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;
  var RAG = CONFIG.rag || { timeoutMs: 20000, minAnswerChars: 8, notInContext: /not in available context/i };

  var CATALOG = [
    {
      id: 'about',
      k: ['who are you', 'who is esplora', 'what is esplora', 'about', 'story', 'history', 'founded', 'company', 'esplora travel'],
      t: "Esplora Travel is a small company specialising in escorted journeys for small groups of guests. We were founded in Cambridge, United Kingdom in 2009, and we run expert-led cultural tours and walking holidays in some of the most interesting corners of the Mediterranean and beyond."
    },
    {
      id: 'destinations',
      k: ['destinations', 'where do you go', 'where do your tours go', 'which countries', 'sicily', 'greece', 'turkey', 'italy', 'caucasus', 'crete', 'meteora', 'places'],
      t: "Our tours cover Sicily, Greece, Turkey, Italy, and the Caucasus. From the hilltop monasteries of Meteora in Greece to the wine towns of Marsala in Sicily and the lakes of eastern Turkey, we pick the corners that reward curious, small-group travel."
    },
    {
      id: 'how-tours-work',
      k: ['how do tours work', 'small group', 'small-group', 'group size', 'how many people', 'escorted', 'inclusive', 'included', 'expert local guides', 'like-minded', 'what is it like'],
      t: "We travel in small groups of like-minded people with expert local guides, so every trip feels personal and relaxed. Our tours are fully inclusive with guaranteed departures, and our aim is to give you the very best travel experience — meticulous planning with an informal, friendly approach."
    },
    {
      id: 'walking',
      k: ['walking', 'walking holidays', 'walking tours', 'cultural tours', 'hiking', 'travel style', 'choose your travel style', 'types of tours'],
      t: "We offer two travel styles: cultural tours for those who love history, art, and local life, and walking holidays for those who want to explore on foot. Both are small-group, expert-led, and fully inclusive — you choose the style that suits you."
    },
    {
      id: 'booking',
      k: ['book', 'booking', 'how do i book', 'reserve', 'reservation', 'availability', 'departures', 'dates', 'price', 'cost', 'how much', 'discount', 'newsletter'],
      t: "The best way to book or check dates and prices is to email trips@esplora.co.uk or call +44 (0)1223 328446 — we're happy to talk through the options and can arrange a Zoom call. And if you subscribe to our newsletter, new subscribers get a £50 discount on their first Esplora Travel tour."
    },
    {
      id: 'insurance',
      k: ['insurance', 'travel insurance', 'do i need insurance', 'cover', 'covered'],
      t: "We ask that all our guests have adequate travel insurance in place to cover them for the dates of their travels. Esplora Ltd do not sell travel insurance themselves, but we can offer suggestions of suitable companies for our UK guests."
    },
    {
      id: 'who-we-are',
      k: ['damian', 'damian croft', 'founder', 'director', 'who runs', 'team', 'host', 'guide', 'who are the guides'],
      t: "Our Founding Director is Damian Croft, and he still leads and hosts trips himself — including a personal tour of his home town of Milazzo in Sicily. Our guides are highly experienced locals who read the needs of their group and look after every detail."
    },
    {
      id: 'reviews',
      k: ['reviews', 'testimonials', 'what do guests say', 'recommended', 'guests', 'feedback', 'reputation', 'trusted', 'aito'],
      t: "Guests repeatedly praise our meticulous planning, friendliness, and personal approach — many travel with us again and recommend us to friends. We're also trusted and verified by AITO, the specialist travel association."
    },
    {
      id: 'contact',
      k: ['contact', 'phone', 'call', 'email', 'reach', 'number', 'get in touch', 'address', 'located', 'where are you', 'whatsapp', 'zoom'],
      t: "If you're enquiring about a tour, email is the best way to reach us: trips@esplora.co.uk. You can also call +44 (0)1223 328446, message us on WhatsApp at +44 7507 208380, or book a slot for a Zoom call. We're based in Cambridge, United Kingdom."
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

  function buildQuery(text) {
    var q = String(text || '').trim()
      .replace(/^(hi|hey|hello|yo|ok|okay|so|um|uh)[,!. ]+/i, '')
      .replace(/\b(can you|could you|please|tell me|do you know|i want to know|whats|what's)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (q.length < 3) { q = String(text || '').trim(); }
    return (CONFIG.business && CONFIG.business.ragPrefix ? CONFIG.business.ragPrefix : '') + q;
  }

  function agentFetch(query) {
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, RAG.timeoutMs);
    return fetch(CONFIG.endpoints.outloud, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': CONFIG.endpoints.publishableKey || '' },
      body: JSON.stringify({ action: 'agent', client: CONFIG.clientId, q: query }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) { return null; }
      return res.json().catch(function () { return null; });
    }).then(function (d) {
      if (!d) { return null; }
      var a = (d.answer || d.text) ? String(d.answer || d.text).trim() : '';
      if (!a || RAG.notInContext.test(a) || a.length < RAG.minAnswerChars) { return null; }
      var k = { text: a, source: 'agent', knowledgeId: 'agent:' + Date.now() };
      ['quote', 'show', 'remember', 'leadSaved', 'lead'].forEach(function (key) {
        if (d[key]) { k[key] = d[key]; }
      });
      return k;
    }).catch(function () {
      clearTimeout(timer);
      return null;
    });
  }

  window.OUTLOUD.knowledge = {
    retrieve: function (query) {
      var local = fromCatalog(query);
      return agentFetch(buildQuery(query)).then(function (a) {
        if (a) { return a; }
        if (local) { return { text: local.text, source: 'catalog', knowledgeId: local.knowledgeId }; }
        return {
          text: "That one's not in my notes yet. I can tell you about our destinations, how our small-group tours work, how to book, or how to reach us — just ask.",
          source: 'fallback'
        };
      });
    },
    peek: fromCatalog
  };
})();
