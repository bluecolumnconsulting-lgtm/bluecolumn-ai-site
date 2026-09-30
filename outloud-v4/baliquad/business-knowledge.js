/* ===============================================================
   Bali Quad Discovery Tours — BUSINESS KNOWLEDGE LAYER (Context 1)
   "Full-size ATV quad and buggy adventures in Bali, since 1999."

   Retrieval order:
     1. Live agent brain  → POST { action:'agent' } on OUTLOUD_FN
     2. Static catalog   → instant, offline-safe (facts below)
     3. Honest fallback  → invites the next question.

   Source: baliquad.com (home, tours, contact, contact-us).
   Pulled 2026-09-29.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;
  var RAG = CONFIG.rag || { timeoutMs: 20000, minAnswerChars: 8, notInContext: /not in available context/i };

  var CATALOG = [
    {
      id: 'about',
      k: ['who are you', 'who is bali quad', 'what is bali quad', 'about', 'story', 'history', 'founded', 'since', 'company', 'baliquad', 'bqdt', 'discovery tours'],
      t: "Bali Quad Discovery Tours has been running adventure tours in Bali since 1999. We're a reputable adventure company with well-trained, dedicated staff who put your safety and satisfaction first, operating full-size quad bikes and buggies with branded tubing equipment for a personal, exceptional holiday experience."
    },
    {
      id: 'tours',
      k: ['what tours', 'what tours do you run', 'tours', 'which tours', 'activities', 'programs', 'options', 'what can i do', 'adventures'],
      t: "Our tour line-up covers four core adventures: the Quad Explorer, the Quad Discovery (our classic all-inclusive tour), the Buggy Explorer, the Buggy Discovery, and the Canyon Tubing Adventure. We also run 2-in-1 combinations that pair a quad or buggy tour with canyon tubing on the same day."
    },
    {
      id: 'quad-discovery',
      k: ['quad discovery', 'classic tour', 'the classic', 'what happens on the tour', 'what is a tour like', 'itinerary', 'what is included', 'pickup', 'transfer'],
      t: "The Bali Quad Discovery Tour is our classic all-inclusive adventure. An air-conditioned car picks you up from your villa or hotel and transfers you to our headquarters in Payangan, where staff welcome you and show a safety video. After hands-on instruction and training on our test circuit, you drive yourself through 5 different types of authentic Balinese terrain — this is one of the longest off-road tours on the island, about 25km of mainly off-road tracks."
    },
    {
      id: 'terrain',
      k: ['terrain', 'where do you drive', 'route', 'track', 'rice fields', 'jungle', 'village', 'villages', 'scenery', 'what will i see', 'desa kerta'],
      t: "You drive through rice fields, plantations, jungle, muddy tracks, and 2 traditional villages in Desa Kerta, Payangan — 5 different types of authentic Balinese terrain in one tour."
    },
    {
      id: 'vehicles',
      k: ['vehicles', 'what vehicles', 'what vehicles do you use', 'fleet', 'quad', 'quads', 'quad bike', 'buggy', 'buggies', 'atv', 'cfmoto', 'cforce', 'zforce', 'side by side', 'machines', 'bikes'],
      t: "Our fleet is modern, state-of-the-art and full size. The quads are CFMoto CForce 450L 4x4 machines with fully automatic transmission, independent rear suspension, a long chassis, and power steering. They comfortably carry two adults up to 250kg and have arm rests and a back rest for the passenger. Our CF ZForce 500 buggies, or side-by-sides, are also full-size with automatic 4x4 transmission and independent rear suspension."
    },
    {
      id: 'beginners',
      k: ['beginner', 'never ridden', 'no experience', 'first time', 'training', 'instruction', 'license', 'driving licence', 'safe', 'safety', 'difficult', 'hard', 'easy'],
      t: "No experience is needed. Every tour starts with hands-on instruction from our guides and practical training on our own test circuit before you head out. All tours are accompanied by experienced guides, and groups are split up according to ability so everyone rides at a comfortable pace."
    },
    {
      id: 'canyon-tubing',
      k: ['canyon tubing', 'tubing', 'river', 'float', 'water', 'inner tube'],
      t: "Canyon Tubing is our river adventure with branded tubing equipment — a fun, guided float through the canyon. It's popular on its own and as part of a 2-in-1 combination with a quad or buggy tour."
    },
    {
      id: 'combos',
      k: ['2 in 1', '2-in-1', 'combo', 'combination', 'two tours', 'both', 'bundled', 'combine'],
      t: "Our 2-in-1 combinations pair a quad or buggy adventure with Canyon Tubing on the same day — choose from Quad Explorer, Quad Discovery, Buggy Explorer, or Buggy Discovery plus tubing. It's the best way to fit two adventures into one trip."
    },
    {
      id: 'booking',
      k: ['book', 'booking', 'how do i book', 'reserve', 'reservation', 'availability', 'price', 'prices', 'cost', 'how much', 'rates', 'book now', 'payment'],
      t: "You can book directly with us — our booking office is in Denpasar and our tours run out of Payangan. Email info@baliquad.com, call +62 361 720766 / 726438, or message WhatsApp +62 821-4575-5660, and the team will walk you through availability and the best options for your group."
    },
    {
      id: 'offers',
      k: ['offer', 'offers', 'special offer', 'special offers', 'discount', 'deal', 'promotion', 'promotions', 'mystery guest', 'cheaper', 'bucks', 'hens', 'party', 'group discount', 'family'],
      t: "We have special offers for direct bookings, plus deals for families with kids, 2-in-1 adventures, and Bucks and Hens parties. Sign up for our Mystery Guest program and get 25% off the published rate — just email before booking with your interested activities and tour date. It's limited and first come, first served."
    },
    {
      id: 'why',
      k: ['why choose', 'why bqdt', 'why should i', 'difference', 'better than', 'reputable', 'awards', 'reviews', 'testimonials', 'word of mouth'],
      t: "Guests love our friendly, funny, and informative guides and the quality of everything we provide, including a fresh lunch. We've been running since 1999 as a reputable adventure company, and we use state-of-the-art full-size vehicles and branded equipment — this isn't a typical tourist tour."
    },
    {
      id: 'contact',
      k: ['contact', 'phone', 'call', 'email', 'reach', 'number', 'get in touch', 'address', 'located', 'where are you', 'whatsapp', 'office hours', 'open'],
      t: "Our booking office is at Jl. Wirasatya VI, No. 4X, Suwung Kangin, Denpasar, Bali 80224, and the tour location is Payangan, Desa Kerta, Dusun Seming. Email info@baliquad.com, call +62 361 720766 or 726438, or WhatsApp +62 821-4575-5660. Office hours are 09:00–22:00 Mon–Fri, 07:00–21:00 otherwise."
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
          text: "That one's not in my notes yet. I can tell you about our tours, our vehicles, special offers, or how to book — just ask.",
          source: 'fallback'
        };
      });
    },
    peek: fromCatalog
  };
})();
