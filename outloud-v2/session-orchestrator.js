/* ===============================================================
   OutLoud 2.0 — SESSION ORCHESTRATOR
   Owns the session lifecycle state machine, cancellation, and event
   routing across every layer (spec: "Session Lifecycle State Machine"):

     IDLE ──▶ LISTENING ──▶ PROCESSING ──▶ RESPONDING ──▶ LISTENING
       ▲                                                        │
       └──────────────▶ CANCELLED ◀──── barge-in (any state) ───┘

   One turn:
     transcript.final → PROCESSING →
       knowledge.retrieve (Context 1) + memory.recall (Context 2)
       → planner.produce (Context 3) → plan-validator →
     RESPONDING → three parallel directors (speech / avatar / content)
     → speech.end → memory.propose applied + audit → LISTENING.

   Barge-in during RESPONDING cancels speech, lip-sync, timeline
   events, gestures, and pending content, then returns to LISTENING.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;

  var STATES = ['IDLE', 'LISTENING', 'PROCESSING', 'RESPONDING', 'CANCELLED'];

  function Orchestrator(bus, deps) {
    this.bus = bus;
    this.input = deps.input;           // RealtimeInput
    this.speech = deps.speech;         // SpeechDirector
    this.avatar = deps.avatar;         // AvatarDirector
    this.content = deps.content;       // ContentDirector
    this.memory = deps.memory;         // SessionMemory
    this.planner = deps.planner;       // ResponsePlanner
    this.state = 'IDLE';
    this.turnId = null;
    this.micWanted = false;
    this._wire();
  }

  Orchestrator.prototype._setState = function (s) {
    if (this.state === s) { return; }
    this.state = s;
    this.bus.publish('state.change', { state: s });
  };

  Orchestrator.prototype._wire = function () {
    var self = this;

    this.bus.on('transcript.final', function (env) {
      /* Barge-in: user speech while RESPONDING cancels the response. */
      if (self.state === 'RESPONDING') { self.bargeIn(env.payload.text); }
      self.submit(env.payload.text, env.payload.typed);
    });

    /* VAD-only barge-in (voice while OutLoud speaks). */
    this.bus.on('vad.speechStart', function () {
      if (self.state === 'RESPONDING') { self.bargeIn(null); }
    });

    /* Avatar routes the live audio element through its analyser. */
    this.bus.on('speech.audio', function (env) { self.avatar.routeAudio(env.payload.el); });

    /* Content interactions become context for the next response. */
    this.content.onAction('plan.select', function (data) {
      self.memory.setFact('interest.plan', data.label, 'interaction');
      self.input.type('Tell me more about ' + data.label);
    });
    this.content.onAction('booking.submit', function (data) {
      Object.keys(data).forEach(function (k) {
        if (data[k]) { self.memory.setFact('lead.' + k, data[k], 'user-stated'); }
      });
      self.memory.setLeadState('captured');
      self.submit('walkthrough details sent');
    });
  };

  /* ---------- session lifecycle ---------- */
  Orchestrator.prototype.sessionStart = function () {
    this.bus.sessionId = this.memory.id;
    this.bus.publish('session.start', { resumed: !!this.memory.facts['session.returned'], sessionId: this.memory.id });
    this.memory.setFact('session.returned', true, 'interaction');
    /* Capability report (client side of session.ready). */
    this.bus.publish('session.ready', {
      capabilities: {
        mic: !!this.input.SR,
        vad: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        tts: 'elevenlabs',
        ttsFallback: !!window.speechSynthesis,
        avatar: '2d-sprite-adapter',
        contentHost: CONFIG.content.host
      }
    });
    this._setState('IDLE');
  };

  /* ---------- one turn ---------- */
  Orchestrator.prototype.submit = function (text, typed) {
    var self = this;
    if (!text || !text.trim()) { return; }
    if (this.state === 'RESPONDING' || this.state === 'PROCESSING') { this.cancel(false); }
    text = text.trim();

    this.bus.publish('turn.start', { text: text, typed: !!typed });
    this.memory.logTurn('visitor', text);
    this._setState('PROCESSING');
    var turnId = 'turn-' + Date.now().toString(36);
    this.turnId = turnId;

    var know = window.OUTLOUD.knowledge;
    know.retrieve(text).then(function (k) {
      if (self.state !== 'PROCESSING') { return; } /* cancelled mid-flight */
      var turn = {
        userText: text,
        knowledge: k,
        memory: self.memory.recall(),
        turnId: turnId,
        sessionId: self.memory.id,
        contentIds: Object.keys(self.content.registry)
      };
      var plan = self.planner.produce(turn);
      var v = window.OUTLOUD.validatePlan(plan, {
        constraints: CONFIG.avatar.constraints,
        contentIds: Object.keys(self.content.registry)
      });
      self.bus.publish('plan.validated', { ok: v.ok, repairs: v.repairs, intent: plan.meta.intent, source: plan.speech.source });
      self.render(v.plan);
    }).catch(function () {
      self._setState('LISTENING');
      self.bus.publish('error', { where: 'pipeline', message: 'Could not build a response — try again.' });
    });
  };

  /* ---------- render: three parallel directors ---------- */
  Orchestrator.prototype.render = function (plan) {
    var self = this;
    this._setState('RESPONDING');
    this.bus.responseId = plan.responseId;
    this.bus.publish('response.start', { responseId: plan.responseId, planVersion: plan.planVersion });

    this.memory.logTurn('outloud', plan.speech.text);

    /* Speech channel (streams chunks; may run with or without audio). */
    this.speech.onChunkStart = function (chunkText) {
      self.bus.publish('transcript.outloud', { text: chunkText, responseId: plan.responseId });
    };
    this.speech.onDone = function () { self.responseEnd(plan); };
    this.input.suspend();
    this.speech.setMuted(this.muted || false);
    this.speech.speak(plan.speech);

    /* Avatar channel (gestures + gaze + expressions scheduled from plan). */
    this.avatar.lipSyncStart();
    this.avatar.runPlan(plan.avatar, Date.now());

    /* Content channel (panel actions scheduled from plan). */
    (plan.content || []).forEach(function (c) { self.content.execute(c); });
  };

  Orchestrator.prototype.responseEnd = function (plan) {
    this.avatar.lipSyncStop();
    /* Memory proposals land only here, audited (three-context rule). */
    if (plan.memory && plan.memory.propose) {
      this.memory.propose(plan.memory.propose);
    }
    if (plan.memory && plan.memory.followState) {
      this.memory.setLeadState(plan.memory.followState);
    }
    this.bus.responseId = null;
    this.bus.publish('response.end', { responseId: plan.responseId });
    if (this.state === 'RESPONDING') {
      this._setState(this.micWanted ? 'LISTENING' : 'IDLE');
      if (this.micWanted) { this.input.resume(); }
    }
  };

  /* ---------- barge-in / cancellation ---------- */
  Orchestrator.prototype.bargeIn = function (heardText) {
    this.bus.publish('bargein', { heard: heardText || null, from: this.state });
    this.cancel(true);
  };

  Orchestrator.prototype.cancel = function (resumeListening) {
    this.speech.cancel();
    this.avatar.cancelAll();
    this.content.cancelPending();
    this._setState('CANCELLED');
    this.bus.publish('cancelled', {});
    var self = this;
    setTimeout(function () {
      if (self.state === 'CANCELLED') {
        self._setState(self.micWanted ? 'LISTENING' : 'IDLE');
        if (self.micWanted && resumeListening) { self.input.resume(); }
      }
    }, 120);
  };

  /* ---------- mic toggle (LISTENING lifecycle) ---------- */
  Orchestrator.prototype.setMic = function (on) {
    this.micWanted = on;
    if (on) {
      this.input.start();
      this._setState('LISTENING');
    } else {
      this.input.stop();
      if (this.state === 'LISTENING') { this._setState('IDLE'); }
    }
  };

  Orchestrator.prototype.setMuted = function (m) {
    this.muted = m;
    this.speech.setMuted(m);
  };

  Orchestrator.prototype.STATES = STATES;

  window.OUTLOUD = window.OUTLOUD || {};
  window.OUTLOUD.Orchestrator = Orchestrator;
})();
