# OutLoud 2.0 — Build Notes (Response Plan Runtime)

Built 2026-09-20 from the spec stored in BlueColumn (sess_q6q730f3, note-20260917-144159).
Build target: `bc-ai-site/outloud-v2/` ONLY. The live page at `bc-ai-site/outloud/` is untouched.
No deploy, no push. Vanilla JS, no build step — every module is a plain `<script>` tag in boot order.

## Architecture map (layer → file → responsibility)

Spec layer | File | Responsibility
--- | --- | --- |
Realtime input | `realtime-input.js` | getUserMedia mic capture, Web Audio RMS **VAD** (`vad.speechStart/End`), Web Speech **streaming transcription** (`transcript.partial` → `transcript.final`), **barge-in** detection (VAD onset or interim text while RESPONDING), typed input follows the same event contract
Transport envelope | `event-bus.js` | Spec's versioned envelope: `{ protocolVersion:"2.0", id, type, timestamp, sessionId, turnId?, responseId?, payload }`. In-page pub/sub today; maps 1:1 onto WebSocket frames when the server lands
Session orchestrator | `session-orchestrator.js` | State machine **IDLE → LISTENING → PROCESSING → RESPONDING → (LISTENING)**, **CANCELLED** on barge-in; event routing; one-turn pipeline; cancellation of speech + lip-sync + gesture timeline + pending content; memory-proposal application at response end
RAG (Context 1) | `business-knowledge.js` | "What does this business know?" — static catalog first (instant/offline), BlueColumn `/recall` for open questions, policy filter on "not in available context". **Never sees customer data.**
Memory (Context 2) | `customer-memory.js` | "What do we know about this customer?" — session facts with provenance, lead state as single source of truth (not UI state), audit trail on every write, transcript is session-scoped and never auto-promoted to memory, planner can only PROPOSE. TODO: server-side persistence to BlueColumn customer namespace
Reasoning (Context 3) | `response-planner.js` | "What should happen next?" — deterministic intent router (HONEST STUB for model-backed planner) producing a **Multimodal Response Plan**: `speech{text, chunks, streamHint}` + `avatar{baseline, gestures[], gaze[], expressions[]}` + `content[]` + `memory.propose[]`. Writes reach Context 2 only through its guarded APIs
Plan validation | `plan-validator.js` | Reject-or-repair per spec: unknown gesture/expression/gaze → degrade; `point_*` → `present_right` (avoidPointing); intensity clamp to `maxGestureIntensity`; overlapping body gestures → first kept, later dropped; unknown content IDs → dropped with **speech preserved**; invalid time offsets clamped; empty speech → fallback line
Rendering — speech | `speech-director.js` | Ported from `outloud/marina-agent.js` (not symlinked). ElevenLabs flash v2_5 → mp3; **chunk-streaming**: plan sentences play sequentially with one-chunk-ahead prefetch (perceived streaming now); browser-TTS fallback still walks the transcript; cancel-safe
Rendering — avatar | `avatar-director.js` | Ported + extended from `outloud/mascot-rig.js`. Sprite adapter with **three independent channels** writing disjoint CSS properties (see below). Spec gesture envelope `gesture.play({name, intensity, entryMs, holdMs, releaseMs})`; `gaze.set({target, transitionMs, holdMs, returnTarget})` (targets: user/content_panel/gallery/form/cta/map + `panel:<id>` DOM resolution); expressions; cancellable + blendable; barge-in overrides everything
Rendering — content | `content-director.js` | **Content Registry** (pricing panel, booking form) + **Action Registry** (panel events feed back into the agent cycle — a plan selection becomes session fact `interest.plan` for the next response). Mounted via SDK config `content: { host: "#outloud-content-panel", allowTakeover: true }`
Boot/chrome | `runtime.js` | Wires layers in spec order, transcript rail, mic/sound toggles, state chip, session.start/session.ready capability report, greeting as a full validated plan turn
Config | `outloud.config.js` | Baseline + constraints + endpoints. **All secrets in ONE object, marked MOVE TO EDGE PROXY**

## Three-context separation (enforced, not just documented)

- `business-knowledge.js` (Context 1) never imports/reads `customer-memory.js`; the planner receives only a serialized `memory.recall()` snapshot.
- `customer-memory.js` (Context 2) refuses writes whose `origin` is neither `user-stated` nor `interaction`; business-shaped writes throw via `assertNotBusinessKnowledge`; every write lands in an audit array.
- `response-planner.js` (Context 3) only PROPOSES memory; the orchestrator applies proposals through Context 2 at response end. Lead state lives in Context 2, never in the UI.
- Node smoke test (`_qa/smoke-plan-pipeline.js`) asserts the invented-origin rejection.

## Avatar: how lip-sync independence is actually implemented

```
#mascot-gesture   ← gesture channel transform (entry/hold/release envelope)
  #mascot-gaze    ← gaze channel transform (smooth look, cubic-bezier)
    #mascot       ← face channel: background-position (12-cell viseme rig) + filter (expression)
```

The three channels write disjoint properties, so the mouth articulates while the body moves — verified in headless Chrome (background-position changes ≥2 distinct frames during speech). The analyser graph is routed through the avatar director (one AudioContext; every TTS `<audio>` published on the bus as `speech.audio`).

## What's real vs stubbed

**Real, working now:**
- Full turn pipeline: input → transcribe → RAG retrieve → memory recall → plan → validate → parallel render (speech + avatar + content)
- ElevenLabs TTS with one-chunk-ahead prefetch streaming (verified: real audio played in headless Chrome)
- Sprite lip-sync driven by live audio analysis (ported band-mapping rig), independent of gestures/gaze
- Gesture envelope with entry/hold/release, cancellation, blending, barge-in override
- Gaze with smooth transitions, hold, return-to-user (keepEyeContact honored by validator)
- Plan validator repairs (all spec cases, unit-verified)
- Content panels shown/updated/highlighted by plans; panel interactions feed back as session memory
- Booking/lead capture flow with memory-persisted lead state and audit trail
- VAD barge-in cancellation of speech + timeline

**Honest stubs (interface defined, marked TODO in code):**
- `audio.chunk` binary mic streaming to server (envelope event emitted as marker; Web Speech is the transcriber meanwhile) — `realtime-input.js`
- True token-streaming TTS (WebSocket/edge); chunk-sequential playback is the current implementation — `speech-director.js`
- Model-backed experience planner (deterministic intent router today; plan shape is final) — `response-planner.js`
- Server-side validation of booking/business actions; booking form carries `data-stub` — `content-director.js`
- Long-lived customer memory persistence to BlueColumn (localStorage is the client mirror) — `customer-memory.js`
- Edge proxy for secrets — `outloud.config.js`

**Approximations (by design, sprite rig has no arm/eye layers):**
- `point_*` gestures degrade to `present_*` (validator) rendered as directional lean + prismatic glow
- Expressions are CSS filter/frame approximations, not dedicated sprites
- Gaze is whole-head transform toward the target's real DOM side, not eyeball isolation

## Secrets

Everything lives in `SECRETS` at the top of `outloud.config.js`, flagged `MOVE TO EDGE PROXY`. Later fix = delete one block + point `CONFIG.endpoints` at same-origin proxy routes. (Note: live 1.0 page still scatters keys across files; that's pre-existing and out of scope.)

## How to run

Open `bc-ai-site/outloud-v2/index.html` in a browser (Chrome/Edge/Safari). Needs network for BlueColumn RAG + ElevenLabs; degrades gracefully offline (catalog answers + browser-voice fallback). Voice input needs Chrome/Edge/Safari 14.5+; typing works everywhere.

## Verification

- `node --check` all 12 JS files — clean
- `_qa/smoke-plan-pipeline.js` — 27/27 (intent routing, validator repairs incl. point→present, overlap drop, content-id drop, intensity clamp, offset clamp, speech-preserved rule, lead flow, three-context rejection, envelope shape)
- `_qa/browser-smoke.mjs` (headless Chrome, 14/14) — boot, greeting turn, pricing turn → transcript + panel + gaze move, panel interaction → session memory, booking form → lead captured, no unexpected page errors
- `_qa/mic-lipsync-smoke.mjs` (fake mic device) — audio.start, vad.ready, vad.speechStart, lip-sync frames changing during speech
- Manual smoke checklist (for Joe, in a real browser):
  1. Land → greeting spoken, mascot's mouth moves, greeting line on transcript
  2. Ask "how much does it cost?" → spoken answer + pricing panel slides in + mascot glances at it and presents, then looks back at you
  3. Tap "AlwaysOn Essential" row → next reply references your interest
  4. Say/typed "book a demo" → booking panel opens, mascot gestures center; fill form → captured, reply confirms; ask again → confirmation, not a re-interview
  5. While OutLoud is speaking, start talking (or type) → it stops mid-sentence (barge-in), state returns to LISTENING
  6. Toggle Sound off → replies still walk the transcript silently, mouth keeps timing
  7. DevTools console: no errors; repairs (if any) logged as `plan repairs:` info lines
