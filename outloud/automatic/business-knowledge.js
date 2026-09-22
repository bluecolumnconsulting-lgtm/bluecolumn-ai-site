/* ===============================================================
   OutLoud for AUTOMATTIC — BUSINESS KNOWLEDGE LAYER (CONTEXT 1 of 3)
   Cloned from outloud-v2/business-knowledge.js and re-aimed at the
   client business: AUTOMATTIC (automatic.com → automattic.com).

   Knowledge source: automattic.com (homepage + about), fetched and
   verified 2026-09-21, cross-checked against Wikipedia and ma.tt.
   Every claim below mirrors that published copy — no invented facts.

   Retrieval order on THIS page:
     1. Static catalog (instant, offline-safe) — the live BlueColumn
       brain is disabled here because its namespace holds OutLoud
       product knowledge, not Automattic knowledge (see config).
     2. Honest fallback that invites the next question.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;
  var RAG = CONFIG.rag || { timeoutMs: 5000, minAnswerChars: 8, notInContext: /not in available context/i };

  /* --- Static catalog: the brain of this page.
         Sourced from automattic.com, 2026-09-21. --- */
  var CATALOG = [
    {
      id: 'pricing',
      k: ['price', 'cost', 'how much', 'plans', 'fee', 'expensive', 'budget'],
      t: "Quick framing: this page is an OutLoud demo by BlueColumn, so pricing here is OutLoud pricing, not Automattic's product pricing. OutLoud Starter is $49 a month with an animated avatar, lead capture, and booking. Pro is $149 with a video avatar and domain connect. Team is $349 with five seats and lead routing. Personal is $19 a month, and white-glove onboarding is an optional $500 one-time add-on."
    },
    {
      id: 'how-it-works',
      k: ['how does it work', 'how it works', 'how do', 'what can you do', 'capab', 'under the hood', 'built', 'what does automattic do', 'what do you do'],
      t: "Automattic builds the open web: WordPress.com for blogs and websites, WooCommerce for selling online, Jetpack for safety and speed, Tumblr, Beeper, Day One, Pocket Casts, Gravatar, Akismet, and enterprise-grade WordPress VIP. The page itself runs on OutLoud — a live knowledge catalog, an ElevenLabs voice, and this mascot, answering around the clock."
    },
    {
      id: 'live-sites',
      k: ['client', 'example', 'live page', 'sites', 'who uses', 'demo pages', 'proof'],
      t: "On the OutLoud side: six live client pages right now — Star Jet Ski Rentals, Vulcan Fence, HomeSpark, OttoMedic, Adventure Club, and Venture Club — and at Arcadia Fence booked jobs went up forty percent in the first month. A page like this one could sit on automattic.com answering visitor questions the same way."
    },
    {
      id: 'what-is',
      k: ['what is automattic', 'tell me about automattic', 'who are you', 'who is this', 'what is this', 'what company', 'about automattic', 'about the company'],
      t: "Automattic is the company behind WordPress.com — the platform that powers over forty percent of all websites. Founded in 2005 by Matt Mullenweg, Automattic is a fully distributed company with no headquarters: people work from more than eighty countries. Its mission is making the web a better place."
    },
    {
      id: 'products',
      k: ['products', 'what do you make', 'brands', 'what do you build', 'portfolio', 'tools'],
      t: "Automattic builds WordPress.com for blogs and websites, WooCommerce for selling online, Jetpack for safety, growth, and speed, and Tumblr. It also makes Beeper for messaging, Day One for journaling, Pocket Casts for podcasts, Gravatar for global avatars, Akismet for spam filtering, Longreads and Newspack for storytelling and publishing, and WordPress VIP for enterprise — ready for AI agents."
    },
    {
      id: 'wordpress-com',
      k: ['wordpress.com', 'wordpress dot com', 'blog', 'website hosting', 'hosting', 'wordpress com'],
      t: "WordPress.com is Automattic's founding product: your blog or website has a free home on the web — your story, your way. The open-source WordPress project behind it powers over forty percent of all websites."
    },
    {
      id: 'woocommerce',
      k: ['woocommerce', 'woo', 'ecommerce', 'e-commerce', 'sell online', 'store', 'shop'],
      t: "WooCommerce is Automattic's free open-source commerce plugin for WordPress. Selling online? Woo! Hang your digital shingle with it — it's one of the most-used ways to build an online store."
    },
    {
      id: 'vip',
      k: ['vip', 'enterprise', 'wordpress vip', 'wpvip', 'big business', 'fortune'],
      t: "WordPress VIP is Automattic's enterprise platform: built for enterprise, ready for AI agents, and powered by WordPress. It runs some of the biggest publishing and media sites on the web."
    },
    {
      id: 'open-source',
      k: ['open source', 'opensource', 'five for the future', 'sponsorship', 'contribute', 'community', 'wordpress.org'],
      t: "Automattic contributes back to open source through Five for the Future and sponsorships: WordPress.org, WP for iOS and Android, BuddyPress, bbPress, WordCamps, and more. As Matt Mullenweg puts it: we don't make software for free, we make it for freedom."
    },
    {
      id: 'founder',
      k: ['founder', 'matt', 'mullenweg', 'ceo', 'who founded', 'history', 'founded', 'when was', 'timeline', '20 years', 'twenty years'],
      t: "Automattic was founded in 2005 by Matt Mullenweg, who remains its CEO. The company is celebrating twenty years — its full story is on the Automattic timeline at automattic.com/timeline."
    },
    {
      id: 'distributed',
      k: ['distributed', 'remote', 'employees', 'how many people', 'team', 'work from', 'headquarters', 'office', 'hiring', 'careers', 'jobs'],
      t: "Automattic is a fully distributed company — more than fourteen hundred people working from over eighty countries, with no physical headquarters. The whole company works on, and for, the web."
    },
    {
      id: 'mission',
      k: ['mission', 'why', 'purpose', 'philosophy', 'values', 'better place', 'freedom'],
      t: "Automattic's stated purpose is simple: making the web a better place. The company builds software for freedom, sponsors open-source projects, and believes in publishing and owning your own story."
    },
    {
      id: 'other-products',
      k: ['beeper', 'tumblr', 'day one', 'pocket casts', 'gravatar', 'akismet', 'longreads', 'newspack', 'jetpack', 'simplenote', 'parse.ly', 'parsely'],
      t: "Beyond WordPress: Beeper unifies fragmented messaging, Tumblr is where communities live, Day One distills your days into a private journal, Pocket Casts is built by podcasters, Gravatar is the global avatar, Akismet filters spam, and Longreads and Newspack power great storytelling and publishing."
    },
    {
      id: 'outloud',
      k: ['outloud', 'out loud', 'this page', 'what is this page', 'bluecolumn', 'blue column', 'who built this'],
      t: "This page itself is OutLoud — BlueColumn's conversational website agent, shown here answering questions about Automattic. An OutLoud page greets every visitor, answers out loud from the business's own knowledge, and shows its work on the screen beside the avatar. Plans start at $49 a month at bluecolumn.ai."
    },
    {
      id: 'booking-flow',
      k: ['book', 'demo', 'walkthrough', 'schedule', 'sign up', 'talk to someone', 'get started', 'contact', 'email', 'phone'],
      t: "Happy to set that up. I'll take your name, business, and the best phone number, and a BlueColumn strategist schedules a walkthrough of what an OutLoud page like this could look like for your site. You can also email hello@bluecolumn.ai."
    },
    {
      id: 'voice-avatar',
      k: ['voice', 'avatar', 'mascot', 'lip', 'speak', 'robot', 'animation', 'orange'],
      t: "I speak with an ElevenLabs voice, and I move as a sprite-animated orange mascot whose lip-sync runs independently of my gestures. The same OutLoud stack also runs as a real-time video avatar on client pages."
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

  /* Clean the visitor's message into a good brain query. Kept from
     the parent build for API parity; used only if RAG is re-enabled. */
  function buildQuery(text) {
    var q = String(text || '').trim()
      .replace(/^(hi|hey|hello|yo|ok|okay|so|um|uh)[,!. ]+/i, '')
      .replace(/\b(can you|could you|please|tell me|do you know|i want to know|whats|what's)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (q.length < 3) { q = String(text || '').trim(); }
    return CONFIG.business.ragPrefix + q;
  }

  /* Live brain path — kept for parity, but gated off on this page
     via CONFIG.rag.disabled (BlueColumn namespace is OutLoud
     product knowledge, not Automattic knowledge). */
  function ragFetch(query) {
    try {
      var downUntil = Number(sessionStorage.getItem('ol-rag-down-until') || 0);
      if (downUntil && Date.now() < downUntil) { return Promise.resolve(null); }
    } catch (e) {}
    var SECRETS = window.OUTLOUD.SECRETS;
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
      clearTimeout(timer);
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
      return { text: a, source: 'rag', knowledgeId: 'rag:' + Date.now() };
    }).catch(function () {
      clearTimeout(timer);
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
      if (CONFIG.rag && CONFIG.rag.disabled) {
        if (local) { return Promise.resolve({ text: local.text, source: 'catalog', knowledgeId: local.knowledgeId }); }
        return Promise.resolve({
          text: "Good question. I know Automattic best — its products, its people, and its open-source work — and I can also show you what this OutLoud page can do, or book a walkthrough for your own site.",
          source: 'fallback'
        });
      }
      return ragFetch(buildQuery(query)).then(function (r) {
        if (r) { return r; }
        if (local) { return { text: local.text, source: 'catalog', knowledgeId: local.knowledgeId }; }
        return {
          text: "Here's the quick version. Automattic is the company behind WordPress.com — powering over forty percent of the web — and I can walk you through its products, its distributed team, or its open-source work.",
          source: 'fallback'
        };
      });
    },
    peek: fromCatalog
  };
})();