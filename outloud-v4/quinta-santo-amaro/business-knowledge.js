/* ===============================================================
   Quinta de Santo Amaro — BUSINESS KNOWLEDGE LAYER (Context 1 of 3)
   "Uma casa com história desde 1544."

   Bilingual (PT / EN): every catalog entry carries both texts and
   both keyword sets; fromCatalog() serves the language currently
   selected on the page (CONFIG.client.language).

   Retrieval order:
     1. Live agent brain  → POST { action:'agent' } on OUTLOUD_FN
     2. Static catalog    → instant, offline-safe (facts below)
     3. Honest fallback   → invites the next question.

   Source: quintasantoamaro.pt (home, a-casa/the-farm, eventos/events,
     vinhos/wines, contactos/contacts). Pulled 2026-09-30.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;
  var RAG = CONFIG.rag || { timeoutMs: 20000, minAnswerChars: 8 };

  /* k = keywords in BOTH languages (PT and EN share the list so a
     question in either language matches). t = { pt, en }. */
  var CATALOG = [
    {
      id: 'about',
      k: ['quem são', 'quem e', 'o que é a quinta', 'sobre', 'história', 'historia', 'fundada', 'origem', 'santo amaro', 'quina', 'since 1544', '1544', 'who are you', 'about', 'history', 'story', 'founded', 'estate', 'the farm', 'quinta'],
      t: {
        pt: "A Quinta de Santo Amaro é uma casa com história no coração da Bairrada. Foi fundada no século XVI pela Ordem Franciscana, e o primeiro registo da nossa família na quinta data de 1879. Ao longo de sete gerações, os espaços foram preservados com carinho e adaptados com sensibilidade, combinando o charme original com a funcionalidade contemporânea, sem perder a essência que atravessou séculos.",
        en: "Quinta de Santo Amaro is a historic estate in the heart of Bairrada. It was founded in the 16th century by the Franciscan Order, and the first record of our family at the estate dates back to 1879. Over seven generations the spaces have been lovingly preserved and sensitively adapted, combining the original charm with contemporary comfort, without losing the essence that has crossed the centuries."
      }
    },
    {
      id: 'estate',
      k: ['a quinta', 'espaço', 'espaco', 'jardins', 'vinhas', 'piscina', 'padel', 'cavalariças', 'cavalariças', 'capela', 'adega', 'capacidade', '350', 'o que tem', 'instalações', 'gardens', 'vineyards', 'chapel', 'cellar', 'pool', 'stables', 'capacity', 'facilities', 'grounds', 'what is there'],
      t: {
        pt: "A Quinta é composta por uma capela do século XVI, amplos jardins com árvores centenárias, piscina, campo de padel, cavalariças e uma antiga adega. Os elegantes jardins, rodeados pelas vinhas que envolvem a casa, são perfeitos para eventos ao ar livre, com capacidade para receber até 350 pessoas.",
        en: "The estate comprises a 16th-century chapel, expansive gardens with century-old trees, a swimming pool, a padel court, stables and an old wine cellar. The elegant gardens, surrounded by the vineyards that encircle the house, are perfect for outdoor events, with capacity for up to 350 people."
      }
    },
    {
      id: 'cellar',
      k: ['adega', 'antiga adega', 'lareira', 'bar', 'projeção', 'projecao', '70', '150', 'espaço interior', 'interior', 'cellar', 'wine cellar', 'fireplace', 'video projection', 'indoor', 'intimate'],
      t: {
        pt: "A antiga adega — onde a família produzia vinho e aguardente — foi transformada na década de 80 por João Flores num ambiente acolhedor, cheio de história e personalidade. O forno deu lugar a uma lareira, uma tapeçaria centenária adorna as antigas pipas de madeira e as dornas de pedra onde se pisavam as uvas foram preservadas. Hoje é um espaço único, com bar, lareira e projeção de vídeo, perfeito para eventos intimistas, acolhendo até 70 pessoas sentadas ou 150 em pé.",
        en: "The old wine cellar — where the family produced wine and aguardente — was transformed in the 1980s by João Flores into a welcoming space full of history and personality. The original oven became a fireplace, a century-old tapestry adorns the old wooden barrels, and the stone treading basins where the grapes were once pressed have been preserved. Today it is a unique space with a bar, a fireplace and video projection — perfect for intimate events, seating up to 70 or hosting 150 standing."
      }
    },
    {
      id: 'events',
      k: ['eventos', 'casamento', 'casamentos', 'celebração', 'celebracao', 'festa', 'batizado', 'evento', 'wedding', 'weddings', 'event', 'events', 'celebration', 'party', 'baptism', 'private event', 'venue'],
      t: {
        pt: "Ao longo de gerações, a Quinta de Santo Amaro foi o palco dos casamentos e celebrações da nossa família. Com capela, vinhas, adega, jardins e, acima de tudo, muito amor, este lugar é único e perfeito para a sua celebração. Cada evento é pensado ao detalhe para que se sinta em casa e crie memórias para a vida. Para orçamentos e datas, escreva para marta@planalto.eu.",
        en: "Over generations, Quinta de Santo Amaro has been the stage for our family's weddings and celebrations. With a chapel, vineyards, wine cellar, gardens and, above all, a great deal of love, this place is unique and perfect for your celebration. Every event is planned down to the detail so that you feel at home and create memories for a lifetime. For quotes and dates, write to marta@planalto.eu."
      }
    },
    {
      id: 'capacity',
      k: ['quantas pessoas', 'capacidade', 'lotação', 'lotacao', 'convidados', 'how many people', 'capacity', 'guests', 'how many guests', 'size', '350 people', 'seated', 'standing'],
      t: {
        pt: "Os jardins e as vinhas recebem eventos ao ar livre até 350 pessoas. Para eventos mais intimistas, a antiga adega acolhe até 70 pessoas sentadas ou 150 em pé.",
        en: "The gardens and vineyards host outdoor events for up to 350 people. For more intimate events, the old wine cellar seats up to 70 or accommodates 150 standing."
      }
    },
    {
      id: 'wines',
      k: ['vinho', 'vinhos', 'adega', 'prova', 'provas', 'espumante', 'branco', 'tinto', 'enologia', 'enólogos', 'bairrada', 'wine', 'wines', 'tasting', 'tastings', 'sparkling', 'red', 'white', 'winemakers', 'terroir', 'vineyard'],
      t: {
        pt: "Na Quinta, o vinho faz parte da nossa identidade. Em colaboração com uma equipa de enólogos, estamos a trabalhar na nossa primeira produção de vinhos branco e tinto, com lançamento em 2025. O objetivo é claro: produzir espumantes, brancos e tintos de alta qualidade que reflitam a tradição e o terroir da Bairrada. Em breve poderá participar nas nossas provas de vinho e almoços vínicos exclusivos, guiados pela nossa equipa de enólogos e acompanhados pelo icónico leitão da Bairrada, entre as vinhas.",
        en: "At the Quinta, wine is part of our identity. In collaboration with a team of winemakers, we are working on our first production of white and red wines, to be launched in 2025. The goal is clear: to produce high-quality sparkling, white and red wines that reflect the tradition and terroir of Bairrada. Soon you will be able to join our exclusive wine tastings and wine lunches, guided by our team of winemakers and accompanied by the iconic Bairrada suckling pig, among the vineyards."
      }
    },
    {
      id: 'family',
      k: ['família', 'familia', 'catarina', 'joão', 'joao', 'pedro', 'salvador', 'marta', 'flores', 'seabra', 'donos', 'quem é a família', 'family', 'owners', 'who owns', 'who runs', 'flores seabra'],
      t: {
        pt: "A Quinta de Santo Amaro é, acima de tudo, um projeto de família. Catarina Flores, João, Pedro, Salvador e Marta Flores Seabra trabalham juntos para preservar a história e a essência deste lugar único. Cada evento é pensado ao detalhe para que se sinta em casa.",
        en: "Quinta de Santo Amaro is, above all, a family project. Catarina Flores, João, Pedro, Salvador and Marta Flores Seabra work together to preserve the history and essence of this unique place. Every event is planned down to the detail so that you feel at home."
      }
    },
    {
      id: 'location',
      k: ['onde', 'localização', 'localizacao', 'chegar', 'coimbra', 'aveiro', 'tocha', 'praia', 'cantanhede', 'cadima', 'morada', 'where', 'location', 'how to get', 'directions', 'beach', 'address', 'distance'],
      t: {
        pt: "A Quinta está a apenas 30 minutos de Coimbra e de Aveiro, e a 8 km da Praia da Tocha, em Cadima, Cantanhede. Oferece fácil acesso sem perder a tranquilidade do campo. Morada: Largo de Santo Amaro 77, 3060-111 Cadima, Cantanhede, Portugal.",
        en: "The Quinta is just 30 minutes from Coimbra and Aveiro, and 8 km from Tocha Beach, in Cadima, Cantanhede. It offers easy access without losing the tranquillity of the countryside. Address: Largo de Santo Amaro 77, 3060-111 Cadima, Cantanhede, Portugal."
      }
    },
    {
      id: 'visit',
      k: ['visita', 'visitar', 'marcar', 'agendar', 'tour', 'prova presencial', 'ver a quinta', 'visit', 'booking a visit', 'schedule', 'appointment', 'come see', 'arraial'],
      t: {
        pt: "Gostaríamos muito de o receber. Para agendar uma visita, um copo de vinho ou uma conversa sobre o seu evento, escreva para marta@planalto.eu e combinamos o melhor dia. Pode também acompanhar-nos no Instagram em @quintasantoamaro.",
        en: "We would be delighted to welcome you. To arrange a visit, a glass of wine or a chat about your event, write to marta@planalto.eu and we will find the best day. You can also follow us on Instagram at @quintasantoamaro."
      }
    },
    {
      id: 'contact',
      k: ['contacto', 'contactos', 'contactar', 'email', 'telefone', 'falar', 'instagram', 'contact', 'contacts', 'reach', 'get in touch', 'email', 'phone', 'talk to someone'],
      t: {
        pt: "Para qualquer assunto, o melhor é escrever para marta@planalto.eu. Estamos na Quinta de Santo Amaro, Largo de Santo Amaro 77, 3060-111 Cadima, Cantanhede. Siga-nos no Instagram em @quintasantoamaro.",
        en: "The best way to reach us is by email at marta@planalto.eu. We are at Quinta de Santo Amaro, Largo de Santo Amaro 77, 3060-111 Cadima, Cantanhede. Follow us on Instagram at @quintasantoamaro."
      }
    }
  ];

  function lang() {
    var l = (CONFIG.client && CONFIG.client.language) || 'pt-PT';
    return (l === 'en' || /^en/i.test(l)) ? 'en' : 'pt';
  }

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
      return { text: best.t[lang()], source: 'catalog', knowledgeId: best.id, _score: bestS };
    }
    return null;
  }

  function buildQuery(text) {
    var q = String(text || '').trim()
      .replace(/^(hi|hey|hello|yo|ok|okay|so|um|uh|olá|ola|bom dia|boa tarde|boa noite)[,!. ]+/i, '')
      .replace(/\b(can you|could you|please|tell me|do you know|i want to know|whats|what's|pode|podia|por favor|diga-me|quero saber|gostaria de saber)\b/gi, ' ')
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
      if (!a || (RAG.notInContext && RAG.notInContext.test(a)) || a.length < RAG.minAnswerChars) { return null; }
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

  function fallback() {
    return lang() === 'en'
      ? "That one isn't in my notes yet. I can tell you about the estate and its history, weddings and events, capacities, our wines, or how to visit and reach us — just ask."
      : "Isso ainda não está nas minhas notas. Posso falar-lhe da Quinta e da sua história, de casamentos e eventos, das capacidades, dos nossos vinhos, ou de como visitar e contactar-nos — pergunte.";
  }

  window.OUTLOUD.knowledge = {
    retrieve: function (query) {
      var local = fromCatalog(query);
      return agentFetch(buildQuery(query)).then(function (a) {
        if (a) { return a; }
        if (local) { return { text: local.text, source: 'catalog', knowledgeId: local.knowledgeId }; }
        return { text: fallback(), source: 'fallback' };
      });
    },
    peek: fromCatalog
  };
})();
