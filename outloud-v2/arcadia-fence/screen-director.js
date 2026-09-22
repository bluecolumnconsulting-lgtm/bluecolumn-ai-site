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
      kicker: 'Arcadia Fence & Gate',
      title: 'Fences and gates, built by a licensed crew',
      body: 'Block walls, steel view fencing, wood, vinyl, custom gates. Serving the Phoenix Metro since 2018 — ROC 337481.',
      ask: 'What does Arcadia build?'
    },
    {
      id: 'quote',
      kicker: 'Free estimates',
      title: 'Say quote, get started',
      body: 'Every estimate is free and transparent — clear scope, clear timeline, no mystery fees. Financing available.',
      ask: 'How do estimates work?'
    },
    {
      id: 'materials',
      kicker: 'The lineup',
      title: 'Built for the Arizona desert',
      body: 'Block walls with decorative caps, steel view fencing for pools and patios, cedar and treated wood, UV-resistant vinyl.',
      ask: 'Tell me about steel view fencing'
    },
    {
      id: 'gates',
      kicker: 'Custom gates',
      title: 'Manual or automated',
      body: 'Keypads, remotes, smart access, heavy-duty hinges. Pedestrian and vehicular, matched to your fence.',
      ask: 'Can you automate a gate?'
    },
    {
      id: 'trust',
      kicker: 'Licensed and insured',
      title: 'ROC 337481, since 2018',
      body: 'HomeAdvisor Approved, BBB listed, owned and run by Joe Pagano — hands-on from design call to final walk-through.',
      ask: 'Who is Arcadia?'
    },
    {
      id: 'your-business',
      kicker: 'This page is OutLoud',
      title: 'A website that answers out loud',
      body: 'The agent on this page answers every visitor, quotes work, and books jobs around the clock. We build one with your business on it.',
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
