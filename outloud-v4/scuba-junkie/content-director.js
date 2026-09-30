/* ===============================================================
   Scuba Junkie — CONTENT DIRECTOR (UI/Content channel)
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
      p.appendChild(el('h3', 'ol-panel-title', 'Scuba Junkie at a glance'));
      var rows = el('div', 'ol-panel-rows');
      [
        { name: 'Established', desc: 'Mabul Island, Sabah, Malaysia', price: '2004' },
        { name: 'Dive centres', desc: 'PADI 5 star Instructor Development Centre', price: 'PADI 5 star' },
        { name: 'Dive locations', desc: 'Sipadan, Mabul, Kapalai, Si Amil', price: '4' },
        { name: 'Resort', desc: 'Mabul Beach Resort, 30 en suite rooms', price: '' },
        { name: 'Award', desc: 'Dive Resort of the Year 2020', price: '' },
        { name: 'Tagline', desc: 'Dive Sipadan from Mabul Island', price: '' }
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
      p.appendChild(el('h3', 'ol-panel-title', 'Where we dive'));
      var rows = el('div', 'ol-panel-rows');
      [
        { name: 'Sipadan', desc: 'Top-10 site: turtles, sharks, barracuda tornado', price: '' },
        { name: 'Mabul', desc: 'Muck diving and our house reef', price: '' },
        { name: 'Kapalai', desc: 'Macro life on a sunken sandbar', price: '' },
        { name: 'Si Amil', desc: 'Pristine reefs and picnic beach days', price: '' }
      ].forEach(function (r) {
        rows.appendChild(el('div', 'ol-panel-row ol-row-static',
          '<span class="ol-row-name">' + r.name + '</span>' + (r.price ? '<span class="ol-row-price mono">' + r.price + '</span>' : '') + '<span class="ol-row-desc">' + r.desc + '</span>'));
      });
      p.appendChild(rows);
      p.appendChild(el('p', 'ol-panel-note mono', 'More than 3,000 species of fish and hundreds of corals in the Celebes Sea.'));
      return p;
    });

    /* --- travel styles panel --- */
    this.register('styles-panel', function () {
      var p = el('div', 'ol-panel');
      p.appendChild(el('h3', 'ol-panel-title', 'Learn to dive with us'));
      var rows = el('div', 'ol-panel-rows');
      [
        { name: 'Discover Scuba Diving', desc: 'Try diving for the first time', price: 'from RM420' },
        { name: 'Open Water Diver', desc: 'Your first full certification', price: 'from RM1,630' },
        { name: 'Advanced Open Water', desc: 'Dive to 30m at deeper sites', price: 'from RM1,360' },
        { name: 'Rescue Diver', desc: 'Look beyond yourself and help others', price: 'from RM1,465' },
        { name: 'Divemaster', desc: 'Your first step as a dive professional', price: 'from RM4,250' },
        { name: 'PADI Instructor', desc: 'Personalised IDC, world-class diving', price: 'from RM7,950' }
      ].forEach(function (r) {
        rows.appendChild(el('div', 'ol-panel-row ol-row-static',
          '<span class="ol-row-name">' + r.name + '</span>' + (r.price ? '<span class="ol-row-price mono">' + r.price + '</span>' : '') + '<span class="ol-row-desc">' + r.desc + '</span>'));
      });
      p.appendChild(rows);
      p.appendChild(el('p', 'ol-panel-note mono', 'Brief refresher dives carry no extra charge. Rates valid until 31 December 2026.'));
      return p;
    });

    /* --- contact panel (info + request form) --- */
    this.register('contact-panel', function () {
      var f = el('form', 'ol-panel ol-form');
      f.setAttribute('data-stub', 'contact: server-side validation + follow-up TODO');
      f.appendChild(el('h3', 'ol-panel-title', 'Talk to Scuba Junkie'));
      f.appendChild(el('div', 'ol-panel-note mono',
        'WhatsApp +60 19-640 0116<br/>Block B, Lot 36, Semporna, Sabah, Malaysia<br/>Dive packages, courses and rooms'));
      [['name', 'text', 'Your name'], ['phone', 'tel', 'Best phone number'], ['topic', 'text', 'Which package or course interests you?']].forEach(function (pair) {
        var input = el('input', 'ol-input');
        input.type = pair[1];
        input.name = pair[0];
        input.placeholder = pair[2];
        input.autocomplete = 'off';
        f.appendChild(input);
      });
      var note = el('p', 'ol-panel-note mono', 'Send your details and the Scuba Junkie team will follow up.');
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
          sum.textContent = 'Captured: ' + (d.leadName || '') + (d.leadPhone ? ', ' + d.leadPhone : '') + '. The Scuba Junkie team will follow up.';
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
