/* ===============================================================
   OutLoud 2.0 — SPEECH DIRECTOR (voice stack)
   Ported from bc-ai-site/outloud/marina-agent.js ( ElevenLabs flash
   v2_5 per-site voice → mp3 → <audio> playback ). Ported, not
   symlinked: the runtime owns playback and emits speech events the
   orchestrator can cancel.

   STREAMING (spec: "response streams rather than waiting for the
   full answer"): the plan's speech.chunks are played SEQUENTIALLY
   with one-chunk-ahead prefetch, so audio starts after the first
   chunk is synthesized instead of after the whole reply. That is
   real perceived streaming today.

   TODO(edge): true token-streaming TTS (WebSocket to ElevenLabs or
   an edge proxy) — the speakStream() interface below is final and
   already drives lip-sync + transcript progressively.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;
  var SECRETS = window.OUTLOUD.SECRETS;

  function SpeechDirector(bus) {
    this.bus = bus;
    this.audio = null;      // current <audio>
    this.aborted = false;
    this.speaking = false;
    this.onChunkStart = null;  // runtime hook (transcript ticker)
    this.onDone = null;
    this.muted = false;
    this.sink = null;       // optional video sink (SimliDirector) — takes blobs when live
  }

  SpeechDirector.prototype.ttsFetch = function (text) {
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 7000); /* never hang the voice */
    return fetch(CONFIG.endpoints.outloud, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': CONFIG.endpoints.publishableKey },
      body: JSON.stringify({ action: 'tts', text: text, voiceId: CONFIG.voice.voiceId }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) { throw new Error('tts ' + res.status); }
      return res.blob();
    }).catch(function (e) { clearTimeout(timer); throw e; });
  };

  /* Browser TTS fallback — honest, labeled. Used when ElevenLabs
     fails (offline, key, network) so the answer is still spoken.
     If browser TTS is missing too, the text still reaches the
     transcript: voice failure must never leave the visitor with
     an empty conversation rail. */
  SpeechDirector.prototype.speakFallback = function (text) {
    var self = this;
    var synth = window.speechSynthesis;
    if (!(synth && window.SpeechSynthesisUtterance)) {
      /* No voice at all: put the whole reply on the transcript. */
      self.bus.publish('speech.chunk.start', { text: text, silent: true });
      if (self.onChunkStart) { self.onChunkStart(text); }
      self.speaking = false;
      self.bus.publish('speech.end', { fallback: true, silent: true });
      if (self.onDone) { self.onDone(); }
      return;
    }
    var started = false;
    var u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    u.onstart = function () {
      started = true;
      /* Fallback still walks the transcript so the page stays in sync. */
      self.bus.publish('speech.chunk.start', { text: text });
      if (self.onChunkStart) { self.onChunkStart(text); }
    };
    u.onend = function () {
      self.speaking = false;
      self.bus.publish('speech.end', { fallback: true });
      if (self.onDone) { self.onDone(); }
    };
    u.onerror = function () {
      if (!started) {
        /* Utterance never began: land the text on the transcript. */
        self.bus.publish('speech.chunk.start', { text: text, silent: true });
        if (self.onChunkStart) { self.onChunkStart(text); }
      }
      self.speaking = false;
      self.bus.publish('speech.end', { fallback: true, failed: true });
      if (self.onDone) { self.onDone(); }
    };
    self.bus.publish('speech.start', { fallback: true });
    synth.speak(u);
  };

  /* Play one audio blob through a fresh <audio> (ownership stays here). */
  SpeechDirector.prototype.playBlob = function (blob, chunkText) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var a = new Audio(URL.createObjectURL(blob));
      self.audio = a;
      self.bus.publish('speech.audio', { el: a });   /* avatar routes it through the lip-sync analyser */
      self.bus.publish('speech.chunk.start', { text: chunkText || '' });
      if (self.onChunkStart) { self.onChunkStart(chunkText || ''); }
      /* Watchdog: a stalled <audio> must never freeze the turn. */
      var settled = false, guard = setTimeout(function () { finish(); }, 20000);
      function finish(err) {
        if (settled) { return; }
        settled = true; clearTimeout(guard);
        if (err) { reject(err); } else { resolve(); }
      }
      a.onloadedmetadata = function () {
        if (isFinite(a.duration) && a.duration > 0) {
          clearTimeout(guard);
          guard = setTimeout(function () { finish(); }, a.duration * 1000 + 2500);
        }
      };
      a.onended = function () { finish(); };
      a.onerror = function () { finish(new Error('audio playback failed')); };
      a.play().catch(function () { finish(new Error('autoplay blocked')); });
    });
  };

  /* Entry point used by the renderer. plan.speech has text + chunks. */
  SpeechDirector.prototype.speak = function (speech) {
    var self = this;
    self.aborted = false;
    self.speaking = true;
    var chunks = (speech.chunks && speech.chunks.length) ? speech.chunks : [speech.text];

    if (self.muted) {
      /* Silent run: still walk the transcript so the page stays alive. */
      var walk = function (i) {
        if (self.aborted) { return; }
        if (i >= chunks.length) { self.speaking = false; self.bus.publish('speech.end', { muted: true }); if (self.onDone) { self.onDone(); } return; }
        if (self.onChunkStart) { self.onChunkStart(chunks[i]); }
        setTimeout(function () { walk(i + 1); }, Math.max(900, chunks[i].length * 34));
      };
      walk(0);
      return;
    }

    var i = 0;
    var prefetch = null; /* blob of chunk[i] fetched while chunk[i-1] plays */

    function fetchChunk(idx) {
      return self.ttsFetch(chunks[idx]).catch(function () { return null; });
    }

    function next() {
      if (self.aborted) { return; }
      if (i >= chunks.length) {
        self.speaking = false;
        self.bus.publish('speech.end', {});
        if (self.onDone) { self.onDone(); }
        return;
      }
      var ci = i;
      var use = prefetch || fetchChunk(ci);
      prefetch = (ci + 1 < chunks.length) ? fetchChunk(ci + 1) : null; /* stream-ahead */
      i += 1;
      use.then(function (blob) {
        if (self.aborted) { return; }
        if (!blob) { /* provider failed mid-plan → finish via browser TTS */
          self.speakFallback(chunks.slice(ci).join(' '));
          return;
        }
        if (self.sink && typeof self.sink.ready === 'function' && self.sink.ready()) {
          /* Sink path still walks the transcript — the rail must show
             the reply while the video face speaks it. */
          self.bus.publish('speech.chunk.start', { text: chunks[ci] || '' });
          if (self.onChunkStart) { self.onChunkStart(chunks[ci] || ''); }
          return self.sink.playBlob(blob, '').then(next);
        }
        return self.playBlob(blob, chunks[ci]).then(next);
      }).catch(function () {
        self.speakFallback(chunks.slice(ci).join(' '));
      });
    }
    next();
  };

  /* Short "thinking" lines played while the brain works, so the
     avatar never sits silent. Pre-synthesized once per session. */
  var FILLERS = ['One sec, let me work that out.', 'Good question, give me a second.', 'Okay, let me check that for you.'];
  SpeechDirector.prototype.warmFillers = function () {
    var self = this;
    if (self._fillers) { return; }
    self._fillers = [];
    FILLERS.forEach(function (t) {
      self.ttsFetch(t).then(function (b) { self._fillers.push(b); }).catch(function () {});
    });
  };
  SpeechDirector.prototype.filler = function () {
    var self = this;
    if (self.muted || !self._fillers || !self._fillers.length) { return; }
    var blob = self._fillers[(self._fi = ((self._fi || 0) + 1)) % self._fillers.length];
    self.bus.publish('speech.filler', {});
    if (self.sink && self.sink.ready && self.sink.ready()) { self.sink.playBlob(blob, '').catch(function () {}); return; }
    var a = new Audio(URL.createObjectURL(blob));
    self.fillerAudio = a;
    self.bus.publish('speech.audio', { el: a });
    a.play().catch(function () {});
  };
  SpeechDirector.prototype.stopFiller = function () {
    if (this.fillerAudio) { try { this.fillerAudio.pause(); } catch (e) {} this.fillerAudio = null; }
  };

  SpeechDirector.prototype.cancel = function () {
    this.stopFiller();
    this.aborted = true;
    if (this.audio) { try { this.audio.pause(); } catch (e) {} this.audio = null; }
    try { if (window.speechSynthesis) { window.speechSynthesis.cancel(); } } catch (e) {}
    if (this.speaking) {
      this.speaking = false;
      this.bus.publish('speech.cancelled', {});
    }
  };

  SpeechDirector.prototype.setMuted = function (m) {
    this.muted = !!m;
    if (m) { try { if (this.audio) { this.audio.pause(); } } catch (e) {} try { if (window.speechSynthesis) { window.speechSynthesis.cancel(); } } catch (e) {} }
  };

  window.OUTLOUD = window.OUTLOUD || {};
  window.OUTLOUD.SpeechDirector = SpeechDirector;
})();
