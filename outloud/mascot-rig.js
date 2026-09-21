/* ============================================================
   OutLoud mascot rig — sprite-frame viseme lip-sync
   - Intercepts window.Audio BEFORE marina-agent.js plays TTS so the
     rig owns the Web Audio graph (one AudioContext, one analyser,
     one media-element source per TTS reply).
   - Maps analyser amplitude bands (low/mid/high) to 12 sprite cells
     at ~22fps with a short hold to avoid strobing.
   - marina-agent.js is NOT modified: its own startMouth() silently
     fails its createMediaElementSource (element already routed) inside
     its try/catch and squishes a hidden #bot-avatar stub instead.
   Sprite sheet: mascot-sprites.png — 4 cols x 3 rows, cell 347x378.
   Frame map (verified by crop inspection):
     0 R1A rest/closed        6 R2C small O mid (OH)
     1 R1B closed seam (M/B/P) 7 R2D mid-open grin, teeth
     2 R1C big open, tongue low 8 R3A tall open, tongue (L/TH)
     3 R1D mid open spread, teeth (EH) 9 R3B mid oval, upper teeth (ER)
     4 R2A wide smile, full teeth 10 R3C clenched teeth grin (S)
     5 R2B tiny round O (OO)   11 R3D tiny dark pucker (W)
   ============================================================ */
(function () {
  'use strict';
  var mascot = document.getElementById('mascot');
  if (!mascot) { return; }
  var COLS = 4, ROWS = 3;
  var cur = -1;
  function setFrame(i) {
    if (i === cur) { return; }
    cur = i;
    var x = (i % COLS) / (COLS - 1) * 100;
    var y = Math.floor(i / COLS) / (ROWS - 1) * 100;
    mascot.style.backgroundPosition = x.toFixed(2) + '% ' + y.toFixed(2) + '%';
  }
  setFrame(0);

  var actx = null, analyser = null, freq = null, activeEl = null, rigOn = false;
  var routed = (typeof WeakSet === 'function') ? new WeakSet() : [];
  function markRouted(el) {
    if (routed.add) { routed.add(el); } else { routed.push(el); routed[el] = true; }
  }
  function isRouted(el) {
    return routed.add ? routed.has(el) : (routed.indexOf(el) !== -1 || routed[el]);
  }

  function ensureGraph(el) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { return false; }
    if (!actx) {
      try { actx = new AC(); } catch (e) { return false; }
    }
    if (actx.state === 'suspended') { try { actx.resume(); } catch (e) {} }
    if (!analyser) {
      try {
        analyser = actx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.6;
        freq = new Uint8Array(analyser.frequencyBinCount);
      } catch (e) { return false; }
    }
    if (!isRouted(el)) {
      try {
        var src = actx.createMediaElementSource(el);
        src.connect(analyser);
        analyser.connect(actx.destination);
        markRouted(el);
      } catch (e) { return false; }
    }
    return true;
  }

  function band(a, b) {
    var s = 0, i;
    for (i = a; i < b; i++) { s += freq[i]; }
    return s / (b - a) / 255;
  }

  function pickFrame(total, lowS, hiS) {
    if (lowS >= 0.52) {           /* rounded, low-frequency vowels */
      return total > 0.40 ? 2 : (total > 0.22 ? 6 : 5);
    }
    if (hiS >= 0.40) {            /* sibilants and fricatives -> teeth */
      return total > 0.34 ? 4 : 10;
    }
    if (total > 0.42) { return 8; }  /* broad open, tongue flavor */
    if (total > 0.28) { return 3; }  /* EH spread mid with teeth */
    return 9;                        /* ER mid oval */
  }

  var lastTick = 0, holdUntil = 0, loopStarted = false;
  function tick(t) {
    requestAnimationFrame(tick);
    if (!rigOn) { return; }
    if (t - lastTick < 45) { return; }   /* ~22fps */
    lastTick = t;
    var el = activeEl;
    if (!analyser || !el || el.paused) { return; }
    analyser.getByteFrequencyData(freq);
    var total = band(2, 160);
    if (total < 0.04) { setFrame(0); holdUntil = 0; return; }
    if (t < holdUntil) { return; }
    var low = band(2, 10), mid = band(11, 60), hi = band(61, 160);
    var s = low + mid + hi;
    if (!s) { return; }
    setFrame(pickFrame(total, low / s, hi / s));
    holdUntil = t + 90;
  }

  function speechEnd() {
    rigOn = false;
    mascot.classList.remove('speaking');
    setFrame(4);   /* friendly landing grin */
    setTimeout(function () { if (!rigOn) { setFrame(0); } }, 900);
  }
  function speechPaused() {
    rigOn = false;
    mascot.classList.remove('speaking');
    setFrame(0);
  }

  /* --- Wrap Audio so the rig grabs the graph before marina-agent does --- */
  var NativeAudio = window.Audio;
  window.Audio = function (src) {
    var a = new NativeAudio(src);
    var origPlay = a.play.bind(a);
    a.play = function () {
      if (ensureGraph(a)) {
        activeEl = a;
        rigOn = true;
        mascot.classList.add('speaking');
        if (!loopStarted) { loopStarted = true; requestAnimationFrame(tick); }
      }
      return origPlay();
    };
    a.addEventListener('ended', speechEnd);
    a.addEventListener('pause', speechPaused);
    return a;
  };
})();
