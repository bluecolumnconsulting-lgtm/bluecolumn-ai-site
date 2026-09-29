/* Capture side-by-side screenshots: OUR mascot vs CLIENT mascot.
   Page-level clip screenshots (not element screenshots) to avoid
   Playwright stability timeouts. */
import { chromium } from '/Users/mac/.openclaw/workspace/demo-sites/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('/tmp/mascot-shots', { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'chrome',
  args: ['--autoplay-policy=no-user-gesture-required', '--window-size=1440,1000'] });

/* ---- 1. OUR live page ---- */
const p1 = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await p1.goto('https://bluecolumn.ai/outloud-v2/arcadia-fence/', { waitUntil: 'load' });
await p1.waitForTimeout(2500);
// open the chat panel if there's a fab
try { await p1.click('#bot-fab', { timeout: 3000 }); } catch {}
await p1.waitForTimeout(1200);
const our = await p1.evaluate(() => {
  const m = document.getElementById('mascot');
  if (!m) return null;
  const r = m.getBoundingClientRect();
  const cs = getComputedStyle(m);
  const layers = [...m.querySelectorAll('div')].map(l => ({
    pos: l.style.backgroundPosition, size: l.style.backgroundSize,
    img: getComputedStyle(l).backgroundImage.slice(0, 80),
    anim: getComputedStyle(l).animationName
  }));
  return {
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    css: {
      width: cs.width, height: cs.height, borderRadius: cs.borderRadius,
      filter: cs.filter, backgroundImage: cs.backgroundImage.slice(0, 80),
      backgroundSize: cs.backgroundSize, backgroundPosition: cs.backgroundPosition,
      animation: cs.animationName, animationDuration: cs.animationDuration,
      transform: cs.transform
    },
    layers
  };
});
console.log('OUR mascot:', JSON.stringify(our, null, 2));
if (our) {
  const shot = await p1.screenshot({ clip: { x: Math.max(0, our.rect.x - 80), y: Math.max(0, our.rect.y - 80), width: our.rect.w + 160, height: our.rect.h + 160 } });
  writeFileSync('/tmp/mascot-shots/ours.png', shot);
}
await p1.close();

/* ---- 2. CLIENT page ---- */
const p2 = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await p2.goto('https://arcadiafenceaz.com/', { waitUntil: 'load' });
await p2.waitForTimeout(6000);
// look for any button that opens FenceBot
const btn = await p2.evaluate(() => {
  const els = [...document.querySelectorAll('button, a, [role=button]')];
  const hit = els.find(e => /fence.?bot|talk|voice|call|buddy|assistant/i.test((e.textContent||'') + (e.getAttribute('aria-label')||'')));
  return hit ? hit.textContent.trim() || hit.getAttribute('aria-label') : null;
});
console.log('CLIENT trigger found:', btn);
try {
  // click the most likely trigger
  await p2.evaluate(() => {
    const els = [...document.querySelectorAll('button, a, [role=button]')];
    const hit = els.find(e => /fence.?bot|talk|voice|call|buddy|assistant/i.test((e.textContent||'') + (e.getAttribute('aria-label')||'')));
    if (hit) hit.click();
  });
} catch (e) { console.log('click err', e.message); }
await p2.waitForTimeout(3500);
const client = await p2.evaluate(() => {
  // find element with fencebot sprite bg
  let found = null;
  document.querySelectorAll('div').forEach(el => {
    if (found) return;
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg.indexOf('fencebot-avatar-sprite') !== -1) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      found = {
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
        css: {
          width: cs.width, height: cs.height, borderRadius: cs.borderRadius,
          filter: cs.filter, backgroundImage: bg.slice(0, 80),
          backgroundSize: cs.backgroundSize, backgroundPosition: cs.backgroundPosition,
          animation: cs.animationName, animationDuration: cs.animationDuration,
          transform: cs.transform
        },
        parent: (() => { const pr = el.parentElement.getBoundingClientRect(); const pc = getComputedStyle(el.parentElement); return { rect: { x: pr.x, y: pr.y, w: pr.width, h: pr.height }, filter: pc.filter, dropShadow: pc.filter }; })()
      };
    }
  });
  return found;
});
console.log('CLIENT mascot:', JSON.stringify(client, null, 2));
if (client) {
  const shot = await p2.screenshot({ clip: { x: Math.max(0, client.rect.x - 120), y: Math.max(0, client.rect.y - 120), width: client.rect.w + 240, height: client.rect.h + 240 } });
  writeFileSync('/tmp/mascot-shots/client.png', shot);
} else {
  // fallback: full page
  const shot = await p2.screenshot();
  writeFileSync('/tmp/mascot-shots/client-full.png', shot);
}
await p2.close();
await browser.close();
console.log('DONE');
