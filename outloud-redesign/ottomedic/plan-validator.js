/* ===============================================================
   OutLoud 2.0 — RESPONSE PLAN VALIDATOR
   Spec: the validator must reject or REPAIR plans that:
     • request unsupported gestures, expressions, or gaze targets
     • use overlapping body gestures that cannot be blended
     • exceed maximum gesture intensity constraints
     • reference unavailable content IDs
     • schedule invalid time offsets
   …and return a DEGRADED but usable plan whenever possible
   (e.g. point_right → present_right; missing content dropped while
   the spoken answer is preserved).
   =============================================================== */
(function () {
  'use strict';

  var KNOWN_GESTURES = ['present_right', 'present_left', 'present_center', 'nod', 'lean_in',
    'point_right', 'point_left']; // point_* are known but degraded when avoidPointing/no arm layer
  var KNOWN_EXPRESSIONS = ['friendly', 'thinking', 'alert', 'warm', 'concerned'];
  var KNOWN_GAZE = ['user', 'content_panel', 'gallery', 'form', 'cta', 'map'];

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function overlaps(a, b) {
    return (a.at < b.at + (a.holdMs || 0) + (a.releaseMs || 0)) &&
           (b.at < a.at + (b.holdMs || 0) + (b.releaseMs || 0));
  }

  function validate(plan, opts) {
    var repairs = [];
    opts = opts || {};
    var con = opts.constraints || {};
    var contentIds = opts.contentIds || [];
    var out = JSON.parse(JSON.stringify(plan)); // deep copy; never mutate producer output

    out.avatar = out.avatar || { gestures: [], gaze: [], expressions: [] };
    out.avatar.gestures = out.avatar.gestures || [];
    out.avatar.gaze = out.avatar.gaze || [];
    out.avatar.expressions = out.avatar.expressions || [];
    out.content = out.content || [];

    /* --- Gestures: allowlist, intensity clamp, pointing policy --- */
    var allow = con.allowGestures || KNOWN_GESTURES;
    var maxInt = typeof con.maxGestureIntensity === 'number' ? con.maxGestureIntensity : 1;
    var kept = [], i, g;

    for (i = 0; i < out.avatar.gestures.length; i++) {
      g = out.avatar.gestures[i];
      if (KNOWN_GESTURES.indexOf(g.name) === -1) {
        repairs.push('gesture "' + g.name + '" unsupported → present_center');
        g.name = 'present_center';
      }
      if (allow.indexOf(g.name) === -1) {
        if (g.name.indexOf('point_') === 0 && con.avoidPointing !== false) {
          repairs.push('pointing disabled → present_right');
          g.name = 'present_right';
        } else if (allow.indexOf('present_center') !== -1) {
          repairs.push('gesture "' + g.name + '" not allowed → present_center');
          g.name = 'present_center';
        } else {
          repairs.push('gesture "' + g.name + '" dropped (not allowed)');
          continue;
        }
      }
      if (typeof g.intensity === 'number' && g.intensity > maxInt) {
        repairs.push('intensity ' + g.intensity + ' > max ' + maxInt + ' → clamped');
        g.intensity = maxInt;
      }
      g.entryMs = clamp(g.entryMs || 260, 60, 1200);
      g.holdMs = clamp(g.holdMs || 900, 0, 8000);
      g.releaseMs = clamp(g.releaseMs || 380, 60, 2000);
      g.at = clamp(g.at || 0, 0, 60000); // invalid/negative offsets repaired
      kept.push(g);
    }

    /* --- Overlapping body gestures: keep the first, drop the rest --- */
    var final = [];
    for (i = 0; i < kept.length; i++) {
      var clash = null, j;
      for (j = 0; j < final.length; j++) { if (overlaps(kept[i], final[j])) { clash = final[j]; break; } }
      if (clash) {
        repairs.push('gesture "' + kept[i].name + '" overlaps "' + clash.name + '" → dropped (not blendable)');
      } else {
        final.push(kept[i]);
      }
    }
    out.avatar.gestures = final;

    /* --- Gaze: known targets, keepEyeContact policy --- */
    var gazeOut = [];
    for (i = 0; i < out.avatar.gaze.length; i++) {
      var z = out.avatar.gaze[i];
      if (KNOWN_GAZE.indexOf(z.target) === -1 && !/^panel:/.test(z.target)) {
        repairs.push('gaze target "' + z.target + '" unknown → user');
        z.target = 'user';
      }
      if (con.keepEyeContact && z.target !== 'user' && !z.returnTarget) {
        z.returnTarget = 'user';
        repairs.push('keepEyeContact: gaze "' + z.target + '" will return to user');
      }
      z.transitionMs = clamp(z.transitionMs || 260, 80, 2000);
      z.holdMs = clamp(z.holdMs || 1600, 0, 10000);
      z.at = clamp(z.at || 0, 0, 60000);
      gazeOut.push(z);
    }
    out.avatar.gaze = gazeOut;

    /* --- Expressions --- */
    out.avatar.expressions = out.avatar.expressions.filter(function (e) {
      if (KNOWN_EXPRESSIONS.indexOf(e.name) === -1) {
        repairs.push('expression "' + e.name + '" unsupported → friendly');
        e.name = 'friendly';
      }
      e.intensity = clamp(typeof e.intensity === 'number' ? e.intensity : 0.6, 0, 1);
      return true;
    });

    /* --- Content: registry check; speech survives missing content --- */
    out.content = out.content.filter(function (c) {
      if (!c || !c.action || !c.target) { repairs.push('content item malformed → dropped'); return false; }
      if (['show', 'hide', 'update', 'highlight'].indexOf(c.action) === -1) {
        repairs.push('content action "' + c.action + '" unknown → show');
        c.action = 'show';
      }
      if (contentIds.length && contentIds.indexOf(c.target) === -1) {
        repairs.push('content id "' + c.target + '" unavailable → dropped (speech preserved)');
        return false;
      }
      c.at = clamp(c.at || 0, 0, 60000);
      return true;
    });

    /* --- Speech must always survive validation --- */
    if (!out.speech || typeof out.speech.text !== 'string' || !out.speech.text.trim()) {
      repairs.push('plan had no speech → fallback line injected');
      out.speech = { text: "Let me put that another way. What would you like to know about OttoMedic?", streamHint: false, chunks: [] };
    }

    return { plan: out, repairs: repairs, ok: repairs.length === 0 };
  }

  window.OUTLOUD = window.OUTLOUD || {};
  window.OUTLOUD.validatePlan = validate;
})();
