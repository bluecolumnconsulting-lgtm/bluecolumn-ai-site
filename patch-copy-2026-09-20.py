#!/usr/bin/env python3
"""Surgical copy patches for bc-ai-site/assets/index-BmiVaa3Z.js (2026-09-20).
Each old string must occur exactly once. No structural/logic changes."""
import sys

PATH = "/Users/mac/.openclaw/workspace/bc-ai-site/assets/index-BmiVaa3Z.js"

REPLACEMENTS = [
# 1. hero rotating words
('vN=["voice agents","phone agents","support lines","IVR flows","live callers"]',
 'vN=["AI agents","voice agents","phone agents","co-pilots","assistants"]'),

# 2. hero headline
('children:["Memory and recall",a.jsx("br",{}),"for ",a.jsx(W7,{})]',
 'children:["Audio-first memory",a.jsx("br",{}),"for ",a.jsx(W7,{})]'),

# 3. hero subhead
('BlueColumn gives your voice agent a real memory. Every call, every caller, every detail — recalled in milliseconds, the moment your agent needs it on the line.',
 'BlueColumn turns calls, voice notes, meetings, and documents into structured memory your agent queries in plain English. Streaming recall puts the first token on the wire in milliseconds, with citations attached.'),

# 4. logo strip label
('Trusted by voice teams at', 'Ships where your stack already lives'),

# 5. logo strip names
('["Vector","Cohere Labs","Bracket","Otter Engine","Northwind","Lemma","Field"]',
 '["npm","MCP Registry","ClawHub","Claude Desktop","Cursor","n8n","LangChain"]'),

# 6. problem h2
('Your voice agent meets every caller for the first time.',
 'Your agent meets every user for the first time.'),

# 7. problem sub
('Callers repeat themselves. Account numbers, preferences, the issue from last week — gone the second the call ends. BlueColumn keeps it all, and hands it back the next time the phone rings.',
 'Preferences, decisions, action items, prior context. Gone the second the session ends. BlueColumn keeps all of it and hands it back in plain English, with citations to the source.'),

# 8. how-it-works h2
('Three calls. One memory layer for every conversation.',
 'Two calls. One memory layer for every conversation.'),

# 9. feature 1
('title:"Capture every call",body:"Stream audio or post a transcript. We store the conversation, the caller, and the context — ready for the next call before it starts."',
 'title:"Capture anything",body:"Post a transcript, upload an audio file, or send plain text to /remember. It chunks, embeds, and indexes the content, extracting entities and action items along the way."'),

# 10. feature 2
('title:"Recall on the line",body:"Sub-100ms retrieval, fast enough to use mid-sentence. Pull the right detail at the right moment without breaking the flow of the call."',
 'title:"Recall in plain English",body:"Ask a question the way a person would. /recall synthesizes an answer with cited sources and relevance scores, streaming over SSE so the first token lands in milliseconds."'),

# 11. feature 3
('title:"One caller, one memory",body:"Isolated memory per caller, per workspace. No cross-leaks, no mixed-up histories. Delete on request, audit on demand."',
 'title:"Isolated by namespace",body:"Memory is scoped per namespace and enforced at runtime. Cross-tenant access returns 403. Hard delete is a single API call."'),

# 12. code showcase h2
('One line of code per call.', 'Two endpoints. One memory layer.'),

# 13. metrics tiles
('{v:"<100ms",l:"p95 recall latency"},{v:"99.9%",l:"Uptime SLA"},{v:"2-index",l:"Hot + cold memory"},{v:"SOC 2",l:"Type II ready"}',
 '{v:"<100ms",l:"p95 recall latency"},{v:"24h",l:"Idempotent retry window"},{v:"Hybrid",l:"Vector + full-text search"},{v:"8",l:"BYO database providers"}'),

# 14. use-case cards (full tuple list)
('["Voice support lines","Greet callers by name, skip the verification dance, pick up the issue exactly where the last call ended."],["Sales & outbound","Walk into every call knowing what was promised, what was asked, and what to follow up on next."],["Healthcare & intake","Patient context, prior visits, preferences and consent — kept per-caller, recalled the second the line connects."],["Bookings & front desk","Repeat guests, dietary notes, table preferences. Your agent remembers regulars without anyone tagging a thing."],["Field service & dispatch","Site history, equipment notes, prior fixes — handed to the agent on the call so the caller never repeats themselves."],["IVR & call deflection","Resolve the call before a human picks up by recalling the caller\'s account, last issue, and resolution."]',
 '["Voice agents & support lines","call_prepare briefs the agent before the call with customer history and suggested openings. call_complete files sentiment and open follow-ups after. Callers never repeat themselves."],["Meetings & voice notes","Upload the recording or forward the memo. Decisions, owners, and action items become searchable memory, with citations back to the clip and timestamp."],["Personal assistants","Preferences and history persist across sessions and are recalled in plain English. One namespace per user keeps every memory isolated."],["Edge devices","Dashcams, doorbells, wearables, and any device that streams audio. streaming_audio_ingest builds per-device memory while audio streams in, and streaming_audio_recall queries it live."],["Research & podcasts","Ingest hours of audio and query it later. Speaker, sentiment, entities, and topics are metadata filters on /recall, not separate passes."],["Music production","music_remember tags takes by instrument, key, tempo, and technique. Describe the take you want in words and get the file back."]'),

# 15. capabilities section sub
('Streaming recall, multimodal ingestion, structured filters, idempotent writes, native MCP. Production primitives — not a demo.',
 'Streaming recall, multimodal ingestion, structured filters, idempotent writes, and a native MCP server. Production primitives, not a demo.'),

# 16. cap card 1 (SSE) event-type sentence
('. Three event types —",a.jsx("code",{children:" vectors"}),", ",a.jsx("code",{children:"synthesis_delta"}),",",a.jsx("code",{children:" done"})," — surface partial output to users the moment the model produces it.',
 '. It streams ",a.jsx("code",{children:"vectors"}),", ",a.jsx("code",{children:"synthesis_delta"}),", and ",a.jsx("code",{children:"done"})," events, so partial output reaches users the moment the model produces it.'),

# 17. cap card 2 (Inputs) em-dash
('transcribed by Groq Whisper — flag ', 'transcribed by Groq Whisper. Flag '),

# 18. cap card 3 (Beyond transcription)
('Six new filter dimensions extracted at ingest:', 'Six filter dimensions extracted at ingest:'),
('and get the right chunks back — every dimension is a metadata filter on ',
 'and get the right chunks back. Every dimension is a metadata filter on '),

# 19. cap card 4 (Precision)
('Stack metadata filters on top of vector search —",', 'Stack metadata filters on top of vector search:",'),
('Filtering happens inside Pinecone: no post-hoc passes, no wasted reads.',
 'Filtering happens inside Pinecone, so there are no post-hoc passes and no wasted reads.'),

# 20. cap card 5 (Idempotency)
('get back the same response — no double-ingestion, no double-charge, no duplicate vectors. Built for unreliable networks and agent retry loops.',
 'get back the same response. No double-ingestion and no double charge. Built for unreliable networks and agent retry loops.'),

# 21. cap card 6 (MCP) eyebrow + h3
('children:"Native integrations"}),a.jsx("h3",{children:"Talk to your memory from Claude Desktop."})',
 'children:"MCP-native"}),a.jsx("h3",{children:"Two-command install, any MCP client."})'),
# cap card 6 body
('BlueColumn ships as a Model Context Protocol server. One config block and the model can call ",a.jsx("code",{children:"remember"}),",",a.jsx("code",{children:" recall"}),", and ",a.jsx("code",{children:"note"})," directly — no glue code, no proxy, no agent framework. Same memory layer, exposed natively to any MCP-aware client.',
 'BlueColumn ships as a Model Context Protocol server. Install bluecolumn-mcp from npm, add two lines to your client config, and the model can call ",a.jsx("code",{children:"remember"}),",",a.jsx("code",{children:" recall"}),", and ",a.jsx("code",{children:"note"})," directly. Works in Claude Desktop, Cursor, and any MCP-aware client. Published on npm at v1.4.0 and listed in the official MCP registry.'),

# 22. audio section sub
('Voice call continuity, sound-event indexing, music metadata — on top of the same persistent memory API. Upload any audio, BlueColumn remembers what matters.',
 'Voice call continuity, sound-event indexing, and music metadata, all on top of the same persistent memory API. Upload any audio. BlueColumn remembers what matters.'),

# 23. audio card 1 (call memory): eyebrow+h3, then body
('children:"NEW"}),a.jsx("h3",{children:"Voice call continuity."})',
 'children:"Call memory"}),a.jsx("h3",{children:"Pre-call briefing. Post-call follow-up."})'),
('["Agents ",a.jsx("em",{children:"prepare"})," with customer context (preferences, history, suggested openings), respond to real-time signals, and ",a.jsx("em",{children:"prove it"})," — every recall includes the clip and timestamp."]',
 '["call_prepare hands the agent a pre-call briefing: customer history, preferences, and suggested openings. call_complete files sentiment and open follow-ups after the call. Every recall cites the clip and timestamp."]'),

# 24. audio card 2 (ingest): eyebrow, em-dash in body
('children:"NEW"}),a.jsx("h3",{children:"Extracts what matters."})',
 'children:"Ingest"}),a.jsx("h3",{children:"Extracts what matters."})'),
('Facts, preferences, promises, action items — not just transcripts.',
 'Facts, preferences, promises, action items, not just transcripts.'),

# 25. audio card 3 (sound events): eyebrow, body
('children:"NEW"}),a.jsx("h3",{children:"Sound-event indexing."})',
 'children:"Sound events"}),a.jsx("h3",{children:"Sound-event indexing."})'),
('Detect and search non-speech audio events: alarms, doors, silence, laughter, keyboard typing. Index any sound and query it later.',
 'sound_analyze detects non-speech audio events: alarms, doors, glass, laughter, silence, keyboard typing. Index an environment once and query it later in plain English.'),

# 26. audio card 4 (music): eyebrow, body
('children:"NEW"}),a.jsx("h3",{children:"Music metadata extraction."})',
 'children:"Music"}),a.jsx("h3",{children:"Music metadata extraction."})'),
('Tempo, key, structure, instrumentation, energy curve, vocal characteristics, and creative lineage — for producers and podcasters who need takes, feedback, and versions tracked.',
 'music_remember tags each take by tempo, key, structure, instrumentation, and technique. music_recall finds the take you describe in words. Built for producers tracking versions and feedback.'),

# 27. NEW edge-streaming card appended to audio cap-grid
('versions tracked."})]})]})]})}),a.jsx(Pn,{className:"quote"',
 'versions tracked."})]})},a.jsxs("div",{className:"cap-card",children:[a.jsx("div",{className:"cap-eyebrow",children:"Edge"}),a.jsx("h3",{children:"Memory for devices on the wire."}),a.jsx("p",{children:"streaming_audio_ingest and streaming_audio_recall give dashcams, doorbells, and wearables per-device memory as audio streams in. Whisper large-v3 transcription with entity and intent extraction, searchable while the device is still recording."})]})]})]})}),a.jsx(Pn,{className:"quote"'),

# 28. pull quote + cite
('“Our callers stopped repeating themselves. Average handle time dropped, CSAT went up, and our agents finally sound like they remember who they\'re talking to.”',
 '“Audio has always been the point. A call, a voice memo, a meeting recording: send it once and it becomes structured, cited, searchable memory. This month the same pipeline learned live device streams, non-speech sound events, and musical metadata.”'),
('— Head of voice, customer experience team', 'From the BlueColumn changelog, September 2026'),

# 29. pricing section head
('Top up credits. Pay as you go.', 'Start free. Scale when it sticks.'),
('No subscriptions, no seats. Buy a pack of credits and burn through them call by call. Credits never expire.',
 'A free tier with no card required. Pay-as-you-go packs when you outgrow it. Subscriptions when you want quotas, analytics, and support.'),

# 30. PAYG pack amounts
('[5,25,50,100,250,500,1e3]', '[5,10,25]'),

# 31. Starter card -> Pay as you go
('children:"Starter"', 'children:"Pay as you go"'),
('Pay as you go. Credits never expire.', 'Credit packs from $5 to $25. Tokens never expire.'),
('children:["~",yN(r)," recalls"]', 'children:["$0.05 per read: about ",yN(r)," reads"]'),
('children:["~",yN(n)," stored memories"]', 'children:["$0.02 per write: about ",yN(n)," writes"]'),
('children:"All endpoints, no rate limits"}),a.jsx("li",{children:"Email support"})',
 'children:"All endpoints, no rate limits"}),a.jsx("li",{children:"$0.50 per audio minute"})'),

# 32. Launch card -> Free
('children:"Launch"', 'children:"Free"'),
('children:["$20",a.jsx("span",{children:"/mo"})]', 'children:["$0",a.jsx("span",{children:"/mo"})]'),
('For solo developers shipping their first AI product.', 'No card required. Ship your first agent memory today.'),
('a.jsx("li",{children:"$22/mo in API credits"}),a.jsx("li",{children:"Per-key namespace isolation"}),a.jsx("li",{children:"Unlimited namespaces"}),a.jsx("li",{children:"Webhooks & GDPR delete"}),a.jsx("li",{children:"Email support"})',
 'a.jsx("li",{children:"100 memory writes per month"}),a.jsx("li",{children:"100 memory reads per month"}),a.jsx("li",{children:"30 audio minutes per month"}),a.jsx("li",{children:"All endpoints + MCP server"})'),
('children:"Start with Launch"', 'children:"Start free"'),

# 33. Developer card list
('a.jsx("li",{children:"$60 in monthly credits ($11 saved)"}),a.jsx("li",{children:"~1,200 recalls / 3,000 memories"}),a.jsx("li",{children:"Auto top-up + spend caps"}),a.jsx("li",{children:"Usage analytics + webhooks"}),a.jsx("li",{children:"Email support, 1-day response"})',
 'a.jsx("li",{children:"Generous monthly write and read quotas"}),a.jsx("li",{children:"Auto top-up + spend caps"}),a.jsx("li",{children:"Usage analytics + webhooks"}),a.jsx("li",{children:"Email support, 1-day response"})'),

# 34. Builder card desc + list
('For production voice agents with real callers.', 'For teams running agents in production.'),
('a.jsx("li",{children:"$260 in monthly credits ($61 saved)"}),a.jsx("li",{children:"~5,200 recalls / 13,000 memories"}),a.jsx("li",{children:"Unlimited API keys + namespaces"}),a.jsx("li",{children:"Custom retention + GDPR delete"}),a.jsx("li",{children:"Priority support, same-day response"})',
 'a.jsx("li",{children:"High monthly quotas"}),a.jsx("li",{children:"Unlimited API keys + namespaces"}),a.jsx("li",{children:"Custom retention + GDPR delete"}),a.jsx("li",{children:"Priority support, same-day response"})'),

# 35. remove Scale card (with preceding comma)
(',a.jsxs("div",{className:"price-card",children:[a.jsx("div",{className:"tier-name",children:"Scale"}),a.jsx("div",{className:"tier-price",children:"Custom"}),a.jsx("div",{className:"tier-desc",children:"Volume credits for agent platforms."}),a.jsxs("ul",{className:"tier-list",children:[a.jsx("li",{children:"Bulk credit pricing"}),a.jsx("li",{children:"SLA + DPA"}),a.jsx("li",{children:"Dedicated infrastructure"}),a.jsx("li",{children:"Solutions engineer"})]}),a.jsx("a",{className:"btn-ghost",href:"mailto:hello@bluecolumn.ai?subject=BlueColumn%20Scale",children:"Talk to sales"})]})',
 ''),

# 36. final CTA
('Give your voice agents a memory.', 'Give your agents a memory.'),
('Free to start, no card required. Live on your first call in 90 seconds.',
 'Free tier, no card required. First memory written in under a minute.'),

# 37. enterprise sub em-dashes
('Flip one field — ",a.jsx("code",{children:"database"})," — and writes land in',
 'Flip one field, ",a.jsx("code",{children:"database"}),", and writes land in'),

# 38. four backends card
('children:"Four vector backends live, more behind a typed interface."',
 'children:"Eight providers behind one field."'),
('Pinecone, Qdrant, Weaviate, pgvector — all production today, managed Pinecone as the default. Migrate off us in an afternoon — the data was always yours.',
 'Pinecone, Qdrant, Weaviate, pgvector, and four more behind a typed provider interface. The BlueColumn managed host is GA today and is the default. Migrating off us is an afternoon. The data was always yours.'),

# 39. closing em line
('Mongo for agent memory — except you can point it at your own Mongo.',
 'Agent memory infrastructure, except you can point it at your own database.'),

# 40. footer tagline
('Memory and recall for voice agents. So your callers never have to repeat themselves.',
 'Audio-first memory for AI agents. Plain-English recall with citations, streaming over SSE.'),

# 41. footer bottom
('Built for voice agents', 'Audio-first agent memory'),
]

def main():
    with open(PATH, encoding="utf-8") as f:
        src = f.read()
    errors = []
    for i, (old, new) in enumerate(REPLACEMENTS, 1):
        n = src.count(old)
        if n != 1:
            errors.append(f"#{i}: expected 1 occurrence, found {n}: {old[:90]!r}")
    if errors:
        print("ABORT, no changes written:")
        for e in errors:
            print(" ", e)
        sys.exit(1)
    for old, new in REPLACEMENTS:
        src = src.replace(old, new, 1)
    with open(PATH, "w", encoding="utf-8") as f:
        f.write(src)
    print(f"OK: {len(REPLACEMENTS)} replacements applied.")

if __name__ == "__main__":
    main()
