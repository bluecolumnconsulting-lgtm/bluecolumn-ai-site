/* ===============================================================
   Bali Quad Discovery Tours — CONTENT DIRECTOR (UI/Content channel)
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
      p.appendChild(el('h3', 'ol-panel-title', 'Bali Quad Discovery Tours at a glance'));
      var rows = el('div', 'ol-panel-rows');
      [
        { name: 'Running since', desc: 'Adventure tours in Bali', price: '1999' },
        { name: 'Base', desc: 'Booking office — Denpasar, Bali', price: '' },
        { name: 'Tours from', desc: 'Payangan, Desa Kerta', price: '' },
        { name: 'Off-road route', desc: 'Rice fields, jungle, villages', price: '~25km' },
        { name: 'Terrain types', desc: 'Authentic Balinese terrain', price: '5' },
        { name: 'Fleet', desc: 'Full-size quads and buggies', price: '4x4' }
      ].forEach(function (r) {
        rows.appendChild(el('div', 'ol-panel-row ol-row-static',
          '<span class="ol-row-name">' + r.name + '</span>' + (r.price ? '<span class="ol-row-price mono">' + r.price + '</span>' : '') + '<span class="ol-row-desc">' + r.desc + '</span>'));
      });
      p.appendChild(rows);
      return p;
    });

    /* --- tours panel --- */
    this.register('tours-panel', function () {
      var p = el('div', 'ol-panel');
      p.appendChild(el('h3', 'ol-panel-title', 'Our tours'));
      var rows = el('div', 'ol-panel-rows');
      [
        { name: 'Quad Discovery', desc: 'Our classic all-inclusive adventure', price: 'Quad' },
        { name: 'Quad Explorer', desc: 'Drive yourself through real Bali', price: 'Quad' },
        { name: 'Buggy Discovery', desc: 'Classic all-inclusive buggy tour', price: 'Buggy' },
        { name: 'Buggy Explorer', desc: 'Full-size side-by-side adventure', price: 'Buggy' },
        { name: 'Canyon Tubing', desc: 'Guided river tubing with branded gear', price: 'Tubing' },
        { name: '2-in-1 Combos', desc: 'Quad or buggy + tubing in one day', price: 'Combo' }
      ].forEach(function (r) {
        rows.appendChild(el('div', 'ol-panel-row ol-row-static',
          '<span class="ol-row-name">' + r.name + '</span>' + (r.price ? '<span class="ol-row-price mono">' + r.price + '</span>' : '') + '<span class="ol-row-desc">' + r.desc + '</span>'));
      });
      p.appendChild(rows);
      p.appendChild(el('p', 'ol-panel-note mono', 'All tours are guided and include hotel pickup in an air-conditioned car, a safety brief, and training on our test circuit.'));
      return p;
    });

    /* --- vehicles panel --- */
    this.register('vehicles-panel', function () {
      var p = el('div', 'ol-panel');
      p.appendChild(el('h3', 'ol-panel-title', 'Our fleet'));
      var rows = el('div', 'ol-panel-rows');
      [
        { name: 'CFMoto CForce 450L', desc: 'Quads — automatic 4x4, power steering', price: '2 seats' },
        { name: 'CF ZForce 500', desc: 'Buggies / side-by-sides — auto 4x4', price: 'Full size' },
        { name: 'Capacity', desc: 'Two adults up to 250kg per quad', price: '250kg' },
        { name: 'Comfort', desc: 'Arm rests and back rest for passenger', price: '' },
        { name: 'Suspension', desc: 'Independent rear suspension, long chassis', price: '' }
      ].forEach(function (r) {
        rows.appendChild(el('div', 'ol-panel-row ol-row-static',
          '<span class="ol-row-name">' + r.name + '</span>' + (r.price ? '<span class="ol-row-price mono">' + r.price + '</span>' : '') + '<span class="ol-row-desc">' + r.desc + '</span>'));
      });
      p.appendChild(rows);
      p.appendChild(el('p', 'ol-panel-note mono', 'No experience needed — hands-on instruction and a test circuit come first.'));
      return p;
    });

    /* --- offers panel --- */
    this.register('offers-panel', function () {
      var p = el('div', 'ol-panel');
      p.appendChild(el('h3', 'ol-panel-title', 'Special offers'));
      var rows = el('div', 'ol-panel-rows');
      [
        { name: 'Mystery Guest', desc: 'Email before booking with your activities and date', price: '25% off' },
        { name: 'Direct bookings', desc: 'Special offers when you book direct', price: '' },
        { name: 'Families with kids', desc: 'Deals for family groups', price: '' },
        { name: '2-in-1 adventures', desc: 'Save on combined adventures', price: '' },
        { name: 'Bucks & Hens', desc: 'Party group packages', price: '' }
      ].forEach(function (r) {
        rows.appendChild(el('div', 'ol-panel-row ol-row-static',
          '<span class="ol-row-name">' + r.name + '</span>' + (r.price ? '<span class="ol-row-price mono">' + r.price + '</span>' : '') + '<span class="ol-row-desc">' + r.desc + '</span>'));
      });
      p.appendChild(rows);
      p.appendChild(el('p', 'ol-panel-note mono', 'Mystery Guest program is limited and on a first come, first served basis.'));
      return p;
    });

    /* --- contact panel (info + request form) --- */
    this.register('contact-panel', function () {
      var f = el('form', 'ol-panel ol-form');
      f.setAttribute('data-stub', 'contact: server-side validation + follow-up TODO');
      f.appendChild(el('h3', 'ol-panel-title', 'Book your Bali adventure'));
      f.appendChild(el('div', 'ol-panel-note mono',
        'info@baliquad.com · +62 361 720766 / 726438<br/>WhatsApp +62 821-4575-5660<br/>Booking office: Denpasar, Bali'));
      [['name', 'text', 'Your name'], ['phone', 'tel', 'Best phone / WhatsApp'], ['topic', 'text', 'Which tour or date are you interested in?']].forEach(function (pair) {
        var input = el('input', 'ol-input');
        input.type = pair[1];
        input.name = pair[0];
        input.placeholder = pair[2];
        input.autocomplete = 'off';
        f.appendChild(input);
      });
      var note = el('p', 'ol-panel-note mono', 'Send your details and the Bali Quad team will follow up.');
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
          sum.textContent = 'Captured: ' + (d.leadName || '') + (d.leadPhone ? ', ' + d.leadPhone : '') + '. The Bali Quad team will follow up.';
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
