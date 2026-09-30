/* ============================================================
   Knight Transportation — PRESENTATION DECK  (screen only)
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
    deckId: 'knight-main',
    brand: 'Knight Transportation',
    label: 'Delivering More',
    slides: [
      {
        id: 'what-is',
        kicker: 'Knight Transportation',
        title: 'Delivering More',
        body: 'Founded in 1990 in Phoenix, Arizona by the four Knight cousins. In 2017 we merged with Swift to form Knight-Swift Transportation Holdings — North America\u2019s largest full truckload company.',
        ask: 'What do you do?'
      },
      {
        id: 'services',
        kicker: 'Our services',
        title: 'Truckload and logistics, end to end',
        body: 'Dry Van, Refrigerated, Port Services, Dedicated, Logistics, and Expedited — plus Flatbed, Teams, Owner Operators, and warehousing through the Knight-Swift network.',
        ask: 'What services do you offer?'
      },
      {
        id: 'network',
        kicker: 'National network',
        title: 'Terminals, shops, and academies nationwide',
        body: 'Driving associates and customers are supported locally across the United States — from Phoenix to Atlanta, Carlisle, Dallas, and beyond.',
        ask: 'How many locations do you have?'
      },
      {
        id: 'equipment',
        kicker: 'Equipment & technology',
        title: 'Best-in-class trucks, built for drivers',
        body: 'Our fleet includes Volvo, International, Kenworth, Freightliner, and Peterbilt tractors equipped with cutting-edge safety and efficiency technology.',
        ask: 'What trucks do you run?'
      },
      {
        id: 'careers',
        kicker: 'Drive for Knight',
        title: 'More miles. More pay. More respect.',
        body: 'OTR, regional, dedicated, team, flatbed, and owner operator opportunities — plus our own CDL training, from permit to OTR. Drive for Knight: 1-888-457-0974.',
        ask: 'How do I become a driver?'
      },
      {
        id: 'military',
        kicker: 'Military & safety',
        title: 'Veterans welcome, safety honored',
        body: 'Dedicated military transition programs for service members and veterans, and a Million Mile Driver program recognizing our safest professionals.',
        ask: 'Do you hire veterans?'
      },
      {
        id: 'contact',
        kicker: 'Next step',
        title: 'Talk to Knight Transportation',
        body: 'General: 800-489-2000 or contact@knighttrans.com. Drivers: 1-888-457-0974. HQ: 5601 West Buckeye Road, Phoenix, Arizona 85043.',
        ask: 'How can I contact you?'
      }
    ]
  };
})();
