/* Headless browser smoke for OutLoud for OTTOMEDIC (sprite edition).
   Run: node _qa/browser-smoke.mjs
   Clone of outloud-v2/_qa/browser-smoke.mjs, re-aimed at the OttoMedic
   catalog + sprite-only avatar. Over file:// the ElevenLabs TTS fetch
   fails → the runtime degrades to the browser-voice fallback and STILL
   produces transcript + content panel updates. The live BlueColumn
   brain (OttoMedic namespace) may or may not answer — both paths must
   land a reply. Sound stays OFF so replies use the deterministic muted
   transcript walk (browser-TTS fallback under barge-in has a Chrome
   quirk: cancel() mid-utterance can stall the next speak(); the real
   page streams ElevenLabs <audio> and is unaffected). */
import { chromium } from '/Users/mac/.openclaw/workspace/demo-sites/node_modules/playwright/index.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(dir, '..', 'index.html');

let failures = 0;
function check(name, cond) { console.log((cond ? 'PASS' : 'FAIL') + ' ' + name); if (!cond) failures++; }

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(1600);

// boot
check('avatar mounted (sprite face element)', await page.locator('#mascot').count() === 1);
check('gaze wrapper present', await page.locator('#mascot-gaze').count() === 1);
check('gesture wrapper present', await page.locator('#mascot-gesture').count() === 1);
check('runtime debug handle', await page.evaluate(() => !!window.OutLoudRuntime));
check('session started', await page.evaluate(() => window.OutLoudRuntime.memory.id.startsWith('sess-')));
check('tap gate present (voice needs a gesture)', await page.locator('.ol-tap-gate').count() === 1);

// deterministic replies: mute → transcript walk
await page.click('#ol-sound');
await page.waitForTimeout(300);

// typed question while gate is up → gate removed, plan runs
await page.fill('#ol-text-in', 'What is OttoMedic?');
await page.click('#ol-send');
await page.waitForTimeout(5000);
const allOutloud1 = await page.evaluate(() => [...document.querySelectorAll('.ol-outloud')].map(n => n.textContent).join(' '));
check('ottomedic reply on transcript', /OttoMedic|skimmer|foam/i.test(allOutloud1));

// pricing question → EVO models + panel
await page.fill('#ol-text-in', 'How much does it cost?');
await page.click('#ol-send');
await page.waitForTimeout(6000);
const allOutloud = await page.evaluate(() => [...document.querySelectorAll('.ol-outloud')].map(n => n.textContent).join(' '));
check('pricing reply mentions EVO models', /EVO|\$899|\$1,?149|\$1,?399/.test(allOutloud));
check('models panel shown', await page.locator('#outloud-content-panel .ol-panel').count() >= 1);
const panelText = await page.evaluate(() => (document.querySelector('#outloud-content-panel .ol-panel') || { textContent: '' }).textContent);
check('models panel lists EVO models + prices', /EVO 5000Z1/.test(panelText) && /\$1,399/.test(panelText));
const gazeTransform = await page.evaluate(() => document.getElementById('mascot-gaze').style.transform);
check('gaze moved toward panel', gazeTransform && gazeTransform !== '');

// booking flow via panel
await page.fill('#ol-text-in', 'I want to book a demo');
await page.click('#ol-send');
await page.waitForTimeout(3500);
check('booking panel visible', await page.locator('.ol-form').count() === 1);
await page.fill('.ol-form input[name=name]', 'Smoke Tester');
await page.fill('.ol-form input[name=business]', 'OttoMedic QA');
await page.fill('.ol-form input[name=phone]', '555 0199');
await page.locator('.ol-submit').click();
await page.waitForTimeout(4000);
const lead = await page.evaluate(() => window.OutLoudRuntime.memory.recall());
check('lead captured via panel', lead.leadState === 'captured' && lead.facts['lead.name'] === 'Smoke Tester');

// screen deck: ambient cards built after first interaction
const cardCount = await page.locator('.ol-screen-card').count();
check('ambient screen cards built (6 OttoMedic cards)', cardCount === 6);

// knowledge catalog sanity (peek API)
const peek = await page.evaluate(() => window.OUTLOUD.knowledge.peek('how does it work'));
check('catalog has how-it-works', !!peek && /mechanical/.test(peek.text));

// console/page errors: filter out expected offline fetch failures
const realErrors = errors.filter(e => !/tts 4|tts 5|Failed to fetch|net::ERR|ERR_/i.test(e));
check('no unexpected page errors', realErrors.length === 0);
if (realErrors.length) { console.log(realErrors.join('\n')); }

await browser.close();
console.log(failures ? '\n' + failures + ' FAILURES' : '\nBROWSER SMOKE ALL PASS');
process.exit(failures ? 1 : 0);