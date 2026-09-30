/* ===============================================================
   Scuba Junkie — BUSINESS KNOWLEDGE LAYER (Context 1 of 3)
   "Dive Sipadan from our eco resort on Mabul Island."

   Retrieval order:
     1. Live agent brain  → POST { action:'agent' } on OUTLOUD_FN
     2. Static catalog   → instant, offline-safe (facts below)
     3. Honest fallback  → invites the next question.

   Source: scuba-junkie.com (home, sipadan-si-amil-packages, mabul-beach-resort,
     padi-courses, rooms, diving-sipadan, conservation, contact-us, diving,
     diving-mabul, diving-kapalai, diving-siamil, getting-here, know-before-you-go,
     special-offers, restaurant-bar, scuba-junkie).
   Pulled 2026-09-30. Site is English-only.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;
  var RAG = CONFIG.rag || { timeoutMs: 20000, minAnswerChars: 8, notInContext: /not in available context/i };

  var CATALOG = [
    {
      id: 'about',
      k: ['who are you', 'who is scuba junkie', 'what is scuba junkie', 'about', 'story', 'history', 'founded', 'established', 'company', 'scuba junkie', 'what do you do', 'eco dive company', 'sustainable'],
      t: "Scuba Junkie is a dive resort and operator based on Mabul Island, Sabah, just a short boat ride from world-famous Sipadan. Founded in 2004, we have grown into a leading sustainable dive company in Asia through a strong focus on marine conservation and quality diver training. We are a PADI 5* IDC centre offering daily diving and snorkelling trips around the islands of the Celebes Sea."
    },
    {
      id: 'locations',
      k: ['where', 'where are you', 'location', 'located', 'mabul', 'sipadan', 'kapalai', 'si amil', 'semporna', 'sabah', 'borneo', 'celebes sea', 'dive sites', 'dive locations', 'islands', 'malaysia'],
      t: "We are based at Mabul Beach Resort on Mabul Island, off the east coast of Sabah in Malaysian Borneo. From there we dive and snorkel the islands of the Celebes Sea: world-famous Sipadan, plus Mabul, Kapalai and Si Amil. Our dive centre and booking office are in Semporna town on the mainland, roughly a one-hour boat ride from the resort. Sipadan itself is the only volcanic island in Malaysia, plunging over 2,000 metres to the sea floor."
    },
    {
      id: 'sipadan',
      k: ['sipadan', 'why sipadan', 'diving sipadan', 'sipadan sites', 'barracuda point', 'south point', 'drop off', 'top dive site', 'cousteau', 'permit', 'sipadan permit'],
      t: "Sipadan is regularly voted one of the top dive sites in the world. Originally popularised by Jacques Cousteau, it sits in the centre of the Indo-Pacific basin with more than 3,000 species of fish and hundreds of corals. Expect green and hawksbill turtles (often twenty or more on a single dive), white-tip and grey reef sharks, schooling hammerheads, eagle and devil rays, the famous barracuda tornado, and huge bumphead parrotfish at sites such as Barracuda Point, South Point and Drop Off. Sipadan is a protected area limited to 176 divers per day, so a permit is required, and a PADI Advanced Open Water certification or equivalent is needed to dive there."
    },
    {
      id: 'packages',
      k: ['package', 'packages', 'dive package', 'sipadan package', 'sipadan si amil', 'price', 'prices', 'cost', 'how much', 'rates', '3d2n', 'inclusions', 'whats included', 'all inclusive', 'gear rental', 'equipment rental'],
      t: "Our certified-diver Sipadan & Si Amil packages start from 3 days and 2 nights, with accommodation at Mabul Beach Resort, diving around Mabul, Kapalai, Si Amil and Sipadan, boat transfers to and from Mabul at set times, and meals, tea, coffee and water. Your Sipadan permit is guaranteed when you book any package from 3D/2N. Rates are valid until 31 December 2026, and packages with 3 or more Sipadan days can earn automatic discounts in low season. Full equipment rental excluding a dive computer is RM65 per day. If our standard packages do not fit your schedule, we are happy to tailor-make one for you."
    },
    {
      id: 'rooms',
      k: ['room', 'rooms', 'accommodation', 'stay', 'where do i stay', 'resort', 'mabul beach resort', 'vip room', 'deluxe', 'family room', 'dorm', 'dormitory', 'ensuite', 'fan room', 'air conditioning', 'beachfront'],
      t: "You stay at our eco-friendly Mabul Beach Resort, with 30 en suite rooms on the beachfront. Room types cover every budget: two VIP AC rooms with a king bed and partial sea view, Deluxe AC rooms for twin or triple share, one Deluxe AC Family Room, Ensuite AC rooms, Ensuite Fan rooms and mixed-gender dorms. Accommodation rates are per person per night, and prices include full board meals plus tea, coffee and water. A Malaysian tourism tax of RM10 per room per night applies to non-dorm rooms, and a high-season supplement applies on set dates. The resort uses solar water heating, so hot water can take a little time to reach your shower."
    },
    {
      id: 'courses',
      k: ['course', 'courses', 'padi', 'learn to dive', 'certification', 'open water', 'advanced open water', 'rescue diver', 'divemaster', 'instructor', 'idc', 'efr', 'emergency first response', 'discover scuba', 'refresher', 'training', 'get certified'],
      t: "We are an award-winning PADI 5* Instructor Development Centre teaching all levels, from Discover Scuba Diving to Open Water Scuba Instructor. Indicative course prices: Discover Scuba Diving from RM420, Open Water Diver from RM1,630, Advanced Open Water from RM1,360, Emergency First Response RM520, Rescue Diver from RM1,465, Divemaster from RM4,250, and the PADI Instructor course from RM7,950. Brief refresher dives carry no extra charge. Our experienced, multi-lingual instructors teach in calm, clear waters right on our doorstep."
    },
    {
      id: 'beginner',
      k: ['never dived', 'beginner', 'first time', 'try diving', 'no experience', 'non diver', 'snorkel', 'snorkelling', 'snorkeling', 'can i dive', 'start diving'],
      t: "You do not need any experience to start. The PADI Discover Scuba Diving programme lets you try diving for the first time under close professional supervision, and the Open Water Diver course is the full entry-level certification. If you are not a diver, we also run snorkelling trips around Mabul, Kapalai and the surrounding reefs, so everyone in the group has something to enjoy."
    },
    {
      id: 'conservation',
      k: ['conservation', 'environment', 'eco', 'reef', 'turtle', 'shark', 'coral', 'seas', 'sustainability', 'green fins', 'hatchery', 'reef safe', 'donation', 'plastic', 'rehabilitation'],
      t: "Care for the local environment is at the core of Scuba Junkie. Our dedicated conservation arm, Scuba Junkie S.E.A.S., was founded in 2009 and is now a registered NGO running programmes in turtle, shark, coral and cetacean conservation, marine debris and community outreach. The Mabul Turtle Hatchery, established in 2011, has released over 17,000 hatchlings, and our Turtle Rehabilitation Centre has re-released 15 recovered turtles. Our resorts use solar water heating, zero-efflux sewage, recycling and water refill stations, ban single-use plastics, follow a no-seafood policy and are Top Ten Green Fins members. We ask all guests to use reef-safe suncream, and for 2026 we invite guests to make a voluntary RM50 donation to SEAS, which Scuba Junkie matches to double the impact."
    },
    {
      id: 'booking',
      k: ['book', 'booking', 'how do i book', 'reserve', 'reservation', 'availability', 'enquiry', 'enquire', 'quote', 'contact', 'email', 'phone', 'whatsapp', 'get in touch', 'special offers', 'discount', 'returning guest'],
      t: "The easiest way to book or check availability is to fill in the contact form on our website, email, call or message us on WhatsApp at +60 19-640 0116. It helps to include what activity you would like, how many people you are booking for, your preferred room type and how many days of diving you want. Our booking team replies within 24 hours. Sipadan permits are limited, so we recommend booking at least a few weeks ahead. We run special offers including up to 15 per cent off diving, up to 20 per cent on combo bookings with other Scuba Junkie locations, and discounts for returning guests."
    },
    {
      id: 'getting-here',
      k: ['getting here', 'how do i get there', 'how do i get to', 'transfer', 'boat', 'flight', 'airport', 'tawau', 'semporna', 'transport', 'get to mabul', 'departure times'],
      t: "Most guests fly into Tawau airport, transfer to Semporna on the mainland, then take our boat to Mabul. Boats depart Semporna to Mabul at 8am and 2.30pm, and Mabul to Semporna at 10am and 4pm. To reach Mabul the same day you arrive, book a flight landing by 12 noon at Tawau. The 10am return suits flights leaving at 2pm or later. There may be an additional transfer fee of RM150 each way if no other guests share the boat. Our office at Block B, Lot 36, Semporna is a five-minute walk from the bus stops."
    },
    {
      id: 'experience',
      k: ['what is it like', 'atmosphere', 'friendly', 'family', 'staff', 'crew', 'why choose', 'why scuba junkie', 'reviews', 'testimonials', 'safe', 'safety', 'award', 'reputation', 'dive resort of the year'],
      t: "Divers return to us time and again for our safety standards, our friendly crew and the family atmosphere. We were voted Dive Resort of the Year by divers around the world in 2020. Reviews highlight professional but patient instructors, brilliant diving on the house reef, and a resort that feels like family from the dive guides and boat captains through to the kitchen and bar staff. Our dive centre at Mabul can host up to 100 divers a day, with over 100 world-class dive sites to choose from."
    },
    {
      id: 'resort-life',
      k: ['restaurant', 'bar', 'food', 'meals', 'eat', 'drink', 'beer', 'beach', 'sunset', 'wifi', 'internet', 'facilities', 'whats on site', 'jetty bar', 'house reef'],
      t: "The resort includes full board meals in a large open-plan restaurant, and in the evenings you can enjoy a drink in the spacious upstairs panoramic bar or the jetty bar while watching the sunset. There is a house reef for a swim before breakfast, a private beach where turtles sometimes nest, and a small retail shop for souvenirs and dive accessories. Wi-Fi is available in the common areas, though the speed varies, and there is mobile signal and 4G on the island. There are no ATMs, money changers or supermarkets on Mabul, so bring some cash from Semporna."
    },
    {
      id: 'family',
      k: ['family', 'children', 'kids', 'child', 'young', 'family friendly', 'children price', 'half price'],
      t: "Families are welcome at Mabul Beach Resort. Our Deluxe AC Family Room sleeps two adults and two children, or up to four adults, and children under 12 sharing a room with two adults receive half-price accommodation. Speak with our booking team and we will help match the right room and activities for your family."
    },
    {
      id: 'pro',
      k: ['divemaster internship', 'go pro', 'career', 'work', 'internship', 'become a pro', 'instructor internship', 'gap year', 'dream job'],
      t: "If you want to turn diving into a career, we run Divemaster and Instructor internships as well as the standard professional courses. Our four-week Divemaster course covers every aspect of working in a PADI dive centre, and our personalised IDCs prepare you fully for life as a PADI instructor, with world-class diving and an introduction to our environmental projects along the way."
    },
    {
      id: 'contact',
      k: ['contact', 'address', 'where to find you', 'office', 'phone number', 'email address', 'reach you', 'find us', 'map', 'hours'],
      t: "Our booking office is Scuba Junkie, Block B, Lot 36, 91308 Semporna, Sabah, Malaysia, down by the waterfront and a five-minute walk from the bus stops. The quickest way to reach us is the contact form on our website or WhatsApp on +60 19-640 0116, and our booking team replies within 24 hours."
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
          text: "That one is not in my notes yet. I can tell you about diving Sipadan, our PADI courses, the Mabul Beach Resort rooms, our packages and prices, our conservation work, or how to book and get here — just ask.",
          source: 'fallback'
        };
      });
    },
    peek: fromCatalog
  };
})();
