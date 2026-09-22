/* ===============================================================
   OutLoud 2.0 — CONTENT DIRECTOR (UI/Content channel)
   Spec: Content Registry (component management) + Action Registry
   (component events), mounted via SDK config
     content: { host: "#outloud-content-panel", allowTakeover: true }
   Response Plans address panels by id; interactive events from the
   panels feed BACK into the agent response cycle (a selection like
   "Two-panel repair" becomes usable context for the next response).

   Every plan-driven action is validated (plan-validator + registry
   membership here) before touching the DOM. Business actions that
   mutate real state (booking/CRM) are stubs pending server-side
   validation, marked data-stub below.
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

    /* --- pricing panel --- */
    this.register('pricing-panel', function () {
      var p = el('div', 'ol-panel');
      p.appendChild(el('h3', 'ol-panel-title', 'AlwaysOn plans'));
      var rows = el('div', 'ol-panel-rows');
      [
        { id: 'essential', name: 'AlwaysOn Essential', desc: 'Answers customer questions, captures leads, and books on a live calendar, 24/7. We build it, run it, and manage it.', price: '$497 setup · $97/mo' },
        { id: 'engine', name: 'AlwaysOn Lead Engine', desc: 'Everything in Essential, plus a managed lead list for your trade and service area, worked around the clock.', price: '$997 setup · $197/mo' }
      ].forEach(function (r) {
        var row = el('button', 'ol-panel-row', '<span class="ol-row-name">' + r.name + '</span><span class="ol-row-price mono">' + r.price + '</span><span class="ol-row-desc">' + r.desc + '</span>');
        row.type = 'button';
        row.setAttribute('data-row', r.id);
        row.addEventListener('click', function () {
          self.emitAction('plan.select', { plan: r.id, label: r.name });
          p.setAttribute('data-selected', r.id);
          [].forEach.call(p.querySelectorAll('.ol-panel-row'), function (n) { n.classList.remove('sel'); });
          row.classList.add('sel');
        });
        rows.appendChild(row);
      });
      p.appendChild(rows);
      p.appendChild(el('p', 'ol-panel-note mono', 'Setups are one-time. No contracts, month to month.'));
      return p;
    });

    /* --- live client sites panel --- */
    this.register('sites-panel', function () {
      var p = el('div', 'ol-panel');
      p.appendChild(el('h3', 'ol-panel-title', 'Live on OutLoud'));
      var rows = el('div', 'ol-panel-rows');
      [
        { name: 'Star Jet Ski Rentals' },
        { name: 'Vulcan Fence' },
        { name: 'HomeSpark' },
        { name: 'OttoMedic' },
        { name: 'Adventure Club' },
        { name: 'Venture Club' }
      ].forEach(function (r) {
        rows.appendChild(el('div', 'ol-panel-row ol-row-static', '<span class="ol-row-name">' + r.name + '</span>'));
      });
      p.appendChild(rows);
      p.appendChild(el('p', 'ol-panel-note mono', 'At Arcadia Fence and Gate, booked jobs went up 40% in the first month.'));
      return p;
    });

    /* --- avatar catalog panel (the tier model, shown on-screen) --- */
    this.register('avatars-panel', function () {
      var p = el('div', 'ol-panel');
      p.appendChild(el('h3', 'ol-panel-title', 'Pick your face'));
      var rows = el('div', 'ol-panel-rows');
      [
        { id: 'animated', name: 'Animated character', desc: 'A custom mascot with live lip-sync, gestures, and gaze. Included with every plan.', price: 'Included' },
        { id: 'stock', name: 'Stock video faces', desc: 'Real-time talking heads from the Simli library — pick one, it speaks live with your voice.', price: 'Lead Engine tier' },
        { id: 'custom', name: 'Custom face', desc: 'Your face (or a brand character we build). The one on this page is a real custom face.', price: 'Premium add-on' }
      ].forEach(function (r) {
        rows.appendChild(el('div', 'ol-panel-row ol-row-static',
          '<span class="ol-row-name">' + r.name + '</span><span class="ol-row-price mono">' + r.price + '</span><span class="ol-row-desc">' + r.desc + '</span>'));
      });
      p.appendChild(rows);
      p.appendChild(el('p', 'ol-panel-note mono', 'Every avatar speaks with your business knowledge and books on your calendar.'));
      return p;
    });

    /* --- booking panel (lead capture form) --- */
    this.register('booking-panel', function () {
      var f = el('form', 'ol-panel ol-form');
      f.setAttribute('data-stub', 'booking: server-side validation + calendar write TODO');
      f.appendChild(el('h3', 'ol-panel-title', 'Book a walkthrough'));
      [['name', 'text', 'Your name'], ['business', 'text', 'Business (or "none")'], ['phone', 'tel', 'Best phone number']].forEach(function (pair) {
        var input = el('input', 'ol-input');
        input.type = pair[1];
        input.name = pair[0];
        input.placeholder = pair[2];
        input.autocomplete = 'off';
        f.appendChild(input);
      });
      var note = el('p', 'ol-panel-note mono', 'A BlueColumn strategist schedules the walkthrough from these details.');
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
          note.textContent = 'Need a ' + missing.join(' and a ') + ' so the strategist can actually call you.';
          return;
        }
        self.emitAction('booking.submit', data);
        note.textContent = 'Captured. Production: calendar + SMS confirmation run server-side.';
      });
      return f;
    });

    /* First paint: panels built lazily on first show. */
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
        /* Captured lead: swap the form for a confirmation summary. */
        if (d.leadCaptured) {
          var title = r.el.querySelector('.ol-panel-title');
          if (title) { title.textContent = 'Walkthrough request captured'; }
          [].forEach.call(r.el.querySelectorAll('input, .ol-submit'), function (n) {
            n.classList.add('ol-hidden');
            if (n.tagName === 'BUTTON') { n.disabled = true; }
          });
          var sum = r.el.querySelector('.ol-lead-summary');
          if (!sum) {
            sum = el('p', 'ol-lead-summary');
            r.el.insertBefore(sum, r.el.querySelector('.ol-panel-note'));
          }
          sum.textContent = 'Captured: ' + (d.leadName || '') + (d.leadBusiness ? ' at ' + d.leadBusiness : '') +
            (d.leadPhone ? ', ' + d.leadPhone : '') + '. A strategist will call to schedule.';
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
