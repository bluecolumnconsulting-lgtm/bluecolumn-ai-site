/* ===============================================================
   OutLoud for AUTOMATTIC — SCREEN DIRECTOR (ambient content rotation)
   Cloned from outloud-v2/screen-director.js. Same rules as the
   parent build:
     • Plan-driven panels always win; the deck steps aside and
       resumes after the panel is gone.
     • Every card carries a one-tap question.
     • Rotation pauses while OutLoud speaks.

   The deck content is AUTOMATTIC-SPECIFIC — every claim mirrors
   the page's own catalog (sourced from automattic.com, 2026-09-21):
     1. What is Automattic       2. The products
     3. WordPress.com            4. Open source / Five for the Future
     5. Fully distributed        6. This page is an OutLoud demo
   =============================================================== */
(function () {
  'use strict';

  var CARDS = [
    {
      id: 'what-is',
      kicker: 'This page is the product',
      title: 'Automattic, out loud',
      body: 'The company behind WordPress.com — powering over 40% of all websites — answering questions out loud through an OutLoud agent.',
      ask: 'What is Automattic?'
    },
    {
      id: 'products',
      kicker: 'What Automattic makes',
      title: 'One company, the open web',
      body: 'WordPress.com, WooCommerce, Jetpack, Tumblr, Beeper, Day One, Pocket Casts, Gravatar, Akismet, Longreads, Newspack, WordPress VIP.',
      ask: 'Which products do you make?'
    },
    {
      id: 'wordpress',
      kicker: 'The founding product',
      title: 'WordPress.com',
      body: 'Your blog or website has a home on the web. The open-source WordPress project behind it powers over 40% of the web.',
      ask: 'What is WordPress.com?'
    },
    {
      id: 'open-source',
      kicker: 'We make it for freedom',
      title: 'Open source, contributed back',
      body: 'WordPress.org, BuddyPress, bbPress, WordCamps — sponsored through Five for the Future. “We don’t make software for free, we make it for freedom.”',
      ask: 'Tell me about open source'
    },
    {
      id: 'distributed',
      kicker: 'No headquarters',
      title: 'A fully distributed company',
      body: 'Founded in 2005 by Matt Mullenweg. More than 1,400 people working from over 80 countries — a company that works on, and for, the web.',
      ask: 'How does the team work?'
    },
    {
      id: 'outloud-demo',
      kicker: 'Your business, out loud',
      title: 'Imagine this with your logo on it',
      body: 'This whole page is OutLoud by BlueColumn: an agent that greets, answers, and books — from the business’s own knowledge. Book a walkthrough.',
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