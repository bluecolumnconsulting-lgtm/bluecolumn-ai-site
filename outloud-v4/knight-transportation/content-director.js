/* ===============================================================
   Knight Transportation — CONTENT DIRECTOR (UI/Content channel)
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
      p.appendChild(el('h3', 'ol-panel-title', 'Knight Transportation at a glance'));
      var rows = el('div', 'ol-panel-rows');
      [
        { name: 'Founded', desc: '1990 in Phoenix, Arizona, by the four Knight cousins', price: '1990' },
        { name: 'Parent', desc: 'Knight-Swift Transportation Holdings (NYSE: KNX)', price: '2017' },
        { name: 'Network', desc: 'National terminals, shops, and academies across the U.S.', price: 'Nationwide' },
        { name: 'Services', desc: 'Dry Van, Refrigerated, Port, Dedicated, Logistics, Expedited', price: '6 core' },
        { name: 'HQ', desc: '5601 West Buckeye Road, Phoenix, Arizona', price: '85043' },
        { name: 'Tagline', desc: 'Delivering More', price: '' }
      ].forEach(function (r) {
        rows.appendChild(el('div', 'ol-panel-row ol-row-static',
          '<span class="ol-row-name">' + r.name + '</span>' + (r.price ? '<span class="ol-row-price mono">' + r.price + '</span>' : '') + '<span class="ol-row-desc">' + r.desc + '</span>'));
      });
      p.appendChild(rows);
      return p;
    });

    /* --- services panel --- */
    this.register('services-panel', function () {
      var p = el('div', 'ol-panel');
      p.appendChild(el('h3', 'ol-panel-title', 'Our services'));
      var rows = el('div', 'ol-panel-rows');
      [
        { name: 'Dry Van', desc: 'Full truckload van freight', price: '' },
        { name: 'Refrigerated', desc: 'Temperature-controlled freight', price: '' },
        { name: 'Port Services', desc: 'Drayage and port logistics', price: '' },
        { name: 'Dedicated', desc: 'Committed fleets and routes', price: '' },
        { name: 'Logistics', desc: 'Brokerage and managed capacity', price: '' },
        { name: 'Expedited', desc: 'Time-critical shipments', price: '' }
      ].forEach(function (r) {
        rows.appendChild(el('div', 'ol-panel-row ol-row-static',
          '<span class="ol-row-name">' + r.name + '</span>' + (r.price ? '<span class="ol-row-price mono">' + r.price + '</span>' : '') + '<span class="ol-row-desc">' + r.desc + '</span>'));
      });
      p.appendChild(rows);
      p.appendChild(el('p', 'ol-panel-note mono', 'Also: Flatbed, Teams, Owner Operators, and warehousing through the Knight-Swift network.'));
      return p;
    });

    /* --- careers panel --- */
    this.register('careers-panel', function () {
      var p = el('div', 'ol-panel');
      p.appendChild(el('h3', 'ol-panel-title', 'Drive for Knight'));
      var rows = el('div', 'ol-panel-rows');
      [
        { name: 'OTR', desc: 'Over-the-road truckload', price: '' },
        { name: 'Regional', desc: 'Local and regional routes', price: '' },
        { name: 'Dedicated', desc: 'Committed fleets', price: '' },
        { name: 'Teams', desc: 'Team driving opportunities', price: '' },
        { name: 'Owner Operators', desc: 'Run under Knight authority', price: '' },
        { name: 'CDL Training', desc: 'Permit, school, and OTR training', price: '' }
      ].forEach(function (r) {
        rows.appendChild(el('div', 'ol-panel-row ol-row-static',
          '<span class="ol-row-name">' + r.name + '</span>' + (r.price ? '<span class="ol-row-price mono">' + r.price + '</span>' : '') + '<span class="ol-row-desc">' + r.desc + '</span>'));
      });
      p.appendChild(rows);
      p.appendChild(el('p', 'ol-panel-note mono', 'Benefits: health, 401k match, PTO, tuition assistance, stock purchase plan, and bonuses. Drivers call 1-888-457-0974.'));
      return p;
    });

    /* --- contact panel (info + request form) --- */
    this.register('contact-panel', function () {
      var f = el('form', 'ol-panel ol-form');
      f.setAttribute('data-stub', 'contact: server-side validation + follow-up TODO');
      f.appendChild(el('h3', 'ol-panel-title', 'Talk to Knight Transportation'));
      f.appendChild(el('div', 'ol-panel-note mono',
        '800-489-2000 · contact@knighttrans.com<br/>Drivers: 1-888-457-0974<br/>5601 West Buckeye Road, Phoenix, Arizona 85043'));
      [['name', 'text', 'Your name'], ['phone', 'tel', 'Best phone number'], ['topic', 'text', 'What is this about?']].forEach(function (pair) {
        var input = el('input', 'ol-input');
        input.type = pair[1];
        input.name = pair[0];
        input.placeholder = pair[2];
        input.autocomplete = 'off';
        f.appendChild(input);
      });
      var note = el('p', 'ol-panel-note mono', 'Send your details and the Knight team will follow up.');
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
          if (title) { title.textContent = 'Request captured'; }
          [].forEach.call(r.el.querySelectorAll('input, .ol-submit'), function (n) {
            n.classList.add('ol-hidden');
            if (n.tagName === 'BUTTON') { n.disabled = true; }
          });
          var sum = r.el.querySelector('.ol-lead-summary');
          if (!sum) {
            sum = el('p', 'ol-lead-summary');
            r.el.insertBefore(sum, r.el.querySelector('.ol-panel-note'));
          }
          sum.textContent = 'Captured: ' + (d.leadName || '') + (d.leadPhone ? ', ' + d.leadPhone : '') + '. The Knight team will follow up.';
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
