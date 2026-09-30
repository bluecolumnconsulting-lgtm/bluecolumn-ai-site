/* ============================================================
   Scuba Junkie — PRESENTATION DECK  (screen only)
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
    deckId: 'scubajunkie-main',
    brand: 'Scuba Junkie',
    label: 'Dive Sipadan from Mabul Island',
    slides: [
      {
        id: 'what-is',
        kicker: 'Scuba Junkie',
        title: 'Dive Sipadan from our eco resort on Mabul',
        body: 'Established in 2004, Scuba Junkie is a dive resort and operator on Mabul Island, Sabah, a short boat ride from world-famous Sipadan. We are a PADI 5 star IDC centre and a leading sustainable dive company in Asia.',
        ask: 'Who are you and where are you based?'
      },
      {
        id: 'locations',
        kicker: 'Where we dive',
        title: 'Sipadan, Mabul, Kapalai and Si Amil',
        body: 'From Mabul Beach Resort we dive and snorkel the islands of the Celebes Sea. Sipadan is the only volcanic island in Malaysia, plunging over 2,000 metres to the sea floor in the heart of the Indo-Pacific basin.',
        ask: 'Where do you dive?'
      },
      {
        id: 'sipadan',
        kicker: 'Sipadan',
        title: 'One of the top dive sites in the world',
        body: 'More than 3,000 species of fish, green and hawksbill turtles, reef and hammerhead sharks, eagle and devil rays, the famous barracuda tornado and huge bumphead parrotfish. Sipadan is limited to 176 divers a day, and your permit is guaranteed with our packages.',
        ask: 'Why is Sipadan so special?'
      },
      {
        id: 'packages',
        kicker: 'Dive packages',
        title: 'All-inclusive Sipadan and Si Amil packages',
        body: 'Packages from 3 days and 2 nights include resort accommodation, diving around Mabul, Kapalai, Si Amil and Sipadan, boat transfers, and meals, tea, coffee and water. Rates are valid until 31 December 2026, and we can tailor packages to your schedule.',
        ask: 'What Sipadan packages do you offer?'
      },
      {
        id: 'courses',
        kicker: 'Learn to dive',
        title: 'All PADI courses, from try-dive to instructor',
        body: 'As an award-winning PADI 5 star IDC centre we teach every level: Discover Scuba Diving from RM420, Open Water Diver from RM1,630, Advanced Open Water from RM1,360, Rescue Diver from RM1,465, Divemaster from RM4,250 and Instructor from RM7,950 in cool, clear water.',
        ask: 'What PADI courses can I take?'
      },
      {
        id: 'resort',
        kicker: 'Where you stay',
        title: 'Rooms for every budget on the beachfront',
        body: 'Mabul Beach Resort has 30 en suite rooms, from VIP and Deluxe AC rooms to fan rooms and dorms. Rates include full board meals and are per person per night, with solar water heating and a house reef for a swim before breakfast.',
        ask: 'What rooms and accommodation do you have?'
      },
      {
        id: 'conservation',
        kicker: 'Give back',
        title: 'Conservation at the core of everything',
        body: 'Our NGO, Scuba Junkie S.E.A.S., runs turtle, shark, coral and cetacean programmes. The Mabul Turtle Hatchery has released over 17,000 hatchlings. For 2026, a voluntary RM50 guest donation to SEAS is matched by Scuba Junkie.',
        ask: 'What conservation work do you do?'
      },
      {
        id: 'booking',
        kicker: 'Next step',
        title: 'Book your dive holiday with Scuba Junkie',
        body: 'Book or check availability through the website form, or message us on WhatsApp at +60 19-640 0116. Our office is at Block B, Lot 36, Semporna, Sabah, Malaysia. The booking team replies within 24 hours.',
        ask: 'How do I book and get there?'
      }
    ]
  };
})();
