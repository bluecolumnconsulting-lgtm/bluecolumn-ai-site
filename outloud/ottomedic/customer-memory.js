/* ===============================================================
   OutLoud 2.0 — CUSTOMER / SESSION MEMORY LAYER  (CONTEXT 2 of 3)
   "What do we know about this customer?" — consented session facts,
   preferences, lead state, project details.

   STRICT BOUNDARIES (spec: three-context rule):
     • Business documentation NEVER lands here (that's Context 1).
     • The chat transcript is session-scoped, NEVER promoted to
       permanent customer memory by itself.
     • Facts become memory only from explicit user statements or
       high-confidence interaction data — with an audit record.
     • UI state is never the source of truth for lead state; this
       layer is, and it persists to localStorage per session.

   TODO(server): persist long-lived consented memory to the
   BlueColumn customer namespace (server-side write, validated).
   The in-page store below is the client mirror of that record.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;

  function load() {
    try {
      var raw = localStorage.getItem(CONFIG.session.storageKey);
      if (raw) { return JSON.parse(raw); }
    } catch (e) {}
    return null;
  }

  function SessionMemory() {
    var saved = load();
    this.id = (saved && saved.id) || 'sess-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    this.startedAt = new Date().toISOString();
    this.facts = (saved && saved.facts) || {};        // consented/session facts
    this.leadState = (saved && saved.leadState) || 'none';  // none | capturing | captured
    this.lead = (saved && saved.lead) || {};          // structured lead record
    this.audit = (saved && saved.audit) || [];        // every memory write, with reason
    this.transcript = [];                             // session-scoped ONLY
    this.persist();
  }

  SessionMemory.prototype.persist = function () {
    try {
      localStorage.setItem(CONFIG.session.storageKey, JSON.stringify({
        id: this.id, startedAt: this.startedAt,
        facts: this.facts, leadState: this.leadState, lead: this.lead, audit: this.audit.slice(-50)
      }));
    } catch (e) {}
  };

  /* Transcript entry — session-scoped, deliberately NOT a fact. */
  SessionMemory.prototype.logTurn = function (role, text) {
    this.transcript.push({ role: role, text: text, at: new Date().toISOString() });
  };

  /* Write a fact with provenance + audit. `origin` must be
     'user-stated' or 'interaction' — never 'invented'. */
  SessionMemory.prototype.setFact = function (key, value, origin) {
    if (!key) { return; }
    var prev = this.facts[key];
    this.facts[key] = { value: value, origin: origin || 'interaction', at: new Date().toISOString() };
    this.audit.push({ key: key, from: prev ? prev.value : null, to: value, origin: origin || 'interaction', at: this.facts[key].at });
    this.persist();
  };

  /* Memory proposals from the planner (Context 3 can only PROPOSE;
     this layer decides and records). Spec: propose memory facts only
     when supported by explicit user input or high-confidence data. */
  SessionMemory.prototype.propose = function (proposals) {
    var m = this, applied = [];
    (proposals || []).forEach(function (p) {
      if (!p || !p.key || p.value === undefined || p.value === null || p.value === '') { return; }
      if (p.origin !== 'user-stated' && p.origin !== 'interaction') { return; }
      m.setFact(p.key, p.value, p.origin);
      applied.push(p.key);
    });
    return applied;
  };

  /* Lead state transitions — the single source of truth. */
  SessionMemory.prototype.setLeadState = function (state) {
    this.leadState = state;
    this.audit.push({ leadState: state, at: new Date().toISOString() });
    this.persist();
  };

  /* Policy-filtered recall for the planner: returns a plain,
     serializable view. Nothing raw leaks (audit stays internal). */
  SessionMemory.prototype.recall = function () {
    var out = { sessionId: this.id, leadState: this.leadState, facts: {} }, k;
    for (k in this.facts) {
      if (Object.prototype.hasOwnProperty.call(this.facts, k)) {
        out.facts[k] = this.facts[k].value;
      }
    }
    return out;
  };

  /* Deliberate NO-OP: nothing here may store business knowledge.
     Call sites (planner) never route catalog/rag text through this
     layer; this stub exists so a future mistake fails loudly. */
  SessionMemory.prototype.assertNotBusinessKnowledge = function (text) {
    if (/\$\d+|per month|setup/i.test(String(text)) && arguments[1] === 'fact') {
      throw new Error('three-context violation: business knowledge blocked from customer memory');
    }
  };

  window.OUTLOUD = window.OUTLOUD || {};
  window.OUTLOUD.SessionMemory = SessionMemory;
})();
