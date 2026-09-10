# Replicate Talking-Avatar MVP — The Rewards Club widget

Replaces the Simli real-time video path with a **clip-generation** pipeline:
text → ElevenLabs TTS (Antonio, `eleven_flash_v2_5`) → **Replicate MuseTalk**
(`tmappdev/lipsync`) → MP4 talking-head clip → playback in the existing
`bc-video-el` stage. Pure addition: **no existing file was modified**, nothing
committed, nothing deployed.

## Files (all NEW)

| File | Purpose |
|---|---|
| `provider.js` | `AvatarProvider` interface + `ReplicateAvatarProvider` (MuseTalk via proxy) + `MockAvatarProvider` (offline, no token) + `ClipCache` + phase-2 stubs (`AvatarRenderer`, `AudioStream`, `VideoTransport`) |
| `avatar-bridge.js` | Drop-in bridge with the exact public surface the video toggle needs (`speakText` / `speakAudioUrl` / `isReady` / `stop`), 6-state machine, one-voice guard, hash cache. The **exact future wiring diff** is documented in its header comment |
| `tts.js` | ElevenLabs TTS module (same voice/model as `site-avatar.js`; dry-run mode for tests) |
| `replicate-stack.js` | One-line loader for `index.html` wiring step 1 |
| `worker/replicate-proxy.js` | Ready-to-deploy Cloudflare Worker proxy (token via secret). **Not deployed** — needs Joe's go |
| `worker/wrangler.toml` | Wrangler sketch with account id + KV cache upgrade path |
| `tests/mock-flow.js` | Node test proving the full mock flow; `node --check` clean on all JS |
| `README.md` | This file |

## Model slugs — verified 2026-09-10 (on replicate.com, not guessed)

- **Primary:** `tmappdev/lipsync` — "Lipsync model using MuseTalk", public, ~7.8K runs.
  Cost ≈ **$0.05–0.09 per run** (page showed $0.052 and $0.087 for different inputs),
  Nvidia A100 80GB, **~62 s** typical prediction. Input keys follow the MuseTalk
  convention `{ image, audio }`; verify via the curl below on first run with a token.
- **Fallback:** `cjwbw/sadtalker` — single-image audio-driven talking face (stylized
  characters OK), ≈ $0.09/run, A100, ~66 s.
- **DEAD (do not use):** `marvinhattie/wav2lip` and `cjwbw/wav2lip` both return
  **404** today. The Wav2Lip fallback role is covered by SadTalker instead.

One-time schema check once a token exists:

```bash
curl -s -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  https://api.replicate.com/v1/models/tmappdev/lipsync \
  | jq '.latest_version.openapi_schema.components.schemas.Input'
```

## Cost & latency estimate per 10 s clip

- TTS (ElevenLabs flash): negligible on the current plan tier.
- MuseTalk run: **~$0.05–0.09** (A100 ~62 s wall clock; billed per second of GPU).
- Worst realistic case with the SadTalker fallback: **~$0.09–0.15**.
- **Hash cache** means repeat replies cost **$0** — the 6 canned intents plus common
  questions will hit cache constantly. Effective cost per unique question: ~$0.07.
- **Cold start:** first prediction of the day incurs model cold-boot on A100 — expect
  **+10–30 s** on the first request (60–90 s total vs ~62 s warm). Subsequent runs warm.
- End-to-end latency for a *new* 10 s reply: TTS (~1–2 s) + MuseTalk (~60–90 s) ≈
  **1–1.5 min**. This is NOT real-time like Simli — the bridge shows `generating`
  state while the clip builds, then plays instantly; repeat phrasings are instant
  from cache.

## Wiring steps — AFTER the parity agent lands (do not run concurrently)

The full diff is documented verbatim at the top of `avatar-bridge.js`. Summary:

1. `index.html` — after the `widget/site-avatar.js?v=4` script tag add:
   ```html
   <script src="widget/replicate/replicate-stack.js?v=1"></script>
   ```
2. `site-avatar.js` — two 2-line guards so the bridge owns video-mode speech
   (newest speech wins; returns `false` → original Simli path keeps working):
   - `speakTextThroughSimli(text)` → prepend
     `if (window.BCReplicateBridge && window.BCReplicateBridge.speakText(text)) { return; }`
   - `speakThroughSimli(url)` → prepend the same guard with `speakAudioUrl(url)`.
3. Optional config (before the stack script):
   ```js
   window.BCReplicateConfig = { proxyUrl: 'https://bc-replicate-proxy.<account>.workers.dev', forceMock: false };
   ```
   Until a `proxyUrl` is set, the bridge auto-selects `MockAvatarProvider` — the
   flow is fully demoable offline (audio playback + mouth animation, no video clip).

## Before it works end-to-end (blocked items)

1. **Replicate API token** — none exists on this machine (checked env, TOOLS.md,
   config, repo). Nothing is hardcoded. The provider reads
   `globalThis.REPLICATE_API_TOKEN` for direct/Node mode; in the browser the token
   lives only in the Worker secret.
2. **Worker deploy** — `worker/` is ready but NOT deployed (Joe's go required):
   ```
   npx wrangler secret put REPLICATE_API_TOKEN
   npx wrangler deploy
   ```
3. **Input-key confirmation** — `{ image, audio }` follows the MuseTalk convention;
   confirm against the live OpenAPI schema with the curl above and adjust
   `INPUT_KEYS` in the proxy if needed.

## KV cache upgrade path

MVP cache is an in-memory `Map` (`provider.js → ClipCache`) keyed
`fnv1a(image|text)`. To persist across visitors/sessions: bind a Workers KV
namespace as `CLIPS` in `worker/wrangler.toml`, then in the proxy store
`{ status:'done', videoUrl }` under `'clip_' + hash` on success and serve on hit —
the browser contract never changes. Marked TODOs sit at the exact lines.
