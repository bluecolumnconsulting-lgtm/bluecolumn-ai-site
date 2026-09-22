/* ===============================================================
   OutLoud 2.0 — AVATAR DIRECTOR (2D sprite adapter)
   Extended from bc-ai-site/outloud/mascot-rig.js. Ported, not linked.

   Spec requirements implemented here:
     • Lip-sync runs INDEPENDENT of body gestures and gaze — three
       channels write disjoint CSS properties on nested wrappers:
         face    → #mascot  background-position (12-cell viseme rig)
         gaze    → #mascot-gaze  transform (smooth look targets)
         gesture → #mascot-gesture transform (body channel)
       They never fight for the same property, so the mouth keeps
       articulating while the body enters/holds/releases a gesture.
     • Body gestures use the spec's entry/hold/release envelope:
         gesture.play({ name, intensity, entryMs, holdMs, releaseMs })
       and are blendable + cancellable (cancellation = fast safe
       release; a new gesture fast-releases the old one, never
       locking the avatar in a pose).
     • Gaze: gaze.set({ target, transitionMs, holdMs, returnTarget })
       — user, content_panel, form, gallery, cta, map (panel:<id>
       resolves real DOM panels). Smooth, never snapping.
     • High-priority interruption (barge-in) overrides all scheduled
       gestures via cancelAll().

   Honest approximations (documented in BUILD-NOTES-2-0.md):
     • Sprite rig has no separate arm layer → point_* gestures are
       degraded by the validator to present_*; "present" is rendered
       as a directional lean + prismatic glow toward the target.
     • Expressions are CSS filter/tilt approximations, not sprites.
   =============================================================== */
(function () {
  'use strict';

  /* 4×3 sprite sheet, verified frame map (from mascot-rig.js audit):
     0 rest/closed   1 closed seam (M/B/P)  2 big open, tongue   3 EH spread
     4 wide grin     5 tiny O (OO)         6 small O (OH)       7 mid-open grin
     8 tall open (L/TH) 9 ER mid oval     10 clenched S        11 W pucker */
  var A = (window.OUTLOUD.CONFIG || {}).avatar || {}; var COLS = A.cols || 4, ROWS = A.rows || 3;

  function AvatarDirector(bus, opts) {
    this.bus = bus;
    this.opts = opts || {};
    this.mount = null;
    this.mascot = null;
    this.gazeEl = null;
    this.gestureEl = null;
    this.glow = null;
    this.cur = -1;
    this.frameHoldUntil = 0;
    this.lastTick = 0;
    this.raf = 0;
    this.rigOn = false;
    this.actx = null;
    this.analyser = null;
    this.freq = null;
    this.routed = typeof WeakSet === 'function' ? new WeakSet() : [];
    this.gestureRAF = 0;
    this.timers = [];
    this.currentGesture = null;
    this.pulseTimer = 0;
    /* viseme state machine (Arcadia port): pose + hold tracking */
    this.pose = 0;
    this.poseSince = 0;
    this.noiseFloor = 0;
    this.lastDb = undefined;
  }

  /* ---------- mount: build the channel-nested DOM ---------- */
  AvatarDirector.prototype.attach = function (host) {
    var self = this;
    host.innerHTML =
      '<div id="mascot-gesture" class="ol-avatar-gesture">' +
        '<div id="mascot-gaze" class="ol-avatar-gaze">' +
          '<div id="mascot" class="ol-avatar-face"></div>' +
        '</div>' +
        '<div id="mascot-glow" class="ol-avatar-glow" aria-hidden="true"></div>' +
      '</div>';
    this.mount = host;
    this.mascot = host.querySelector('#mascot');
    this.gazeEl = host.querySelector('#mascot-gaze');
    this.gestureEl = host.querySelector('#mascot-gesture');
    this.glow = host.querySelector('#mascot-glow');
    this.mascot.style.backgroundImage = 'url(' + this.opts.sprite + ')';
    this.mascot.style.backgroundSize = (COLS * 100) + '% ' + (ROWS * 100) + '%';
    this.setFrame(0);
    this.setExpression(this.opts.baseline && this.opts.baseline.emotion || 'friendly', 0.6);
    /* rAF loop runs always; cheap no-op when rig is off. */
    if (!this.raf) { this.raf = requestAnimationFrame(function (t) { self.tick(t); }); }
  };

  /* ---------- FACE channel (visemes / lip-sync) ---------- */
  AvatarDirector.prototype.setFrame = function (i) {
    if (COLS < 2 || ROWS < 2) { return; } /* static fallback image: no rig grid */
    if (i === this.cur || !this.mascot) { return; }
    this.cur = i;
    var x = (i % COLS) / (COLS - 1) * 100;
    var y = Math.floor(i / COLS) / (ROWS - 1) * 100;
    this.mascot.style.backgroundPosition = x.toFixed(2) + '% ' + y.toFixed(2) + '%';
  };

  AvatarDirector.prototype.tick = function (t) {
    var self = this;
    this.raf = requestAnimationFrame(function (tt) { self.tick(tt); });
    if (!this.rigOn || !this.mascot) { return; }
    if (t - this.lastTick < 45) { return; } /* ~22fps cap */
    this.lastTick = t;

    if (this.analyser && this.activeEl && !this.activeEl.paused) {
      /* =========================================================
         VISEME CLASSIFIER v2 — ported from the Arcadia
         LipSyncEngine (Web Audio AnalyserNode approach):
           • RMS envelope in dB above an ADAPTIVE noise floor
           • low/mid/high spectral band energy for phoneme class
           • transient (consonant burst) detection
           • HYSTERESIS + HOLD state machine — the mouth never
             flickers between adjacent poses on quiet syllables
         Mapped onto our verified 12-frame viseme rig.
         ========================================================= */
      this.analyser.getByteFrequencyData(this.freq);

      /* --- dB envelope with adaptive noise floor --- */
      var sum2 = 0, i, n = 0, bin;
      for (i = 2; i < 160; i++) { bin = this.freq[i] / 255; sum2 += bin * bin; n++; }
      var rms = Math.sqrt(sum2 / Math.max(1, n));
      var db = 20 * Math.log10(rms + 1e-6);
      if (!this.noiseFloor) { this.noiseFloor = db - 10; }
      /* track the floor downward fast, upward slowly — silence pulls
         it down, residual room tone pulls it up slowly */
      this.noiseFloor = Math.min(this.noiseFloor + 0.35, Math.max(-60, db));
      var voiced = db > this.noiseFloor + 6;

      /* --- transient detection: consonant bursts jump instantly --- */
      var dbDelta = db - (this.lastDb === undefined ? db : this.lastDb);
      this.lastDb = db;
      var burst = voiced && dbDelta > 3.5;

      if (!voiced) {
        if (t - (this.poseSince || 0) > 120) { this.setPose('REST', t); }
        return;
      }

      /* --- spectral band classification --- */
      var low = this.band(2, 10), mid = this.band(11, 60), hi = this.band(61, 160);
      var s = low + mid + hi || 1;
      var lowS = low / s, hiS = hi / s;
      var cand = burst
        ? (hiS >= 0.40 ? 10 : 4)                       /* S / wide burst */
        : this.classify(lowS, hiS, db);
      this.applyPose(cand, t, burst);
    } else {
      /* text-pulse fallback (browser TTS / muted walk) */
      if (t < this.frameHoldUntil) { return; }
      var phase = (Date.now() / 130) % 2;
      this.setFrame(phase < 1 ? 8 : 3);
      this.frameHoldUntil = t + 110;
    }
  };

  /* Phoneme-class → frame, with hysteresis: a pose holds for its
     minimum duration; a challenger must beat the incumbent by a
     margin (or arrive as a transient) before the pose switches. */
  AvatarDirector.prototype.classify = function (lowS, hiS, db) {
    if (lowS >= 0.55) { return db > -18 ? 2 : (db > -26 ? 6 : 5); }  /* big open / OH / OO */
    if (hiS >= 0.42) { return db > -24 ? 4 : 1; }                    /* wide grin / closed seam (FV/M) */
    if (db > -16) { return 8; }                                      /* tall open (L/TH) */
    if (db > -23) { return 3; }                                      /* EH spread */
    return 9;                                                        /* ER mid oval */
  };
  var POSE_HOLD = { 0: 120, 2: 100, 5: 130, 6: 110, 11: 110 };
  AvatarDirector.prototype.applyPose = function (cand, t, burst) {
    if (cand === this.pose) { return; }
    var held = t - (this.poseSince || 0);
    var needHold = POSE_HOLD[this.pose] || 90;
    if (held < needHold && !burst) { return; }   /* incumbent holds */
    this.pose = cand;
    this.poseSince = t;
    this.setFrame(cand);
  };
  AvatarDirector.prototype.setPose = function (name, t) {
    var map = { REST: 0 };
    this.pose = map[name] !== undefined ? map[name] : this.pose;
    this.poseSince = t || Date.now();
    this.setFrame(this.pose);
  };

  AvatarDirector.prototype.band = function (a, b) {
    var s = 0, i;
    for (i = a; i < b; i++) { s += this.freq[i]; }
    return s / (b - a) / 255;
  };

  /* Route a speech <audio> element through the rig's analyser.
     Called via the 'speech.audio' event from the runtime. */
  AvatarDirector.prototype.routeAudio = function (el) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || !el) { return; }
    if (!this.actx) {
      try { this.actx = new AC(); } catch (e) { return; }
    }
    if (this.actx.state === 'suspended') { try { this.actx.resume(); } catch (e) {} }
    if (!this.analyser) {
      try {
        this.analyser = this.actx.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.6;
        this.freq = new Uint8Array(this.analyser.frequencyBinCount);
      } catch (e) { return; }
    }
    var routed = this.routed.add ? this.routed.has(el) : this.routed.indexOf(el) !== -1;
    if (!routed) {
      try {
        var src = this.actx.createMediaElementSource(el);
        src.connect(this.analyser);
        this.analyser.connect(this.actx.destination);
        if (this.routed.add) { this.routed.add(el); } else { this.routed.push(el); }
      } catch (e) { return; }
    }
    this.activeEl = el;
  };

  AvatarDirector.prototype.lipSyncStart = function () {
    this.rigOn = true;
    if (this.mascot) { this.mascot.classList.add('speaking'); }
  };

  AvatarDirector.prototype.lipSyncStop = function () {
    this.rigOn = false;
    this.activeEl = null;
    this.pose = 0;
    this.poseSince = 0;
    this.noiseFloor = 0;
    if (this.mascot) { this.mascot.classList.remove('speaking'); }
    this.setFrame(4); /* friendly landing grin */
    var self = this;
    setTimeout(function () { if (!self.rigOn) { self.setFrame(0); } }, 900);
  };

  /* ---------- GAZE channel (independent transform) ---------- */
  var GAZE_DIRS = { user: { x: 0, r: 0 }, content_panel: { x: 5, r: 2.5 }, gallery: { x: -6, r: -2.5 }, form: { x: 6, r: 3 }, cta: { x: 0, r: 0 }, map: { x: -5, r: -2 } };

  AvatarDirector.prototype.resolveGaze = function (target) {
    if (target === 'user') { return GAZE_DIRS.user; }
    var key = GAZE_DIRS[target] !== undefined ? target : 'content_panel';
    var dir = GAZE_DIRS[key];
    /* If a real DOM panel exists, look toward its actual side. */
    var panel = document.getElementById(String(target).replace(/^panel:/, ''));
    if (panel && this.mount) {
      var pr = panel.getBoundingClientRect();
      var ar = this.mount.getBoundingClientRect();
      if (pr.right < ar.left) { dir = { x: -6, r: -3 }; }
      else if (pr.left > ar.right) { dir = { x: 6, r: 3 }; }
    }
    return dir;
  };

  AvatarDirector.prototype.gazeSet = function (spec) {
    var self = this;
    var dir = this.resolveGaze(spec.target);
    var ms = spec.transitionMs || 260;
    this.gazeEl.style.transition = 'transform ' + ms + 'ms cubic-bezier(.4,0,.2,1)';
    this.gazeEl.style.transform = 'translateX(' + dir.x + '%) rotate(' + dir.r + 'deg)';
    if (spec.holdMs && spec.returnTarget) {
      this.timers.push(setTimeout(function () {
        var back = self.resolveGaze(spec.returnTarget || 'user');
        self.gazeEl.style.transition = 'transform ' + ms + 'ms cubic-bezier(.4,0,.2,1)';
        self.gazeEl.style.transform = 'translateX(' + back.x + '%) rotate(' + back.r + 'deg)';
      }, (spec.transitionMs || 260) + (spec.holdMs || 0)));
    }
  };

  AvatarDirector.prototype.gazeNeutral = function () {
    if (!this.gazeEl) { return; }
    this.gazeEl.style.transition = 'transform 300ms cubic-bezier(.4,0,.2,1)';
    this.gazeEl.style.transform = 'translateX(0) rotate(0)';
  };

  /* ---------- GESTURE channel (body, envelope-driven) ---------- */
  var GESTURE_POSE = {
    present_right: { x: 5, y: -1, s: 1.01, r: 1.5, glow: 'right' },
    present_left: { x: -5, y: -1, s: 1.01, r: -1.5, glow: 'left' },
    present_center: { x: 0, y: -2, s: 1.02, r: 0, glow: 'center' },
    nod: { x: 0, y: 0, s: 1.0, r: 0, nod: true },
    lean_in: { x: 0, y: 1.5, s: 1.05, r: 0 }
  };

  AvatarDirector.prototype.gesturePlay = function (g) {
    var self = this;
    var pose = GESTURE_POSE[g.name];
    if (!pose || !this.gestureEl) { return; }
    this.cancelGesture(true); /* blend = fast release of the outgoing pose */
    var inten = typeof g.intensity === 'number' ? g.intensity : 0.6;
    var entryMs = g.entryMs || 260, holdMs = g.holdMs || 900, releaseMs = g.releaseMs || 380;
    var start = null;

    if (pose.glow) { this.showGlow(pose.glow, inten); }
    this.currentGesture = { name: g.name, cancelled: false };

    function targetTransform(p) {
      return 'translate(' + (pose.x * inten * p).toFixed(2) + '%,' + (pose.y * inten * p).toFixed(2) + '%) ' +
        'scale(' + (1 + (pose.s - 1) * inten * p).toFixed(4) + ') ' +
        'rotate(' + (pose.r * inten * p).toFixed(2) + 'deg)';
    }
    function release(cancelFast) {
      var rs = null, dur = cancelFast ? Math.min(180, releaseMs) : releaseMs;
      var r0 = null;
      function rstep(ts) {
        if (!r0) { r0 = ts; }
        var p = 1 - Math.min(1, (ts - r0) / dur);
        self.gestureEl.style.transform = targetTransform(p);
        if (p > 0) { self.gestureRAF = requestAnimationFrame(rstep); }
        else { self.hideGlow(); if (cancelFast === 'final') { self.currentGesture = null; } }
      }
      cancelAnimationFrame(self.gestureRAF);
      self.gestureRAF = requestAnimationFrame(rstep);
    }

    function astep(ts) {
      if (!start) { start = ts; }
      var t = ts - start;
      if (self.currentGesture && self.currentGesture.cancelled) { return; }
      if (t < entryMs) {
        var p = 1 - Math.pow(1 - t / entryMs, 3); /* ease-out entry */
        self.gestureEl.style.transform = targetTransform(p);
        self.gestureRAF = requestAnimationFrame(astep);
      } else if (t < entryMs + holdMs) {
        if (pose.nod) {
          var n = Math.sin((t - entryMs) / holdMs * Math.PI * 2) * 2.2 * inten;
          self.gestureEl.style.transform = 'translateY(' + n.toFixed(2) + '%)';
        } else {
          self.gestureEl.style.transform = targetTransform(1);
        }
        self.gestureRAF = requestAnimationFrame(astep);
      } else if (t < entryMs + holdMs + releaseMs) {
        release(false);
      } else {
        self.gestureEl.style.transform = 'translate(0,0) scale(1) rotate(0)';
        self.hideGlow();
        self.currentGesture = null;
      }
    }
    cancelAnimationFrame(this.gestureRAF);
    this.gestureRAF = requestAnimationFrame(astep);
    this._releaseFn = release;
  };

  AvatarDirector.prototype.cancelGesture = function (soft) {
    if (this.currentGesture) { this.currentGesture.cancelled = true; }
    cancelAnimationFrame(this.gestureRAF);
    if (this.gestureEl) {
      this.gestureEl.style.transition = 'transform ' + (soft ? 180 : 180) + 'ms ease-out';
      this.gestureEl.style.transform = 'translate(0,0) scale(1) rotate(0)';
      var self = this;
      setTimeout(function () { if (self.gestureEl) { self.gestureEl.style.transition = ''; } }, 200);
    }
    this.hideGlow();
    this.currentGesture = null;
  };

  AvatarDirector.prototype.showGlow = function (side, inten) {
    if (!this.glow) { return; }
    this.glow.className = 'ol-avatar-glow ol-glow-' + side;
    this.glow.style.opacity = String(0.25 + inten * 0.5);
  };
  AvatarDirector.prototype.hideGlow = function () {
    if (this.glow) { this.glow.style.opacity = '0'; }
  };

  /* ---------- EXPRESSION channel (CSS approximation) ---------- */
  var EXPR_FILTER = {
    friendly: 'saturate(1.08) brightness(1.02)',
    warm: 'saturate(1.16) brightness(1.04)',
    thinking: 'saturate(0.82) brightness(0.97)',
    alert: 'contrast(1.07) saturate(1.05)',
    concerned: 'saturate(0.8) brightness(0.94)'
  };

  AvatarDirector.prototype.setExpression = function (name, intensity) {
    if (!this.mascot) { return; }
    var f = EXPR_FILTER[name] || EXPR_FILTER.friendly;
    var k = typeof intensity === 'number' ? intensity : 0.6;
    this.mascot.style.filter = k > 0.85 ? f : (f + ' opacity(' + (0.72 + k * 0.28).toFixed(2) + ')');
    if (name === 'warm' || name === 'friendly') { this.setFrame(4); }
    if (name === 'thinking') { this.setFrame(9); }
  };

  /* ---------- Orchestration helpers ---------- */
  AvatarDirector.prototype.clearTimeline = function () {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  };

  AvatarDirector.prototype.runPlan = function (avatarSpec, responseStartMs) {
    var self = this;
    var t0 = responseStartMs;
    this.clearTimeline();
    var b = avatarSpec.baseline;
    if (b) {
      if (b.emotion) { this.setExpression(b.emotion, b.energy); }
      if (b.initialGaze) { this.timers.push(setTimeout(function () { self.gazeSet({ target: b.initialGaze, transitionMs: 300 }); }, 0)); }
    }
    (avatarSpec.expressions || []).forEach(function (e) {
      self.timers.push(setTimeout(function () { self.setExpression(e.name, e.intensity); }, e.at || 0));
    });
    (avatarSpec.gaze || []).forEach(function (z) {
      self.timers.push(setTimeout(function () { self.gazeSet(z); }, z.at || 0));
    });
    (avatarSpec.gestures || []).forEach(function (g) {
      self.timers.push(setTimeout(function () { self.gesturePlay(g); }, g.at || 0));
    });
  };

  /* High-priority interruption: overrides everything scheduled. */
  AvatarDirector.prototype.cancelAll = function () {
    this.clearTimeline();
    this.cancelGesture();
    this.gazeNeutral();
    this.lipSyncStop();
  };

  window.OUTLOUD = window.OUTLOUD || {};
  window.OUTLOUD.AvatarDirector = AvatarDirector;
})();
