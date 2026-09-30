/* ============================================================
   Esplora Travel — PRESENTATION DECK  (screen only)
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
    deckId: 'esplora-main',
    brand: 'Esplora Travel',
    label: 'Small group cultural & walking tours',
    slides: [
      {
        id: 'what-is',
        kicker: 'Esplora Travel',
        title: 'Small-group journeys, personally hosted',
        body: 'Founded in Cambridge in 2009, Esplora specialises in escorted journeys for small groups of guests in the most interesting corners of the Mediterranean and beyond.',
        ask: 'Where do your tours go?'
      },
      {
        id: 'destinations',
        kicker: 'Our destinations',
        title: 'Sicily, Greece, Turkey, Italy and the Caucasus',
        body: 'From the monasteries of Meteora to the wine towns of Marsala and the lakes of eastern Turkey — expert-led cultural tours and walking holidays.',
        ask: 'Where do your tours go?'
      },
      {
        id: 'experience',
        kicker: 'The experience',
        title: 'Small groups, expert local guides',
        body: 'We travel in small groups of like-minded people with expert local guides. Fully inclusive, guaranteed departures, and meticulous planning with an informal, friendly approach.',
        ask: 'How do small-group tours work?'
      },
      {
        id: 'styles',
        kicker: 'Choose your style',
        title: 'Cultural tours or walking holidays',
        body: 'Pick the travel style that suits you — cultural tours for history, art, and local life, or walking holidays to explore on foot. Both small-group and expert-led.',
        ask: 'What types of tours do you run?'
      },
      {
        id: 'hosts',
        kicker: 'Who you travel with',
        title: 'Personally hosted by people who care',
        body: 'Founding Director Damian Croft still leads trips himself, including a personal tour of his home town of Milazzo in Sicily. Guests return again and again for the personal approach.',
        ask: 'Who are the guides?'
      },
      {
        id: 'booking',
        kicker: 'Book with us',
        title: 'Easy to enquire, easy to book',
        body: 'Email trips@esplora.co.uk, call +44 (0)1223 328446, message us on WhatsApp, or book a Zoom call. New newsletter subscribers get £50 off their first tour.',
        ask: 'How do I book a tour?'
      },
      {
        id: 'contact',
        kicker: 'Next step',
        title: 'Talk to Esplora Travel',
        body: 'Email trips@esplora.co.uk · Call +44 (0)1223 328446 · WhatsApp +44 7507 208380 · Cambridge, United Kingdom. Trusted and verified by AITO.',
        ask: 'How can I contact you?'
      }
    ]
  };
})();
