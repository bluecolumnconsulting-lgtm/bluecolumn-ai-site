/* ============================================================
   OutLoud LipSyncController — continuous constrained articulation rig
   Faithful implementation of Joe's spec (note-20260928-201922).

   Replaces the old "frequency-band analyser -> 8 discrete sprite cells"
   approach with a phoneme/timing-driven continuous rig:

     speech front end  ──►  [{start,end,viseme}, ...]  ──►  LipSyncController
                                                                  │
                                    Pose { jawOpen, lipSeal, lipRound, lipPucker,
                                           lipSpread, lowerLipTuck, tongueTipUp,
                                           tongueForward }  (all 0..1)
                                                                  │
                                    renderer (morph targets / sprite mapping)

   Timing defaults (spec):
     anticipation 0.045s — articulation begins this far ahead of start
     release      0.035s — articulation persists this long after end
     smoothing    0.020s — exponential frame-to-frame smoothing constant

   Audio-clock: sample(audio.currentTime + calibratedOffset) each rAF —
   NOT accumulated frame deltas. Pause/seek/rate changes handled by
   discontinuity detection in sample().
   ============================================================ */
(function (root) {
  'use strict';

  var KEYS = ['jawOpen', 'lipSeal', 'lipRound', 'lipPucker', 'lipSpread',
              'lowerLipTuck', 'tongueTipUp', 'tongueForward'];

  /* Visual targets — not a universal phoneme inventory. */
  var TARGETS = {
    REST:   { jawOpen: 0,    lipSeal: 0.2,  lipRound: 0,   lipPucker: 0,   lipSpread: 0,    lowerLipTuck: 0,   tongueTipUp: 0,   tongueForward: 0 },
    MBP:    { jawOpen: 0,    lipSeal: 1,    lipRound: 0,   lipPucker: 0,   lipSpread: 0,    lowerLipTuck: 0,   tongueTipUp: 0,   tongueForward: 0 },
    EE:     { jawOpen: 0.20, lipSeal: 0,    lipRound: 0,   lipPucker: 0,   lipSpread: 0.85, lowerLipTuck: 0,   tongueTipUp: 0,   tongueForward: 0 },
    EH:     { jawOpen: 0.42, lipSeal: 0,    lipRound: 0,   lipPucker: 0,   lipSpread: 0.30, lowerLipTuck: 0,   tongueTipUp: 0,   tongueForward: 0 },
    AA:     { jawOpen: 0.85, lipSeal: 0,    lipRound: 0,   lipPucker: 0,   lipSpread: 0,    lowerLipTuck: 0,   tongueTipUp: 0,   tongueForward: 0 },
    OH:     { jawOpen: 0.52, lipSeal: 0,    lipRound: 0.80, lipPucker: 0,   lipSpread: 0,    lowerLipTuck: 0,   tongueTipUp: 0,   tongueForward: 0 },
    UW:     { jawOpen: 0.18, lipSeal: 0,    lipRound: 0.95, lipPucker: 0.75, lipSpread: 0,    lowerLipTuck: 0,   tongueTipUp: 0,   tongueForward: 0 },
    FV:     { jawOpen: 0.12, lipSeal: 0,    lipRound: 0,   lipPucker: 0,   lipSpread: 0,    lowerLipTuck: 0.90, tongueTipUp: 0,   tongueForward: 0 },
    L:      { jawOpen: 0.30, lipSeal: 0,    lipRound: 0,   lipPucker: 0,   lipSpread: 0,    lowerLipTuck: 0,   tongueTipUp: 0.90, tongueForward: 0 },
    TH:     { jawOpen: 0.22, lipSeal: 0,    lipRound: 0,   lipPucker: 0,   lipSpread: 0,    lowerLipTuck: 0,   tongueTipUp: 0,   tongueForward: 0.85 },
    SH_CH:  { jawOpen: 0.22, lipSeal: 0,    lipRound: 0.45, lipPucker: 0.30, lipSpread: 0,    lowerLipTuck: 0,   tongueTipUp: 0,   tongueForward: 0 }
  };

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  /* Standard smoothstep on t in [0,1] */
  function smoothstep(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t * t * (3 - 2 * t);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function copyPose(p) {
    var o = {};
    for (var i = 0; i < KEYS.length; i++) { o[KEYS[i]] = p[KEYS[i]]; }
    return o;
  }

  /* Defaults per spec. */
  var DEFAULTS = { anticipation: 0.045, release: 0.035, smoothing: 0.020 };

  function LipSyncController(cfg) {
    this.cfg = {};
    for (var k in DEFAULTS) { this.cfg[k] = DEFAULTS[k]; }
    if (cfg) { for (var k2 in cfg) { this.cfg[k2] = cfg[k2]; } }
    this.events = [];          /* [{start,end,viseme}] sorted, non-overlapping */
    this.output = copyPose(TARGETS.REST);
    this.previousTime = undefined;
  }

  LipSyncController.prototype.setEvents = function (events) {
    /* Copy + sort by start (spec expects sorted, non-overlapping). */
    this.events = (events || []).slice().sort(function (a, b) {
      return a.start - b.start;
    });
    this.reset();
  };

  LipSyncController.prototype.reset = function () {
    this.output = copyPose(TARGETS.REST);
    this.previousTime = undefined;
  };

  /* Binary search: first event whose end + release is still > time. */
  LipSyncController.prototype.firstRelevant = function (time) {
    var lo = 0, hi = this.events.length, cfg = this.cfg;
    while (lo < hi) {
      var mid = (lo + hi) >>> 1;
      if (this.events[mid].end + cfg.release <= time) { lo = mid + 1; }
      else { hi = mid; }
    }
    return lo;
  };

  LipSyncController.prototype.sample = function (time) {
    if (!Number.isFinite(time)) {
      throw new Error('Audio time must be finite');
    }
    var cfg = this.cfg;
    var target = copyPose(TARGETS.REST);
    var totalWeight = 0;
    var activity = 0;
    var closure = 0;

    var i = this.firstRelevant(time);
    for (; i < this.events.length; i++) {
      var ev = this.events[i];
      /* Events are sorted by start; once start - anticipation > time, done. */
      if (ev.start - cfg.anticipation > time) { break; }

      var attack = smoothstep((time - (ev.start - cfg.anticipation)) / cfg.anticipation);
      var release = smoothstep((ev.end + cfg.release - time) / cfg.release);
      var weight = attack * release;
      if (weight <= 0) { continue; }

      var tgt = TARGETS[ev.viseme] || TARGETS.REST;
      for (var k = 0; k < KEYS.length; k++) {
        target[KEYS[k]] += tgt[KEYS[k]] * weight;
      }
      totalWeight += weight;
      activity += weight;
      if (ev.viseme === 'MBP') { closure = Math.max(closure, weight); }
    }

    var pose;
    if (totalWeight > 1e-6) {
      for (var k2 = 0; k2 < KEYS.length; k2++) {
        target[KEYS[k2]] /= totalWeight;
      }
      pose = target;
    } else {
      pose = copyPose(TARGETS.REST);
    }

    /* Blend toward neutral by activity level so silence settles to REST. */
    var act = clamp01(activity);
    if (act < 1) {
      for (var k3 = 0; k3 < KEYS.length; k3++) {
        pose[KEYS[k3]] = lerp(TARGETS.REST[KEYS[k3]], pose[KEYS[k3]], act);
      }
    }

    /* Seek / discontinuity detection: hard reset, no interpolation. */
    var prev = this.previousTime;
    var dt = (prev === undefined) ? Infinity : (time - prev);
    var discontinuous = prev === undefined || !Number.isFinite(dt) || dt < 0 || dt > 0.25;
    if (discontinuous) {
      this.output = copyPose(pose);
    } else {
      /* Exponential smoothing with cfg.smoothing time constant. */
      var a = 1 - Math.exp(-dt / Math.max(1e-6, cfg.smoothing));
      for (var k4 = 0; k4 < KEYS.length; k4++) {
        this.output[KEYS[k4]] = lerp(this.output[KEYS[k4]], pose[KEYS[k4]], a);
      }
    }

    /* Speech constraints (after smoothing). */
    this.output.lipSeal = Math.max(this.output.lipSeal, closure);
    this.output.jawOpen = Math.min(this.output.jawOpen, 1 - closure * 0.98);
    this.output.tongueForward *= 1 - closure;

    for (var k5 = 0; k5 < KEYS.length; k5++) {
      this.output[KEYS[k5]] = clamp01(this.output[KEYS[k5]]);
    }

    this.previousTime = time;
    return copyPose(this.output);
  };

  /* --- Phoneme -> viseme front end (visual targets) --- */
  var PHONEME_MAP = {
    /* bilabial closure */
    m: 'MBP', b: 'MBP', p: 'MBP',
    /* spread */
    iy: 'EE', ih: 'EE', i: 'EE',
    /* moderately open front */
    eh: 'EH', ae: 'EH',
    /* open */
    aa: 'AA', ah: 'AA', ao: 'AA', ow: 'AA',
    /* rounded */
    oh: 'OH', aw: 'OH',
    /* tighter rounded */
    uw: 'UW', u: 'UW', w: 'UW',
    /* lower lip -> upper teeth */
    f: 'FV', v: 'FV',
    /* tongue-tip */
    l: 'L',
    /* dental */
    th: 'TH',
    /* postalveolar */
    sh: 'SH_CH', ch: 'SH_CH', jh: 'SH_CH', zh: 'SH_CH',
    /* neutral default for the rest */
    t: 'TH', d: 'L', s: 'TH', z: 'TH', n: 'L', r: 'L', y: 'EE', k: 'EH', g: 'EH', hh: 'EH'
  };

  function phonemeToViseme(ph) {
    var p = (ph || '').toLowerCase().trim();
    if (!p) { return 'REST'; }
    return PHONEME_MAP[p] || 'REST';
  }

  /* --- ElevenLabs with-timestamps -> viseme event track ---
     Accepts an array of {characters, character_start_times_seconds,
     character_end_times_seconds, ...} per word. Maps characters to
     phoneme-ish visemes by merging identical consecutive visemes. */
  function eventsFromTimestampedWords(words, opts) {
    opts = opts || {};
    var minGap = opts.minGap || 0.012;      /* merge gap tolerance (s) */
    var minDur = opts.minDur || 0.030;      /* drop ultra-short events */
    var events = [];
    var pending = null;

    function flush(viseme, start, end) {
      if (end - start >= minDur) { events.push({ start: start, end: end, viseme: viseme }); }
    }

    (words || []).forEach(function (word) {
      var starts = word.character_start_times_seconds || [];
      var ends = word.character_end_times_seconds || [];
      var chars = (word.characters || '').toLowerCase();
      for (var c = 0; c < chars.length && c < starts.length && c < ends.length; c++) {
        var viseme = phonemeToViseme(chars[c]);
        var s = starts[c], e = ends[c];
        if (!pending) { pending = { viseme: viseme, start: s, end: e }; continue; }
        if (viseme === pending.viseme || (s - pending.end) <= minGap) {
          pending.viseme = viseme; /* keep latest label if merged */
          pending.end = e;
        } else {
          flush(pending.viseme, pending.start, pending.end);
          pending = { viseme: viseme, start: s, end: e };
        }
      }
    });
    if (pending) { flush(pending.viseme, pending.start, pending.end); }
    return events;
  }

  /* --- Letter/digraph -> viseme front end (ElevenLabs alignments are
     literal characters, not phonemes). Digraphs handled first. --- */
  var DIGRAPHS = { th: 'TH', sh: 'SH_CH', ch: 'SH_CH', ph: 'FV', wh: 'UW', ck: 'EH', ng: 'OH', qu: 'UW' };
  var CHAR_VISEME = {
    m: 'MBP', b: 'MBP', p: 'MBP',
    f: 'FV', v: 'FV',
    w: 'UW', u: 'UW', o: 'OH',
    e: 'EH', a: 'AA', i: 'EE', y: 'EE',
    l: 'L', r: 'L',
    t: 'EH', d: 'EH', n: 'EH', s: 'EH', z: 'EH', c: 'EH', k: 'EH', g: 'EH', j: 'EH', x: 'EH', h: 'EH'
  };

  function letterToViseme(seq) {
    var s = (seq || '').toLowerCase();
    if (DIGRAPHS[s]) { return DIGRAPHS[s]; }
    return CHAR_VISEME[s[0]] || null;   /* null = punctuation/space/unknown */
  }

  /* Flat character alignment (ElevenLabs /with-timestamps) -> viseme events.
     Consecutive same-viseme characters merge; gaps become implicit REST. */
  function eventsFromCharacters(chars, starts, ends, opts) {
    opts = opts || {};
    var minDur = opts.minDur || 0.030;
    var events = [];
    var pending = null;

    function flush() {
      if (pending && (pending.end - pending.start) >= minDur) {
        events.push({ start: pending.start, end: pending.end, viseme: pending.viseme });
      }
      pending = null;
    }

    for (var i = 0; i < chars.length; i++) {
      var raw = chars[i];
      var v = null;
      if (/[a-z]/i.test(raw)) {
        var two = (raw + (chars[i + 1] || '')).toLowerCase();
        if (DIGRAPHS[two] && !/^[a-z]$/i.test(chars[i + 1] || '') === false) {
          /* digraph only if the pair maps via DIGRAPHS and next char is a letter */
          v = DIGRAPHS[two];
          i++; /* consume both chars */
          if (pending) { pending.end = ends[i]; }
          else { pending = { viseme: v, start: starts[i - 1], end: ends[i] }; }
          if (pending.viseme !== v) { flush(); pending = { viseme: v, start: starts[i - 1], end: ends[i] }; }
          continue;
        }
        v = letterToViseme(raw);
      }
      if (!v) { flush(); continue; }   /* space/punctuation closes the mouth */
      if (pending && pending.viseme === v) { pending.end = ends[i]; }
      else { flush(); pending = { viseme: v, start: starts[i], end: ends[i] }; }
    }
    flush();
    return events;
  }

  /* Export. */
  root.LipSyncController = LipSyncController;
  root.LipSyncTargets = TARGETS;
  root.LipSyncPhonemeMap = PHONEME_MAP;
  root.phonemeToViseme = phonemeToViseme;
  root.eventsFromTimestampedWords = eventsFromTimestampedWords;
  root.eventsFromCharacters = eventsFromCharacters;
  root.letterToViseme = letterToViseme;
})(typeof window !== 'undefined' ? window : this);
