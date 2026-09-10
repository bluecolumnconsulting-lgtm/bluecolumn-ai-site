/* ===============================================================
   tests/mock-flow.js — proves the provider + bridge contract
   WITHOUT a Replicate token and with AT MOST ONE ElevenLabs call.

   Run:  node tests/mock-flow.js
   One real TTS call (quota-friendly):  RUN_REAL_TTS=1 node tests/mock-flow.js
   =============================================================== */
'use strict';

var assert = require('assert');
var path = require('path');

/* Load modules in browser-identical order (globals + module.exports) */
require(path.join(__dirname, '..', 'tts.js'));
require(path.join(__dirname, '..', 'provider.js'));
require(path.join(__dirname, '..', 'avatar-bridge.js'));

var TTS = globalThis.BC_TTS;
var Providers = globalThis.BCAvatarProviders;
var Bridge = globalThis.BCReplicateBridge;

/* Quota guard: dry-run by default; the ONLY real call below is opt-in
   via RUN_REAL_TTS=1 (and it was consumed once on 2026-09-10, passed:
   ~46KB mp3 from voice Antonio). */
globalThis.BC_TTS_DRYRUN = true;

var passed = [];
function ok(name) { passed.push(name); console.log('  ok - ' + name); }

(async function main() {
  /* ---- 1. Provider contract: MockAvatarProvider ---- */
  var mock = new Providers.MockAvatarProvider({ latencyMs: 10 });
  var clip = await mock.generate({
    image: 'data:image/png;base64,FAKE',
    audio: 'data:audio/mpeg;base64,FAKE'
  });
  assert.ok(clip, 'mock provider returns a clip');
  assert.strictEqual(clip.provider, 'mock');
  assert.strictEqual(clip.audioUrl, 'data:audio/mpeg;base64,FAKE');
  assert.strictEqual(clip.videoUrl, null, 'mock yields audio-only clip (no token needed)');
  ok('MockAvatarProvider.generate -> {videoUrl:null, audioUrl, provider:"mock"}');

  /* Validation errors carry .stage='validate' */
  try { await mock.generate({ image: 'x' }); assert.fail('should reject'); }
  catch (e) { assert.strictEqual(e.stage, 'validate'); }
  try { await mock.generate({ audio: 'x' }); assert.fail('should reject'); }
  catch (e) { assert.strictEqual(e.stage, 'validate'); }
  ok('assertContract rejects missing image/audio with stage=validate');

  /* ---- 2. TTS request shape (dry-run = ZERO quota) ---- */
  var ttsShape = await TTS.synthesize('Welcome to Venture Club.');
  assert.strictEqual(ttsShape.request.url.indexOf('https://api.elevenlabs.io/v1/text-to-speech/'), 0);
  assert.ok(ttsShape.request.url.indexOf('iLVmqjzCGGvqtMCk6vVQ') !== -1, 'voice Antonio in URL');
  assert.strictEqual(ttsShape.request.headers['xi-api-key'], TTS.CONFIG.apiKey);
  var bodyObj = JSON.parse(ttsShape.request.body);
  assert.strictEqual(bodyObj.model_id, 'eleven_flash_v2_5');
  assert.ok(bodyObj.text.length > 0);
  ok('TTS request shape: endpoint + xi-api-key + model_id eleven_flash_v2_5 (dry-run)');

  /* ---- 2b. Optional REAL TTS (one call max, only when RUN_REAL_TTS=1) ---- */
  if (process.env.RUN_REAL_TTS === '1') {
    var real = await TTS.synthesize('Venture Club, at your service.', { real: true });
    assert.ok(real.blob && real.blob.size > 1000, 'real TTS returned mp3 blob (' + (real.blob && real.blob.size) + ' bytes)');
    ok('REAL ElevenLabs TTS returned ' + (real.blob && real.blob.size) + ' bytes (1 call used)');
  } else {
    console.log('  skip - real TTS call (set RUN_REAL_TTS=1 for exactly one quota call)');
  }

  /* ---- 3. Bridge flow: text -> tts shape -> provider contract -> playback ---- */
  /* Fake fetch so the bridge's TTS step stays offline but shaped right */
  var fakeFetchCalled = 0;
  var fakeFetch = function (url, opts) {
    fakeFetchCalled++;
    if (String(url).indexOf('api.elevenlabs.io') !== -1) {
      return Promise.resolve({
        ok: true,
        blob: function () {
          return Promise.resolve({
            size: 4,
            arrayBuffer: function () { return Promise.resolve(new ArrayBuffer(4)); }
          });
        }
      });
    }
    return Promise.reject(new Error('unexpected fetch ' + url));
  };
  globalThis.fetch = fakeFetch;
  var audioRefCapture = null;
  var FakeFileReader = function () {};
  FakeFileReader.prototype.readAsDataURL = function () { this.result = 'data:audio/mpeg;base64,QUJDRA=='; this.onload(); };
  globalThis.FileReader = FakeFileReader;

  /* Stub provider to capture what the bridge hands it (contract probe) */
  var probe = Object.create(Providers.AvatarProvider.prototype);
  probe.generate = function (request) {
    audioRefCapture = request;
    return Promise.resolve({
      videoUrl: null, audioUrl: request.audioUrl, cached: false, provider: 'probe', meta: {}
    });
  };
  Bridge._internal.setProvider(probe);

  var states = [];
  var done = null;
  Bridge.init({ image: 'widget/lee-avatar.png' });
  Bridge.on('state', function (s) { states.push(s); });
  Bridge.on('done', function (d) { if (done) { done(d); } });

  var owned = Bridge.speakText('What is Venture Club?', {
    /* force the REAL synthesize path (no dry-run short-circuit) but
       through the injected fake fetch -> zero network, zero quota */
    ttsOpts: { real: true, fetchImpl: fakeFetch }
  });
  assert.strictEqual(owned, true, 'bridge accepts ownership');
  ok('bridge.speakText returns true (video-mode ownership)');

  var result = await new Promise(function (resolve) {
    done = resolve;
    setTimeout(function () { resolve({ how: 'timeout' }); }, 3000);
  });
  assert.ok(['ended', 'no-media', 'blocked', 'stale'].indexOf(result.how) !== -1, 'playback contract resolved: ' + result.how);
  ok('playback contract fired done event (how=' + result.how + ')');

  /* provider contract: bridge passed image + audio (data URL from TTS) */
  assert.ok(audioRefCapture, 'bridge called provider.generate');
  assert.strictEqual(audioRefCapture.image, 'widget/lee-avatar.png');
  assert.strictEqual(audioRefCapture.audioUrl, 'data:audio/mpeg;base64,QUJDRA==');
  ok('provider contract: generate({image, audioUrl}) got mascot + TTS data URL');

  /* state machine hit generating + speaking */
  assert.ok(states.indexOf('generating') !== -1, 'generating observed: ' + states.join(','));
  assert.ok(states.indexOf('speaking') !== -1, 'speaking observed: ' + states.join(','));
  ok('state machine: ' + states.join(' -> '));

  /* ---- 4. One-voice guard: newest speech cancels the active feed ---- */
  var cancelled = 0;
  Bridge.on('cancelled', function () { cancelled++; });
  Bridge.speakText('First utterance is mid-flight...');
  Bridge.speakText('Second utterance wins immediately');
  assert.strictEqual(cancelled, 1, 'exactly one cancellation (no double audio)');
  ok('one-voice guard: newest speech cancelled the active feed (n=' + cancelled + ')');

  /* ---- 5. Hash cache ---- */
  var cache = new Providers.ClipCache();
  var k1 = cache.key('img', 'same text');
  var k2 = cache.key('img', 'same text');
  var k3 = cache.key('img', 'other text');
  assert.strictEqual(k1, k2, 'identical (image,text) -> same key');
  assert.notStrictEqual(k1, k3, 'different text -> different key');
  cache.put(k1, { videoUrl: 'https://cdn/x.mp4' });
  assert.strictEqual(cache.get(k1).videoUrl, 'https://cdn/x.mp4');
  ok('ClipCache: identical replies reuse the clip (fnv1a keyed)');

  /* ---- 6. Direct mode correctly refuses without a token ---- */
  var direct = new Providers.ReplicateAvatarProvider({ fetchImpl: function () { return Promise.reject(new Error('must not fetch')); } });
  try {
    await direct.generateDirect({ image: 'x', audio: 'y' });
    assert.fail('direct mode should refuse without token');
  } catch (e) {
    assert.ok(/REPLICATE_API_TOKEN not set/.test(e.message), 'clean no-token refusal');
  }
  ok('ReplicateAvatarProvider.generateDirect refuses cleanly without a token (no hardcode)');

  console.log('\nAll ' + passed.length + ' checks passed. One-voice guard, cache, contracts OK.');
  process.exit(0);
})().catch(function (err) {
  console.error('FAIL:', err && err.stack || err);
  process.exit(1);
});
