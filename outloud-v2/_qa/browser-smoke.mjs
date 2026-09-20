/* Headless browser smoke for OutLoud 2.0 (no network TTS — fallback path).
   Run: node _qa/browser-smoke.mjs
   Uses file:// URL + Playwright chromium. ElevenLabs fetch will fail
   offline → the runtime must degrade to the browser-voice fallback and
   STILL produce transcript + content panel updates. That's the point. */
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
await page.waitForTimeout(1600); // let the boot greeting turn fire + render

// boot
check('avatar mounted (sprite face element)', await page.locator('#mascot').count() === 1);
check('gaze wrapper present', await page.locator('#mascot-gaze').count() === 1);
check('gesture wrapper present', await page.locator('#mascot-gesture').count() === 1);
check('runtime debug handle', await page.evaluate(() => !!window.OutLoudRuntime));
check('session started', await page.evaluate(() => window.OutLoudRuntime.memory.id.startsWith('sess-')));
check('greeting transcript line', await page.locator('.ol-outloud').first().textContent().then(t => t.length > 20));

// typing a question → plan → transcript + content panel (RAG up to ~5s, TTS fallback offline)
await page.fill('#ol-text-in', 'How much does it cost?');
await page.click('#ol-send');
await page.waitForTimeout(7000);
const lastOutloud = await page.locator('.ol-outloud').last().textContent();
check('pricing reply on transcript', /Essential|497|97/.test(lastOutloud));
check('pricing panel shown', await page.locator('#outloud-content-panel .ol-panel').count() >= 1);
const gazeTransform = await page.evaluate(() => document.getElementById('mascot-gaze').style.transform);
check('gaze moved toward panel', gazeTransform && gazeTransform !== '');

// content panel interaction feeds back into the cycle
await page.locator('.ol-panel-row').first().click();
await page.waitForTimeout(2500);
const inter = await page.evaluate(() => window.OutLoudRuntime.memory.recall().facts['interest.plan']);
check('panel selection lands in session memory', !!inter && String(inter).includes('Essential'));

// state machine sanity
const states = await page.evaluate(() => window.OutLoudRuntime.orch.STATES.length);
check('orchestrator has 5 states', states === 5);

// booking flow via panel
await page.fill('#ol-text-in', 'I want to book a demo');
await page.click('#ol-send');
await page.waitForTimeout(4000);
check('booking panel visible', await page.locator('.ol-form').count() === 1);
await page.fill('.ol-form input[name=name]', 'Smoke Tester');
await page.fill('.ol-form input[name=business]', 'QA Co');
await page.fill('.ol-form input[name=phone]', '555 0199');
await page.locator('.ol-submit').click();
await page.waitForTimeout(4000);
const lead = await page.evaluate(() => window.OutLoudRuntime.memory.recall());
check('lead captured via panel', lead.leadState === 'captured' && lead.facts['lead.name'] === 'Smoke Tester');

// console/page errors: filter out expected offline fetch failures
const realErrors = errors.filter(e => !/tts 4|tts 5|Failed to fetch|net::ERR|ERR_/i.test(e));
check('no unexpected page errors', realErrors.length === 0);
if (realErrors.length) { console.log(realErrors.join('\n')); }

await browser.close();
console.log(failures ? '\n' + failures + ' FAILURES' : '\nBROWSER SMOKE ALL PASS');
process.exit(failures ? 1 : 0);
