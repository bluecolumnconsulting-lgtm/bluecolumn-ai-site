/* ===============================================================
   Reicks View Farms — BUSINESS KNOWLEDGE LAYER (Context 1 of 3)
   "Families Feeding Families."

   Retrieval order:
     1. Live agent brain  → POST { action:'agent' } on OUTLOUD_FN
     2. Static catalog   → instant, offline-safe (facts below)
     3. Honest fallback  → invites the next question.

   Source: reicksviewfarms.com (home, what-we-do, sustainability,
   rvf-cares, careers, contact). Pulled 2026-09-29.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;
  var RAG = CONFIG.rag || { timeoutMs: 20000, minAnswerChars: 8, notInContext: /not in available context/i };

  var CATALOG = [
    {
      id: 'about',
      k: ['who are you', 'who is reicks', 'about', 'story', 'history', 'founded', 'family', 'reicks view farms'],
      t: "Reicks View Farms was founded in 1979 by Dale and Laura Reicks near Jerico, Iowa. We're 5th-generation pork producers who started with 240 acres of corn and 200 sows — and we're still a family farm, run today by Dale and Laura, their kids Brady and Kaylie, and over 300 employees."
    },
    {
      id: 'what-we-do',
      k: ['what do you do', 'what do you produce', 'services', 'do you make', 'what does reicks'],
      t: "We're a full pork and grain operation. That means pork production (sow units, nurseries, finishing barns), our own feed mill, grain and row-crop farming, our own trucking fleet, and Jerico Construction, which builds our barns."
    },
    {
      id: 'pork-scale',
      k: ['how many pigs', 'how many hogs', 'how big', 'market hogs', 'how much pork', 'sows', 'barns'],
      t: "We raise about 1.5 million market hogs a year across more than 100 finishing barns in Northeast Iowa, and we contract with 130+ production partners. Around 70% of our hogs go to the Tyson plant in Waterloo."
    },
    {
      id: 'farming',
      k: ['corn', 'grain', 'crops', 'acres', 'feed mill', 'row crop', 'sustainable', 'manure'],
      t: "We farm row crops on more than 10,000 acres across Northeast Iowa and Southern Minnesota, mostly corn-on-corn rotation. Our own feed mill blends every batch precisely, and hog-farm nutrients fertilize about half our acres — injected 8 inches below ground to protect water and soil."
    },
    {
      id: 'where',
      k: ['where are you', 'where located', 'location', 'address', 'iowa', 'lawler', 'headquarters'],
      t: "We're headquartered at 1020 Pembroke Avenue, PO Box 150, Lawler, Iowa 52154, with production across Northeast Iowa. You can reach us at 641-364-7843 or rvfinfo@reicksview.com."
    },
    {
      id: 'contact',
      k: ['contact', 'phone', 'call', 'email', 'reach', 'number', 'get in touch'],
      t: "Easy — call us at 641-364-7843, email rvfinfo@reicksview.com, or write to Reicks View Farms, 1020 Pembroke Avenue, PO Box 150, Lawler, Iowa 52154."
    },
    {
      id: 'careers',
      k: ['job', 'jobs', 'career', 'careers', 'hiring', 'apply', 'employment', 'work', 'openings', 'positions', 'driver', 'wage'],
      t: "We're always taking applications. Right now we're hiring Market Hog Drivers (starting $25.75/hr, Class A CDL), Feed Truck Drivers, Mill Operators, Swine Production Technicians ($18.66/hr), an IT Support Technician, and an Agronomy & Technology Coordinator. Benefits include health, dental, 401k with match, and paid time off. Apply at reicksviewfarms.com or call 641-364-7843."
    },
    {
      id: 'community',
      k: ['community', 'donate', 'donation', 'ham', 'give back', 'charity', 'rvf cares', 'veterans', 'food bank'],
      t: "Giving back is core to who we are. Every Easter, Thanksgiving, and Christmas we donate hams to 10+ local food banks — over 650 hams last Christmas alone. We also host the annual Flag Day Fundraiser for veterans, which has raised $75,000 in a single year."
    },
    {
      id: 'sustainability',
      k: ['sustainab', 'environment', 'odor', 'biosecurity', 'green', 'carbon', 'we care'],
      t: "We take sustainability seriously. With Iowa State University we tested odor reduction in our finishing barns — down at least 80% up to 1,000 feet out. Our new six-bay truck wash maximizes biosecurity, and we use cover crops and precision injection to protect soil and water."
    },
    {
      id: 'pub-pinicon',
      k: ['pub', 'pinicon', 'restaurant', 'tenderloin', 'pork tenderloin'],
      t: "The Reicks family also owns The Pub at the Pinicon in New Hampton, Iowa — winner of the 2019 Best Breaded Pork Tenderloin in Iowa. All its pork is sourced right here from Reicks View Farms."
    },
    {
      id: 'education',
      k: ['4h', '4-h', 'ffa', 'education', 'ag education', 'youth', 'kids', 'fair', 'show pigs'],
      t: "We're big believers in the next generation. The Reicks View Ag Education Center at the Howard County Fairgrounds in Cresco is a 22,900-square-foot facility where 4-H and FFA kids can raise and show pigs — keeping farm life open to kids from town, too."
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
          text: "That one's not in my notes yet. I can tell you about what we do, our pork production, careers, community giving, or how to reach us — just ask.",
          source: 'fallback'
        };
      });
    },
    peek: fromCatalog
  };
})();
