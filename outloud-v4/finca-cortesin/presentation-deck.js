/* ============================================================
   Finca Cortesín — PRESENTATION DECK  (screen only)
   ============================================================
   A hand-authored, VALIDATED slide deck. The presentation screen
   renders THIS data only — never model-generated HTML/JS. Slide
   copy mirrors the spoken catalog so the screen and the spoken
   answer can never disagree.

   Slides advance on REAL speech bookmarks (speech.chunk.start),
   never timers.
   ============================================================ */
(function () {
  'use strict';
  window.OUTLOUD = window.OUTLOUD || {};

  window.OUTLOUD.PresentationDeck = {
    deckId: 'fincacortesin-main',
    brand: 'Finca Cortesín',
    label: 'Luxury golf, spa and beach resort',
    slides: [
      {
        id: 'what-is',
        kicker: 'Finca Cortesín',
        title: 'Andalusian soul, world class style',
        body: 'A five star resort in Casares on the Costa del Sol, opened in March 2009 across 532 acres. Whitewashed architecture, patios and gardens, about a mile from the Mediterranean.',
        ask: 'What is Finca Cortesín?'
      },
      {
        id: 'location',
        kicker: 'Where we are',
        title: 'Casares, on Spain’s Costa del Sol',
        body: 'Carretera de Casares, s/n, 29690 Casares, Málaga. Sea on one side, the Casares mountains on the other, and easy reach to Málaga, Seville and Granada.',
        ask: 'Where is Finca Cortesín?'
      },
      {
        id: 'golf',
        kicker: 'Golf',
        title: 'An 18 hole championship course',
        body: 'Designed by Cabell B. Robinson, with wide fairways, strategic bunkering and immaculate greens. Host venue of the 2023 Solheim Cup and a stop on the DP World Tour.',
        ask: 'Tell me about the golf'
      },
      {
        id: 'spa',
        kicker: 'Spa and wellness',
        title: 'More than 2,200 square metres of balance',
        body: 'Thermal baths, a saltwater pool and a snow cave, with treatments inspired by Eastern and Western traditions, plus open air yoga and curated rituals.',
        ask: 'What is the spa like?'
      },
      {
        id: 'dining',
        kicker: 'Eat and drink',
        title: 'A journey through cultures and flavours',
        body: 'El Jardín de Lutz for Mediterranean freshness, Don Giovanni for Italian elegance, REI for Japanese precision, plus the Clubhouse, Blue Bar and Pool 35.',
        ask: 'What are the restaurants?'
      },
      {
        id: 'rooms',
        kicker: 'Stay',
        title: '67 suites with an intimate feel',
        body: 'Junior, Junior View, Executive, Garden, Pool, Sea View, Cortesin and Family Suites, plus private Residences. Generous space, natural light and views over gardens, pools or the coast.',
        ask: 'What suites do you have?'
      },
      {
        id: 'contact',
        kicker: 'Next step',
        title: 'Plan your stay at Finca Cortesín',
        body: '+34 952 937 800 · reservas@hotelcortesin.com · concierge@hotelcortesin.com · Carretera de Casares, s/n, 29690 Casares, Málaga, Spain.',
        ask: 'How can I book a stay?'
      }
    ]
  };
})();
