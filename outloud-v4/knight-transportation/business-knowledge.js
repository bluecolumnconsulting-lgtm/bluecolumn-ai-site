/* ===============================================================
   Knight Transportation — BUSINESS KNOWLEDGE LAYER (Context 1 of 3)
   "Delivering More."

   Retrieval order:
     1. Live agent brain  → POST { action:'agent' } on OUTLOUD_FN
     2. Static catalog   → instant, offline-safe (facts below)
     3. Honest fallback  → invites the next question.

   Source: knighttrans.com (home, why-knight, careers, contact,
   services). Pulled 2026-09-29.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;
  var RAG = CONFIG.rag || { timeoutMs: 20000, minAnswerChars: 8, notInContext: /not in available context/i };

  var CATALOG = [
    {
      id: 'about',
      k: ['who are you', 'who is knight', 'about', 'story', 'history', 'founded', 'knight transportation', 'company'],
      t: "Knight Transportation was founded in 1990 in Phoenix, Arizona by the four Knight cousins, who started with a single terminal and a handful of trucks. In 2017 Knight merged with Swift to form Knight-Swift Transportation Holdings, North America's largest full truckload company. We're still headquartered in Phoenix."
    },
    {
      id: 'services',
      k: ['services', 'what do you do', 'what do you offer', 'dry van', 'refrigerated', 'reefer', 'port', 'dedicated', 'logistics', 'expedited', 'flatbed', 'freight', 'truckload'],
      t: "We're a full-service truckload and logistics carrier. Our core services are Dry Van, Refrigerated (temperature-controlled), Port Services, Dedicated, Logistics, and Expedited. We also run Flatbed, Teams, Owner Operator programs, truck and trailer sales, and warehousing through the Knight-Swift network."
    },
    {
      id: 'scale',
      k: ['how big', 'how many trucks', 'how many tractors', 'how many trailers', 'terminals', 'network', 'nationwide', 'locations'],
      t: "Knight Transportation runs one of the largest truckload fleets in North America, supported by a national network of terminals, shops, and training academies across the United States. Our driving associates and customers are supported locally everywhere from Phoenix to Atlanta to Carlisle."
    },
    {
      id: 'equipment',
      k: ['equipment', 'trucks', 'tractors', 'volvo', 'international', 'kenworth', 'freightliner', 'peterbilt', 'fleet', 'technology'],
      t: "We invest in best-in-class equipment for driver safety and experience. Our fleet includes Volvo, International, Kenworth, Freightliner, and Peterbilt tractors, all equipped with cutting-edge technology to enhance safety, efficiency, and the driver experience."
    },
    {
      id: 'quote',
      k: ['quote', 'freight quote', 'price', 'pricing', 'rate', 'ship', 'shipping', 'request a quote', 'load', 'capacity'],
      t: "The fastest way to get a freight quote is to request one at knighttrans.com, or call our sales and customer service line. You can also reach dedicated, logistics, and truck-and-trailer sales teams directly through the contact page."
    },
    {
      id: 'drive',
      k: ['drive', 'driver', 'driving', 'become a driver', 'cdl', 'driving jobs', 'truck driver', 'drive for knight'],
      t: "Driving for Knight means more miles, more pay, and more respect. We have OTR, regional, dedicated, team, flatbed, and owner operator opportunities, plus our own CDL training — permit, school, and OTR training — to get you licensed and on the road. Apply at knighttrans.com or call Drive for Knight at 1-888-457-0974."
    },
    {
      id: 'careers',
      k: ['career', 'careers', 'job', 'jobs', 'hiring', 'apply', 'employment', 'work', 'openings', 'office', 'shop', 'technician', 'benefits'],
      t: "We hire drivers, shop technicians, and office professionals nationwide. Benefits include health insurance, 401k match, paid time off, tuition assistance and reimbursement, an employee stock purchase plan, bonus programs, on-site gyms, and corporate discounts — as part of a Fortune 500 company. Search openings at knighttrans.com."
    },
    {
      id: 'military',
      k: ['military', 'veteran', 'veterans', 'army', 'navy', 'air force', 'marines', 'gi bill', 'transition'],
      t: "Knight actively recruits military veterans and transitioning service members. Our military program helps you move from service to a rewarding driving career, with dedicated support and pathways that respect your experience."
    },
    {
      id: 'million-mile',
      k: ['million mile', 'million miles', 'safety', 'safe driving', 'award'],
      t: "We honor our safest, most dedicated professionals through the Million Mile Driver program — recognizing drivers who reach a million safe miles on the road."
    },
    {
      id: 'contact',
      k: ['contact', 'phone', 'call', 'email', 'reach', 'number', 'get in touch', 'address', 'headquarters', 'located', 'where are you'],
      t: "General inquiries: call 800-489-2000 or email contact@knighttrans.com. Driver recruiting: 1-888-457-0974. Our headquarters is at 5601 West Buckeye Road, Phoenix, Arizona 85043."
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
          text: "That one's not in my notes yet. I can tell you about our services, freight quotes, driving careers, equipment, or how to reach us — just ask.",
          source: 'fallback'
        };
      });
    },
    peek: fromCatalog
  };
})();
