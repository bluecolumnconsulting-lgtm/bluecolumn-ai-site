/* ===============================================================
   Knight Transportation — RESPONSE PLANNER  (CONTEXT 3 of 3: reasoning)
   "What should happen next?" — receives the user message, approved
   knowledge (Context 1), policy-filtered session memory (Context 2),
   and the avatar/content capabilities, then produces a structured
   Multimodal Response Plan:

     { speech, avatar { gestures, gaze, expressions }, content[], memory }

   The live brain supplies the ANSWER for open questions; the planner
   CHOREOGRAPHS it — gaze toward the right panel, gestures, a natural
   follow-up. Every plan is validated before render.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;

  function rid(prefix) { return prefix + '-' + Date.now().toString(36); }

  /* Sentence-ish chunking for progressive delivery. */
  function chunk(text) {
    var parts = String(text).split(/(?<=[.!?])\s+/);
    if (parts.length < 2) { return [String(text)]; }
    var chunks;
    if (parts[0].length <= 220) { chunks = [parts[0]]; parts = parts.slice(1); }
    else { chunks = []; }
    var buf = '';
    parts.forEach(function (p) {
      buf += (buf ? ' ' : '') + p;
      if (buf.length > 110) { chunks.push(buf); buf = ''; }
    });
    if (buf) { chunks.push(buf); }
    return chunks;
  }

  var FOLLOWUPS = [
    "Want to hear about driving careers?",
    "Want me to show you our services?",
    "Happy to go deeper on any part of that.",
    "Anything there you want me to expand on?",
    "Want the contact details in case you'd like to reach the team?"
  ];

  function pick(list, i) { return list[((i % list.length) + list.length) % list.length]; }

  function Planner(bus, memory) {
    this.bus = bus;
    this.memory = memory;
    this._lastIntent = null;
    this._lastTextHead = '';
    this._lastFollow = -1;
    this._turnCount = 0;
  }

  Planner.prototype.detectIntent = function (text, memory) {
    var low = String(text || '').toLowerCase().trim();
    if (memory.leadState === 'capturing') { return 'lead-capture'; }
    var words = low.split(/\s+/).filter(Boolean).length;
    if (/^(hi|hey|hello|yo|good (morning|afternoon|evening)|what'?s up|sup)\b/.test(low) && words <= 3) { return 'greet'; }
    if (/(job|jobs|career|careers|hiring|apply|employment|work for|openings|positions|driver|driving|cdl|owner operator|technician|shop|office|wage|pay|benefits)/.test(low)) { return 'careers'; }
    if (/(quote|freight quote|price|pricing|rate|ship|shipping|request a quote|load|capacity|dry van|refrigerated|reefer|port|dedicated|logistics|expedited|flatbed|service)/.test(low)) { return 'services'; }
    if (/(military|veteran|million mile|safety|equipment|trucks|tractors|volvo|international|kenworth|freightliner|peterbilt|fleet|technology)/.test(low)) { return 'facts'; }
    if (/(contact|phone|call|email|reach you|talk to|address|located|where are you|get in touch|human|person)/.test(low)) { return 'contact'; }
    if (/^(thanks|thank you|ty|appreciate|great|perfect|awesome|sounds good|cool|bye|goodbye|that'?s all)\b/.test(low)) { return 'thanks'; }
    return 'open-question';
  };

  Planner.prototype._name = function (memory) {
    var n = memory.facts['visitor.name'];
    return n ? String(n) : '';
  };

  Planner.prototype._followUp = function (intent) {
    var i = this._turnCount;
    var fu = pick(FOLLOWUPS, i + (intent === 'careers' ? 1 : 0));
    if (fu === this._lastFollow) { fu = pick(FOLLOWUPS, i + 2); }
    this._lastFollow = fu;
    return fu;
  };

  /* Contact form flow (name → phone → topic), driven by session memory. */
  Planner.prototype.leadStep = function (turn) {
    var m = this.memory;
    var f = m.recall().facts;
    var text = String(turn.userText || '').trim();
    var low = text.toLowerCase();
    var k = turn.knowledge || {};

    var wordCount = low.split(/\s+/).filter(Boolean).length;
    if (wordCount <= 3 && /^(never ?mind|forget it|cancel|stop|nah|no thanks|not now)\b/.test(low)) {
      m.setLeadState('none');
      return { speech: "No problem, parked for now. Ask me anything else whenever you're ready.", content: [], followState: 'none' };
    }

    if (/\?$/.test(text.trim()) || /^(what|how|why)\b/.test(low)) {
      if (turn.knowledge && turn.knowledge.source !== 'fallback') {
        var pending = f['lead.name'] ? (f['lead.phone'] ? 'what this is about' : 'the best phone number') : 'your name';
        return { speech: k.text + ' Back to that: ' + pending + '?', content: [], followState: 'capturing' };
      }
    }

    if (!f['lead.name']) {
      var raw = text.replace(/^(my name is|i'?m|i am|this is|it'?s|call me|name'?s)\s+/i, '').trim();
      var name = raw.split(/\s+/).slice(0, 3).join(' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      var filler = /^(um+|uh+|hmm+|er+|ah+|okay|ok|well|so|yeah|yes|no|like|sure)\b/i;
      if (name.length < 2 || name.length > 40 || filler.test(name) || filler.test(raw)) {
        return { speech: "I didn't quite catch a name there. What should I put down?", content: [], followState: 'capturing' };
      }
      m.propose([{ key: 'lead.name', value: name, origin: 'user-stated' }]);
      return { speech: "Thanks, " + name.split(' ')[0] + ". What's the best phone number to reach you?", content: [], followState: 'capturing' };
    }

    if (!f['lead.phone']) {
      var digits = text.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) {
        return { speech: "That number looks short of a real one. Something like 602 555 0134 works. What's the best number?", content: [], followState: 'capturing' };
      }
      var pretty = digits.length === 10 ? '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6) : digits;
      m.propose([{ key: 'lead.phone', value: pretty, origin: 'user-stated' }]);
      return { speech: "Got it. And what's this about — a freight quote, a driving job, or something else?", content: [], followState: 'capturing' };
    }

    var topic = text.trim() || 'General question';
    m.propose([{ key: 'lead.topic', value: topic, origin: 'user-stated' }]);
    m.setLeadState('captured');
    return {
      speech: "Saved. I have " + f['lead.name'] + ", " + f['lead.phone'] + ", about " + topic + ". The Knight team will follow up from there.",
      content: [{ action: 'update', target: 'contact-panel', data: { leadCaptured: true, leadName: f['lead.name'], leadPhone: f['lead.phone'] }, at: 300 }],
      followState: 'captured'
    };
  };

  Planner.prototype.produce = function (turn) {
    var memory = turn.memory;
    var intent = this.detectIntent(turn.userText, memory);
    /* Agent answers that carry a visual always go through the open path. */
    if (turn.knowledge && turn.knowledge.knowledgeId && String(turn.knowledge.knowledgeId).indexOf('agent:') === 0 &&
        ['greet', 'lead-capture', 'contact', 'careers', 'services'].indexOf(intent) === -1) { intent = 'open'; }
    this.bus.publish('intent.detected', { intent: intent }, { sessionId: turn.sessionId, turnId: turn.turnId });
    this._turnCount += 1;

    var speech, gestures = [], gaze = [], expressions = [], content = [], propose = [], follow = null;
    var k = turn.knowledge || {};

    var stated = turn.userText.match(/\b(?:my name is|i'?m|i am|call me|this is|name'?s)\s+([A-Za-z]+)/);
    if (stated) { propose.push({ key: 'visitor.name', value: stated[1].replace(/\b\w/, function (c) { return c.toUpperCase(); }), origin: 'user-stated' }); }

    var name = this._name(memory);
    var helloName = name ? ', ' + name : '';
    var repeat = (intent === this._lastIntent && this._lastIntent !== null &&
      String(turn.userText).toLowerCase().slice(0, 18) === this._lastTextHead);

    switch (intent) {
      case 'lead-capture': {
        var step = this.leadStep(turn);
        speech = step.speech; content = step.content; follow = step.followState;
        expressions.push({ name: 'warm', intensity: 0.7, at: 0 });
        gaze.push({ target: 'user', transitionMs: 260, holdMs: 3000, at: 0 });
        break;
      }
      case 'greet': {
        speech = CONFIG.client.greeting;
        expressions.push({ name: 'warm', intensity: 0.8, at: 0 });
        gestures.push({ name: 'nod', intensity: 0.5, entryMs: 240, holdMs: 500, releaseMs: 320, at: 200 });
        break;
      }
      case 'thanks': {
        speech = pick([
          "Anytime" + helloName + ". If you want the team to reach out, say contact us and I'll take your details.",
          "Glad that helped. Anything else about shipping or driving you'd like to know?",
          "Happy to help. Want me to show how to get a freight quote?"
        ], this._turnCount);
        expressions.push({ name: 'warm', intensity: 0.8, at: 0 });
        gestures.push({ name: 'nod', intensity: 0.5, entryMs: 240, holdMs: 500, releaseMs: 320, at: 200 });
        break;
      }
      case 'contact': {
        speech = "Easiest paths: call 800-489-2000, email contact@knighttrans.com, or leave your name and number here and the team will reach out. Drivers can call 1-888-457-0974. The screen has the details.";
        expressions.push({ name: 'friendly', intensity: 0.7, at: 0 });
        gaze.push({ target: 'panel:contact-panel', transitionMs: 260, holdMs: 2600, returnTarget: 'user', at: 300 });
        gestures.push({ name: 'present_center', intensity: 0.62, entryMs: 260, holdMs: 1100, releaseMs: 380, at: 300 });
        content.push({ action: 'show', target: 'contact-panel', data: {}, at: 400 });
        break;
      }
      case 'careers': {
        speech = k.text;
        if (repeat) { speech = "Happy to run it again. " + speech; }
        expressions.push({ name: 'friendly', intensity: 0.7, at: 0 });
        gaze.push({ target: 'panel:careers-panel', transitionMs: 260, holdMs: 2600, returnTarget: 'user', at: 300 });
        gestures.push({ name: 'present_right', intensity: 0.62, entryMs: 260, holdMs: 1100, releaseMs: 380, at: 300 });
        content.push({ action: 'show', target: 'careers-panel', data: {}, at: 400 });
        break;
      }
      case 'services': {
        speech = k.text;
        if (repeat) { speech = "Sure. " + speech; }
        expressions.push({ name: 'friendly', intensity: 0.7, at: 0 });
        gaze.push({ target: 'panel:services-panel', transitionMs: 260, holdMs: 2600, returnTarget: 'user', at: 300 });
        gestures.push({ name: 'present_right', intensity: 0.6, entryMs: 260, holdMs: 1100, releaseMs: 380, at: 300 });
        content.push({ action: 'show', target: 'services-panel', data: {}, at: 400 });
        break;
      }
      case 'facts': {
        speech = k.text;
        if (repeat) { speech = "Happy to run it again. " + speech; }
        expressions.push({ name: 'friendly', intensity: 0.7, at: 0 });
        gaze.push({ target: 'panel:facts-panel', transitionMs: 260, holdMs: 2600, returnTarget: 'user', at: 300 });
        gestures.push({ name: 'present_center', intensity: 0.6, entryMs: 260, holdMs: 1100, releaseMs: 380, at: 300 });
        content.push({ action: 'show', target: 'facts-panel', data: {}, at: 400 });
        break;
      }
      default: { /* open-question: the live brain's answer, choreographed */
        speech = k.text || "What would you like to know about Knight Transportation?";
        if (k.remember) {
          Object.keys(k.remember).forEach(function (key) {
            if (k.remember[key]) { propose.push({ key: 'visitor.' + key, value: String(k.remember[key]), origin: 'user-stated' }); }
          });
        }
        if (k.show) {
          content.push({ action: 'show', target: k.show, data: {}, at: 400 });
          gaze.push({ target: 'panel:' + k.show, transitionMs: 260, holdMs: 2200, returnTarget: 'user', at: 300 });
        }
        if (k.leadSaved) {
          follow = 'captured';
          content.push({ action: 'update', target: 'contact-panel', data: { leadCaptured: true, leadName: (k.lead && k.lead.name) || '', leadPhone: (k.lead && k.lead.phone) || '' }, at: 400 });
          content.push({ action: 'show', target: 'contact-panel', data: {}, at: 450 });
        }
        if (k.source === 'fallback') {
          expressions.push({ name: 'thinking', intensity: 0.5, at: 0 });
        } else {
          expressions.push({ name: 'friendly', intensity: 0.6, at: 0 });
        }
        if (k.source === 'catalog' && !repeat) { speech += ' ' + this._followUp(intent); }
        break;
      }
    }

    this._lastIntent = intent;
    this._lastTextHead = String(turn.userText || '').toLowerCase().slice(0, 18);

    if (window.OUTLOUD && window.OUTLOUD.cleanReply) {
      var cap = (CONFIG.controller && CONFIG.controller.maxAnswerWords) || 90;
      speech = window.OUTLOUD.cleanReply(speech, cap);
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
