/* ===============================================================
   BC TTS module (ElevenLabs) — Replicate avatar stack, part 2
   Same voice + model as the existing widget (site-avatar.js):
     voice  : Antonio  iLVmqjzCGGvqtMCk6vVQ
     model  : eleven_flash_v2_5
   NOTE: the key below is already shipped publicly in site-avatar.js
   (client-side demo widget, same as the Simli demo key). It is the
   same scoped key verified 2026-08-24 (no user_read needed for TTS).
   Node/tests: set globalThis.BC_TTS_DRYRUN = true to validate the
   request shape without spending quota.
   =============================================================== */
(function (root) {
  'use strict';

  var CONFIG = {
    voiceId: (root.BCReplicateConfig && root.BCReplicateConfig.voiceId) || 'iLVmqjzCGGvqtMCk6vVQ',
    modelId: (root.BCReplicateConfig && root.BCReplicateConfig.ttsModelId) || 'eleven_flash_v2_5',
    apiKey: (root.BCReplicateConfig && root.BCReplicateConfig.ttsApiKey) || 'sk_6b9aa7c4edd19c804554e48fd48dac0dc3686a3fb49cc843'
  };

  function endpoint(voiceId, modelId) {
    return 'https://api.elevenlabs.io/v1/text-to-speech/' + voiceId +
      '?output_format=mp3_44100_128&model_id=' + encodeURIComponent(modelId);
  }

  /* Build the exact request (exported for dry-run validation) */
  function buildRequest(text) {
    return {
      url: endpoint(CONFIG.voiceId, CONFIG.modelId),
      method: 'POST',
      headers: {
        'xi-api-key': CONFIG.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({ text: String(text || ''), model_id: CONFIG.modelId })
    };
  }

  /**
   * synthesize(text) -> Promise<{ blob, request }>
   * Resolves with an MP3 blob plus the request it used (handy for
   * tests and caching). Rejects with Error .stage = 'tts'.
   */
  function synthesize(text, opts) {
    opts = opts || {};
    var req = buildRequest(text);
    if (root.BC_TTS_DRYRUN && !opts.real) {
      return Promise.resolve({ blob: null, request: req, dryRun: true });
    }
    var doFetch = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    if (!doFetch) { var e = new Error('no fetch available'); e.stage = 'tts'; return Promise.reject(e); }
    return doFetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body
    }).then(function (res) {
      if (!res.ok) {
        var e = new Error('tts ' + res.status); e.stage = 'tts'; throw e;
      }
      return res.blob();
    }).then(function (blob) {
      return { blob: blob, request: req, dryRun: false };
    }, function (err) {
      err = err instanceof Error ? err : new Error(String(err));
      err.stage = err.stage || 'tts';
      throw err;
    });
  }

  var api = {
    CONFIG: CONFIG,
    buildRequest: buildRequest,
    endpoint: endpoint,
    synthesize: synthesize
  };

  root.BC_TTS = api;
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
