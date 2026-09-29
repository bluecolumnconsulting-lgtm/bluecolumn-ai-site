/* Capture the CLIENT's full-screen Buddy (voice/video call mode), not the tiny chat icon. */
import { chromium } from '/Users/mac/.openclaw/workspace/demo-sites/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('/tmp/mascot-shots', { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'chrome',
  args: ['--autoplay-policy=no-user-gesture-required', '--window-size=1440,1000'] });

const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text().slice(0,200)); });
await page.goto('https://arcadiafenceaz.com/', { waitUntil: 'load' });
await page.waitForTimeout(5000);

// Find and click the FenceBot launcher
const launcher = await page.evaluate(() => {
  const els = [...document.querySelectorAll('button, a, [role=button]')];
  const hit = els.find(e => /fence.?bot|talk|chat|buddy|voice|call|pricing/i.test((e.textContent||'') + (e.getAttribute('aria-label')||'')));
  return hit ? { text: hit.textContent.trim().slice(0,60), aria: hit.getAttribute('aria-label') } : null;
});
console.log('launcher:', JSON.stringify(launcher));

if (launcher) {
  await page.evaluate(() => {
    const els = [...document.querySelectorAll('button, a, [role=button]')];
    const hit = els.find(e => /fence.?bot|talk|chat|buddy|voice|call|pricing/i.test((e.textContent||'') + (e.getAttribute('aria-label')||'')));
    if (hit) hit.click();
  });
  await page.waitForTimeout(3000);
}

// Dump all visible buttons now (chat header should have Map/Voice/Video)
const buttons = await page.evaluate(() => {
  return [...document.querySelectorAll('button, [role=button]')].map(b => ({
    text: (b.textContent||'').trim().slice(0,50),
    aria: b.getAttribute('aria-label')||'',
    title: b.getAttribute('title')||'',
    cls: (b.className||'').toString().slice(0,60)
  })).filter(b => b.text || b.aria || b.title);
});
console.log('buttons:', JSON.stringify(buttons, null, 1));

// Click Voice (full-screen call). Try multiple strategies.
const clicked = await page.evaluate(() => {
  const cands = [...document.querySelectorAll('button, [role=button]')];
  let hit = cands.find(b => /voice/i.test((b.getAttribute('aria-label')||'') + (b.getAttribute('title')||'')));
  if (!hit) hit = cands.find(b => /^voice$/i.test((b.textContent||'').trim()));
  if (!hit) hit = cands.find(b => /call/i.test((b.getAttribute('aria-label')||'')));
  if (hit) { hit.click(); return (hit.getAttribute('aria-label')||hit.textContent||'').trim(); }
  return null;
});
console.log('clicked voice:', clicked);
await page.waitForTimeout(6000);

// Now find the big sprite element
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
          filter: pc.filter, background: pc.backgroundColor, borderRadius: pc.borderRadius
        }
      };
    }
  });
  return found;
});
console.log('BIG Buddy:', JSON.stringify(big, null, 2));

// Screenshot full viewport
const full = await page.screenshot();
writeFileSync('/tmp/mascot-shots/client-fullscreen.png', full);
// And a tight crop around Buddy if found
if (big) {
  const shot = await page.screenshot({ clip: { x: Math.max(0, big.rect.x - 260), y: Math.max(0, big.rect.y - 260), width: 760, height: 760 } });
  writeFileSync('/tmp/mascot-shots/client-buddy.png', shot);
}
await browser.close();
console.log('DONE');
