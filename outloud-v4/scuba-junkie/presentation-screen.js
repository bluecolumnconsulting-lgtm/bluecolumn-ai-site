/* ============================================================
   OutLoud v3 — PRESENTATION SCREEN DIRECTOR  (Job c3973498)
   ============================================================
   Screen-only implementation of the conversation-controlled
   presentation runtime. Replaces MinimalScreenDirector (stub).

   • AVATARS ARE UNTOUCHED — no edits to avatar/speech/sink paths.
   • Slides advance on REAL SPEECH BOOKMARKS (speech.chunk.start),
     never timers. The deck renders hand-authored data only.
   • Command engine mirrors the spec's revision/turn validation:
       - revision counter rejects stale commands (expectedRevision)
       - turnId ownership invalidates avatar-driven cues once the
         visitor navigates manually
       - commandId map makes every command idempotent
   • Every applied command publishes 'screen.snapshot' so a future
     SSE/transport layer can consume the same shape it already
     emits in-page today.

   INTENT → SLIDE MAP (single source of truth, mirrors planner):
     pricing / avatars / how-it-works / live-sites / timeline /
     booking → their slide; greet & open-question → "what-is".
   ============================================================ */
(function () {
  'use strict';
  window.OUTLOUD = window.OUTLOUD || {};

  var DECK = window.OUTLOUD.PresentationDeck;

  function PresentationScreenDirector(bus) {
    this.bus = bus;
    this.deck = DECK || { deckId: 'outloud-v3-main', slides: [] };
    this.el = null;
    this.cardsEl = null;
    this.dotsEl = null;
    this.standbyEl = null;
    this.started = false;

    /* command-engine state (spec: screen_sessions / screen_commands) */
    this.revision = 0;
    this.turnId = null;          /* active avatar turn owning the screen */
    this.deckId = this.deck.deckId;
    this.slideId = null;
    this.applied = {};           /* commandId -> revision (idempotency) */
    this.queue = [];             /* slides queued by the current turn */
    this.lastIntent = null;

    this._wire();
  }

  /* ---------- command engine (spec §command service) ---------- */
  PresentationScreenDirector.prototype.applyCommand = function (command) {
    if (!command || typeof command !== 'object') { return null; }
    /* idempotent: a repeated commandId is dropped */
    if (command.commandId && this.applied[command.commandId]) { return this.snapshot(); }
    /* stale: expectedRevision mismatch rejects the command */
    if (typeof command.expectedRevision === 'number' &&
        command.expectedRevision !== this.revision) { return this.snapshot(); }
    /* deck guard: never render an unknown slide */
    var target = this._findSlide(command.slideId || this.slideId);
    if (command.slideId && !target) { return this.snapshot(); }

    var nextSlide = target ? target.id : this.slideId;
    this.slideId = nextSlide;
    this.revision += 1;
    /* manual navigation (turnId null) cancels any outstanding avatar cue */
    if (command.turnId === null || command.turnId === undefined) {
      this.turnId = null;
      this.queue = [];
    } else if (command.turnId) {
      this.turnId = command.turnId;
    }
    if (command.commandId) { this.applied[command.commandId] = this.revision; }
    this._renderSlide(nextSlide);
    this.bus.publish('screen.snapshot', this.snapshot());
    return this.snapshot();
  };

  PresentationScreenDirector.prototype.snapshot = function () {
    return {
      revision: this.revision,
      turnId: this.turnId,
      deckId: this.deckId,
      slideId: this.slideId,
      scene: this.slideId ? 'slide' : 'standby'
    };
  };

  PresentationScreenDirector.prototype._findSlide = function (id) {
    var s, i;
    for (i = 0; i < this.deck.slides.length; i++) {
      s = this.deck.slides[i];
      if (s.id === id) { return s; }
    }
    return null;
  };

  /* ---------- avatar speech-bookmark bridge (spec §AvatarScreenBridge) ---------- */
  PresentationScreenDirector.prototype._wire = function () {
    var self = this;

    this.bus.on('intent.detected', function (env) {
      self.lastIntent = env.payload && env.payload.intent;
    });

    this.bus.on('response.start', function (env) {
      /* begin a turn: queue the intent's slide, owned by this response */
      var intent = self.lastIntent || 'open-question';
      self.turnId = env.payload.responseId;
      self.queue = self._slidesForIntent(intent);
    });

    /* REAL speech bookmark: each spoken chunk advances the deck one step. */
    this.bus.on('speech.chunk.start', function () {
      if (!self.turnId) { return; }         /* no active turn owns the screen */
      if (!self.queue.length) { return; }   /* nothing left to show */
      var nextId = self.queue.shift();
      self.applyCommand({
        commandId: 'cue-' + self.turnId + '-' + nextId,
        expectedRevision: self.revision,
        turnId: self.turnId,
        slideId: nextId
      });
    });

    this.bus.on('response.end', function () { self._endTurn(); });
    this.bus.on('speech.cancelled', function () { self._endTurn(); });
    this.bus.on('cancelled', function () { self._endTurn(); });
  };

  PresentationScreenDirector.prototype._endTurn = function () {
    if (!this.turnId && !this.queue.length) { return; }
    this.turnId = null;
    this.queue = [];
  };

  /* One slide per intent today; the queue mechanism supports multi-slide
     walks the moment speech bookmarks carry per-section cues. */
  PresentationScreenDirector.prototype._slidesForIntent = function (intent) {
    var map = {
      'pricing': 'pricing',
      'avatars': 'voice-avatar',
      'how-it-works': 'how-it-works',
      'live-sites': 'live-sites',
      'timeline': 'timeline',
      'book': 'booking',
      'lead-capture': 'booking',
      'contact': 'booking',
      'greet': 'what-is',
      'open-question': 'what-is'
    };
    var id = map[intent];
    return id ? [id] : [];
  };

  /* ---------- DOM ---------- */
  PresentationScreenDirector.prototype.start = function () {
    if (this.started) { return; }
    this.started = true;
    this.el = document.getElementById('ol-screen');
    if (!this.el || !this.deck.slides.length) { return; }
    this._build();
    this.el.classList.add('deck-live');
    /* opening slide: the OutLoud sign, no timer involved */
    this.applyCommand({
      commandId: 'deck-open',
      expectedRevision: this.revision,
      turnId: null,
      slideId: this.deck.slides[0].id
    });
  };

  PresentationScreenDirector.prototype._build = function () {
    var el = this.el;
    var top = document.createElement('div');
    top.className = 'ol-screen-topbar ol-screen-decktop';

    var brand = document.createElement('span');
    brand.className = 'ol-screen-brand';
    brand.textContent = (this.deck.brand || 'bluecolumn') + ' / ' + (this.deck.label || 'OutLoud');

    var nav = document.createElement('div');
    nav.className = 'ol-screen-decknav';

    var dots = document.createElement('div');
    dots.className = 'ol-screen-dots';
    dots.setAttribute('role', 'tablist');
    dots.setAttribute('aria-label', 'Presentation slides');

    var prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'ol-screen-navbtn';
    prev.setAttribute('aria-label', 'Previous slide');
    prev.textContent = '‹';

    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'ol-screen-navbtn';
    next.setAttribute('aria-label', 'Next slide');
    next.textContent = '›';

    nav.appendChild(prev);
    nav.appendChild(dots);
    nav.appendChild(next);
    top.appendChild(brand);
    top.appendChild(nav);
    el.insertBefore(top, el.firstChild);

    this.dotsEl = dots;
    this._buildDots();

    /* deck cards live in their own layer inside the existing body */
    var body = el.querySelector('.ol-screen-body');
    this.standbyEl = document.getElementById('ol-screen-standby');
    if (body) {
      this.cardsEl = document.createElement('div');
      this.cardsEl.className = 'ol-screen-cards';
      this.cardsEl.setAttribute('role', 'tabpanel');
      this._buildCards();
      body.appendChild(this.cardsEl);
    }

    var self = this;
    prev.addEventListener('click', function () { self.nudge(-1); });
    next.addEventListener('click', function () { self.nudge(1); });
    document.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') { return; }
      if (!self.started) { return; }
      if (e.key === 'ArrowRight') { self.nudge(1); }
      else if (e.key === 'ArrowLeft') { self.nudge(-1); }
    });
  };

  PresentationScreenDirector.prototype._buildDots = function () {
    var self = this;
    this.deck.slides.forEach(function (s, i) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'ol-screen-dot';
      d.setAttribute('role', 'tab');
      d.setAttribute('aria-label', s.title);
      d.setAttribute('data-slide', s.id);
      d.addEventListener('click', function () {
        self.applyCommand({
          commandId: 'manual-dot-' + s.id + '-' + Date.now(),
          expectedRevision: self.revision,
          turnId: null,
          slideId: s.id
        });
      });
      self.dotsEl.appendChild(d);
    });
  };

  PresentationScreenDirector.prototype._buildCards = function () {
    var self = this;
    this.deck.slides.forEach(function (s) {
      var card = document.createElement('div');
      card.className = 'ol-screen-card';
      card.setAttribute('data-slide', s.id);

      var kicker = document.createElement('div');
      kicker.className = 'ol-card-kicker';
      kicker.textContent = s.kicker || '';

      var title = document.createElement('div');
      title.className = 'ol-card-title';
      title.textContent = s.title;

      var body = document.createElement('div');
      body.className = 'ol-card-body';
      body.textContent = s.body;

      card.appendChild(kicker);
      card.appendChild(title);
      card.appendChild(body);

      if (s.ask) {
        var ask = document.createElement('button');
        ask.type = 'button';
        ask.className = 'ol-card-ask';
        ask.textContent = s.ask + ' →';
        ask.addEventListener('click', function () {
          /* visitor control: ask about this slide */
          self.bus.publish('transcript.final', { text: s.ask, typed: true });
        });
        card.appendChild(ask);
      }
      self.cardsEl.appendChild(card);
    });
  };

  PresentationScreenDirector.prototype._renderSlide = function (id) {
    var i, card, dot;
    for (i = 0; this.cardsEl && i < this.cardsEl.children.length; i++) {
      card = this.cardsEl.children[i];
      card.classList.toggle('active', card.getAttribute('data-slide') === id);
    }
    for (i = 0; this.dotsEl && i < this.dotsEl.children.length; i++) {
      dot = this.dotsEl.children[i];
      dot.classList.toggle('active', dot.getAttribute('data-slide') === id);
    }
  };

  /* Manual navigation: cancels avatar cues, moves one slide. */
  PresentationScreenDirector.prototype.nudge = function (dir) {
    var slides = this.deck.slides;
    if (!slides.length) { return; }
    var idx = 0, i;
    for (i = 0; i < slides.length; i++) { if (slides[i].id === this.slideId) { idx = i; break; } }
    idx = (idx + dir + slides.length) % slides.length;
    this.applyCommand({
      commandId: 'manual-nudge-' + Date.now(),
      expectedRevision: this.revision,
      turnId: null,
      slideId: slides[idx].id
    });
  };

  window.OUTLOUD.ScreenDirector = PresentationScreenDirector;
})();
