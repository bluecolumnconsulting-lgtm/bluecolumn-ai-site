/* ===============================================================
   Finca Cortesín — BUSINESS KNOWLEDGE LAYER (Context 1)
   "Five star golf, spa and beach resort in Casares, Costa del Sol."

   Retrieval order:
     1. Live agent brain  → POST { action:'agent' } on OUTLOUD_FN
     2. Static catalog   → instant, offline-safe (facts below)
     3. Honest fallback  → invites the next question.

   Source: fincacortesin.com (home, about-us, golf, luxury-spa-spain,
   beach-resort-spain, contact-us). Pulled 2026-09-29.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;
  var RAG = CONFIG.rag || { timeoutMs: 20000, minAnswerChars: 8, notInContext: /not in available context/i };

  var CATALOG = [
    {
      id: 'about',
      k: ['who are you', 'what is finca cortesin', 'what is finca cortesín', 'about', 'overview', 'story', 'history', 'opened', 'since', 'company', 'resort', 'cortesin', 'cortesín', 'what kind of place'],
      t: "Finca Cortesín is a five star luxury resort hotel in Casares, on the Costa del Sol in Andalusia, Spain. It opened in March 2009 and sits across 532 acres about a mile from the Mediterranean coast. The property captures the essence of a classic Andalusian cortijo, with whitewashed architecture, palatial patios, fragrant courtyards and manicured gardens, and it brings together an award winning golf course, a large spa, a beach club and several restaurants."
    },
    {
      id: 'location',
      k: ['where are you', 'where is', 'located', 'location', 'address', 'how do i get', 'casares', 'costa del sol', 'malaga', 'málaga', 'which part of spain', 'how far', 'airport'],
      t: "Finca Cortesín is in Casares, in the province of Málaga, on Spain's Costa del Sol. The address is Carretera de Casares, s/n, 29690 Casares, Málaga. The resort sits about a mile from the Mediterranean coast, with the sea to one side and the Casares mountains to the other, and it is well placed for trips to Málaga, Seville and Granada."
    },
    {
      id: 'golf',
      k: ['golf', 'golf course', 'the course', 'play golf', 'tee time', 'tee times', 'handicap', 'solheim', 'championship', 'fairways', 'green fees', 'caddie', 'caddey'],
      t: "Golf is at the heart of Finca Cortesín. The estate is home to an 18 hole championship course designed by Cabell B. Robinson, with wide fairways, strategic bunkering and immaculate greens that challenge professionals while staying enjoyable for amateurs. The resort hosted the 2023 Solheim Cup, and the course has also welcomed DP World Tour events. Tee times can be arranged through the resort."
    },
    {
      id: 'golf-course',
      k: ['cabell', 'robinson', 'designed by', 'who designed', 'par', 'holes', 'bunkers', 'olive trees', 'nicklaus academy', 'practice', 'driving range'],
      t: "The championship course at Finca Cortesín was designed by Cabell B. Robinson. It is an 18 hole layout with a natural flow across the rolling landscape, framed by olive trees and sweeping coastal views. The resort also has the Nicklaus Academy for coaching, plus practice facilities, a driving range and short game areas, and an elegant clubhouse."
    },
    {
      id: 'spa',
      k: ['spa', 'wellness', 'massage', 'treatment', 'thermal', 'saltwater pool', 'snow cave', 'snow cabin', 'hammam', 'sauna', 'relax', 'yoga', 'retreat'],
      t: "The Spa at Finca Cortesín spans more than 2,200 square metres and is dedicated to restoring balance and beauty. It includes thermal baths, a saltwater pool and a snow cave, with treatments inspired by both Eastern and Western traditions. Open air yoga and curated rituals round out a wellness offering built for deep renewal of body and mind."
    },
    {
      id: 'beach-club',
      k: ['beach', 'beach club', 'infinity pool', 'sea', 'shore', 'loungers', 'seaside', 'swim'],
      t: "Finca Cortesín has an exclusive Beach Club a short drive from the hotel. It features a 35 metre infinity pool, shaded loungers and Mediterranean cuisine served by the shore, making it a relaxed place to spend a day in the sun."
    },
    {
      id: 'dining',
      k: ['dining', 'restaurant', 'restaurants', 'eat', 'food', 'dinner', 'lunch', 'breakfast', 'el jardin', 'el jardín de lutz', 'don giovanni', 'rei', 'blue bar', 'pool 35', 'clubhouse dining', 'michelin', 'cuisine'],
      t: "Dining at Finca Cortesín is a journey through cultures and flavours. El Jardín de Lutz leads the collection with Mediterranean freshness, Don Giovanni offers Italian elegance, and REI brings Japanese precision and fusion. The Clubhouse, Blue Bar and Pool 35 round out the options, each built around seasonal produce and creative cooking."
    },
    {
      id: 'rooms',
      k: ['rooms', 'room', 'suites', 'suite', 'accommodation', 'stay', 'bedroom', 'balcony', 'where do i sleep', 'how many rooms', 'how many suites', 'family suite', 'pool suite', 'sea view', 'residence'],
      t: "The hotel has 67 spacious suites, which gives it an intimate feel for a resort of this scale. Suite types include the Junior Suite, Junior View Suite, Executive Suite, Garden Suite, Pool Suite, Sea View, Cortesin Suite and Family Suite, plus private Residences such as La Reserva and Green 10. Each suite is generously proportioned and bathed in natural light, with views over the gardens, the pools or the coastline."
    },
    {
      id: 'weddings-events',
      k: ['wedding', 'weddings', 'event', 'events', 'celebration', 'celebrations', 'meetings', 'meeting', 'conference', 'private', 'venue', 'spaces', 'occasion'],
      t: "Finca Cortesín is a setting for weddings, meetings and private celebrations. From intimate gatherings in sunlit courtyards to grand occasions set against the Andalusian gardens, the team crafts each event with close attention to detail. The resort combines elegance and versatility, with attentive service and bespoke arrangements for every occasion."
    },
    {
      id: 'awards',
      k: ['awards', 'award', 'recognised', 'recognized', 'conde nast', 'gold list', 'best resort', 'reviews', 'reputation', 'ranked', 'accolades'],
      t: "Finca Cortesín is consistently recognised among the finest destinations in Europe. It has been named the number one resort in Spain and Portugal and has earned a place on Condé Nast Traveler's Gold List, among other accolades. The resort says each award reflects its philosophy of uncompromising service, refined experiences and timeless Andalusian charm."
    },
    {
      id: 'experiences',
      k: ['experiences', 'things to do', 'activities', 'tennis', 'paddle', 'padel', 'horse', 'horseback', 'riding', 'gym', 'fitness', 'racket', 'excursion', 'day trip', 'region'],
      t: "Beyond golf and the spa, days at Finca Cortesín unfold in variety. There are tennis and paddle courts, a fitness and racket club with gyms and light filled studios, guided yoga and holistic practices, and horseback riding through the rolling hills. The team can also arrange cultural trips to Málaga, Seville and Granada."
    },
    {
      id: 'booking',
      k: ['book', 'booking', 'how do i book', 'how can i book', 'reserve', 'reservation', 'reservations', 'availability', 'price', 'prices', 'cost', 'how much', 'rates', 'book now', 'stay'],
      t: "You can book a stay through the resort's booking page at fincacortesin.com, or contact the reservations team directly. Email reservas@hotelcortesin.com or call +34 952 937 800, and the team will help with availability, suite choice and any experiences you would like to add. You can also leave your name and number here and the team will reach out."
    },
    {
      id: 'contact',
      k: ['contact', 'phone', 'call', 'email', 'reach', 'number', 'get in touch', 'concierge', 'whatsapp', 'office hours', 'speak to someone', 'human'],
      t: "Our concierge team is here to help. Call +34 952 937 800, email reservas@hotelcortesin.com for reservations or concierge@hotelcortesin.com for concierge matters, or reach us on WhatsApp. The address is Carretera de Casares, s/n, 29690 Casares, Málaga, Spain."
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
          text: "That one is not in my notes yet. I can tell you about the golf course, the spa, our suites, dining, awards, or how to book a stay. Just ask.",
          source: 'fallback'
        };
      });
    },
    peek: fromCatalog
  };
})();
