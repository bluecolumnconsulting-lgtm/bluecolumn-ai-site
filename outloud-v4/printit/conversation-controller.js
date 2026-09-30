/* ===============================================================
   OutLoud 2.0 — CONVERSATION CONTROLLER
   Browser port of OutLoud-conversation-controller (ConversationSession
   + InterruptiblePlayback), installed 2026-09-29 from the BlueColumn
   database drop (namespace nl, doc sess_ezs8ane7 / sess_olvjcjhi).

   Division of labor (no double-cancel, no double-submit):
     • The Orchestrator already owns cancel-and-replace: its
       'vad.speechStart' handler barges in during RESPONDING and its
       'transcript.final' handler cancels an in-flight turn before
       submitting the new one. The controller rides the SAME events
       and adds what the orchestrator does not have:
         – revision tokens (stale-turn detection for audio/frames)
         – bounded replies (cleanReply hard cap, used by the planner)
         – conversation history retention for the next generation
         – avatar.state lifecycle events (listening / speaking / idle)
         – InterruptiblePlayback: the audio.frame queue contract for
           the edge transport upgrade (decode → enqueue → clear)
   Does NOT change lip-sync: audio still flows through SpeechDirector
   and the avatar analyser (spec: "does not change the existing lip
   sync implementation").
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;

  /* ---------- bounded replies (hard cap, controller contract) ---------- */
  function clean(text, maxWords) {
    var t = String(text || '').trim();
    var words = t.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) { return t; }
    var kept = words.slice(0, maxWords).join(' ');
    var m = kept.match(/^(.*[.!?])(\s|$)/);
    return m ? m[1] : kept;
  }

  /* Sentence chunker — mirrors response-planner so the capped text
     still streams chunk-by-chunk through the voice. */
  function chunk(text) {
    var parts = String(text).split(/(?<=[.!?])\s+/);
    if (parts.length < 2) { return [String(text)]; }
    var chunks;
    if (parts[0].length <= 220) {
      chunks = [parts[0]];
      parts = parts.slice(1);
    } else {
      chunks = [];
    }
    var buf = '';
    parts.forEach(function (p) {
      buf += (buf ? ' ' : '') + p;
      if (buf.length > 110) { chunks.push(buf); buf = ''; }
    });
    if (buf) { chunks.push(buf); }
    return chunks;
  }

  /* ---------- InterruptiblePlayback (src/client.js port) ----------
     Browser playback contract. Feed provider-decoded AudioBuffer
     chunks to enqueue(); audio.clear stops and discards everything
     queued; audio.end sets idle only when the last scheduled frame
     finishes. Ships for the edge-transport upgrade (audio.frame path);
     the local SpeechDirector queue honors the same semantics today. */
  function InterruptiblePlayback(context, onState) {
    this.context = context;
    this.onState = onState || function () {};
    this.sources = [];
    this.nextAt = 0;
    this.revision = 0;
    this.ended = false;
  }
  InterruptiblePlayback.prototype.count = function () { return this.sources.length; };
  InterruptiblePlayback.prototype.add = function (s) { this.sources.push(s); };
  InterruptiblePlayback.prototype.remove = function (s) {
    var i = this.sources.indexOf(s);
    if (i !== -1) { this.sources.splice(i, 1); }
  };
  InterruptiblePlayback.prototype.handle = function (event) {
    if (event.type === 'audio.clear') {
      this.revision = event.revision;
      var keep = [];
      this.sources.forEach(function (s) {
        try { s.stop(); } catch (e) { keep.push(s); }
      });
      this.sources = keep;
      this.nextAt = 0;
      this.ended = false;
      this.onState('listening');
    } else if (event.type === 'audio.end') {
      this.ended = true;
      if (!this.sources.length) { this.onState('idle'); }
    } else if (event.type === 'avatar.state') {
      if (event.state) { this.onState(event.state); }
    }
  };
  InterruptiblePlayback.prototype.enqueue = function (buffer, revision) {
    if (revision !== undefined && revision !== this.revision) { return; }  /* stale frame — discard */
    var src = this.context.createBufferSource();
    src.buffer = buffer;
    src.connect(this.context.destination);
    var startAt = Math.max(this.context.currentTime, this.nextAt);
    try { src.start(startAt); } catch (e) { return; }
    this.nextAt = startAt + buffer.duration;
    var self = this;
    src.onended = function () {
      self.remove(src);
      if (self.ended && !self.sources.length) { self.onState('idle'); }
    };
    this.add(src);
  };

  /* ---------- ConversationSession (src/conversation.js port) ---------- */
  function ConversationSession(deps) {
    if (!deps || !deps.bus || !deps.orch) { throw Error('Missing adapter'); }
    this.deps = deps;
    var cfg = CONFIG.controller || {};
    this.maxWords = cfg.maxAnswerWords || 90;
    this.historyLimit = cfg.historyLimit || 8;
    this.revision = 0;
    this.history = [];
    this.speaking = false;
    this.currentQ = null;
    this.replyBuf = '';
    this.replyId = null;
    this.closed = false;
    this._wire();
  }

  /* Is revision rev still the live turn? */
  ConversationSession.prototype.current = function (rev) {
    return !this.closed && rev === this.revision;
  };

  /* Mic VAD speech_start — accepted IMMEDIATELY, even while the
     avatar is speaking (controller contract #1). The audio clear
     itself is the Orchestrator's barge-in on the same event; here we
     stamp the revision so any in-flight or queued audio from the old
     turn is stale, and move the avatar to listening. */
  ConversationSession.prototype.speechStart = function (env) {
    if (this.closed) { return; }
    if (this.speaking || this.deps.orch.state === 'RESPONDING') {
      this.revision += 1;
      this.speaking = false;
      this.deps.bus.publish('avatar.state', { state: 'listening', revision: this.revision, duringPlayback: true });
    }
  };

  /* Only FINAL transcripts enter here (interim text stays on the
     caption rail — contract #1). The Orchestrator's transcript.final
     handler does the cancel-and-replace submit; the controller stamps
     the revision, opens the turn record, and marks the avatar. */
  ConversationSession.prototype.transcriptFinal = function (env) {
    if (this.closed) { return; }
    var text = env && env.payload ? env.payload.text : env;
    if (!text || !String(text).trim()) { return; }
    var wasLive = this.speaking || this.deps.orch.state === 'RESPONDING' || this.deps.orch.state === 'PROCESSING';
    this.revision += 1;
    if (wasLive) {
      this.speaking = false;
      this.deps.bus.publish('avatar.state', { state: 'listening', revision: this.revision, duringPlayback: this.speaking });
    }
    this.currentQ = String(text).trim();
    this.replyBuf = '';
    this.replyId = null;
    this.deps.bus.publish('avatar.state', { state: 'thinking', revision: this.revision });
  };

  ConversationSession.prototype.close = function () {
    this.closed = true;
    this.revision += 1;
    this.speaking = false;
  };

  ConversationSession.prototype._wire = function () {
    var self = this;
    /* Accumulate the spoken reply per responseId for history. */
    this.deps.bus.on('transcript.outloud', function (env) {
      if (self.replyId === env.payload.responseId) {
        self.replyBuf += ' ' + env.payload.text;
      } else {
        self.replyId = env.payload.responseId;
        self.replyBuf = env.payload.text;
      }
    });
    this.deps.bus.on('response.start', function () {
      self.speaking = true;
      self.deps.bus.publish('avatar.state', { state: 'speaking', revision: self.revision });
    });
    this.deps.bus.on('speech.end', function () { self._endTurn('idle'); });
    this.deps.bus.on('speech.cancelled', function () { self.speaking = false; });
    this.deps.bus.on('error', function () { self.speaking = false; });
  };

  ConversationSession.prototype._endTurn = function (finalState) {
    this.speaking = false;
    if (this.replyBuf && this.currentQ) {
      this.history.push({ question: this.currentQ, answer: this.replyBuf.trim() });
      if (this.history.length > this.historyLimit) { this.history.shift(); }
    }
    this.currentQ = null;
    this.replyBuf = '';
    this.replyId = null;
    this.deps.bus.publish('avatar.state', { state: finalState || 'idle', revision: this.revision });
  };

  window.OUTLOUD = window.OUTLOUD || {};
  window.OUTLOUD.ConversationSession = ConversationSession;
  window.OUTLOUD.InterruptiblePlayback = InterruptiblePlayback;
  window.OUTLOUD.cleanReply = clean;
  window.OUTLOUD.chunkReply = chunk;
})();
