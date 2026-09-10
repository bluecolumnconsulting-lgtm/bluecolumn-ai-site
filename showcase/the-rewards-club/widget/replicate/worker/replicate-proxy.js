/* ===============================================================
   BC Replicate Proxy — Cloudflare Worker (READY TO DEPLOY, NOT DEPLOYED)
   Holds the Replicate token server-side; forwards generation
   requests from /showcase/the-rewards-club/widget/replicate/.

   Deploy plan (requires Joe's go — Cloudflare creds in TOOLS.md):
     wrangler secret put REPLICATE_API_TOKEN
     wrangler deploy
   Token is NEVER in code or the repo.

   Endpoints:
     POST /generate   { image, audio, model? }  (image/audio = URLs or
                      data: URLs <~25MB total; Replicate accepts data URLs)
       -> 200 { videoUrl, cached? }                    (done)
       -> 202 { pollUrl: "<origin>/poll/<id>" }        (still running)
       -> 4xx { error }
     GET  /poll/:id   -> 200 { status, videoUrl?, error? }
     GET  /health     -> 200 { ok: true }
   =============================================================== */
const REPLICATE_API = 'https://api.replicate.com/v1';

/* Verified 2026-09-10. Keep in sync with widget/replicate/provider.js */
const DEFAULT_MODEL = 'cjwbw/sadtalker';     // single-image talking face (mascot PNG + audio)
const FALLBACK_MODEL = 'tmappdev/lipsync';   // MuseTalk lipsync (needs an idle VIDEO input)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',              // tighten to the GH Pages origin before prod
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status,
  headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
});

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') { return new Response(null, { status: 204, headers: CORS_HEADERS }); }
    if (!env || !env.REPLICATE_API_TOKEN) { return json({ error: 'worker secret REPLICATE_API_TOKEN is not set' }, 500); }
    const token = env.REPLICATE_API_TOKEN;
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') { return json({ ok: true }); }

    /* ---------- POST /generate ---------- */
    if (request.method === 'POST' && url.pathname === '/generate') {
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'invalid JSON body' }, 400); }
      const { image, audio, model } = body || {};
      if (!image || !audio) { return json({ error: 'image and audio are required' }, 400); }

      const modelSlug = model || DEFAULT_MODEL;
      /* Input mapping verified against live schemas 2026-09-10:
         - cjwbw/sadtalker: { source_image, driven_audio, still_mode, use_eyeblink, preprocess }
         - tmappdev/lipsync: { video_input, audio_input }  (image arg must be a VIDEO) */
      let input;
      if (modelSlug.indexOf('sadtalker') !== -1) {
        input = { source_image: image, driven_audio: audio, still_mode: true, use_eyeblink: true, preprocess: 'full' };
      } else {
        input = { video_input: image, audio_input: audio };
      }
      /* Cache check: FNV-1a(image|audio) short hash -> Workers KV when bound.
         KV upgrade path: create namespace, bind as CLIPS in wrangler.toml,
         then key = 'clip_' + hash and store { status:'done', videoUrl }.
         Until then this section is a no-op pass-through. */
      // const hash = await hashKey(image + '|' + audio);
      // const hit = env.CLIPS && await env.CLIPS.get('clip_' + hash, 'json');
      // if (hit) { return json({ ...hit, cached: true }); }

      /* Resolve latest published version for the model */
      const modelRes = await fetch(`${REPLICATE_API}/models/${modelSlug}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!modelRes.ok) {
        return json({ error: `model ${modelSlug} not reachable (${modelRes.status})` }, 502);
      }
      const modelData = await modelRes.json();
      const version = modelData.latest_version && modelData.latest_version.id;
      if (!version) { return json({ error: `model ${modelSlug} has no published version` }, 502); }

      /* Input keys below match the MuseTalk lipsync convention
         (image + audio). Verify against the live schema the first
         time a token is available:
           curl -s -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
             https://api.replicate.com/v1/models/tmappdev/lipsync | jq '.latest_version.openapi_schema'
         and adjust INPUT_KEYS if the names differ. */
      const createRes = await fetch(`${REPLICATE_API}/predictions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version,
          input
        })
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData.id) {
        return json({ error: createData.detail || `prediction create failed (${createRes.status})` }, 502);
      }

      /* Poll inline up to ~150s of Worker CPU-safe awaits; beyond that
         hand the client a pollUrl. */
      const deadline = Date.now() + 150000;
      let prediction = createData;
      while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled') {
        if (Date.now() > deadline) {
          return json({
            pollUrl: `${url.origin}/poll/${prediction.id}`,
            status: prediction.status
          }, 202);
        }
        await new Promise(r => setTimeout(r, 1500));
        const pr = await fetch(`${REPLICATE_API}/predictions/${prediction.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        prediction = await pr.json();
      }

      if (prediction.status !== 'succeeded') {
        return json({ error: `prediction ${prediction.status}: ${prediction.error || 'unknown'}` }, 502);
      }
      const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
      /* KV upgrade path (see above): await env.CLIPS.put('clip_' + hash, JSON.stringify({ status:'done', videoUrl: output })) */
      return json({ videoUrl: output, model: modelSlug, predictionId: prediction.id });
    }

    /* ---------- GET /poll/:id ---------- */
    const pollMatch = url.pathname.match(/^\/poll\/([\w-]+)$/);
    if (request.method === 'GET' && pollMatch) {
      const pr = await fetch(`${REPLICATE_API}/predictions/${pollMatch[1]}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const prediction = await pr.json();
      if (prediction.status === 'succeeded') {
        const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
        return json({ status: 'done', videoUrl: output });
      }
      if (prediction.status === 'failed' || prediction.status === 'canceled') {
        return json({ status: 'failed', error: prediction.error || prediction.status });
      }
      return json({ status: prediction.status });
    }

    return json({ error: 'not found' }, 404);
  }
};
