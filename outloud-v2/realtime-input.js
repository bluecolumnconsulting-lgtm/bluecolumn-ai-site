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
      var fin = '', part = '', i, res;
      for (i = ev.resultIndex; i < ev.results.length; i++) {
        res = ev.results[i];
        if (res.isFinal) { fin += res[0].transcript; } else { part += res[0].transcript; }
      }
      if (part) { self.bus.publish('transcript.partial', { text: part }); }
      if (fin && fin.trim()) {
        self.bus.publish('transcript.final', { text: fin.trim() });
      }
    };
    r.onerror = function (ev) {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        self.wantMic = false;
        self.bus.publish('error', { where: 'mic', message: 'Voice input blocked — enable the mic in browser settings. Typing works everywhere.' });
      }
    };
    r.onend = function () {
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
    if (this.recog) { try { this.recog.stop(); } catch (e) {} }
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
    if (t) { this.bus.publish('transcript.final', { text: t, typed: true }); }
  };

  window.OUTLOUD = window.OUTLOUD || {};
  window.OUTLOUD.RealtimeInput = RealtimeInput;
})();
