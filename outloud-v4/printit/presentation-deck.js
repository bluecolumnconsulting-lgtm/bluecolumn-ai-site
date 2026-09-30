/* ============================================================
   OutLoud v3 — PRESENTATION DECK  (Job c3973498 — screen only)
   ============================================================
   A hand-authored, VALIDATED slide deck. The presentation screen
   renders THIS data only — never model-generated HTML/JS. Slide
   copy mirrors the canonical business-knowledge catalog so the
   screen and the spoken answer can never disagree.

   Spec mapping (client-side equivalent of the server spec):
     • deckId / slide ids      → deck_id / slide_id
     • slide "walk"            → the avatar's speech-bookmark cue
                                 list (slide advances on real speech
                                 chunks, never timers).
   ============================================================ */
(function () {
  'use strict';
  window.OUTLOUD = window.OUTLOUD || {};

  window.OUTLOUD.PresentationDeck = {
    deckId: 'outloud-v3-main',
    brand: 'bluecolumn',
    label: 'OutLoud',
    slides: [
      {
        id: 'what-is',
        kicker: 'OutLoud by BlueColumn',
        title: 'A website you can talk to',
        body: 'Answers questions out loud, quotes work, and books appointments 24/7 — on every page, for every visitor. This very page is the product.',
        ask: 'What is OutLoud?'
      },
      {
        id: 'pricing',
        kicker: 'Plans',
        title: 'From $19 / month',
        body: 'Personal $19. Starter $49 — animated avatar, lead capture, booking. Pro $149 — video avatar + 200 video minutes. Team $349 — 5 seats, 600 pooled minutes, lead routing. White-glove onboarding +$500 one-time.',
        ask: 'What does it cost?'
      },
      {
        id: 'how-it-works',
        kicker: 'Under the hood',
        title: 'Brain, voice, face',
        body: 'A live BlueColumn brain answers from your own knowledge, an ElevenLabs voice speaks it, and the face moves in sync. Mic in — voice out.',
        ask: 'How does it work?'
      },
      {
        id: 'voice-avatar',
        kicker: 'The presenter',
        title: 'A real voice and a live face',
        body: 'Animated characters on every plan, real-time video talking heads on Pro, or a custom face. The one talking to you right now is custom.',
        ask: 'How do the avatars work?'
      },
      {
        id: 'live-sites',
        kicker: 'Proof',
        title: 'Live on six client pages',
        body: 'Star Jet Ski, Vulcan Fence, HomeSpark, OttoMedic, Adventure Club, Venture Club. Arcadia Fence & Gate: booked jobs up 40% in month one.',
        ask: 'Who uses it?'
      },
      {
        id: 'timeline',
        kicker: 'Getting started',
        title: 'Live in about 30 days',
        body: 'We build it, run it, and manage it. You show up to the booked jobs.',
        ask: 'How long does setup take?'
      },
      {
        id: 'booking',
        kicker: 'Next step',
        title: 'Book a walkthrough',
        body: 'Leave your name, business, and best number — a BlueColumn strategist schedules the walkthrough. Or email hello@bluecolumn.ai.',
        ask: 'Book a demo'
      }
    ]
  };
})();
