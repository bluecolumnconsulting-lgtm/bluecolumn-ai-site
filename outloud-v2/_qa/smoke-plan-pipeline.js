/* Throwaway smoke test: planner → validator → memory pipeline in node. */
global.window = {};
const fs = require('fs');
const path = require('path');
const DIR = process.argv[2];
['outloud.config.js', 'event-bus.js', 'business-knowledge.js', 'customer-memory.js', 'plan-validator.js', 'response-planner.js']
  .forEach(f => eval(fs.readFileSync(path.join(DIR, f), 'utf8')));

const O = global.window.OUTLOUD;
let failures = 0;
function check(name, cond) { console.log((cond ? 'PASS' : 'FAIL') + ' ' + name); if (!cond) failures++; }

const bus = new O.EventBus();
const mem = new O.SessionMemory();
const planner = new O.ResponsePlanner(bus, mem);
const contentIds = ['pricing-panel', 'booking-panel'];

function runTurn(text) {
  mem.logTurn('visitor', text);
  const knowledge = O.knowledge.peek(text) || { text: 'fallback text here', source: 'fallback' };
  const plan = planner.produce({
    userText: text, knowledge, memory: mem.recall(),
    turnId: 't', sessionId: 's', contentIds
  });
  const v = O.validatePlan(plan, { constraints: O.CONFIG.avatar.constraints, contentIds });
  /* simulate orchestrator responseEnd: apply the plan's memory proposals */
  if (v.plan.memory && v.plan.memory.propose) { mem.propose(v.plan.memory.propose); }
  if (v.plan.memory && v.plan.memory.followState) { mem.setLeadState(v.plan.memory.followState); }
  return { plan, v };
}

// 1. pricing turn: plan + validator + content ids known
let r = runTurn('How much does OutLoud cost?');
check('pricing intent', r.plan.meta.intent === 'pricing');
check('pricing speech mentions price', /\$497/.test(r.plan.speech.text));
check('pricing content valid', r.v.plan.content.some(c => c.target === 'pricing-panel' && c.action === 'show'));
check('pricing has present_right gesture', r.v.plan.avatar.gestures.some(g => g.name === 'present_right'));
check('pricing gaze to panel with return', r.v.plan.avatar.gaze.every(z => z.returnTarget === 'user'));

// 2. greeting turn
r = runTurn('hi');
check('greet intent', r.plan.meta.intent === 'greet');

// 3. booking turn
r = runTurn('I want to book a demo');
check('book intent → capturing', mem.leadState === 'capturing');
check('book shows booking panel', r.v.plan.content.some(c => c.target === 'booking-panel'));

// 4. lead capture flow: name → business → phone
r = runTurn('Joe');
check('lead name captured', mem.facts['lead.name'] && mem.facts['lead.name'].value === 'Joe');
r = runTurn('Acme Fencing');
check('lead business captured', mem.facts['lead.business'] && mem.facts['lead.business'].value === 'Acme Fencing');
r = runTurn('555 0100');
check('lead captured end-state', mem.leadState === 'captured');
check('lead summary speech', /Acme Fencing/.test(r.v.plan.speech.text));

// 5. memory proposal from explicit statement
r = runTurn('my name is Sandra');
check('visitor.name proposed from user statement', mem.facts['visitor.name'] && mem.facts['visitor.name'].value === 'Sandra');

// 6. validator repairs: unknown gesture + overlapping + bad content + bad offset
const bad = {
  protocolVersion: '2.0', sessionId: 's', turnId: 't', responseId: 'r',
  speech: { text: 'hello', streamHint: false, chunks: ['hello'] },
  avatar: {
    baseline: {}, gestures: [
      { name: 'point_right', intensity: 1.4, at: 0, entryMs: 260, holdMs: 1100, releaseMs: 380 },
      { name: 'moonwalk', intensity: 0.5, at: 100 },
      { name: 'nod', intensity: 0.5, at: 300 }
    ], gaze: [{ target: 'moon', at: -5 }], expressions: [{ name: 'winking', at: 0 }]
  },
  content: [{ action: 'explode', target: 'nope-panel', at: 0 }]
};
const vb = O.validatePlan(bad, { constraints: O.CONFIG.avatar.constraints, contentIds });
check('point_right degraded', vb.plan.avatar.gestures.some(g => g.name === 'present_right'));
check('unknown gesture handled', !vb.plan.avatar.gestures.some(g => g.name === 'moonwalk'));
check('overlap repaired (≤2 gestures kept, no overlap)', vb.plan.avatar.gestures.length <= 2);
check('unknown gaze → user', vb.plan.avatar.gaze[0].target === 'user');
check('negative at clamped', vb.plan.avatar.gaze[0].at === 0);
check('unknown expression → friendly', vb.plan.avatar.expressions[0].name === 'friendly');
check('unknown content dropped', vb.plan.content.length === 0);
check('speech preserved', vb.plan.speech.text === 'hello');
check('repairs reported', vb.repairs.length >= 5);
check('intensity clamped', vb.plan.avatar.gestures.every(g => g.intensity <= 0.8));

// 7. three-context rule: memory must not accept business-knowledge-shaped writes via propose
try {
  mem.propose([{ key: 'catalog.price', value: '$497 per month', origin: 'invented' }]);
  check('three-context: invented origin rejected', !mem.facts['catalog.price']);
} catch (e) { check('three-context: invented origin rejected', true); }

// 8. event envelope shape
const env = O.events.create('test.ev', { a: 1 }, { sessionId: 's' });
check('envelope fields', env.protocolVersion === '2.0' && env.id && env.timestamp && env.sessionId === 's' && env.payload.a === 1);

// 9. audit trail exists
check('memory audit trail', mem.audit.length > 0);

// 10. chunking for streaming
r = runTurn('how does it work');
check('speech has chunks', r.plan.speech.chunks.length >= 1);

console.log(failures ? ('\n' + failures + ' FAILURES') : '\nALL PASS');
process.exit(failures ? 1 : 0);
