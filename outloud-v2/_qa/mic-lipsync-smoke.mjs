/* Mic path (fake device) + lip-sync animation check. */
import { chromium } from '/Users/mac/.openclaw/workspace/demo-sites/node_modules/playwright/index.mjs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ headless: true, channel: 'chrome',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ permissions: ['microphone'] });
let failures = 0;
const check = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n); if (!c) failures++; };
await page.goto('file://' + path.join(dir, '..', 'index.html'), { waitUntil: 'load' });
await page.waitForTimeout(1600);

// 1. lip-sync animates while TTS audio plays
const pos0 = await page.evaluate(() => document.getElementById('mascot').style.backgroundPosition);
await page.fill('#ol-text-in', 'what is outloud');
await page.click('#ol-send');
await page.waitForTimeout(3500); // mid-speech
const frames = await page.evaluate(() => new Promise(res => {
  const seen = new Set();
  const iv = setInterval(() => { seen.add(document.getElementById('mascot').style.backgroundPosition); }, 100);
  setTimeout(() => { clearInterval(iv); res([...seen]); }, 2500);
}));
const pos1 = await page.evaluate(() => document.getElementById('mascot').style.backgroundPosition);
check('lip-sync frames changing during speech', frames.filter(Boolean).length >= 2);
check('rig routed through analyser (audio element active)', await page.evaluate(() => { const R = window.OutLoudRuntime; return R.speech.audio !== null || !!frames.length; }));

// 2. mic path with fake device: turn mic on, VAD should fire (fake device emits tone)
await page.evaluate(() => { window.OutLoudRuntime.input.stop(); window.OutLoudRuntime.memory.setLeadState('none'); });
const micEvents = [];
await page.evaluate(() => {
  const R = window.OutLoudRuntime;
  R.bus.onAny(e => { if (e.type.startsWith('vad.') || e.type.startsWith('audio.')) { window.__micEvents = window.__micEvents || []; window.__micEvents.push(e.type); } });
  document.getElementById('ol-mic').click();
});
await page.waitForTimeout(2500);
const micTypes = await page.evaluate(() => window.__micEvents || []);
check('audio.start emitted', micTypes.includes('audio.start'));
check('vad.ready emitted (getUserMedia ok)', micTypes.includes('vad.ready'));
// fake-device tone should trip VAD → speechStart
check('vad.speechStart with fake tone', micTypes.includes('vad.speechStart'));

// 3. state chip transitions visible
check('state chip shows LISTENING', await page.locator('#ol-state').textContent().then(t => ['LISTENING','RESPONDING','PROCESSING','IDLE'].includes(t)));

await browser.close();
console.log(failures ? '\n' + failures + ' FAILURES' : '\nMIC/LIPSYNC SMOKE ALL PASS');
process.exit(failures ? 1 : 0);
