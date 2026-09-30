/* ===============================================================
   OutLoud 2.0 — REALTIME INPUT LAYER
   Mic capture + energy VAD + streaming transcription + barge-in.

   Real in this build:
     • getUserMedia mic capture with Web Audio RMS energy VAD
       (vad.speechStart / vad.speechEnd events).
     • Web Speech recognition as the streaming transcriber —
       interim results publish transcript.partial, finals publish
       transcript.final. (Edge/model transcription is the upgrade
       path; the event contract below is final.)
     • Barge-in: VAD onset or any interim text while the runtime is
       RESPONDING publishes input.bargein → orchestrator cancels
       speech, lip-sync, gesture timeline, and pending content.

   TODO(edge): binary audio.chunk streaming to the server (the
   envelope event audio.chunk exists below and is emitted as a
   marker so the transport upgrade is additive).
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;

  function RealtimeInput(bus) {
    this.bus = bus;
    this.micOn = false;
    this.wantMic = false;
    this.recog = null;
    this.stream = null;
    this.actx = null;
    this.analyser = null;
    this.buf = null;
    this.speaking = false;
    this.hangover = 0;
    this.raf = 0;
    this.SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.suspended = false; // paused while OutLoud speaks (anti-echo)
  }

  RealtimeInput.prototype.supported = function () { return !!this.SR; };

  /* ---- Mic capture + VAD (independent of transcription) ---- */
  RealtimeInput.prototype.startVad = function () {
    var self = this;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || self.actx) { return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      self.stream = stream;
      self.actx = new AC();
      var src = self.actx.createMediaStreamSource(stream);
      self.analyser = self.actx.createAnalyser();
      self.analyser.fftSize = 512;
      src.connect(self.analyser);
      self.buf = new Uint8Array(self.analyser.frequencyBinCount);
      var tick = function () {
        if (!self.micOn) { return; }
        self.raf = requestAnimationFrame(tick);
        /* Anti-echo: while OutLoud speaks (suspended), the mic hears the
           avatar's own voice through the speakers — a VAD trigger here
           barge-ins the runtime against ITSELF and cancels every answer
           mid-sentence. Swallow VAD events while suspended. */
        if (self.suspended) { self.speaking = false; return; }
        self.analyser.getByteTimeDomainData(self.buf);
        var sum = 0, i, v;
        for (i = 0; i < self.buf.length; i++) { v = (self.buf[i] - 128) / 128; sum += v * v; }
        var rms = Math.sqrt(sum / self.buf.length);
        var now = Date.now();
        self.trackProsody(rms, now);
        if (rms > CONFIG.vad.rmsThreshold) {
          self.hangover = now + CONFIG.vad.hangoverMs;
          if (!self.speaking) {
            self.speaking = true;
            self.bus.publish('vad.speechStart', { rms: rms });
          }
        } else if (self.speaking && now > self.hangover) {
          self.speaking = false;
          self.bus.publish('vad.speechEnd', {});
        }
      };
      self.micOn = true;
      self.raf = requestAnimationFrame(tick);
      self.bus.publish('vad.ready', {});
    }).catch(function () {
      self.bus.publish('error', { where: 'mic', message: 'Microphone access denied — typing still works.' });
    });
  };

  /* ---- Voice feel (prosody): loudness, pace, pauses, pitch movement ----
     Collected per utterance from the same mic stream; summarized into a
     short plain-language hint sent with the question. */
  RealtimeInput.prototype.trackProsody = function (rms, now) {
    var p = this.pro || (this.pro = { start: 0, frames: 0, voiced: 0, sum: 0, peak: 0, pauses: 0, wasVoiced: false, pitches: [] });
    if (!p.start) { p.start = now; }
    p.frames++;
    var voiced = rms > CONFIG.vad.rmsThreshold;
    if (voiced) {
      p.voiced++; p.sum += rms; if (rms > p.peak) { p.peak = rms; }
      if (p.frames % 4 === 0 && this.actx) {
        var f = this.estimatePitch();
        if (f) { p.pitches.push(f); }
      }
    } else if (p.wasVoiced) { p.pauses++; }
    p.wasVoiced = voiced;
  };
  RealtimeInput.prototype.estimatePitch = function () {
    var b = this.buf, n = b.length, sr = this.actx.sampleRate, best = 0, bestLag = 0, lag, i, c;
    for (lag = Math.floor(sr / 400); lag < Math.min(n / 2, Math.floor(sr / 70)); lag++) {
      c = 0;
      for (i = 0; i < n - lag; i++) { c += (b[i] - 128) * (b[i + lag] - 128); }
      if (c > best) { best = c; bestLag = lag; }
    }
    return bestLag ? sr / bestLag : 0;
  };
  RealtimeInput.prototype.summarizeProsody = function (text) {
    var p = this.pro; this.pro = null;
    if (!p || p.voiced < 10) { return ''; }
    var secs = Math.max(0.5, (p.voiced / 60));
    var words = text.split(/\s+/).length;
    var wps = words / secs;
    var avg = p.sum / p.voiced;
    var tags = [];
    tags.push(wps > 3.2 ? 'speaking fast' : wps < 1.8 ? 'speaking slowly' : 'normal pace');
    tags.push(avg > 0.12 ? 'loud' : avg < 0.035 ? 'quiet' : 'normal volume');
    if (p.pauses > words / 3) { tags.push('many pauses (hesitant)'); }
    var ps = p.pitches;
    if (ps.length >= 4) {
      var mean = ps.reduce(function (a, x) { return a + x; }, 0) / ps.length;
      var sd = Math.sqrt(ps.reduce(function (a, x) { return a + (x - mean) * (x - mean); }, 0) / ps.length);
      tags.push(sd / mean > 0.25 ? 'lively, expressive pitch' : sd / mean < 0.1 ? 'flat, monotone pitch' : 'steady pitch');
      var h = Math.floor(ps.length / 2), a1 = 0, a2 = 0, k;
      for (k = 0; k < h; k++) { a1 += ps[k]; } for (k = h; k < ps.length; k++) { a2 += ps[k]; }
      if (a2 / (ps.length - h) > (a1 / h) * 1.12) { tags.push('rising at the end'); }
    }
    if (wps > 3.2 && avg > 0.12) { tags.push('possibly frustrated or urgent'); }
    else if (wps < 1.8 && avg < 0.035) { tags.push('possibly unsure or low energy'); }
    return tags.join(', ');
  };

  RealtimeInput.prototype.stopVad = function () {
    this.micOn = false;
    cancelAnimationFrame(this.raf);
    if (this.stream) { this.stream.getTracks().forEach(function (t) { t.stop(); }); this.stream = null; }
    if (this.actx) { try { this.actx.close(); } catch (e) {} this.actx = null; }
    this.speaking = false;
  };

  /* ---- Streaming transcription (Web Speech) ---- */
  RealtimeInput.prototype.startTranscription = function () {
    var self = this;
    if (!self.SR || self.recog) { return; }
    var r = new self.SR();
    r.lang = 'en-US';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = function (ev) {
      if (self.recog !== r) { return; }
      var fin = '', part = '', i, res;
      for (i = ev.resultIndex; i < ev.results.length; i++) {
        res = ev.results[i];
        if (res.isFinal) { fin += res[0].transcript; } else { part += res[0].transcript; }
      }
      if (part) { self.bus.publish('transcript.partial', { text: part }); }
      if (fin && fin.trim()) {
        self.lastProsody = self.summarizeProsody(fin.trim());
        self.bus.publish('transcript.final', { text: fin.trim(), prosody: self.lastProsody });
      }
    };
    r.onerror = function (ev) {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        self.wantMic = false;
        self.bus.publish('error', { where: 'mic', message: 'Voice input blocked — enable the mic in browser settings. Typing works everywhere.' });
      }
    };
    r.onend = function () {
      if (self.recog !== r) { return; }   /* stale recognizer — a newer one owns the mic */
      if (self.wantMic && !self.suspended) {
        /* Fast re-arm: recognition restarts in 200ms (was 300ms) so the
           mic is back live almost immediately after each answer. */
        setTimeout(function () { try { r.start(); } catch (e) {} }, 200);
      }
    };
    self.recog = r;
    try { r.start(); } catch (e) {}
  };

  RealtimeInput.prototype.stopTranscription = function () {
    if (this.recog) { try { this.recog.stop(); } catch (e) {} this.recog = null; }
  };

  RealtimeInput.prototype.start = function () {
    this.wantMic = true;
    this.startVad();
    this.startTranscription();
    this.bus.publish('audio.start', { vad: true, transcriber: 'webspeech' });
    /* TODO(edge): audio.chunk events with encoded PCM/Opus frames. */
    this.bus.publish('audio.chunk', { marker: true, note: 'edge streaming not wired yet' });
  };

  RealtimeInput.prototype.stop = function () {
    this.wantMic = false;
    this.stopTranscription();
    this.stopVad();
    this.bus.publish('audio.end', {});
  };

  /* Anti-echo: suspend recognition while OutLoud speaks. */
  RealtimeInput.prototype.suspend = function () {
    this.suspended = true;
    /* Drop the handle before stopping so resume() starts a fresh recognizer
       (a dead one left here made the page go deaf after the first answer). */
    var r = this.recog;
    this.recog = null;
    if (r) { try { r.stop(); } catch (e) {} }
  };
  RealtimeInput.prototype.resume = function () {
    var self = this;
    this.suspended = false;
    if (self.wantMic && self.SR) {
      /* Fast resume: 200ms (was 350ms) — the mic is back quickly after
         each answer so the next thing you say is heard immediately. */
      setTimeout(function () { try { self.startTranscription(); } catch (e) {} }, 200);
    }
  };

  /* Typed input follows the same transcript.final contract. */
  RealtimeInput.prototype.type = function (text) {
    var t = String(text || '').trim();
    if (t) { this.lastProsody = ''; this.bus.publish('transcript.final', { text: t, typed: true }); }
  };

  window.OUTLOUD = window.OUTLOUD || {};
  window.OUTLOUD.RealtimeInput = RealtimeInput;
})();
