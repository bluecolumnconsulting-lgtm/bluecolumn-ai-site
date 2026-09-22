/* ===============================================================
   OutLoud for OTTOMEDIC — SCREEN DIRECTOR (ambient content rotation)
   Implements the screen-content spec recovered from the BlueColumn
   note (sess_3swhnp08…sess_mbm25jkc, 2026-09-21):

     "Content must constantly be visible on the screen… useful
      content even before users ask questions…"

   Rules:
     • Plan-driven panels always win: when the orchestrator presents
       a panel, the deck steps aside and resumes after it is gone.
     • Every card carries a one-tap question.
     • Rotation pauses while OutLoud speaks.

   The deck content is OTTOMEDIC-SPECIFIC — every claim mirrors the
   existing OttoMedic landing page in this repo (Marina's INTENTS +
   the landing bundle, showcase/project-home-spark/):
     1. What is OttoMedic        2. How it works (mechanical)
     3. What it prevents         4. Models & pricing
     5. Proof (2,000+ keepers)   6. This page is an OutLoud demo
   =============================================================== */
(function () {
  'use strict';

  var CARDS = [
    {
      id: 'what-is',
      kicker: 'This page is the product',
      title: 'The only skimmer that thinks for itself',
      body: 'OttoMedic continuously monitors and adjusts to maintain optimal foam height. Set your target once — never touch it again.',
      ask: 'What is OttoMedic?'
    },
    {
      id: 'how-it-works',
      kicker: 'Patented valve technology',
      title: 'Mechanical, not electronic',
      body: 'No sensors to calibrate, no controllers to tune. The purely mechanical valve works identically on day 1 and day 1,000.',
      ask: 'How does it work?'
    },
    {
      id: 'prevents',
      kicker: 'What\u2019s at stake',
      title: 'Three disasters, eliminated',
      body: 'Skimmate on your floor. A pump running dry. Corals too stressed to grow. OttoMedic prevents all three — before they happen.',
      ask: 'What problems does it prevent?'
    },
    {
      id: 'models',
      kicker: 'Pick your model',
      title: 'EVO 5000Z1 · 7000Z1 · 9000Z1',
      body: '100–200 gallons $899 · 200–400 gallons $1,149 · 400–600 gallons $1,399. 60-day performance guarantee on every model.',
      ask: 'What does it cost?'
    },
    {
      id: 'proof',
      kicker: 'Real systems, real results',
      title: '2,000+ reef keepers',
      body: 'Livestock worth $40K+ protected. Zero daily adjustments. 24/7 consistent performance. 5-year warranty, made in Germany.',
      ask: 'Who uses OttoMedic?'
    },
    {
      id: 'outloud-demo',
      kicker: 'Your business, out loud',
      title: 'Imagine this with your logo on it',
      body: 'This whole page is OutLoud by BlueColumn: an agent that greets, answers, and books — from the business\u2019s own knowledge. Book a walkthrough.',
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