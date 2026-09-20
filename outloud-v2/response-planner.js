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

   Design (improved 2026-09-20):
   • Context 1 (live BlueColumn brain) supplies the ANSWER for open
     questions. The planner's job is to CHOREOGRAPH it: gaze toward
     the right panel, gestures, expressions, a natural follow-up.
   • Canned catalog lines are a fallback, not the default voice.
   • Every reply uses session memory (name, interest, lead state),
     varies phrasing so nothing sounds canned twice in a row, and
     ends open answers with a real next step.
   • Lead capture recovers from messy input: cancel phrases,
     questions mid-flow (answered, then the pending question is
     re-asked), malformed phones, "no business" answers.
   The plan is ALWAYS validated before render.
   =============================================================== */
(function () {
  'use strict';
  var CONFIG = window.OUTLOUD.CONFIG;

  function rid(prefix) { return prefix + '-' + Date.now().toString(36); }

  /* Sentence-ish chunking for progressive delivery. The FIRST
     sentence ships alone so the voice starts after one short
     synthesis instead of waiting on the whole reply. */
  function chunk(text) {
    var parts = String(text).split(/(?<=[.!?])\s+/);
    if (parts.length < 2) { return [String(text)]; }
    var chunks;
    if (parts[0].length <= 220) {
      chunks = [parts[0]];
      parts = parts.slice(1);
    } else {
      chunks = [];
    }
    var buf = '';
    parts.forEach(function (p) {
      buf += (buf ? ' ' : '') + p;
      if (buf.length > 110) { chunks.push(buf); buf = ''; }
    });
    if (buf) { chunks.push(buf); }
    return chunks;
  }

  /* Phrase pools: rotate so repeated turns never repeat verbatim. */
  var GREETINGS = [
    "Hey there{NAME}. Ask me anything: what OutLoud does, what it costs, how it works. Or say book a demo and I'll take your details.",
    "Hi{NAME}, good to see you. I can cover pricing, how the stack works, or the live client pages. What's on your mind?",
    "Hello{NAME}. I'm the OutLoud agent, and this page is me. Fire away with questions, or say book a walkthrough."
  ];
  var FOLLOWUPS = [
    "Want me to line up a walkthrough for your business?",
    "Want the pricing on that?",
    "Happy to go deeper on any part of that.",
    "Anything there you want me to expand on?",
    "Should I show you what this looks like on a live client page?"
  ];

  function pick(list, i) { return list[((i % list.length) + list.length) % list.length]; }

  function Planner(bus, memory) {
    this.bus = bus;
    this.memory = memory; // live SessionMemory — Context 3 writes go through
                          // Context 2's guarded APIs only (propose / setLeadState)
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
    if (/(book|demo|walkthrough|schedule|sign ?up|get started|talk to)/.test(low)) { return 'book'; }
    if (/(price|pricing|cost|how much|plans?\b|fee|expensive|budget)/.test(low)) { return 'pricing'; }
    if (/(how does it work|how it works|how do|what can you|what do you do|capab|under the hood|built|stack|brain|tech)/.test(low)) { return 'how-it-works'; }
    if (/(client|example|live page|who uses|sites|references|portfolio|proof|results)/.test(low)) { return 'live-sites'; }
    if (/(how long|timeline|when can|how fast|turnaround|launch)/.test(low)) { return 'timeline'; }
    if (/(email|contact|reach you|talk to a human|real person)/.test(low)) { return 'contact'; }
    if (/^(thanks|thank you|ty|appreciate|great|perfect|awesome|sounds good|cool|bye|goodbye|that'?s all)\b/.test(low)) { return 'thanks'; }
    return 'open-question';
  };

  /* ---------- helpers ---------- */
  Planner.prototype._name = function (memory) {
    var n = memory.facts['visitor.name'];
    return n ? String(n) : '';
  };

  Planner.prototype._followUp = function (intent) {
    var i = this._turnCount;
    var fu = pick(FOLLOWUPS, i + (intent === 'pricing' ? 1 : 0));
    if (fu === this._lastFollow) { fu = pick(FOLLOWUPS, i + 2); }
    this._lastFollow = fu;
    return fu;
  };

  /* Lead capture mini-flow (name → business → phone), driven by
     session memory — UI never holds this state. Recovers from
     messy input instead of dead-ending. */
  Planner.prototype.leadStep = function (turn) {
    var m = this.memory;
    var f = m.recall().facts;
    var text = String(turn.userText || '').trim();
    var low = text.toLowerCase();
    var k = turn.knowledge || {};

    /* Bail-out phrases: leave capture gracefully, keep the door open.
       Only short, unambiguous bail-outs count, so "actually, my name
       is Joe" still captures the name. */
    var wordCount = low.split(/\s+/).filter(Boolean).length;
    if (wordCount <= 3 && /^(never ?mind|forget it|cancel|stop|nah|no thanks|not now)\b/.test(low)) {
      m.setLeadState('none');
      return {
        speech: "No problem, parked for now. Ask me anything else, or say book a demo when you're ready.",
        content: [], followState: 'none'
      };
    }

    /* A question mid-capture gets a real answer first, then the
       pending question comes back. Never dead-end the visitor. */
    if (/\?$/.test(text.trim()) || /^(what|how|why)\b/.test(low)) {
      if (turn.knowledge && turn.knowledge.source !== 'fallback') {
        var pending = f['lead.name'] ? (f['lead.business'] ? 'your phone number' : 'the business name') : 'your name';
        return {
          speech: k.text + ' Back to the walkthrough: ' + pending + '?',
          content: [], followState: 'capturing'
        };
      }
    }

    if (!f['lead.name']) {
      /* Strip common prefixes; keep up to 3 words. Reject filler. */
      var raw = text.replace(/^(my name is|i'?m|i am|this is|it'?s|call me|name'?s)\s+/i, '').trim();
      var name = raw.split(/\s+/).slice(0, 3).join(' ')
        .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      var filler = /^(um+|uh+|hmm+|er+|ah+|okay|ok|well|so|yeah|yes|no|like|sure)\b/i;
      if (name.length < 2 || name.length > 40 || filler.test(name) || filler.test(raw)) {
        return {
          speech: "I didn't quite catch a name there. What should I put down?",
          content: [], followState: 'capturing'
        };
      }
      m.propose([{ key: 'lead.name', value: name, origin: 'user-stated' }]);
      var first = name.split(' ')[0];
      return {
        speech: "Thanks, " + first + ". What business is this for?",
        content: [], followState: 'capturing'
      };
    }

    if (!f['lead.business']) {
      var biz = text.trim();
      if (/^(no|none|nothing|not sure|don'?t have|dont have|i don'?t|i dont|do not have|personal|just me|independent|n\/a|na)\b/i.test(low) ||
          /\b(just me|no business|dont have one|don'?t have one)\b/i.test(low)) {
        biz = 'Independent';
      } else if (biz.length > 60) {
        return {
          speech: "That was a lot at once. What's the business called, short version?",
          content: [], followState: 'capturing'
        };
      } else {
        biz = biz.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      }
      m.propose([{ key: 'lead.business', value: biz, origin: 'user-stated' }]);
      return {
        speech: "Got it, " + biz + ". And the best phone number for the walkthrough call?",
        content: [], followState: 'capturing'
      };
    }

    /* Phone: pull digits, validate, format. */
    var digits = text.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      return {
        speech: "That number looks short of a real one. Something like 480 555 0134 works. What's the best number?",
        content: [], followState: 'capturing'
      };
    }
    var pretty = digits.length === 10
      ? '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6)
      : digits;
    m.propose([{ key: 'lead.phone', value: pretty, origin: 'user-stated' }]);
    m.setLeadState('captured');
    return {
      speech: "Saved. Here's what I have: " + f['lead.name'] + " at " + f['lead.business'] +
        ", " + pretty + ". A BlueColumn strategist will call to schedule the walkthrough.",
      content: [{
        action: 'update', target: 'booking-panel',
        data: { leadCaptured: true, leadName: f['lead.name'], leadBusiness: f['lead.business'], leadPhone: pretty },
        at: 300
      }],
      followState: 'captured'
    };
  };

  Planner.prototype.produce = function (turn) {
    /* turn = { userText, knowledge, memory, turnId, sessionId, contentIds } */
    var memory = turn.memory;
    var intent = this.detectIntent(turn.userText, memory);
    this.bus.publish('intent.detected', { intent: intent }, { sessionId: turn.sessionId, turnId: turn.turnId });
    this._turnCount += 1;

    var speech, gestures = [], gaze = [], expressions = [], content = [], propose = [], follow = null;
    var k = turn.knowledge || {};

    /* Only explicit user statements become memory (three-context rule). */
    var stated = turn.userText.match(/\b(?:my name is|i'?m|i am|call me|this is|name'?s)\s+([A-Za-z]+)/);
    if (stated) { propose.push({ key: 'visitor.name', value: stated[1].replace(/\b\w/, function (c) { return c.toUpperCase(); }), origin: 'user-stated' }); }
    var place = turn.userText.match(/\b(?:in|near|from)\s+((?:Mesa|Chandler|Gilbert|Tempe|Scottsdale|Phoenix|Queen Creek|Ahwatukee)[a-z ]*)/i);
    if (place) { propose.push({ key: 'visitor.location', value: place[1].trim(), origin: 'user-stated' }); }

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
        speech = pick(GREETINGS, this._turnCount - 1).replace('{NAME}', name ? ', ' + name : '');
        expressions.push({ name: 'warm', intensity: 0.8, at: 0 });
        gestures.push({ name: 'nod', intensity: 0.5, entryMs: 240, holdMs: 500, releaseMs: 320, at: 200 });
        break;
      }
      case 'thanks': {
        speech = pick([
          "Anytime" + helloName + ". If you want the next step, say book a demo and I'll take your details.",
          "Glad that landed. Anything else on your list?",
          "Happy to help. Want me to line up a walkthrough, or is there more to ask?"
        ], this._turnCount);
        expressions.push({ name: 'warm', intensity: 0.8, at: 0 });
        gestures.push({ name: 'nod', intensity: 0.5, entryMs: 240, holdMs: 500, releaseMs: 320, at: 200 });
        break;
      }
      case 'contact': {
        speech = "Easiest path: hello@bluecolumn.ai, or leave your name and number here and a strategist calls you. Which do you prefer?";
        expressions.push({ name: 'friendly', intensity: 0.7, at: 0 });
        gaze.push({ target: 'panel:booking-panel', transitionMs: 260, holdMs: 2200, returnTarget: 'user', at: 300 });
        content.push({ action: 'show', target: 'booking-panel', data: {}, at: 400 });
        break;
      }
      case 'book': {
        var rf = turn.memory.facts;
        if (turn.memory.leadState === 'captured' && rf['lead.name'] && rf['lead.phone']) {
          speech = "You're already on the list" + (rf['lead.name'] ? ", " + rf['lead.name'] : "") +
            ". A BlueColumn strategist will call " + rf['lead.phone'] +
            " to schedule the walkthrough. Anything else I can answer first?";
          expressions.push({ name: 'warm', intensity: 0.8, at: 0 });
          gestures.push({ name: 'nod', intensity: 0.5, entryMs: 240, holdMs: 500, releaseMs: 320, at: 200 });
          content.push({
            action: 'update', target: 'booking-panel',
            data: { leadCaptured: true, leadName: rf['lead.name'], leadBusiness: rf['lead.business'] || '', leadPhone: rf['lead.phone'] },
            at: 400
          });
          break;
        }
        speech = "Let's do it. I'll take your name, business, and best phone number, and a BlueColumn strategist schedules the walkthrough from there. First: what's your name?";
        follow = 'capturing';
        expressions.push({ name: 'alert', intensity: 0.6, at: 0 });
        gaze.push({ target: 'panel:booking-panel', transitionMs: 260, holdMs: 2200, returnTarget: 'user', at: 300 });
        gestures.push({ name: 'present_center', intensity: 0.62, entryMs: 260, holdMs: 1100, releaseMs: 380, at: 300 });
        content.push({ action: 'show', target: 'booking-panel', data: {}, at: 400 });
        break;
      }
      case 'pricing': {
        speech = k.text;
        if (repeat) { speech = "Happy to run it again. " + speech; }
        if (k.source === 'rag' || k.source === 'catalog') { speech += ' ' + this._followUp(intent); }
        expressions.push({ name: 'friendly', intensity: 0.7, at: 0 });
        gaze.push({ target: 'panel:pricing-panel', transitionMs: 260, holdMs: 2600, returnTarget: 'user', at: 300 });
        gestures.push({ name: 'present_right', intensity: 0.62, entryMs: 260, holdMs: 1100, releaseMs: 380, at: 300 });
        content.push({ action: 'show', target: 'pricing-panel', data: {}, at: 400 });
        content.push({ action: 'highlight', target: 'pricing-panel', data: { lines: ['essential', 'engine'] }, at: 900 });
        break;
      }
      case 'live-sites': {
        speech = k.text;
        if (k.source === 'rag' || k.source === 'catalog') { speech += ' ' + this._followUp(intent); }
        expressions.push({ name: 'friendly', intensity: 0.7, at: 0 });
        gaze.push({ target: 'panel:sites-panel', transitionMs: 260, holdMs: 2600, returnTarget: 'user', at: 300 });
        gestures.push({ name: 'present_right', intensity: 0.6, entryMs: 260, holdMs: 1100, releaseMs: 380, at: 300 });
        content.push({ action: 'show', target: 'sites-panel', data: {}, at: 400 });
        break;
      }
      case 'how-it-works': {
        speech = k.text;
        if (k.source === 'rag' || k.source === 'catalog') { speech += ' ' + this._followUp(intent); }
        if (k.source === 'rag') { expressions.push({ name: 'thinking', intensity: 0.4, at: 0 }); }
        else { expressions.push({ name: 'friendly', intensity: 0.6, at: 0 }); }
        gestures.push({ name: 'lean_in', intensity: 0.4, entryMs: 300, holdMs: 1400, releaseMs: 400, at: 300 });
        break;
      }
      case 'timeline': {
        speech = k.text;
        if (k.source === 'rag' || k.source === 'catalog') { speech += ' ' + this._followUp(intent); }
        expressions.push({ name: 'friendly', intensity: 0.6, at: 0 });
        break;
      }
      default: { /* open-question: the live brain's answer, choreographed */
        speech = k.text || "What would you like to know?";
        if (k.source === 'rag') {
          speech += ' ' + this._followUp(intent);
          expressions.push({ name: 'friendly', intensity: 0.6, at: 0 });
        } else if (k.source === 'fallback') {
          expressions.push({ name: 'thinking', intensity: 0.5, at: 0 });
        } else {
          expressions.push({ name: 'friendly', intensity: 0.6, at: 0 });
        }
        break;
      }
    }

    this._lastIntent = intent;
    this._lastTextHead = String(turn.userText || '').toLowerCase().slice(0, 18);

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