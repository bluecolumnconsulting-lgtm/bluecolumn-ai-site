# OutLoud v2: Rethink Brief

Prepared 2026-09-20. The live page at `bc-ai-site/outloud/` is untouched and stays as-is. Everything here is a fresh concept, not a reskin.

---

## 1. What OutLoud is, in one sentence

**OutLoud is a business website that answers your customers out loud: it quotes the work and books the appointment, at 2 PM or 2 AM.**

A stranger gets it in five seconds because the sentence contains the buyer (business owner), the mechanism (the website speaks and transacts), and the payoff (booked jobs with nobody at the desk).

---

## 2. Why the current page fails

Honest audit of `bc-ai-site/outloud/`:

1. **The mascot demonstrates nothing.** Buddy is a sprite rig that wiggles while an audio file plays. It shows that we can animate a cartoon's mouth. It does not show the product, which is a *conversation that ends in a booking*. The lip-sync is the demo, and the demo is decoration.
2. **The page performs the product instead of showing it.** "This page is OutLoud" is a great line, but the actual proof is hidden behind a tap-gate, an autoplay-policy fight, and a sound-on assumption. Most visitors land on phones, often muted. They never hear the greeting, so the core claim ("this page is the product") is never cashed.
3. **It's a SaaS template wearing a mascot.** Stats strip, 4 leak cards, versus columns, 4 industry cards, 2 pricing cards, FAQ accordion, footer. That is the exact hero+cards+testimonial rhythm the constitution bans, and the Inter/Space Grotesk/blue palette reads as generated.
4. **The gadget aesthetic works against the buyer.** The target customer is a fence contractor or a clinic office manager, not a developer. A dark "screen" panel with a transcript mirror, chip buttons, and a status spinner reads as a chatbot toy. It raises the exact objection ("another chatbot") the page needs to kill.
5. **One chance to be heard.** The entire conversion argument depends on audio. If the visitor's first experience is silent, the page has a point of view it never states.

What's worth keeping: the "page is the product" instinct, the concrete numbers ($497/$97, 30 days, +40% Arcadia Fence), the versus-conversation copy, and the lead-capture flow. The problem was never the copy. It's that the page tells before it shows, and requires sound to show at all.

---

## 3. Three concept directions

These are structural ideas for how a voice-first page presents itself, not color variants.

### Concept A: The After-Hours Call Log

The page is a dispatch ledger. A night's worth of answered questions, timestamped, in rows: 11:52 PM, asked about haul-away, answered. 2:14 AM, quoted 180 feet of cedar, emailed. 4:03 AM, confirmed service area. The visitor scrolls one ordinary night at a business they're compared against.

- **First 10 seconds:** A ruled ledger with last night's timestamps and one-line outcomes. No pitch yet. The pitch is implied: all of this happened while the owner slept.
- **What it proves:** Availability. 24/7 stops being a badge and becomes a record.
- **Risk:** A log of one-line answers proves responsiveness but not *conversation*. Bookings need multi-turn dialogue, and a ledger flattens that.

### Concept B: The Recorded Call (recommended)

The page is a single phone call, presented as a transcript you read top to bottom. Timestamped lines, two speakers, a play button on each line. You land mid-call and finish it 51 seconds later with a booked appointment and a sent confirmation. The page's only job is to hand you one complete conversation and let you judge it.

- **First 10 seconds:** A timestamp, "WED 10:47 PM," and a customer asking a real question in real words. You are reading before you have decided whether to listen, so sound-on is optional, not required.
- **What it proves:** The product is the conversation, and the conversation ends in a booking. It works silent, which is where most traffic actually is.
- **Why it fits OutLoud specifically:** Voice is the medium, but *reading* a call is how people evaluate calls (every sales team reviews call recordings). The page borrows an existing, trusted behavior instead of inventing one.

### Concept C: The Front Desk

The page has no marketing scroll at all. One screen, styled as a front-desk window: a live mic and a wired agent you can actually talk to, with the transcript building beneath. All product facts live behind the conversation; the agent is the page.

- **First 10 seconds:** A counter, a mic prompt, silence waiting for your voice.
- **What it proves:** Liveness. Nothing is canned.
- **Risk:** This is the current page's bet, restaged. It depends entirely on the visitor choosing to talk, on mic permissions, and on the voice stack being up. As a product page it converts worst of the three; as a demo hub it's fine. It was paused for a reason.

---

## 4. Recommendation: Concept B

- It shows the product with zero required interaction. Scroll = demo.
- It works with sound off and upgrades with sound on (browser-speech stand-in per line, no keys, no autoplay fight).
- It's the only direction whose proof structure matches the sale: the owner is being asked to trust an unattended conversation, so the page gives them one to review.
- Concept A is a strong *section* inside B (kept as "The overnight log"), and C can be added later as a single "Talk to it now" module once the voice stack is production-ready.

---

## 5. Visual direction: "Frosted Glass"

**Update, 2026-09-20:** the approved style anchor image (`style-anchor.png` in this folder) replaced the original editorial direction below. The visual language is now soft-3D frosted glass — translucent layered panels with `backdrop-filter` blur, white-alpha borders and inner highlights — over a white-to-blue vertical gradient that deepens through the scroll, in the manner of a premium Apple product render. The single accent slot (formerly signal red) is now one restrained iridescent/prismatic gradient, used only on the live/play semantics and the top rim of the call and CTA panels; its small-text form is deepened to hold contrast. Depth comes from large diffused shadows and 14–20px radii; hard rules and the Newsreader serif are gone, replaced by spacing, translucent layer edges, and Manrope (Spline Sans Mono kept for timestamps and data). Concept, copy, structure, and interaction model are unchanged — this restyle is skin only.

- **Typography:** Newsreader (variable optical serif; roman for the OutLoud voice, italic for the customer) + Spline Sans Mono (timestamps, speaker labels, section numbers, data). Two families. Display is the transcript itself; there is no separate hero type style to fight it.
- **Palette:** paper `#FAF9F6`, ink `#191611`, hairline `#DDD8CE`, muted `#6F695E`, and one accent: signal red `#C2321F`, used only for live/play semantics. No gradients anywhere. Field color does the work.
- **Layout system:** one reading column (~640px) with a left timestamp/speaker rail on desktop, collapsing to inline labels on mobile. Hard horizontal rules between sections. No cards anywhere; pricing is a ruled table, specs are a numbered list, client links are a ruled index. Section widths vary (full-bleed rules vs. narrow reading column) so the vertical rhythm isn't uniform.
- **Motion:** one idea only. When a line plays, its duration chip becomes a small animated level meter. Everything else is 150-200ms color transitions. `prefers-reduced-motion` freezes the meter.
- **Constitution checks:** no hero+3-cards, no gradient mesh, no emoji, no icon soup, no glassmorphism, no pill buttons, radius 2px, left-aligned reading measure 55-65ch, mono used structurally not decoratively, no invented stats (reuses only claims already on the live page, with the same framing).

**Design fingerprint (new, none of 001-003 reused):** direction "Night Shift Transcript"; fonts Newsreader + Spline Sans Mono; colors #FAF9F6 / #191611 / #C2321F; hero = timestamped transcript opener, text-only, asymmetric rail; grid = single reading column + rail; nav = minimal top rule; CTA = rectangular ink button; interaction = per-line speech playback + level meter; avatar presentation = none (voice is the presentation).

---

## 6. Prototype

`bc-ai-site/outloud-v2/index.html` + `styles.css` + `app.js`. Vanilla, single page, mobile-first, no build step, two font files from Google Fonts, inline SVG only.

- Per-line play buttons use the browser's `speechSynthesis` as an honest stand-in, labeled as such on the page. This makes the page genuinely voice-first in any browser with zero credentials.
- Sound master toggle, cancellation handling, and a graceful message where no speech engine exists.
- Lead-capture and calendar calls are stubbed with visible `data-stub` markers. No BlueColumn wiring in this prototype.
