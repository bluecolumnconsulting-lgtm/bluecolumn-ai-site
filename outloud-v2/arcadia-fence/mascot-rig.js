/* ============================================================
   OutLoud mascot rig — faithful port of the arcadiafenceaz.com rig
   (the one that works flawlessly on the client's own site).

   Source of truth (extracted from the live client bundle):
   - Sprite:  fencebot-avatar-sprite-normalized.png, 720x420 RGBA,
     4 cols x 2 rows, cell 180x210, 8 viseme cells.
   - Viseme map:  rest{0,0} u{1,0} th{2,0} fv{3,0}
                  e{0,1}  ai{1,1} o{2,1} ch{3,1}
   - Engine: analyser-driven phoneme state machine — noise-floor
     learning, attack/release envelope, low/mid/high band energies,
     spectral centroid, gate + hysteresis, minHold + hangover,
     30fps target. Only the MOUTH changes; the body never flickers.
   - Renderer: pixel-exact background math (backgroundSize = W*4 x H*2,
     backgroundPosition = -col*W, -row*H) + 320ms pose crossfade,
     same as the client site's two-layer renderer.

   Integration contract (unchanged): wraps window.Audio BEFORE
   arcadia-agent.js plays TTS so the rig owns the Web Audio graph.
   arcadia-agent.js is not modified.
   ============================================================ */
(function () {
  'use strict';
  var mascot = document.getElementById('mascot');
  if (!mascot) { return; }
  mascot.style.backgroundImage = 'none';

  /* --- client-site viseme map (verbatim) --- */
  var VISEME = {
    rest: { col: 0, row: 0 },
    u:    { col: 1, row: 0 },
    th:   { col: 2, row: 0 },
    fv:   { col: 3, row: 0 },
    e:    { col: 0, row: 1 },
    ai:   { col: 1, row: 1 },
    o:    { col: 2, row: 1 },
    ch:   { col: 3, row: 1 }
  };
  var COLS = 4, ROWS = 2;
  var SPRITE_URL = 'fencebot-sprite.png';

  /* --- two-layer crossfade renderer (client-site pose-in/pose-out) --- */
  var layers = [];
  (function buildLayers() {
    var prev = document.createElement('div');
    var cur = document.createElement('div');
    [prev, cur].forEach(function (el) {
      el.style.cssText = 'position:absolute;inset:0;background-image:url("' +
        SPRITE_URL + '");background-repeat:no-repeat;';
      el.setAttribute('aria-hidden', 'true');
      mascot.appendChild(el);
      layers.push(el);
    });
  })();

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  var showing = 1;                 /* which layer is current */
  var curVisemeName = null;

  function renderLayer(el, v, anim, z) {
    var w = mascot.clientWidth || 320;
    var h = mascot.clientHeight || w;
    el.style.backgroundSize = (w * COLS) + 'px ' + (h * ROWS) + 'px';
    el.style.backgroundPosition = (-v.col * w) + 'px ' + (-v.row * h) + 'px';
    el.style.animation = 'none';
    /* force restart of the 320ms pose animation on every swap */
    void el.offsetWidth;
    el.style.animation = anim;
    el.style.zIndex = String(z);
  }
  function setViseme(name) {
    if (!VISEME[name]) { name = 'rest'; }
    if (name === curVisemeName) { return; }
    var v = VISEME[name];
    var prevEl = layers[showing], curEl = layers[1 - showing];
    showing = 1 - showing;
    curVisemeName = name;
    /* previous frame fades out (if it ever rendered), new frame fades in */
    if (curEl.getAttribute('data-rendered') === '1') {
      renderLayer(prevEl, VISEME[curEl.getAttribute('data-v') || 'rest'],
        'pose-out 320ms ease-out forwards', 1);
    }
    curEl.setAttribute('data-rendered', '1');
    curEl.setAttribute('data-v', name);
    renderLayer(curEl, v, 'pose-in 320ms ease-out forwards', 2);
  }

  /* --- engine: faithful port of the client-site LipSync class --- */
  var CFG = {
    fftSize: 2048, analyserSmoothing: 0.75, targetFps: 30,
    attackMs: 55, releaseMs: 220, noiseLearnRate: 0.015,
    gateDb: 8.5, hangoverMs: 180,
    quietDb: 9, softDb: 13, mediumDb: 17, loudDb: 21,
    lowBandHz: [200, 600], midBandHz: [800, 2500], highBandHz: [3000, 8000],
    hysteresisDb: 3.5, minHoldMs: 110, peakBoostDb: 2.5,
    centroidBoostDb: 2, maxRangeDb: 30
  };
  function toDb(x) { var e = Math.max(1e-8, x); return 20 * Math.log10(e); }
  function frac(dt, ms) { return 1 - Math.exp(-dt / Math.max(1, ms)); }

  function Engine() {
    this.noiseFloorDb = -60; this.envDb = 0; this.peakDb = 0;
    this.lowE = 0; this.midE = 0; this.highE = 0;
    this.speaking = false; this.lastSpokeAt = 0;
    this.mouth = 'rest'; this.lastChangeAt = 0; this.lastTickAt = 0;
  }
  Engine.prototype.attach = function (analyser, sampleRate) {
    this.analyser = analyser; this.sampleRate = sampleRate || 44100;
    analyser.fftSize = CFG.fftSize;
    analyser.smoothingTimeConstant = CFG.analyserSmoothing;
    this.timeData = new Float32Array(CFG.fftSize);
    this.freqData = new Uint8Array(analyser.frequencyBinCount);
  };
  Engine.prototype.band = function (a, b) {
    if (!this.freqData) { return 0; }
    var nyq = this.sampleRate / 2, n = this.freqData.length;
    var i0 = clamp(Math.round(a / nyq * n), 0, n - 1);
    var i1 = clamp(Math.round(b / nyq * n), i0, n - 1);
    var s = 0;
    for (var i = i0; i <= i1; i++) { s += this.freqData[i] / 255; }
    return (i1 <= i0) ? 0 : s / (i1 - i0 + 1);
  };
  Engine.prototype.tick = function (t) {
    if (!this.analyser) { return this.mouth; }
    if (!this.lastTickAt) { this.lastTickAt = t; }
    var dt = t - this.lastTickAt; this.lastTickAt = t;
    this.analyser.getFloatTimeDomainData(this.timeData);
    var sum = 0, i, s;
    for (i = 0; i < this.timeData.length; i++) { var v = this.timeData[i]; sum += v * v; }
    var rms = Math.sqrt(sum / this.timeData.length);
    var rmsDb = toDb(rms);
    var learn = (rmsDb - this.noiseFloorDb < 6) ? CFG.noiseLearnRate : CFG.noiseLearnRate * 0.2;
    this.noiseFloorDb = this.noiseFloorDb * (1 - learn) + rmsDb * learn;
    var envTarget = clamp(rmsDb - this.noiseFloorDb, 0, CFG.maxRangeDb);
    var up = frac(dt, CFG.attackMs), down = frac(dt, CFG.releaseMs);
    this.envDb = envTarget > this.envDb
      ? this.envDb + (envTarget - this.envDb) * up
      : this.envDb + (envTarget - this.envDb) * down;
    this.peakDb = envTarget > this.peakDb
      ? this.peakDb + (envTarget - this.peakDb) * frac(dt, 10)
      : this.peakDb + (envTarget - this.peakDb) * frac(dt, 80);
    var peakSurplus = Math.max(0, this.peakDb - this.envDb);
    this.analyser.getByteFrequencyData(this.freqData);
    var k = 0.7;
    var low = this.band(CFG.lowBandHz[0], CFG.lowBandHz[1]);
    var mid = this.band(CFG.midBandHz[0], CFG.midBandHz[1]);
    var high = this.band(CFG.highBandHz[0], CFG.highBandHz[1]);
    this.lowE = this.lowE * k + low * (1 - k);
    this.midE = this.midE * k + mid * (1 - k);
    this.highE = this.highE * k + high * (1 - k);
    var wSum = 0, cSum = 0;
    for (i = 0; i < this.freqData.length; i++) {
      var b = this.freqData[i] / 255; wSum += b; cSum += b * i;
    }
    var centroidN = clamp((wSum > 1e-6 ? cSum / wSum : 0) / this.freqData.length, 0, 1);
    if (this.envDb > CFG.gateDb) { this.speaking = true; this.lastSpokeAt = t; }
    else if (t - this.lastSpokeAt > CFG.hangoverMs) { this.speaking = false; }
    var next, held = (t - this.lastChangeAt) >= CFG.minHoldMs;
    if (!this.speaking) { next = 'rest'; }
    else {
      var level = this.envDb + clamp(peakSurplus / 6, 0, 1) * CFG.peakBoostDb + centroidN * CFG.centroidBoostDb;
      var quiet = level < CFG.quietDb + CFG.hysteresisDb;
      var soft = level >= CFG.softDb - CFG.hysteresisDb && level < CFG.mediumDb;
      var medium = level >= CFG.mediumDb - CFG.hysteresisDb && level < CFG.loudDb;
      var loud = level >= CFG.loudDb - CFG.hysteresisDb;
      var total = this.lowE + this.midE + this.highE + 0.001;
      var lowR = this.lowE / total, midR = this.midE / total;
      var highDominant = this.highE / total > 0.4 && this.highE > 0.15;
      var lowDominant = lowR > 0.45 && this.lowE > 0.2;
      var midDominant = midR > 0.4;
      if (quiet) { next = 'rest'; }
      else if (highDominant) { next = peakSurplus > 3 ? 'ch' : (centroidN > 0.6 ? 'th' : 'fv'); }
      else if (loud) { next = lowDominant ? 'o' : 'ai'; }
      else if (medium) { next = lowDominant ? 'u' : (midDominant ? 'e' : 'ai'); }
      else if (soft && lowDominant) { next = 'u'; }
      else { next = 'e'; }
    }
    if (next !== this.mouth && !held) { next = this.mouth; }
    if (next !== this.mouth) { this.mouth = next; this.lastChangeAt = t; }
    return this.mouth;
  };

  /* --- audio graph: same interception contract as before --- */
  var actx = null, engine = null, activeEl = null, rigOn = false;
  var routed = (typeof WeakSet === 'function') ? new WeakSet() : [];
  function markRouted(el) { if (routed.add) { routed.add(el); } else { routed.push(el); routed[el] = true; } }
  function isRouted(el) { return routed.add ? routed.has(el) : (routed.indexOf(el) !== -1 || routed[el]); }

  function ensureGraph(el) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { return false; }
    if (!actx) { try { actx = new AC(); } catch (e) { return false; } }
    if (actx.state === 'suspended') { try { actx.resume(); } catch (e) {} }
    if (!engine) {
      try {
        var analyser = actx.createAnalyser();
        engine = new Engine();
        engine.attach(analyser, actx.sampleRate);
        /* analyser is a tap only; element path below keeps audio audible */
      } catch (e) { return false; }
    }
    if (!isRouted(el)) {
      try {
        var src = actx.createMediaElementSource(el);
        src.connect(actx.destination);   /* audio keeps playing */
        src.connect(engine.analyser);    /* tap for lip-sync    */
        markRouted(el);
      } catch (e) { return false; }
    }
    return true;
  }

  var lastTick = 0, loopStarted = false;
  function tick(t) {
    requestAnimationFrame(tick);
    if (!rigOn || !engine) { return; }
    var minMs = 1000 / (CFG.targetFps || 30);
    if (t - lastTick < minMs) { return; }
    lastTick = t;
    var el = activeEl;
    if (!el || el.paused) { return; }
    setViseme(engine.tick(t));
  }
  function loop() {
    if (!loopStarted) { loopStarted = true; requestAnimationFrame(tick); }
  }

  function speechEnd() {
    rigOn = false;
    mascot.classList.remove('speaking');
    setViseme('rest');
  }

  var NativeAudio = window.Audio;
  window.Audio = function (src) {
    var a = new NativeAudio(src);
    var origPlay = a.play.bind(a);
    a.play = function () {
      if (ensureGraph(a)) {
        activeEl = a;
        rigOn = true;
        mascot.classList.add('speaking');
        loop();
      }
      return origPlay();
    };
    a.addEventListener('ended', speechEnd);
    a.addEventListener('pause', speechEnd);
    return a;
  };

  /* re-render on resize so pixel math stays exact */
  window.addEventListener('resize', function () {
    if (curVisemeName) {
      var name = curVisemeName;
      curVisemeName = null;
      setViseme(name);
    }
  });
  setViseme('rest');
})();