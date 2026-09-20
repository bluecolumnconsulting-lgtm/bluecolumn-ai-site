/* Simulated visitor conversations, end to end through the real code
   path: knowledge.retrieve (RAG mocked + catalog) → planner.produce →
   plan-validator → memory proposal application (orchestrator's
   responseEnd behavior). Mocked fetch makes this deterministic offline.

   Run: node _qa/simulate-conversations.js
*/
global.window = {};
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..');

/* Mock fetch: RAG answers grounded like the live brain (which now has
   the canonical OutLoud knowledge doc ingested), TTS never called here. */
const RAG_ANSWERS = {
  'warranty': 'OutLoud pages come with ongoing management, so fixes and content updates are handled by BlueColumn for as long as the plan is active.',
  'difference': 'The difference is the live brain: OutLoud answers from the business own knowledge with a real voice and books straight on a calendar, while a chatbot mostly links to pages.',
  'notinknowledge': null
};
global.fetch = function (url, opts) {
  if (String(url).includes('/recall')) {
    const q = JSON.parse(opts.body).q || '';
    for (const key of Object.keys(RAG_ANSWERS)) {
      if (q.includes(key)) {
        return Promise.resolve({ json: () => Promise.resolve({ answer: RAG_ANSWERS[key] }) });
      }
    }
    return Promise.resolve({ json: () => Promise.resolve({ answer: 'information not in available context' }) });
  }
  return Promise.reject(new Error('offline'));
};

['outloud.config.js', 'event-bus.js', 'business-knowledge.js', 'customer-memory.js', 'plan-validator.js', 'response-planner.js']
  .forEach(f => eval(fs.readFileSync(path.join(DIR, f), 'utf8')));

const O = global.window.OUTLOUD;
let failures = 0;
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + name); if (!cond) failures++; };

const bus = new O.EventBus();
const mem = new O.SessionMemory();
const planner = new O.ResponsePlanner(bus, mem);
const contentIds = ['pricing-panel', 'booking-panel', 'sites-panel'];

/* One turn through the pipeline, exactly like the orchestrator does. */
async function turn(text) {
  mem.logTurn('visitor', text);
  const knowledge = await O.knowledge.retrieve(text);
  const plan = planner.produce({
    userText: text, knowledge, memory: mem.recall(),
    turnId: 't' + planner._turnCount, sessionId: 's', contentIds
  });
  const v = O.validatePlan(plan, { constraints: O.CONFIG.avatar.constraints, contentIds });
  if (v.plan.memory && v.plan.memory.propose) { mem.propose(v.plan.memory.propose); }
  if (v.plan.memory && v.plan.memory.followState) { mem.setLeadState(v.plan.memory.followState); }
  return { knowledge, plan: v.plan, repairs: v.repairs, text: v.plan.speech.text };
}
const noEmDash = (t) => !/—/.test(t);

(async () => {
  /* 1. Cold greeting */
  let r = await turn('hi');
  check('C1 greet intent', r.plan.meta.intent === 'greet');
  check('C1 greeting names the product or invites a question', /OutLoud|Ask me|anything/i.test(r.text));
  check('C1 house voice: no em-dash', noEmDash(r.text));

  /* 2. Pricing question → live-or-catalog answer + pricing panel + follow-up */
  r = await turn('how much does it cost?');
  check('C2 pricing intent', r.plan.meta.intent === 'pricing');
  check('C2 mentions a real price', /\$497/.test(r.text));
  check('C2 pricing panel shown', r.plan.content.some(c => c.target === 'pricing-panel' && c.action === 'show'));
  check('C2 ends with a follow-up question', /\?/.test(r.text));

  /* 3. Capability question → answer + follow-up */
  r = await turn('what can you do exactly?');
  check('C3 how-it-works answered', r.plan.meta.intent === 'how-it-works' && r.text.length > 60);
  check('C3 no dead end (has follow-up)', /walkthrough|deeper|expand|pricing/i.test(r.text));

  /* 4. Obscure question → live brain grounded answer, wrapped in a plan */
  r = await turn('do your pages come with a warranty or ongoing support?');
  check('C4 rag source used', r.knowledge.source === 'rag');
  check('C4 rag answer spoken (not "not in context" leak)', /management/i.test(r.text) && !/not in available context/i.test(r.text));
  check('C4 plan still choreographed (expression)', r.plan.avatar.expressions.length > 0);

  /* 5. Booking happy path: book → name → business → phone */
  r = await turn('I want to book a demo');
  check('C5 book → capturing', mem.leadState === 'capturing');
  check('C5 booking panel shown', r.plan.content.some(c => c.target === 'booking-panel'));
  r = await turn('Priya Shah');
  check('C5 name captured', mem.facts['lead.name'] && mem.facts['lead.name'].value === 'Priya Shah');
  r = await turn('Shah Auto Repair');
  check('C5 business captured', mem.facts['lead.business'] && mem.facts['lead.business'].value === 'Shah Auto Repair');
  r = await turn('480 555 0134');
  check('C5 phone formatted', /\(480\) 555-0134/.test(r.text));
  check('C5 captured state + summary mentions lead', mem.leadState === 'captured' && /Priya/.test(r.text));
  check('C5 booking panel updated with lead', r.plan.content.some(c => c.target === 'booking-panel' && c.action === 'update' && c.data.leadCaptured));

  /* 6. Messy capture inputs recover */
  const mem2 = new O.SessionMemory();
  const planner2 = new O.ResponsePlanner(new O.EventBus(), mem2);
  const turn2 = async (text) => {
    const knowledge = await O.knowledge.retrieve(text);
    const plan = planner2.produce({ userText: text, knowledge, memory: mem2.recall(), turnId: 'x', sessionId: 's2', contentIds });
    if (plan.memory.propose) { mem2.propose(plan.memory.propose); }
    if (plan.memory.followState) { mem2.setLeadState(plan.memory.followState); }
    return plan.speech.text;
  };
  await turn2('book a walkthrough');
  let t = await turn2('ummm');
  check('C6 implausible name re-asked', /name/i.test(t));
  t = await turn2('Marcus');
  check('C6 name accepted on retry', mem2.facts['lead.name'] && mem2.facts['lead.name'].value === 'Marcus');
  t = await turn2('i dont have one, just me');
  check('C6 no-business handled', mem2.facts['lead.business'] && mem2.facts['lead.business'].value === 'Independent');
  t = await turn2('hello');
  check('C6 bad phone re-asked', mem2.leadState === 'capturing' && /number/i.test(t));
  t = await turn2('6025550188');
  check('C6 recovery ends captured', mem2.leadState === 'captured');

  /* 7. Bail out of capture gracefully */
  const mem3 = new O.SessionMemory();
  const planner3 = new O.ResponsePlanner(new O.EventBus(), mem3);
  const turn3 = async (text) => {
    const knowledge = await O.knowledge.retrieve(text);
    const plan = planner3.produce({ userText: text, knowledge, memory: mem3.recall(), turnId: 'y', sessionId: 's3', contentIds });
    if (plan.memory.propose) { mem3.propose(plan.memory.propose); }
    if (plan.memory.followState) { mem3.setLeadState(plan.memory.followState); }
    return plan.speech.text;
  };
  await turn3('book a demo');
  t = await turn3('never mind');
  check('C7 cancel exits capture', mem3.leadState === 'none' && /No problem|parked/i.test(t));
  t = await turn3('what is outloud anyway');
  check('C7 agent still answers after cancel', t.length > 40);

  /* 8. Question mid-capture: answered, then re-asked */
  const mem4 = new O.SessionMemory();
  const planner4 = new O.ResponsePlanner(new O.EventBus(), mem4);
  const turn4 = async (text) => {
    const knowledge = await O.knowledge.retrieve(text);
    const plan = planner4.produce({ userText: text, knowledge, memory: mem4.recall(), turnId: 'z', sessionId: 's4', contentIds });
    if (plan.memory.propose) { mem4.propose(plan.memory.propose); }
    if (plan.memory.followState) { mem4.setLeadState(plan.memory.followState); }
    return plan.speech.text;
  };
  await turn4('schedule a walkthrough');
  t = await turn4('how long does setup take?');
  check('C8 question answered mid-capture', /30 days|Back to the walkthrough/i.test(t));
  check('C8 pending question re-asked', /your name/i.test(t));
  check('C8 still capturing', mem4.leadState === 'capturing');

  /* 9. Second greeting never repeats the first verbatim */
  const mem5 = new O.SessionMemory();
  const planner5 = new O.ResponsePlanner(new O.EventBus(), mem5);
  const turn5 = async (text) => {
    const knowledge = await O.knowledge.retrieve(text);
    const plan = planner5.produce({ userText: text, knowledge, memory: mem5.recall(), turnId: 'w', sessionId: 's5', contentIds });
    if (plan.memory.propose) { mem5.propose(plan.memory.propose); }
    if (plan.memory.followState) { mem5.setLeadState(plan.memory.followState); }
    return plan.speech.text;
  };
  const g1 = await turn5('hello');
  const g2 = await turn5('hey');
  check('C9 varied greetings', g1 !== g2);

  /* 10. Total unknown → honest fallback + a path forward */
  r = await turn('do you know the password to my wifi?');
  check('C10 honest fallback', r.knowledge.source === 'fallback' && /don't have that one yet/i.test(r.text));
  check('C10 offers follow-up path', /email|strategist|follow up/i.test(r.text));
  check('C10 house voice: no em-dash anywhere', noEmDash(r.text));

  console.log(failures ? '\n' + failures + ' FAILURES' : '\nSIMULATION ALL PASS');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });