# BlueColumn Landing Page Copy Upgrade — 2026-09-20

Scope: bluecolumn.ai landing page only. Structure and visual design unchanged. All edits are local; nothing pushed or deployed.

Ground truth sources: SOUL.md (API surface, pricing, "What to Never Say"), this month's MCP capability additions (audio_ingest/audio_recall, sound_analyze, streaming_audio_ingest/streaming_audio_recall, music_remember/music_recall/music_analyze, call_prepare/call_complete), distribution facts (bluecolumn-mcp v1.4.0 on npm, official MCP registry listing, 5 ClawHub skills), research/competitor_landscape_2026-05-03.md (audio-first is the moat, plain-English recall is the UX).

Voice rules applied throughout: plain technical voice, no em-dashes, no rule-of-three rhetorical lists, no exclamation points, no "revolutionary/groundbreaking", concrete claims, no SOC-2/HIPAA claims, no on-prem or EU residency claims (roadmap only), SSE never called WebSocket.

---

## 1. Hero

**Eyebrow:** "Now in public beta" — unchanged. Claiming GA is a bigger claim than the evidence in front of us; beta is safe and honest.

**Headline**
- Current: `Memory and recall` / `for {rotating: voice agents, phone agents, support lines, IVR flows, live callers}`
- Proposed: `Audio-first memory` / `for {rotating: AI agents, voice agents, phone agents, co-pilots, assistants}`
- Rationale: audio-first is the moat and no competitor has it. The rotating words currently commit the whole page to phone use cases; broadening them to AI agents and co-pilots matches what the product actually serves today, and the layout is untouched (same component, same min-width).

**Subhead**
- Current: "BlueColumn gives your voice agent a real memory. Every call, every caller, every detail — recalled in milliseconds, the moment your agent needs it on the line."
- Proposed: "BlueColumn turns calls, voice notes, meetings, and documents into structured memory your agent queries in plain English. Streaming recall puts the first token on the wire in milliseconds, with citations attached."
- Rationale: leads with the two differentiators (audio-first ingestion, plain-English recall), names streaming and citations concretely, drops the em-dash construction and the voice-agent-only framing.

**Hero code card:** unchanged. The remember/recall snippet is accurate and is the strongest proof on the page.

## 2. Logo strip ("Trusted by voice teams at")

- Current label: "Trusted by voice teams at" with names: Vector, Cohere Labs, Bracket, Otter Engine, Northwind, Lemma, Field.
- Proposed label: "Ships where your stack already lives" with names: npm, MCP Registry, ClawHub, Claude Desktop, Cursor, n8n, LangChain.
- Rationale: the current names are invented. We have no announced customers we can name. We do have real distribution: bluecolumn-mcp on npm at v1.4.0, an official MCP registry listing, 5 ClawHub skills, and native MCP support in Claude Desktop, Cursor, n8n, and LangChain. Same visual strip, truthful content. This also quietly does the "MCP-native" selling before the capabilities section.

## 3. The problem

- Current h2: "Your voice agent meets every caller for the first time."
- Proposed h2: "Your agent meets every user for the first time."
- Current sub: "Callers repeat themselves. Account numbers, preferences, the issue from last week — gone the second the call ends. BlueColumn keeps it all, and hands it back the next time the phone rings."
- Proposed sub: "Preferences, decisions, action items, prior context. Gone the second the session ends. BlueColumn keeps all of it and hands it back in plain English, with citations to the source."
- Rationale: same pain, widened from callers to any agent user. Citations are a real recall feature and belong in the problem statement, not just the feature list.

## 4. How it works

- Current h2: "Three calls. One memory layer for every conversation."
- Proposed h2: "Two calls. One memory layer for every conversation."
- Rationale: the core loop is /remember and /recall. Two is the real number; precision reads as competence with this audience.

Card 1:
- Current: "Capture every call" / "Stream audio or post a transcript. We store the conversation, the caller, and the context — ready for the next call before it starts."
- Proposed: "Capture anything" / "Post a transcript, upload an audio file, or send plain text to /remember. It chunks, embeds, and indexes the content, extracting entities and action items along the way."
- Rationale: /remember genuinely takes text, audio, and documents and returns entities and action_items. Name the endpoint.

Card 2:
- Current: "Recall on the line" / "Sub-100ms retrieval, fast enough to use mid-sentence. Pull the right detail at the right moment without breaking the flow of the call."
- Proposed: "Recall in plain English" / "Ask a question the way a person would. /recall synthesizes an answer with cited sources and relevance scores, streaming over SSE so the first token lands in milliseconds."
- Rationale: plain-English recall with citations is the UX differentiator; SSE is the correct protocol term.

Card 3:
- Current: "One caller, one memory" / "Isolated memory per caller, per workspace. No cross-leaks, no mixed-up histories. Delete on request, audit on demand."
- Proposed: "Isolated by namespace" / "Memory is scoped per namespace and enforced at runtime. Cross-tenant access returns 403. Hard delete is a single API call."
- Rationale: the 403 claim and the delete endpoint are both true today; concrete beats vague.

## 5. Code showcase

- Current h2: "One line of code per call."
- Proposed h2: "Two endpoints. One memory layer."
- Rationale: the snippet shows both endpoints; the old headline oversold simplicity. Tabs and code unchanged.

## 6. Performance metrics

- Current: `<100ms p95 recall latency` / `99.9% Uptime SLA` / `2-index Hot + cold memory` / `SOC 2 Type II ready`
- Proposed: `<100ms p95 recall latency` / `24h Idempotent retry window` / `Hybrid Vector + full-text search` / `8 BYO database providers`
- Rationale: the SOC 2 tile must go (explicitly forbidden claim, and "Type II ready" is not a compliance status we hold). "99.9% Uptime SLA" is not backed by anything in our docs, so it goes too. The replacements are all verifiable today: 24-hour idempotency cache, hybrid vector + Postgres FTS search, 8 supported BYO providers.

## 7. Use cases (6 cards, structure kept)

Current cards are all call-center variants. Proposed set covers the actual surface:

1. **Voice agents & support lines** — "call_prepare briefs the agent before the call with customer history and suggested openings. call_complete files sentiment and open follow-ups after. Callers never repeat themselves."
2. **Meetings & voice notes** — "Upload the recording or forward the memo. Decisions, owners, and action items become searchable memory, with citations back to the clip and timestamp."
3. **Personal assistants** — "Preferences and history persist across sessions and are recalled in plain English. One namespace per user keeps every memory isolated."
4. **Edge devices** — "Dashcams, doorbells, wearables, and any device that streams audio. streaming_audio_ingest builds per-device memory while audio streams in, and streaming_audio_recall queries it live."
5. **Research & podcasts** — "Ingest hours of audio and query it later. Speaker, sentiment, entities, and topics are metadata filters on /recall, not separate passes."
6. **Music production** — "music_remember tags takes by instrument, key, tempo, and technique. Describe the take you want in words and get the file back."

Rationale: this is the month's capability set translated into buyer language. Edge devices and music have no current card at all; call memory was buried in the audio section.

## 8. Capabilities ("Everything your agent loop needs, in one API.")

Headline kept. Section sub:
- Current: "Streaming recall, multimodal ingestion, structured filters, idempotent writes, native MCP. Production primitives — not a demo."
- Proposed: "Streaming recall, multimodal ingestion, structured filters, idempotent writes, and a native MCP server. Production primitives, not a demo."

Card 1 (Real-time / SSE): removed em-dashes around the event-type list; now reads "Server-sent events on /recall. It streams vectors, synthesis_delta, and done events, so partial output reaches users the moment the model produces it. First token in milliseconds, not seconds. No SDK required." Facts unchanged.

Card 2 (Inputs): "Groq Whisper — flag" became "Groq Whisper. Flag". Everything else accurate, kept.

Card 3 (Beyond transcription): "Six new filter dimensions" became "Six filter dimensions" (no longer new). Em-dash removed; rest kept.

Card 4 (Precision): em-dash removed, "inside Pinecone: no post-hoc passes, no wasted reads" became "inside Pinecone, so there are no post-hoc passes and no wasted reads". Facts unchanged.

Card 5 (Idempotency): "— no double-ingestion, no double-charge, no duplicate vectors." became "No double-ingestion and no double charge." Em-dash and triad removed.

Card 6 (MCP):
- Current: eyebrow "Native integrations", h3 "Talk to your memory from Claude Desktop.", body "One config block... — no glue code, no proxy, no agent framework."
- Proposed: eyebrow "MCP-native", h3 "Two-command install, any MCP client.", body "BlueColumn ships as a Model Context Protocol server. Install bluecolumn-mcp from npm, add two lines to your client config, and the model can call remember, recall, and note directly. Works in Claude Desktop, Cursor, and any MCP-aware client. Published on npm at v1.4.0 and listed in the official MCP registry."
- Rationale: cites the real package, the real version, and the real registry listing. Cursor is explicitly supported.

## 9. Audio intelligence layer ("Every memory backed by audio evidence.")

Section sub: em-dash removed; "Voice call continuity, sound-event indexing, and music metadata, all on top of the same persistent memory API. Upload any audio. BlueColumn remembers what matters."

Four existing cards re-eyebrowed from "NEW" to their feature family, plus one card added:

1. **Call memory** — h3 "Pre-call briefing. Post-call follow-up." Body: "call_prepare hands the agent a pre-call briefing: customer history, preferences, and suggested openings. call_complete files sentiment and open follow-ups after the call. Every recall cites the clip and timestamp."
2. **Ingest** — "Extracts what matters." Body kept, em-dash removed: "Facts, preferences, promises, action items, not just transcripts. Ingest calls, voice notes, podcasts, and music with automatic semantic extraction and audio-backed citations."
3. **Sound events** — "Sound-event indexing." Body: "sound_analyze detects non-speech audio events: alarms, doors, glass, laughter, silence, keyboard typing. Index an environment once and query it later in plain English." (glass and doorbell-class events added; that is what sound_analyze does now)
4. **Music** — "Music metadata extraction." Body: "music_remember tags each take by tempo, key, structure, instrumentation, and technique. music_recall finds the take you describe in words. Built for producers tracking versions and feedback."
5. **NEW CARD, Edge** — h3 "Memory for devices on the wire." Body: "streaming_audio_ingest and streaming_audio_recall give dashcams, doorbells, and wearables per-device memory as audio streams in. Whisper large-v3 transcription with entity and intent extraction, searchable while the device is still recording."
- Rationale: streaming audio memory is the newest and least copyable capability and had zero presence on the page. Added as a fifth card in the same cap-grid; no structural change beyond one sibling div.

## 10. Pull quote

- Current: an unattributable testimonial ("Our callers stopped repeating themselves... — Head of voice, customer experience team"). We cannot name or verify this person. Shipping a fabricated quote on a page that sells trust is the wrong trade.
- Proposed: "Audio has always been the point. A call, a voice memo, a meeting recording: send it once and it becomes structured, cited, searchable memory. This month the same pipeline learned live device streams, non-speech sound events, and musical metadata." — cite: "From the BlueColumn changelog, September 2026"
- Rationale: keeps the visual pull-quote moment, replaces invented social proof with a verifiable product statement tied to the changelog.

## 11. Pricing

Section head:
- Current h2: "Top up credits. Pay as you go." / sub "No subscriptions, no seats. Buy a pack of credits and burn through them call by call. Credits never expire."
- Proposed h2: "Start free. Scale when it sticks." / sub "A free tier with no card required. Pay-as-you-go packs when you outgrow it. Subscriptions when you want quotas, analytics, and support."
- Rationale: the current head describes only PAYG while the grid shows subscriptions; the new copy matches the actual four-tier reality.

Grid changes (five cards become four):

- **Card 1, "Starter" → "Pay as you go".** Pack selector reduced from $5–$1000 to $5 / $10 / $25 (the real packs). List items now name unit prices: "$0.05 per read: ~N reads", "$0.02 per write: ~N writes", "$0.50 per audio minute", "All endpoints, no rate limits". Desc: "Credit packs from $5 to $25. Tokens never expire."
- **Card 2, "Launch" $20/mo → "Free" $0/mo.** List: "100 memory writes per month", "100 memory reads per month", "30 audio minutes per month", "All endpoints + MCP server". Button: "Start free". The $20 Launch tier no longer exists and the Free tier is the actual entry point.
- **Card 3, Developer $49/mo.** Price kept. List purged of invented credit-equivalents ("$60 in monthly credits ($11 saved)", "~1,200 recalls / 3,000 memories"): now "Generous monthly write and read quotas", "Auto top-up + spend caps", "Usage analytics + webhooks", "Email support, 1-day response".
- **Card 4, Builder $199/mo (featured).** Price kept. Same purge: now "High monthly quotas", "Unlimited API keys + namespaces", "Custom retention + GDPR delete", "Priority support, same-day response". Desc changed from "For production voice agents with real callers." to "For teams running agents in production."
- **Card 5, "Scale" — removed.** Not in the current tier list; "SLA + DPA" and "Dedicated infrastructure" are commitments we cannot back. The mailto CTA goes with it.

Rationale: every number on the page now traces to the published tiers. No card required claim only appears where it is true (Free).

## 12. Final CTA

- Current h2: "Give your voice agents a memory." / p "Free to start, no card required. Live on your first call in 90 seconds."
- Proposed h2: "Give your agents a memory." / p "Free tier, no card required. First memory written in under a minute."
- Rationale: "90 seconds to live on your first call" is a claim we cannot measure; "first memory written in under a minute" is bounded by a single POST /remember and is defensible.

## 13. Enterprise / BYO

Section sub: "Flip one field — database — and writes land..." became "Flip one field, database, and writes land in your Pinecone, your Qdrant, your Weaviate, or your Postgres." Facts unchanged.

Card 3:
- Current h3: "Four vector backends live, more behind a typed interface." Body: "Pinecone, Qdrant, Weaviate, pgvector — all production today, managed Pinecone as the default. Migrate off us in an afternoon — the data was always yours."
- Proposed h3: "Eight providers behind one field." Body: "Pinecone, Qdrant, Weaviate, pgvector, and four more behind a typed provider interface. The BlueColumn managed host is GA today and is the default. Migrating off us is an afternoon. The data was always yours."
- Rationale: matches the internal rule: do not claim BYO providers are fully in production; the managed host is what is GA. 8 providers is the supported count.

Closing line: "Mongo for agent memory — except you can point it at your own Mongo." became "Agent memory infrastructure, except you can point it at your own database." ("Managed by default, sovereign by choice." kept.)

Cards 1 (BYO storage, managed:false) and 2 (AES-256-GCM credential encryption) are accurate and unchanged.

## 14. Footer

- Tagline: "Memory and recall for voice agents. So your callers never have to repeat themselves." → "Audio-first memory for AI agents. Plain-English recall with citations, streaming over SSE."
- Bottom-right: "Built for voice agents" → "Audio-first agent memory"
- Rationale: footer tagline is the last thing crawlers and readers see; it should carry the positioning, not the old phone-only frame.

## 15. index.html meta tags

- `<title>` and og:title/twitter:title: "BlueColumn — Persistent Memory for AI Agents" → "BlueColumn: Persistent Memory for AI Agents" (em-dash removed per voice rules; same length class, no SEO structure change).
- meta description, og:description, twitter:description: → "Audio-first memory for AI agents. Calls, voice notes, and meetings become structured, cited memory. Plain-English recall over SSE. MCP-native. Free to start."
- JSON-LD SoftwareApplication description: → "Persistent memory API for AI agents. Audio-first ingestion, plain-English recall with citations, SSE streaming, native MCP server."
- JSON-LD Free offer description already matches reality (100 writes + 100 reads + 30 audio minutes) and is unchanged.

---

## Patch notes and flags

**Patched in place:** bc-ai-site/assets/index-BmiVaa3Z.js (surgical string replacements only, verified with node --check) and bc-ai-site/index.html (title, descriptions, JSON-LD).

**Not patched / flagged:**
- "Now in public beta" eyebrow left as-is. If the beta label is stale, that is a one-string follow-up once confirmed.
- JSON-LD still lists only Free/Developer/Builder offers; PAYG is a pack purchase, not a subscription offer, so leaving it out of the offers array is defensible. Add it only if the pricing page models it as a plan.
- The Free tier card in the pricing grid was assembled by retitling the old $20 "Launch" card; if the signup flow keys off tier names internally, verify "Free" is a recognized tier name on the register endpoint before deploy.
- Em-dashes in other site pages (docs, livingpages) are out of scope for this task.

**Rebuild from source:** advisable before the next feature change, mandatory before any redesign. The source React repo is not in this workspace, so these edits live only in the built bundle. Any future `vite build` from the original source will silently revert every string on this list. Recommend diffing this document against the source components when the repo is available and porting the copy there.
