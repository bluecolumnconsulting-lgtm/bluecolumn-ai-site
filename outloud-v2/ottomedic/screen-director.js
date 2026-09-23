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
     1. What is OttoMedic        2. EVO models
     3. Proof (live clients)     4. Timeline (30 days)
     5. Pick your face (tiers)   6. Your business (the walkthrough)

   Rules:
     • Plan-driven panels always win: when the orchestrator presents
       a panel (pricing/booking/avatars), the deck steps aside and
       resumes after the panel is gone.
     • Every card carries a one-tap question — the screen is itself
       a conversation starter, not a billboard.
     • Rotation pauses while Marina speaks so the face + screen
       stay in sync; resumes when the runtime goes idle.
   =============================================================== */
(function () {
  'use strict';

  /* Cards use real material from ottomedic.com */
var CARDS = [
    {
      id: 'brand',
      img: 'img/skimmer-full.jpg',
      kicker: 'OTTOMEDIC · U.S. Patent 9078419',
      title: 'EVO 7000Z1 protein skimmer',
      body: "Integrated hands-free automatic internal water level control — the only one of its kind. Always performing at 100% efficiency.",
      ask: 'How does it work?'
    },
    {
      id: 'water-level',
      img: 'img/skimmer-quarter.jpg',
      kicker: 'Self-regulating',
      title: 'Water level exactly where you want it',
      body: "Operates in ANY water level between 1 inch and 10½ inches — regardless of changing aquarium and sump conditions.",
      ask: 'How does the water level control work?'
    },
    {
      id: 'power',
      img: 'img/skimmer-lid.jpg',
      kicker: 'Built to survive',
      title: 'Unaffected by power outages',
      body: "Goes into a state of suspended animation — internal water level never changes until power returns.",
      ask: 'What happens in a power outage?'
    },
    {
      id: 'siphon',
      img: 'img/skimmer-base.jpg',
      kicker: 'Siphon technology',
      title: 'Maximum water flow, minimum effort',
      body: "The pump works in unison with the siphon that literally pulls water through the skimmer — no flow-restricting valves.",
      ask: 'Why is it better than other brands?'
    },
    {
      id: 'quiet',
      img: 'img/skimmer-full.jpg',
      kicker: 'Closed-loop air',
      title: 'Extremely quiet — and no smells',
      body: "Self-contained air circulation keeps smoke, fumes, dust, dander and odors out of your aquarium — and your home.",
      ask: 'Tell me about the closed loop'
    },
    {
      id: 'maintain',
      img: 'img/skimmer-lid.jpg',
      kicker: 'Easy maintenance',
      title: 'Never unplug to empty it',
      body: "Remove the collection container without turning off power. Silicon O-rings make disassembly and re-assembly easy.",
      ask: 'How do I maintain it?'
    },
    {
      id: 'your-business',
      kicker: 'Talk to Marina',
      title: 'Answers every visitor, out loud',
      body: 'Marina answers questions about the skimmer around the clock — how it works, models, specs, setup.',
      ask: 'How does it work?'
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

    if (this.standby) { this.standby.classList.add('ol-standby-dim'); }
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
        (c.img ? '<img class="ol-card-img" src="' + c.img + '" alt="">' : '') +
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
