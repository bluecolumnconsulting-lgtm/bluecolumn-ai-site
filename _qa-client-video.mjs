/* Capture the CLIENT's full-screen VIDEO-mode Buddy (the sprite render) with fake media permissions. */
import { chromium } from '/Users/mac/.openclaw/workspace/demo-sites/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('/tmp/mascot-shots', { recursive: true });

const browser = await chromium.launch({
  headless: true, channel: 'chrome',
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--window-size=1440,1000'
  ]
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  permissions: ['camera', 'microphone']
});
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text().slice(0,200)); });

await page.goto('https://arcadiafenceaz.com/', { waitUntil: 'load' });
await page.waitForTimeout(4000);

// open FenceBot launcher
await page.evaluate(() => {
  const els = [...document.querySelectorAll('button, [role=button]')];
  const hit = els.find(e => /fence.?bot|instant pricing/i.test((e.textContent||'') + (e.getAttribute('aria-label')||'')));
  if (hit) hit.click();
});
await page.waitForTimeout(2500);

// click Video call
const clicked = await page.evaluate(() => {
  const els = [...document.querySelectorAll('button, [role=button]')];
  let hit = els.find(b => /video/i.test((b.getAttribute('aria-label')||'')));
  if (hit) { hit.click(); return 'video'; }
  return null;
});
console.log('clicked:', clicked);
await page.waitForTimeout(7000);

// find the sprite element (full-screen video mode)
const big = await page.evaluate(() => {
  let found = null;
  document.querySelectorAll('div').forEach(el => {
    if (found) return;
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg.indexOf('fencebot-avatar-sprite') !== -1) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const pr = el.parentElement.getBoundingClientRect();
      const pc = getComputedStyle(el.parentElement);
      found = {
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        css: {
          width: cs.width, height: cs.height,
          filter: cs.filter,
          backgroundSize: cs.backgroundSize, backgroundPosition: cs.backgroundPosition,
          animation: cs.animationName, animationDuration: cs.animationDuration,
          transform: cs.transform, transformOrigin: cs.transformOrigin,
          borderRadius: cs.borderRadius, overflow: cs.overflow
        },
        parent: {
          rect: { x: Math.round(pr.x), y: Math.round(pr.y), w: Math.round(pr.width), h: Math.round(pr.height) },
          filter: pc.filter, background: pc.backgroundColor, borderRadius: pc.borderRadius,
          className: el.parentElement.className.toString().slice(0,120)
        }
      };
    }
  });
  return found;
});
console.log('VIDEO Buddy:', JSON.stringify(big, null, 2));

const full = await page.screenshot();
writeFileSync('/tmp/mascot-shots/client-video-full.png', full);
if (big) {
  const shot = await page.screenshot({ clip: { x: Math.max(0, big.rect.x - 320), y: Math.max(0, big.rect.y - 320), width: 900, height: 900 } });
  writeFileSync('/tmp/mascot-shots/client-video-buddy.png', shot);
}
await browser.close();
console.log('DONE');
