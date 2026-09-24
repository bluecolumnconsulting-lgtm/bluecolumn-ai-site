# OutLoud Platform — app-preview notes

MVP of "the inside": accounts + onboarding + dashboard + leads, built as a static
no-build-step site matching the rest of this repo. Deployed to
`https://bluecolumn.ai/app-preview/` on git push.

## Files

| File | Purpose |
|---|---|
| `index.html` | Shell. Loads supabase-js v2 (CDN UMD) + `app.js`. **Never loads `keys.js` statically.** |
| `app.js` | All logic: hash router (`#/login #/signup #/type #/onboarding #/dashboard #/leads #/success`), auth, BlueColumn namespace read/write, onboarding wizard (4 steps), CSV parser, dashboard, leads. |
| `app.css` | outloud-v3 redesign aesthetic (light bg, DM Sans + Newsreader, teal primary, rainbow gradient accents). |
| `keys.js` | ⚠️ INTERIM — see warning below. Defines `window.OL_KEYS {blueColumnKey, elevenLabsKey, simliKey}`. Injected dynamically **only after** a Supabase session is confirmed (`injectKeys()` in app.js). Logged-out visitors never fetch it. |
| `a/index.html` | Public agent template. `?slug=<slug>` renders name/status from the account config; includes a commented `BOT_CFG` block showing exactly how the outloud-v3 runtime will hydrate next build. |
| `mascot-sprites.png` | Copy of `outloud/mascot-sprites.png` (4×3 viseme rig, rescaled to 1041×850 to keep the repo lean). |
| `bluecolumn-mark.png` | 136px copy of `bluecolumn-logo-circle.png` for the header lockup. |

## ⚠️ Interim keys — REMOVE AT GA

`keys.js` ships the BlueColumn API key (and Simli key) client-side. Mitigation:
it is only injected after the auth gate confirms a Supabase session, so public
visitors and the login/signup pages never receive it. This is acceptable for a
preview build only.

**Edge proxy pending.** To remove keys.js we need one of:
- a Cloudflare API token with **Workers Scripts Edit** (current Joe token lacks
  it — verified 2026-09-09: token sees zero zones and cannot manage DNS or deploy workers), or
- a **Supabase access token** for project `jfeoiwmqmbqejjloxvcs` so edge
  functions can be deployed via CLI.

The proxy would wrap: BlueColumn `/agent-remember` `/agent-recall` (key stays
server-side), ElevenLabs TTS, and Simli `/compose/token` — and later serve
per-slug public pages.

## Data model — BlueColumn namespaces ARE the database

No SQL tables. Everything lives in the BlueColumn memory API
(`https://api.bluecolumn.ai`, Bearer key).

- **`ol_registry`** — one rolling doc, `metadata.type: "acct-registry"`,
  `content` = JSON array of accounts:
  `[{user_id, slug, business_name, account_type(business|personal), plan, status, created_at}]`
  Signup reads it (recall), appends, writes it back whole. Tolerates a missing
  registry (creates new).
- **`ol_acct_<slug>`** — all docs for one account, distinguished by
  `metadata.type`:
  - `"acct-config"` — `{version:1, slug, user_id, account_type, plan,
    business:{name, whatYouDo, serviceArea, hours, pricingStyle, commonQuestions},
    avatar:{kind:mascot|simli, faceId, name}, voice:{voiceId, name},
    publicUrl, status:draft|live, created_at, updated_at}`
  - `"catalog"` — `{version:1, items:[{name, description, price, category,
    serviceArea, notes}], saved_at}`
  - `"lead"` — one doc per captured lead `{name, contact, message, page, received_at}`

`plan` is a display flag only (starter $49 / pro $149 / team $349 / personal
$19) — **no billing in this build**.

### API field notes (verified 2026-09-24 against live API)

- `/agent-remember`: `{ text, namespace, metadata:{type, title} }`. `content`
  also works as an alias for `text`. `metadata.title` becomes the doc title;
  without it the API auto-summarizes one.
- `/agent-recall`: `{ namespace, q, top_k }`. Both `q` and `query` are accepted.
  `top_k` max is **20** (25 → 400 validation error).
- Recall sources carry `excerpt` (may be truncated), `title`, `doc_id`,
  `created_at`. app.js parses JSON out of excerpts with a progressive
  last-brace-trim fallback.
- Recall is semantic, not exhaustive: a freshly written doc can lag a few
  seconds before recall sees it, and top_k caps results. The registry read is
  therefore eventually-consistent — fine for this MVP, worth a dedicated
  list-docs endpoint later.

## Auth

Supabase project `https://jfeoiwmqmbqejjloxvcs.supabase.co`, anon key only
(public, safe client-side). Email confirmation is OFF on this project (verified
2026-09-24 10:17 MST — `/auth/v1/signup` returns a session immediately), so
signup flows straight into the business-name step. Sessions persist via
supabase-js localStorage; a `ol_session_cache` copy lets the shell render
instantly on return visits.

Signup flow: email+password → business name (+plan flag) → slug auto-generated
(lowercase/hyphens, collision-checked against registry, suggests `name-2`) →
Business/Personal choice card → registry entry + initial `acct-config` (status
draft) → onboarding.

## Onboarding wizard

1. **Tell us about your business** — labels adapt for personal accounts
   ("Tell us about you"). Saves `acct-config`.
2. **Load your products & services** — CSV template download, drag-drop or
   file-pick, in-browser hand-rolled CSV parser (quoted fields, escaped quotes,
   multiline cells, blank-row drop — unit-tested), auto column mapping by
   header keywords with per-column remap selects, plain-English help under each
   header, editable preview table, row deletion, plus a manual row editor.
   Saves one `catalog` doc.
3. **Pick your avatar & voice** — mascot (included; sprite from
   `outloud/mascot-sprites.png`) + 5 stock Simli video faces (faceIds verified
   against Simli's published default-faces list 2026-09-24; Madison
   `5fc23ea5…` is also live in this repo's OttoMedic config, Sabour
   `7e74d6e7…` in outloud-v3) + 7 stock ElevenLabs voices (Antonio
   `iLVmqjzCGGvqtMCk6vVQ` is the OutLoud signature). Audio preview disabled
   ("Preview coming with launch") — needs the edge proxy.
4. **Review & go live** — summary, public URL, `Go live` flips status to
   `live` → success screen.

Everything is re-editable from the dashboard (Edit content → step 1/2,
Change avatar & voice → step 3).

## Dashboard & leads

- Dashboard: status chip (Live/Draft), public URL + copy, plan flag with
  upgrade teaser, name/catalog-count/face/voice stats, action cards, sign out.
  Config loads via recall on the account namespace; a `lastKnown` copy in
  localStorage (`ol_last_config_<slug>`) renders instantly and is marked
  stale when recall is slow.
- Leads: recall `"customer leads…"` on the account namespace, lead-shaped docs
  newest-first, empty state: "No leads yet — your OutLoud is ready to catch
  them." (Nothing writes leads yet — the public capture form is part of the
  outloud-v3 runtime wiring, next build.)

## Public agent template

`a/index.html?slug=<slug>` — generic loader, no keys. Shows name, status chip,
and the placeholder state ("This OutLoud is getting dressed up — check back
shortly") when the brain proxy is unavailable. Contains the commented
`BOT_CFG` hydration contract for the outloud-v3 runtime. Exists so the
dashboard's "View my page" link resolves today.

**Known gap:** `https://bluecolumn.ai/a/<slug>/` 404s until a per-slug static
generator or the edge proxy serves these pages. The template is ready either way.

## How to promote to /app/ (GA path)

1. Ship the edge proxy (needs CF Workers Scripts Edit **or** Supabase access
   token — see above): proxy BlueColumn + ElevenLabs + Simli, delete `keys.js`.
2. Add lead capture + outloud-v3 runtime wiring to `a/index.html`, generate
   static per-slug pages (or serve via proxy).
3. Copy `app-preview/` → `/app/` (or make it the Pages project root), update
   the dashboard's public URL constant, flip `robots` from `noindex`.
4. Add billing (plan flag already flows through the data model) and audio
   previews.

## Verification log (2026-09-24)

- `node --check app.js` → clean. Unit tests (run in node): CSV quoted commas,
  escaped quotes, multiline cells, blank-row drop; slugify (incl. `&`→"and",
  accents); baseSlug collision suffixing; tryParseJson trim; autoMap header
  keyword mapping — all pass.
- All local hrefs/srcs verified to resolve (bluecolumn-mark.png,
  mascot-sprites.png, favicon, app.css?v=1, app.js?v=1, keys.js?v=1, a/ paths).
- Live API round-trip re-verified on namespace `ol-smoke-0924` (remember +
  recall + field-shape probes above) before wiring app.js.
- Throwaway signup `ol-mvp-check-<rand>@bluecolumn.ai` → session returned
  (auth path reconfirmed).
