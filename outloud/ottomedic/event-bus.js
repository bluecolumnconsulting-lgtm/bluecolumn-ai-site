/* ===============================================================
   OutLoud 2.0 — EVENT BUS (spec: versioned WebSocket protocol)
   Every event uses the common envelope from the spec:

     OutLoudEvent<T> {
       protocolVersion: "2.0",
       id, type, timestamp, sessionId, turnId?, responseId?, payload
     }

   In the 2.0 client this bus runs in-page. When the server transport
   lands, publish()/subscribe() map 1:1 onto WebSocket frames — the
   envelope never changes, so the orchestrator code is transport-ready.
   =============================================================== */
(function () {
  'use strict';

  var seq = 0;

  function uid(prefix) {
    seq += 1;
    return (prefix || 'evt') + '-' + Date.now().toString(36) + '-' + seq.toString(36);
  }

  function create(type, payload, meta) {
    meta = meta || {};
    return {
      protocolVersion: '2.0',
      id: uid(type),
      type: type,
      timestamp: new Date().toISOString(),
      sessionId: meta.sessionId || null,
      turnId: meta.turnId || null,
      responseId: meta.responseId || null,
      payload: payload
    };
  }

  function EventBus() {
    this._subs = {};       // type -> [fn]
    this._any = [];        // wildcard listeners
    this.sessionId = null;
    this.turnId = null;
    this.responseId = null;
  }

  EventBus.prototype.on = function (type, fn) {
    (this._subs[type] = this._subs[type] || []).push(fn);
    return this;
  };

  EventBus.prototype.onAny = function (fn) {
    this._any.push(fn);
    return this;
  };

  EventBus.prototype.off = function (type, fn) {
    var list = this._subs[type] || [];
    var i = list.indexOf(fn);
    if (i !== -1) { list.splice(i, 1); }
    return this;
  };

  EventBus.prototype.publish = function (type, payload, meta) {
    var env = create(type, payload, meta || {
      sessionId: this.sessionId, turnId: this.turnId, responseId: this.responseId
    });
    var list = this._subs[type];
    var i;
    if (list) {
      for (i = 0; i < list.length; i++) {
        try { list[i](env); } catch (e) {
          /* one bad listener never kills the bus */
          if (window.console && console.error) { console.error('[bus] listener error', type, e); }
        }
      }
    }
    for (i = 0; i < this._any.length; i++) {
      try { this._any[i](env); } catch (e) {}
    }
    return env;
  };

  window.OUTLOUD = window.OUTLOUD || {};
  window.OUTLOUD.EventBus = EventBus;
  window.OUTLOUD.events = { create: create, uid: uid };
})();
