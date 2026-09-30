/* ===============================================================
   Reicks View Farms — CONTENT DIRECTOR (UI/Content channel)
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
      p.appendChild(el('h3', 'ol-panel-title', 'Reicks View Farms at a glance'));
      var rows = el('div', 'ol-panel-rows');
      [
        { name: 'Founded', desc: '1979 by Dale and Laura Reicks, near Jerico, Iowa', price: '1979' },
        { name: 'Team', desc: '5th-generation family owners and 300+ employees', price: '300+' },
        { name: 'Market hogs', desc: 'Raised each year across 100+ finishing barns', price: '~1.5M/yr' },
        { name: 'Production partners', desc: 'Contract growers across Northeast Iowa', price: '130+' },
        { name: 'Farmland', desc: 'Row crops in Iowa and Southern Minnesota', price: '10,000+ acres' },
        { name: 'Tagline', desc: 'Families Feeding Families', price: '' }
      ].forEach(function (r) {
        rows.appendChild(el('div', 'ol-panel-row ol-row-static',
          '<span class="ol-row-name">' + r.name + '</span>' + (r.price ? '<span class="ol-row-price mono">' + r.price + '</span>' : '') + '<span class="ol-row-desc">' + r.desc + '</span>'));
      });
      p.appendChild(rows);
      return p;
    });

    /* --- careers panel --- */
    this.register('careers-panel', function () {
      var p = el('div', 'ol-panel');
      p.appendChild(el('h3', 'ol-panel-title', 'Open roles'));
      var rows = el('div', 'ol-panel-rows');
      [
        { name: 'Market Hog Driver', desc: 'Class A CDL required', price: '$25.75/hr' },
        { name: 'Feed Truck Driver', desc: 'Regional routes out of Lawler', price: '' },
        { name: 'Mill Operator', desc: 'Feed mill, Northeast Iowa', price: '' },
        { name: 'Swine Production Technician', desc: 'Sow units, nurseries, finishing', price: '$18.66/hr' },
        { name: 'IT Support Technician', desc: 'Internal systems across the operation', price: '' },
        { name: 'Agronomy & Technology Coordinator', desc: 'Row-crop and precision-ag programs', price: '' }
      ].forEach(function (r) {
        rows.appendChild(el('div', 'ol-panel-row ol-row-static',
          '<span class="ol-row-name">' + r.name + '</span>' + (r.price ? '<span class="ol-row-price mono">' + r.price + '</span>' : '') + '<span class="ol-row-desc">' + r.desc + '</span>'));
      });
      p.appendChild(rows);
      p.appendChild(el('p', 'ol-panel-note mono', 'Benefits: health, dental, 401k with match, and paid time off. Apply at reicksviewfarms.com or call 641-364-7843.'));
      return p;
    });

    /* --- community panel --- */
    this.register('community-panel', function () {
      var p = el('div', 'ol-panel');
      p.appendChild(el('h3', 'ol-panel-title', 'Giving back'));
      var rows = el('div', 'ol-panel-rows');
      [
        { name: 'Food banks', desc: 'Hams donated every Easter, Thanksgiving, and Christmas', price: '650+' },
        { name: 'Flag Day Fundraiser', desc: 'Annual event supporting local veterans', price: '$75K' },
        { name: 'Ag Education Center', desc: '4-H and FFA facility at the Howard County Fairgrounds', price: '22,900 sq ft' },
        { name: 'The Pub at the Pinicon', desc: '2019 Best Breaded Pork Tenderloin in Iowa', price: '' }
      ].forEach(function (r) {
        rows.appendChild(el('div', 'ol-panel-row ol-row-static',
          '<span class="ol-row-name">' + r.name + '</span>' + (r.price ? '<span class="ol-row-price mono">' + r.price + '</span>' : '') + '<span class="ol-row-desc">' + r.desc + '</span>'));
      });
      p.appendChild(rows);
      return p;
    });

    /* --- contact panel (info + request form) --- */
    this.register('contact-panel', function () {
      var f = el('form', 'ol-panel ol-form');
      f.setAttribute('data-stub', 'contact: server-side validation + follow-up TODO');
      f.appendChild(el('h3', 'ol-panel-title', 'Talk to Reicks View Farms'));
      f.appendChild(el('div', 'ol-panel-note mono',
        '641-364-7843 · rvfinfo@reicksview.com<br/>1020 Pembroke Avenue, PO Box 150, Lawler, Iowa 52154'));
      [['name', 'text', 'Your name'], ['phone', 'tel', 'Best phone number'], ['topic', 'text', 'What is this about?']].forEach(function (pair) {
        var input = el('input', 'ol-input');
        input.type = pair[1];
        input.name = pair[0];
        input.placeholder = pair[2];
        input.autocomplete = 'off';
        f.appendChild(input);
      });
      var note = el('p', 'ol-panel-note mono', 'Send your details and the Reicks View team will follow up.');
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
          sum.textContent = 'Captured: ' + (d.leadName || '') + (d.leadPhone ? ', ' + d.leadPhone : '') + '. The Reicks View team will follow up.';
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
