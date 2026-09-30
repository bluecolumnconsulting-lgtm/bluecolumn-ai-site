/* ============================================================
   Quinta de Santo Amaro — PRESENTATION DECK  (screen only)
   ============================================================
   A hand-authored, VALIDATED slide deck. The presentation screen
   renders THIS data only — never model-generated HTML/JS. Slide
   copy mirrors the spoken catalog so the screen and the spoken
   answer can never disagree.

   Bilingual: every field is { pt, en }. localized(lang) resolves a
   plain-string deck for the active language; the screen rebuilds its
   cards when the page language changes.

   Slides advance on REAL speech bookmarks (speech.chunk.start),
   never timers.
   ============================================================ */
(function () {
  'use strict';
  window.OUTLOUD = window.OUTLOUD || {};

  var DECK = {
    deckId: 'quinta-main',
    brand: 'Quinta de Santo Amaro',
    label: 'Casamentos · Eventos · Vinhos',
    slides: [
      {
        id: 'what-is',
        kicker: { pt: 'Quinta de Santo Amaro', en: 'Quinta de Santo Amaro' },
        title: { pt: 'Uma casa com história desde 1544', en: 'A house with history since 1544' },
        body: {
          pt: 'Uma casa com história no coração da Bairrada, fundada no século XVI pela Ordem Franciscana. A nossa família está aqui desde 1879, ao longo de sete gerações.',
          en: 'A historic estate in the heart of Bairrada, founded in the 16th century by the Franciscan Order. Our family has been here since 1879, across seven generations.'
        },
        ask: { pt: 'Qual é a história da Quinta?', en: 'What is the history of the estate?' }
      },
      {
        id: 'estate',
        kicker: { pt: 'O espaço', en: 'The estate' },
        title: { pt: 'Jardins, vinhas e uma capela do século XVI', en: 'Gardens, vineyards and a 16th-century chapel' },
        body: {
          pt: 'Capela do século XVI, jardins com árvores centenárias, piscina, campo de padel, cavalariças e uma antiga adega. Os jardins recebem eventos ao ar livre até 350 pessoas.',
          en: 'A 16th-century chapel, gardens with century-old trees, a pool, padel court, stables and an old wine cellar. The gardens host outdoor events for up to 350 people.'
        },
        ask: { pt: 'O que tem a Quinta?', en: 'What does the estate offer?' }
      },
      {
        id: 'cellar',
        kicker: { pt: 'A antiga adega', en: 'The old cellar' },
        title: { pt: 'Um espaço único para eventos intimistas', en: 'A unique space for intimate events' },
        body: {
          pt: 'A antiga adega tem bar, lareira e projeção de vídeo — perfeita para eventos intimistas, acolhendo até 70 pessoas sentadas ou 150 em pé.',
          en: 'The old cellar has a bar, a fireplace and video projection — perfect for intimate events, seating up to 70 or hosting 150 standing.'
        },
        ask: { pt: 'Fale-me da antiga adega.', en: 'Tell me about the old cellar.' }
      },
      {
        id: 'events',
        kicker: { pt: 'Eventos', en: 'Events' },
        title: { pt: 'Casamentos e celebrações de família', en: 'Weddings and family celebrations' },
        body: {
          pt: 'Ao longo de gerações, a Quinta foi o palco dos casamentos e celebrações da nossa família. Cada evento é pensado ao detalhe para que se sinta em casa.',
          en: 'Over generations, the Quinta has been the stage for our family\u2019s weddings and celebrations. Every event is planned down to the detail so you feel at home.'
        },
        ask: { pt: 'Quero organizar um evento.', en: 'I want to plan an event.' }
      },
      {
        id: 'wines',
        kicker: { pt: 'Vinhos', en: 'Wines' },
        title: { pt: 'Sabores da Bairrada', en: 'Flavors of Bairrada' },
        body: {
          pt: 'Em colaboração com enólogos, trabalhamos na nossa primeira produção de vinhos branco e tinto, com lançamento em 2025. Em breve, provas e almoços vínicos entre as vinhas.',
          en: 'With a team of winemakers we are working on our first white and red wines, launching in 2025. Soon, tastings and wine lunches among the vineyards.'
        },
        ask: { pt: 'Fale-me dos vinhos.', en: 'Tell me about the wines.' }
      },
      {
        id: 'location',
        kicker: { pt: 'Localização', en: 'Location' },
        title: { pt: 'A 30 minutos de Coimbra e Aveiro', en: '30 minutes from Coimbra and Aveiro' },
        body: {
          pt: 'Cadima, Cantanhede — a 30 minutos de Coimbra e Aveiro e a 8 km da Praia da Tocha. Fácil acesso, sem perder a tranquilidade do campo.',
          en: 'Cadima, Cantanhede \u2014 30 minutes from Coimbra and Aveiro and 8 km from Tocha Beach. Easy access, without losing the tranquillity of the countryside.'
        },
        ask: { pt: 'Onde fica a Quinta?', en: 'Where is the estate?' }
      },
      {
        id: 'contact',
        kicker: { pt: 'Próximo passo', en: 'Next step' },
        title: { pt: 'Fale com a Quinta de Santo Amaro', en: 'Talk to Quinta de Santo Amaro' },
        body: {
          pt: 'marta@planalto.eu · Largo de Santo Amaro 77, 3060-111 Cadima, Cantanhede · Instagram @quintasantoamaro.',
          en: 'marta@planalto.eu · Largo de Santo Amaro 77, 3060-111 Cadima, Cantanhede · Instagram @quintasantoamaro.'
        },
        ask: { pt: 'Como faço uma visita?', en: 'How can I visit?' }
      }
    ]
  };

  DECK.localized = function (lang) {
    if (lang !== 'en') { lang = 'pt'; }
    return DECK.slides.map(function (s) {
      function pick(v) { return (v && typeof v === 'object') ? (v[lang] != null ? v[lang] : v.pt) : v; }
      return {
        id: s.id,
        kicker: pick(s.kicker),
        title: pick(s.title),
        body: pick(s.body),
        ask: pick(s.ask)
      };
    });
  };

  /* Plain-string view for the active language (consumed by the screen). */
  DECK.slidesFor = function (lang) { return DECK.localized(lang); };

  window.OUTLOUD.PresentationDeck = DECK;
})();
