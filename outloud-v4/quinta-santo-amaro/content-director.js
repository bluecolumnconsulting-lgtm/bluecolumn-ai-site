/* ===============================================================
   Esplora Travel — CONTENT DIRECTOR (UI/Content channel)
   Spec: Content Registry (component management) + Action Registry
   (component events). Response Plans address panels by id;
   interactive events feed BACK into the agent response cycle.

   Every plan-driven action is validated (plan-validator + registry
   membership here) before touching the DOM.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;

  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) { d.className = cls; }
    if (html !== undefined) { d.innerHTML = html; }
    return d;
  }

  function ContentDirector(bus) {
    this.bus = bus;
    this.host = null;
    this.registry = {};     /* panelId -> { el, visible, builder } */
    this.actions = {};      /* action name -> handler (Action Registry) */
    this.pendingTimers = [];
  }

  /* ---------- Content Registry ---------- */
  ContentDirector.prototype.mount = function () {
    var self = this;
    this.host = document.querySelector(CONFIG.content.host);
    if (!this.host) { return; }

    /* --- at-a-glance panel --- */
    this.register('facts-panel', function () {
      var p = el('div', 'ol-panel');
      p.appendChild(el('h3', 'ol-panel-title', 'Esplora Travel at a glance'));
      var rows = el('div', 'ol-panel-rows');
      [
        { name: 'Founded', desc: 'Cambridge, United Kingdom', price: '2009' },
        { name: 'Style', desc: 'Escorted journeys for small groups', price: 'Small group' },
        { name: 'Destinations', desc: 'Sicily, Greece, Turkey, Italy, Caucasus', price: '5' },
        { name: 'Director', desc: 'Damian Croft, Founding Director', price: '' },
        { name: 'Trusted by', desc: 'Verified member of AITO', price: '' },
        { name: 'Tagline', desc: 'Small group cultural & walking tours', price: '' }
      ].forEach(function (r) {
        rows.appendChild(el('div', 'ol-panel-row ol-row-static',
          '<span class="ol-row-name">' + r.name + '</span>' + (r.price ? '<span class="ol-row-price mono">' + r.price + '</span>' : '') + '<span class="ol-row-desc">' + r.desc + '</span>'));
      });
      p.appendChild(rows);
      return p;
    });

    /* --- destinations panel --- */
    this.register('destinations-panel', function () {
      var p = el('div', 'ol-panel');
      p.appendChild(el('h3', 'ol-panel-title', 'Where we travel'));
      var rows = el('div', 'ol-panel-rows');
      [
        { name: 'Sicily', desc: 'Island tours, wine towns, and coast', price: '' },
        { name: 'Greece', desc: 'Meteora, classical sites, Crete', price: '' },
        { name: 'Turkey', desc: 'Eastern Turkey and the lake region', price: '' },
        { name: 'Italy', desc: 'Escorted journeys beyond Sicily', price: '' },
        { name: 'The Caucasus', desc: 'History and landscapes', price: '' }
      ].forEach(function (r) {
        rows.appendChild(el('div', 'ol-panel-row ol-row-static',
          '<span class="ol-row-name">' + r.name + '</span>' + (r.price ? '<span class="ol-row-price mono">' + r.price + '</span>' : '') + '<span class="ol-row-desc">' + r.desc + '</span>'));
      });
      p.appendChild(rows);
      p.appendChild(el('p', 'ol-panel-note mono', 'Cultural tours and walking holidays — both small-group, expert-led, and fully inclusive.'));
      return p;
    });

    /* --- travel styles panel --- */
    this.register('styles-panel', function () {
      var p = el('div', 'ol-panel');
      p.appendChild(el('h3', 'ol-panel-title', 'Choose your travel style'));
      var rows = el('div', 'ol-panel-rows');
      [
        { name: 'Cultural tours', desc: 'History, art, and local life', price: '' },
        { name: 'Walking holidays', desc: 'Explore on foot with expert guides', price: '' },
        { name: 'Small groups', desc: 'Like-minded guests, personal attention', price: '' },
        { name: 'Fully inclusive', desc: 'Guaranteed departures, everything arranged', price: '' }
      ].forEach(function (r) {
        rows.appendChild(el('div', 'ol-panel-row ol-row-static',
          '<span class="ol-row-name">' + r.name + '</span>' + (r.price ? '<span class="ol-row-price mono">' + r.price + '</span>' : '') + '<span class="ol-row-desc">' + r.desc + '</span>'));
      });
      p.appendChild(rows);
      p.appendChild(el('p', 'ol-panel-note mono', 'New newsletter subscribers get £50 off their first Esplora Travel tour.'));
      return p;
    });

    /* --- contact panel (info + request form) --- */
    this.register('contact-panel', function () {
      var f = el('form', 'ol-panel ol-form');
      f.setAttribute('data-stub', 'contact: server-side validation + follow-up TODO');
      f.appendChild(el('h3', 'ol-panel-title', 'Talk to Esplora Travel'));
      f.appendChild(el('div', 'ol-panel-note mono',
        'trips@esplora.co.uk · +44 (0)1223 328446<br/>WhatsApp +44 7507 208380<br/>Cambridge, United Kingdom'));
      [['name', 'text', 'Your name'], ['phone', 'tel', 'Best phone number'], ['topic', 'text', 'Which tour are you interested in?']].forEach(function (pair) {
        var input = el('input', 'ol-input');
        input.type = pair[1];
        input.name = pair[0];
        input.placeholder = pair[2];
        input.autocomplete = 'off';
        f.appendChild(input);
      });
      var note = el('p', 'ol-panel-note mono', 'Send your details and the Esplora team will follow up.');
      var submit = el('button', 'ol-submit', 'Send it');
      submit.type = 'submit';
      f.appendChild(submit);
      f.appendChild(note);
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var data = {};
        [].forEach.call(f.querySelectorAll('input'), function (i) {
          data[i.name] = i.value.trim();
          i.classList.remove('ol-missing');
        });
        var missing = [];
        if (!data.name) { missing.push('name'); f.querySelector('[name=name]').classList.add('ol-missing'); }
        if (!data.phone || data.phone.replace(/\D/g, '').length < 7) { missing.push('phone'); f.querySelector('[name=phone]').classList.add('ol-missing'); }
        if (missing.length) {
          note.textContent = 'Need a ' + missing.join(' and a ') + ' so the team can reach you.';
          return;
        }
        self.emitAction('booking.submit', data);
        note.textContent = 'Captured. Production: follow-up runs server-side.';
      });
      return f;
    });

    this.bus.publish('content.ready', { panels: Object.keys(this.registry) });
  };

  ContentDirector.prototype.register = function (id, builder) {
    this.registry[id] = { builder: builder, el: null, visible: false };
  };

  ContentDirector.prototype.ensureBuilt = function (id) {
    var r = this.registry[id];
    if (r && !r.el) {
      r.el = r.builder();
      r.el.classList.add('ol-hidden');
      this.host.appendChild(r.el);
    }
    return r;
  };

  /* ---------- plan-driven actions ---------- */
  ContentDirector.prototype.execute = function (action) {
    var self = this;
    if (!this.host || !this.registry[action.target]) {
      this.bus.publish('content.rejected', { action: action, reason: 'unknown panel' });
      return false;
    }
    var r = this.ensureBuilt(action.target);
    var run = function () {
      if (action.action === 'show') {
        r.el.classList.remove('ol-hidden');
        r.visible = true;
      } else if (action.action === 'hide') {
        r.el.classList.add('ol-hidden');
        r.visible = false;
      } else if (action.action === 'highlight' && action.data && action.data.lines) {
        [].forEach.call(r.el.querySelectorAll('[data-row]'), function (n) {
          n.classList.toggle('pulse', action.data.lines.indexOf(n.getAttribute('data-row')) !== -1);
        });
        self.pendingTimers.push(setTimeout(function () {
          [].forEach.call(r.el.querySelectorAll('.pulse'), function (n) { n.classList.remove('pulse'); });
        }, 4000));
      } else if (action.action === 'update' && action.data) {
        var d = action.data;
        Object.keys(d).forEach(function (k) { r.el.setAttribute('data-' + k, String(d[k])); });
        if (d.leadCaptured) {
          var title = r.el.querySelector('.ol-panel-title');
          if (title) { title.textContent = 'Enquiry captured'; }
          [].forEach.call(r.el.querySelectorAll('input, .ol-submit'), function (n) {
            n.classList.add('ol-hidden');
            if (n.tagName === 'BUTTON') { n.disabled = true; }
          });
          var sum = r.el.querySelector('.ol-lead-summary');
          if (!sum) {
            sum = el('p', 'ol-lead-summary');
            r.el.insertBefore(sum, r.el.querySelector('.ol-panel-note'));
          }
          sum.textContent = 'Captured: ' + (d.leadName || '') + (d.leadPhone ? ', ' + d.leadPhone : '') + '. The Esplora team will follow up.';
        }
      }
      self.bus.publish('content.action', { action: action.action, target: action.target });
    };
    if (action.at) { this.pendingTimers.push(setTimeout(run, action.at)); } else { run(); }
    return true;
  };

  ContentDirector.prototype.hideAll = function () {
    var self = this;
    Object.keys(this.registry).forEach(function (id) {
      var r = self.registry[id];
      if (r.el) { r.el.classList.add('ol-hidden'); r.visible = false; }
    });
  };

  ContentDirector.prototype.cancelPending = function () {
    this.pendingTimers.forEach(clearTimeout);
    this.pendingTimers = [];
  };

  /* ---------- Action Registry: panel events → agent cycle ---------- */
  ContentDirector.prototype.onAction = function (name, fn) {
    this.actions[name] = fn;
  };

  ContentDirector.prototype.emitAction = function (name, data) {
    var fn = this.actions[name];
    this.bus.publish('content.interact', { name: name, data: data });
    if (fn) { fn(data); }
  };

  window.OUTLOUD = window.OUTLOUD || {};
  window.OUTLOUD.ContentDirector = ContentDirector;
})();
