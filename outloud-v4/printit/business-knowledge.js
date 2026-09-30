/* ===============================================================
   Print It Prints — BUSINESS KNOWLEDGE LAYER  (Context 1 of 3)
   "What does this business know?"

   Retrieval order:
     1. Live agent brain  → POST { action:'agent' } on OUTLOUD_FN
        (same secure backend as tts / simli-session / lead).
     2. Static catalog   → instant, offline-safe (printed facts).
     3. Honest fallback  → invites the next question.
   The planner only ever sees answers through retrieve(); it never
   touches internals (three-context rule).

   NOTE for new clients: edit the CATALOG below (or better, feed the
   business facts into the backend agent). Everything else is shared.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;
  var RAG = CONFIG.rag || { timeoutMs: 20000, minAnswerChars: 8, notInContext: /not in available context/i };

  /* --- Static catalog: instant, offline-safe fallback. --- */
  var CATALOG = [
    {
      id: 'what-do-you-print',
      k: ['what do you print', 'what can you print', 'what do you make', 'services', 'offer', 'products'],
      t: "We print everything under the sun — business cards, flyers, banners, signs, brochures, stickers, labels, apparel, and custom jobs. Tell me what you need and I'll get you moving."
    },
    {
      id: 'turnaround',
      k: ['how fast', 'turnaround', 'how long', 'ready', 'rush', 'quick', 'deadline', 'delivery'],
      t: "Most standard jobs are ready within a few business days, and we offer rush turnaround when you're against a deadline. Tell me the job and the date you need it by."
    },
    {
      id: 'business-cards',
      k: ['business cards', 'business card', 'cards'],
      t: "Business cards are one of our most popular jobs. Tell me the quantity, finish (matte, gloss, or spot UV), and whether you have artwork ready, and I'll get you a price."
    },
    {
      id: 'quote',
      k: ['quote', 'estimate', 'price', 'cost', 'how much', 'free quote', 'pricing', 'get a quote'],
      t: "Happy to quote it. Tell me what you're printing, the quantity, and the size, and I'll line up a free estimate — or leave your name and number and a rep will call you."
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

  /* Live agent brain via the secure backend function. */
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
      /* Pass through extras the planner understands (quote card, panels,
         remembered facts, saved lead). */
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
          text: "That one's not in my head yet. I can talk about what we print, turnaround, business cards, or line up a free quote — or leave your name and number and a rep follows up.",
          source: 'fallback'
        };
      });
    },
    peek: fromCatalog
  };
})();
