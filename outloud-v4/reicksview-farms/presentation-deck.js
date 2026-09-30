/* ============================================================
   Reicks View Farms — PRESENTATION DECK  (screen only)
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
    deckId: 'reicksview-main',
    brand: 'Reicks View Farms',
    label: 'Families Feeding Families',
    slides: [
      {
        id: 'what-is',
        kicker: 'Reicks View Farms',
        title: 'Families Feeding Families',
        body: 'Founded in 1979 by Dale and Laura Reicks near Jerico, Iowa — 5th-generation pork producers who started with 240 acres of corn and 200 sows. Still family-run, now with 300+ employees.',
        ask: 'What do you do?'
      },
      {
        id: 'scale',
        kicker: 'Our operation',
        title: 'About 1.5 million market hogs a year',
        body: 'More than 100 finishing barns across Northeast Iowa and 130+ production partners. Around 70% of our hogs go to the Tyson plant in Waterloo.',
        ask: 'How many pigs do you raise?'
      },
      {
        id: 'farming',
        kicker: 'Grain & feed',
        title: '10,000+ acres, our own feed mill',
        body: 'Row crops on over 10,000 acres across Northeast Iowa and Southern Minnesota. Our feed mill blends every batch, and hog nutrients fertilize about half our acres.',
        ask: 'Tell me about your farming.'
      },
      {
        id: 'sustainability',
        kicker: 'Sustainability',
        title: 'Odor cut at least 80%',
        body: 'With Iowa State University we tested odor reduction in finishing barns — down 80% or more up to 1,000 feet out. Cover crops, precision injection, and a six-bay truck wash protect soil, water, and biosecurity.',
        ask: 'What about sustainability?'
      },
      {
        id: 'careers',
        kicker: 'Careers',
        title: 'Now hiring across Iowa',
        body: 'Market Hog Drivers ($25.75/hr, Class A CDL), Feed Truck Drivers, Mill Operators, Swine Production Technicians ($18.66/hr), IT Support, and Agronomy & Technology. Health, dental, 401k match, and PTO.',
        ask: 'How do I apply for a job?'
      },
      {
        id: 'community',
        kicker: 'Giving back',
        title: 'Hams, veterans, and ag education',
        body: '650+ hams donated to local food banks last Christmas. The Flag Day Fundraiser for veterans raised $75,000 in a single year. And the 22,900 sq-ft Ag Education Center keeps 4-H and FFA open to every kid.',
        ask: 'How do you give back?'
      },
      {
        id: 'contact',
        kicker: 'Next step',
        title: 'Talk to Reicks View Farms',
        body: 'Call 641-364-7843, email rvfinfo@reicksview.com, or write to 1020 Pembroke Avenue, PO Box 150, Lawler, Iowa 52154.',
        ask: 'How can I contact you?'
      }
    ]
  };
})();
