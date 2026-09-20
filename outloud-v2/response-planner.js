/* ===============================================================
   OutLoud 2.0 — RESPONSE PLANNER  (CONTEXT 3 of 3: reasoning)
   "What should happen next?" — receives the user message, approved
   knowledge (Context 1), policy-filtered customer memory (Context 2),
   and the avatar/content capabilities, then produces a structured
   Multimodal Response Plan:

     {
       protocolVersion, planVersion, sessionId, turnId, responseId,
       speech: { text, streamHint, chunks },
       avatar: { baseline, gestures[], gaze[], expressions[] },
       content: [ { action, target, data, at } ],
       memory: { propose: [ {key, value, origin} ] }   // proposals only
     }

   This build's reasoning is a deterministic intent router — an HONEST
   STUB for the model-backed experience planner. The interface and
   plan shape are final; swapping in a model call later changes only
   produce()'s internals. The plan is ALWAYS validated before render.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;

  function rid(prefix) { return prefix + '-' + Date.now().toString(36); }

  /* Sentence-ish chunking for progressive delivery. */
  function chunk(text) {
    var parts = String(text).split(/(?<=[.!?])\s+/);
    var chunks = [], buf = '';
    parts.forEach(function (p) {
      buf += (buf ? ' ' : '') + p;
      if (buf.length > 110) { chunks.push(buf); buf = ''; }
    });
    if (buf) { chunks.push(buf); }
    return chunks.length ? chunks : [text];
  }

  function Planner(bus, memory) {
    this.bus = bus;
    this.memory = memory; // live SessionMemory — Context 3 writes go through
                          // Context 2's guarded APIs only (propose / setLeadState)
  }

  Planner.prototype.detectIntent = function (text, memory) {
    var low = String(text || '').toLowerCase();
    if (memory.leadState === 'capturing') { return 'lead-capture'; }
    if (/^(hi|hey|hello|yo|good (morning|afternoon|evening))\b/.test(low)) { return 'greet'; }
    if (/(book|demo|walkthrough|schedule|sign up|talk to)/.test(low)) { return 'book'; }
    if (/(price|pricing|cost|how much|plan)/.test(low)) { return 'pricing'; }
    if (/(what is outloud|what does|how does it work|how it works|brain|built|stack)/.test(low)) { return 'how-it-works'; }
    if (/(client|example|live page|who uses|sites)/.test(low)) { return 'live-sites'; }
    if (/(how long|timeline|when)/.test(low)) { return 'timeline'; }
    return 'open-question';
  };

  /* Lead capture mini-flow (name → business → phone), driven by
     session memory — UI never holds this state. */
  Planner.prototype.leadStep = function (text) {
    var m = this.memory;
    var f = m.recall().facts;
    if (!f['lead.name']) {
      m.propose([{ key: 'lead.name', value: text.trim(), origin: 'user-stated' }]);
      m.setLeadState('capturing');
      return {
        speech: "Thanks, " + text.trim().split(' ')[0] + ". What business is it for?",
        content: [], followState: 'capturing'
      };
    }
    if (!f['lead.business']) {
      m.propose([{ key: 'lead.business', value: text.trim(), origin: 'user-stated' }]);
      return { speech: "Got it. And the best phone number for the walkthrough call?", content: [], followState: 'capturing' };
    }
    m.propose([{ key: 'lead.phone', value: text.trim(), origin: 'user-stated' }]);
    m.setLeadState('captured');
    return {
      speech: "Saved. Here's what I have: " + f['lead.name'] + " at " + f['lead.business'] +
        ", " + text.trim() + ". A BlueColumn strategist will call to schedule the walkthrough.",
      content: [{ action: 'update', target: 'booking-panel', data: { leadCaptured: true }, at: 300 }],
      followState: 'captured'
    };
  };

  Planner.prototype.produce = function (turn) {
    /* turn = { userText, knowledge, memory, turnId, sessionId, contentIds } */
    var memory = turn.memory;
    var intent = this.detectIntent(turn.userText, memory);
    this.bus.publish('intent.detected', { intent: intent }, { sessionId: turn.sessionId, turnId: turn.turnId });

    var speech, gestures = [], gaze = [], expressions = [], content = [], propose = [], follow = null;

    /* Only explicit user statements become memory (three-context rule). */
    var stated = turn.userText.match(/\b(?:my name is|i'?m|i am|call me)\s+([A-Z][a-zA-Z]+)/);
    if (stated) { propose.push({ key: 'visitor.name', value: stated[1], origin: 'user-stated' }); }
    var place = turn.userText.match(/\b(?:in|near|from)\s+((?:Mesa|Chandler|Gilbert|Tempe|Scottsdale|Phoenix|Queen Creek|Ahwatukee)[a-z ]*)/i);
    if (place) { propose.push({ key: 'visitor.location', value: place[1].trim(), origin: 'user-stated' }); }

    var helloName = turn.memory.facts['visitor.name'] ? ', ' + turn.memory.facts['visitor.name'] : '';

    switch (intent) {
      case 'lead-capture': {
        var step = this.leadStep(turn.userText);
        speech = step.speech; content = step.content; follow = step.followState;
        expressions.push({ name: 'warm', intensity: 0.7, at: 0 });
        gaze.push({ target: 'user', transitionMs: 260, holdMs: 3000, at: 0 });
        break;
      }
      case 'greet': {
        speech = "Hey there" + helloName + ". Ask me anything — what OutLoud does, what it costs, how it works — or say book a demo and I'll take your details.";
        expressions.push({ name: 'warm', intensity: 0.8, at: 0 });
        gestures.push({ name: 'nod', intensity: 0.5, entryMs: 240, holdMs: 500, releaseMs: 320, at: 200 });
        break;
      }
      case 'book': {
        var rf = turn.memory.facts;
        if (turn.memory.leadState === 'captured' && rf['lead.name'] && rf['lead.phone']) {
          speech = "You're on the list" + (rf['lead.name'] ? ", " + rf['lead.name'] : "") +
            " — a BlueColumn strategist will call " + rf['lead.phone'] + " to schedule the walkthrough. Anything else I can answer first?";
          expressions.push({ name: 'warm', intensity: 0.8, at: 0 });
          gestures.push({ name: 'nod', intensity: 0.5, entryMs: 240, holdMs: 500, releaseMs: 320, at: 200 });
          content.push({ action: 'show', target: 'booking-panel', data: { leadCaptured: true }, at: 400 });
          break;
        }
        speech = "Let's do it. I'll take your name, business, and best phone number — a BlueColumn strategist schedules the walkthrough from there. First: what's your name?";
        this.memory.setLeadState('capturing');
        expressions.push({ name: 'alert', intensity: 0.6, at: 0 });
        gaze.push({ target: 'panel:booking-panel', transitionMs: 260, holdMs: 2200, returnTarget: 'user', at: 300 });
        gestures.push({ name: 'present_center', intensity: 0.62, entryMs: 260, holdMs: 1100, releaseMs: 380, at: 300 });
        content.push({ action: 'show', target: 'booking-panel', data: { focus: 'lead-name' }, at: 400 });
        break;
      }
      case 'pricing': {
        var price = turn.knowledge || {};
        speech = price.text;
        expressions.push({ name: 'friendly', intensity: 0.7, at: 0 });
        gaze.push({ target: 'panel:pricing-panel', transitionMs: 260, holdMs: 2600, returnTarget: 'user', at: 300 });
        gestures.push({ name: 'present_right', intensity: 0.62, entryMs: 260, holdMs: 1100, releaseMs: 380, at: 300 });
        content.push({ action: 'show', target: 'pricing-panel', data: {}, at: 400 });
        content.push({ action: 'highlight', target: 'pricing-panel', data: { lines: ['essential', 'engine'] }, at: 900 });
        break;
      }
      case 'how-it-works':
      case 'live-sites':
      case 'timeline':
      case 'open-question': {
        var k = turn.knowledge || {};
        speech = k.text;
        if (k.source === 'rag') {
          expressions.push({ name: 'thinking', intensity: 0.4, at: 0 });
        } else {
          expressions.push({ name: 'friendly', intensity: 0.6, at: 0 });
        }
        if (intent === 'how-it-works') {
          gestures.push({ name: 'lean_in', intensity: 0.4, entryMs: 300, holdMs: 1400, releaseMs: 400, at: 300 });
        }
        break;
      }
      default: {
        speech = turn.knowledge ? turn.knowledge.text : "What would you like to know?";
        break;
      }
    }

    var responseId = rid('resp');
    return {
      protocolVersion: '2.0',
      planVersion: '2.0',
      sessionId: turn.sessionId,
      turnId: turn.turnId,
      responseId: responseId,
      speech: {
        text: speech,
        streamHint: CONFIG.voice.streamChunks && chunk(speech).length > 1,
        chunks: chunk(speech),
        source: turn.knowledge ? turn.knowledge.source : 'planner'
      },
      avatar: {
        baseline: JSON.parse(JSON.stringify(CONFIG.avatar.baseline)),
        gestures: gestures,
        gaze: gaze,
        expressions: expressions
      },
      content: content,
      memory: { propose: propose, followState: follow },
      meta: { intent: intent, knowledgeSource: turn.knowledge ? turn.knowledge.source : 'none' }
    };
  };

  window.OUTLOUD = window.OUTLOUD || {};
  window.OUTLOUD.ResponsePlanner = Planner;
})();
