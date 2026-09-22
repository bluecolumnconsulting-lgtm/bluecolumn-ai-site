/* ===============================================================
   OutLoud for ARCADIA FENCE & GATE — BUSINESS KNOWLEDGE LAYER
   (CONTEXT 1 of 3) — STRICT BOUNDARY (spec):
     • This layer never sees customer/session data.
     • Customer data never gets written here.
     • Response logic (planner) only receives answers through
       retrieve(), never raw internals.

   Retrieval order (live brain first, catalog as safety net):
     1. BlueColumn RAG /recall with a constructed query
        (persona prefix + cleaned topic). The namespace holds the
        Arcadia Fence & Gate knowledge from the client stack
        (arcadia-agent.js brainPrefix: 'Arcadia Fence & Gate
        customer question: '). Answers that come back "not in
        available context" are filtered out.
     2. Static catalog (instant, offline-safe) — mirrors the
        published Arcadia BOT_CFG intents (ROC 337481, Phoenix
        Metro, free estimates, financing).
     3. Honest fallback that invites the next question.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;
  var SECRETS = window.OUTLOUD.SECRETS;
  var RAG = CONFIG.rag || { timeoutMs: 5000, minAnswerChars: 8, notInContext: /not in available context/i };

  /* --- Static catalog: instant, offline-safe fallback.
         Mirrors the Arcadia client agent's published intents. --- */
  var CATALOG = [
    {
      id: 'what-is',
      k: ['what is arcadia', 'arcadia', 'fence', 'fencing', 'about', 'tell me about', 'who are you', 'who are', 'company', 'contractor'],
      t: "Arcadia Fence and Gate is a fencing contractor serving the Phoenix Metro since 2018 — block walls, steel view fencing, wood, vinyl, custom gates, chain link, ornamental iron, and pool barriers. Licensed and insured, ROC 337481, owned and run by Joe Pagano."
    },
    {
      id: 'block-walls',
      k: ['block', 'cmu', 'wall', 'privacy wall', 'cap', 'topper'],
      t: "Block walls are the desert favorite — privacy, security, and quiet. Arcadia does decorative caps and toppers, height options for privacy or HOA rules, and reinforcement for long-term stability. Want a free estimate? Just say quote."
    },
    {
      id: 'steel-view',
      k: ['steel', 'view', 'view fence', 'modern', 'sightline', 'pool fence', 'patio'],
      t: "Steel view fencing — modern lines, zero warp, maximum sightlines. Powder-coated and low-maintenance, great for perimeters, pools, and patios, with custom panels and gates. Say quote and I'll get your estimate started."
    },
    {
      id: 'wood',
      k: ['wood', 'cedar', 'lumber', 'slat', 'horizontal'],
      t: "Arcadia builds wood fencing in cedar and treated lumber — horizontal or vertical slats, privacy or decorative accents, done right for the Arizona climate."
    },
    {
      id: 'vinyl',
      k: ['vinyl', 'picket', 'ranch', 'no paint'],
      t: "Vinyl fencing looks great and shrugs off the sun — no repainting. UV-resistant formulations in privacy, picket, and ranch-rail styles."
    },
    {
      id: 'gates',
      k: ['gate', 'automated', 'automatic', 'keypad', 'remote', 'smart access', 'pedestrian', 'vehicular'],
      t: "Custom gates, manual or automated — keypads, remotes, and smart access, with heavy-duty hinges and latches, designed to match your fence. Pedestrian or vehicular, Arcadia builds both."
    },
    {
      id: 'other-materials',
      k: ['chain link', 'iron', 'wrought', 'ornamental', 'composite', 'pool'],
      t: "Beyond the main lineup, Arcadia installs chain link (galvanized or coated), ornamental iron, composite fencing, and pool barriers — steel view fencing and self-latching gates around pools and patios. Recent work includes commercial-grade chain link out in East Mesa."
    },
    {
      id: 'pricing',
      k: ['price', 'cost', 'how much', 'pricing', 'estimate', 'quote', 'fee'],
      t: "Every estimate is free, and quotes are transparent — clear scope, clear timeline, no mystery fees. Financing is available too if you'd rather do a monthly plan. Say quote and I'll start yours right now."
    },
    {
      id: 'financing',
      k: ['financ', 'payment', 'monthly', 'afford', 'lender'],
      t: "Financing that fits — flexible monthly plans, multiple lenders, quick approvals, so you don't have to wait on the fence you want. Want me to start a free estimate?"
    },
    {
      id: 'hoa-permits',
      k: ['hoa', 'permit', 'setback', 'submittal', 'height'],
      t: "Yes — Arcadia guides you on heights, setbacks, and HOA submittals so the paperwork doesn't slow your project down."
    },
    {
      id: 'timeline',
      k: ['fast', 'start', 'soon', 'timeline', 'how long', 'schedule', 'process'],
      t: "Site-ready jobs can start quickly — you get a firm start date in your quote. The flow: free design call, transparent quote, then a licensed crew installs with daily updates and a spotless site."
    },
    {
      id: 'areas',
      k: ['area', 'where', 'serve', 'mesa', 'phoenix', 'gilbert', 'chandler', 'tempe', 'scottsdale', 'queen creek', 'apache'],
      t: "Arcadia serves the whole Phoenix Metro valley-wide — including East Mesa and surrounding Arizona communities. If you're in the Valley, you're covered."
    },
    {
      id: 'hours',
      k: ['hours', 'open', 'when are'],
      t: "Arcadia's hours are Monday through Friday, 7am to 8pm, and Saturday 8am to 4pm. Buddy here answers 24/7."
    },
    {
      id: 'contact',
      k: ['phone', 'call', 'human', 'speak', 'talk to', 'contact', 'email', 'reach'],
      t: "You can reach Arcadia directly at 480-906-9605 or arcadiafencegate@gmail.com. Mon–Fri 7am–8pm, Sat 8am–4pm — or leave your number here and they'll call you."
    },
    {
      id: 'license',
      k: ['licen', 'roc', 'insur', 'bbb', 'homeadvisor', 'trust', 'legit'],
      t: "Arcadia Fence and Gate is ROC 337481 — Arizona licensed and fully insured, serving the Valley since 2018. HomeAdvisor Approved and BBB listed."
    },
    {
      id: 'reviews',
      k: ['review', 'testimonial', 'rating', 'good'],
      t: "Homeowners say it best: 'What a great experience with Joe and his workers. He pays very close attention to my plans, budget and needs — extremely personable, professional, and quick to respond.' Five stars across Google and HomeAdvisor."
    },
    {
      id: 'owner',
      k: ['owner', 'joe', 'who owns', 'who runs'],
      t: "Arcadia is owned and run by Joe Pagano — he's hands-on from the design call to the final walk-through, and quick to respond."
    },
    {
      id: 'gallery',
      k: ['gallery', 'photo', 'picture', 'recent work', 'project', 'examples'],
      t: "Recent work: a steel view fence framing desert mountain views, black iron courtyard fencing with a matching walk gate, a block wall with decorative cap for privacy and sound, horizontal cedar privacy fencing, and white vinyl picket — plus a 5-foot galvanized chain link install at Arizona Skies Senior Community in East Mesa."
    },
    {
      id: 'repair',
      k: ['repair', 'fix', 'broke', 'fallen', 'damage'],
      t: "Repairs aren't listed on the site — your best move is to call Arcadia directly at 480-906-9605 during business hours (Mon–Fri 7–8, Sat 8–4) and describe what happened. They're quick to respond."
    },
    {
      id: 'outloud',
      k: ['outloud', 'out loud', 'this page', 'what is this page', 'bluecolumn', 'blue column', 'who built this'],
      t: "This page itself is OutLoud — BlueColumn's conversational website agent, shown here answering questions about Arcadia Fence and Gate. An OutLoud page greets every visitor, answers out loud from the business's own knowledge, and shows its work on the screen beside the avatar. Plans start at $49 a month at bluecolumn.ai."
    },
    {
      id: 'booking-flow',
      k: ['book', 'demo', 'walkthrough', 'quote', 'estimate', 'sign up', 'get started', 'free'],
      t: "Easy. For your free Arcadia estimate: leave your name, the property address, and the best phone number, and Arcadia calls you — usually same day during business hours. And if you want a page like this one for your business, say book a demo and a BlueColumn strategist schedules the walkthrough."
    },
    {
      id: 'voice-avatar',
      k: ['voice', 'avatar', 'mascot', 'lip', 'speak', 'robot', 'animation', 'orange', 'buddy', 'who are you', 'your name'],
      t: "I'm Buddy, the OutLoud agent for this page. I speak with an ElevenLabs voice, answer from Arcadia's own knowledge plus a live BlueColumn brain, and move as a sprite-animated character whose lip-sync runs independently of my gestures. On client pages the same stack also runs as a real-time video avatar."
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
        try { sessionStorage.setItem('ol-rag-down-until', String(Date.now() + 60 * 60 * 1000)); } catch (e) {}
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
          text: "Here's the quick version. Arcadia Fence and Gate builds block walls, steel view fencing, wood, vinyl, and custom gates across the Phoenix Metro — every estimate is free, financing is available, and they're ROC 337481. I can cover materials, gates, the service area, or start your estimate.",
          source: 'fallback'
        };
      });
    },
    peek: fromCatalog
  };
})();