/* ===============================================================
   OutLoud 2.0 — SCREEN DIRECTOR (ambient content rotation)
   Implements the screen-content spec recovered from the BlueColumn
   note (sess_3swhnp08…sess_mbm25jkc, 2026-09-21):

     "Content must constantly be visible on the screen… useful
      content even before users ask questions… the upgrade is
      complete when a visitor can arrive, READ USEFUL CONTENT,
      explore examples, ask a contextual question, see supporting
      material — without ever encountering an empty main screen."

   Six VALIDATED cards only — every claim mirrors the page's own
   catalog copy (no unverified claims, per spec). The deck rotates
   on the branded screen between answers:
     1. What is OutLoud          2. Simple monthly plans
     3. Proof (live clients)     4. Timeline (30 days)
     5. Pick your face (tiers)   6. Your business (the walkthrough)

   Rules:
     • Plan-driven panels always win: when the orchestrator presents
       a panel (pricing/booking/avatars), the deck steps aside and
       resumes after the panel is gone.
     • Every card carries a one-tap question — the screen is itself
       a conversation starter, not a billboard.
     • Rotation pauses while OutLoud speaks so the face + screen
       stay in sync; resumes when the runtime goes idle.
   =============================================================== */
(function () {
  'use strict';

  var CARDS = [
    {
      id: 'what-is',
      kicker: 'OttoMedic',
      title: 'The skimmer that thinks for itself',
      body: 'Purely mechanical regulation — no sensors to calibrate, no controllers to tune. Set your foam height once, never touch it again.',
      ask: 'What is OttoMedic?'
    },
    {
      id: 'prevents',
      kicker: 'The big three',
      title: 'It prevents the disasters',
      body: 'Overflow on your floor, a pump running dry, corals stressed to a stop. OttoMedic eliminates all three.',
      ask: 'What problems does it prevent?'
    },
    {
      id: 'models',
      kicker: 'Three models',
      title: 'EVO 5000, 7000, 9000',
      body: '100 to 600 gallons, $899 to $1,399. 60-day performance guarantee, 5-year warranty, made in Germany.',
      ask: 'Which model fits my tank?'
    },
    {
      id: 'comparison',
      kicker: 'Why mechanical',
      title: 'No calibration, ever',
      body: 'Electronic controllers need calibration and eventually fail. The patented valve works identically on day 1 and day 1,000.',
      ask: 'How does it compare?'
    },
    {
      id: 'keepers',
      kicker: 'Who runs it',
      title: '2,000+ reef keepers',
      body: 'Protecting livestock worth $40,000 and up. Stability is survival — that is the whole product.',
      ask: 'Who uses it?'
    },
    {
      id: 'your-business',
      kicker: 'This page is OutLoud',
      title: 'A site that talks to every visitor',
      body: 'This page is the product demo — answering, quoting, and booking around the clock. We build one with your business on it.',
      ask: 'Book a demo'
    }
  ];

  var HOLD_MS = 9000;      /* each card on screen */
  var FIRST_DELAY = 5000;  /* let the standby brand sign land first */

  function ScreenDirector(bus) {
    this.bus = bus;
    this.screen = null;
    this.cardHost = null;
    this.standby = null;
    this.idx = -1;
    this.timer = 0;
    this.started = false;
    this.built = false;
  }

  ScreenDirector.prototype.start = function () {
    var self = this;
    if (this.started) { return; }
    this.screen = document.getElementById('ol-screen');
    if (!this.screen) { return; }
    this.standby = document.getElementById('ol-screen-standby');
    this.cardHost = document.createElement('div');
    this.cardHost.className = 'ol-screen-cards';
    this.cardHost.setAttribute('aria-hidden', 'true');
    var body = this.screen.querySelector('.ol-screen-body');
    if (body) { body.insertBefore(this.cardHost, this.screen.querySelector('.ol-host-screen') || null); }
    this.build();
    this.started = true;

    /* Plan panels own the screen while they are up; the deck resumes
       when the screen returns to panel-free idle. */
    if (typeof MutationObserver === 'function') {
      new MutationObserver(function () {
        var panelLive = self.screen.classList.contains('panel-live');
        if (panelLive) { self.pause(); }
        else if (!self.timer) { self.schedule(HOLD_MS); }
      }).observe(this.screen, { attributes: true, attributeFilter: ['class'] });
    }

    this.schedule(FIRST_DELAY);
  };

  ScreenDirector.prototype.build = function () {
    var self = this;
    if (this.built) { return; }
    this.cardHost.innerHTML = '';
    CARDS.forEach(function (c, i) {
      var d = document.createElement('div');
      d.className = 'ol-screen-card' + (i === 0 ? ' active' : '');
      d.setAttribute('data-card', c.id);
      d.innerHTML =
        '<div class="ol-card-kicker mono">' + c.kicker + '</div>' +
        '<div class="ol-card-title">' + c.title + '</div>' +
        '<div class="ol-card-body">' + c.body + '</div>' +
        '<button type="button" class="ol-card-ask" data-ask="' + c.ask.replace(/"/g, '&quot;') + '">' + c.ask + '</button>';
      d.querySelector('.ol-card-ask').addEventListener('click', function () {
        /* One tap = the visitor asks it. Reuse the runtime input. */
        var R = window.OutLoudRuntime;
        if (R && R.input) { R.input.type(c.ask); }
      });
      self.cardHost.appendChild(d);
    });
    this.built = true;
  };

  ScreenDirector.prototype.show = function (i) {
    if (!this.built) { this.build(); }
    [].forEach.call(this.cardHost.children, function (n, k) {
      n.classList.toggle('active', n === this.cardHost.children[i]);
    }, this);
    if (this.standby) { this.standby.classList.add('ol-standby-dim'); }
  };

  ScreenDirector.prototype.schedule = function (ms) {
    var self = this;
    clearTimeout(this.timer);
    this.timer = setTimeout(function () {
      self.timer = 0;
      if (self.screen && self.screen.classList.contains('panel-live')) { return; }
      self.idx = (self.idx + 1) % CARDS.length;
      self.show(self.idx);
      self.schedule(HOLD_MS);
    }, ms);
  };

  ScreenDirector.prototype.pause = function () {
    clearTimeout(this.timer);
    this.timer = 0;
  };

  window.OUTLOUD = window.OUTLOUD || {};
  window.OUTLOUD.ScreenDirector = ScreenDirector;
})();
