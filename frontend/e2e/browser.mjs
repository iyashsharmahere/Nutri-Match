// Real-browser checks. jsdom has no layout engine, so it cannot catch positioning/CSS bugs
// (e.g. the growing plant once rendered as a tiny in-flow box). This script can.
//
// Needs: the API on :8000 and the built app served on :4173 (`npm run build && npx vite preview --port 4173`),
// plus a Chrome/Chromium: set CHROME_PATH (CI: $(which google-chrome)).
import puppeteer from 'puppeteer-core';
import { PNG } from 'pngjs';
import assert from 'node:assert/strict';

const URL = process.env.APP_URL || 'http://127.0.0.1:4173/';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

async function launch() {
  if (process.env.CHROME_PATH) return puppeteer.launch({ executablePath: process.env.CHROME_PATH, args: GL_ARGS, headless: 'shell' });
  const { default: chromium } = await import('@sparticuz/chromium'); // optional local fallback
  return puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, ...GL_ARGS.slice(1)], headless: 'shell' });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];
const browser = await launch();

async function open(width, height) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  page.on('console', (m) => m.type() === 'error' && !/ERR_NAME_NOT_RESOLVED|fonts\.g/.test(m.text()) && problems.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(2000);
  return page;
}
const click = (page, text, scope = 'main') => page.evaluate((t, s) => {
  const b = [...document.querySelector(s).querySelectorAll('button')].find((x) => x.textContent.trim().replace(/\s+/g, ' ') === t);
  if (!b) throw new Error(`no button "${t}"`); b.click();
}, text, scope);

/** Share of pixels in a clip that differ clearly from the paper background: a proxy for "how much plant is drawn". */
async function inkIn(page, clip) {
  // clip coordinates are relative to the document, so add the current scroll offset
  const sy = await page.evaluate(() => scrollY);
  const png = PNG.sync.read(await page.screenshot({ clip: { ...clip, y: clip.y + sy } }));
  let ink = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const d = Math.abs(png.data[i] - 246) + Math.abs(png.data[i + 1] - 242) + Math.abs(png.data[i + 2] - 233);
    if (d > 60) ink++;
  }
  return ink / (png.width * png.height);
}

// ---- 1. The plant: positioned in the margin, and it really grows with scroll ----------------------
for (const [w, h] of [[1915, 930], [1440, 900], [1280, 800], [1320, 800], [768, 900], [390, 800]]) {
  const page = await open(w, h);
  const plant = await page.evaluate(() => {
    const el = document.querySelector('canvas').parentElement, r = el.getBoundingClientRect();
    const h1 = document.querySelector('h1').getBoundingClientRect();
    return { pos: getComputedStyle(el).position, x: r.x, w: r.width, h: r.height, contentLeft: h1.left, pageH: document.documentElement.scrollHeight };
  });
  const tag = `${w}x${h}`;
  assert.equal(plant.pos, 'fixed', `${tag}: plant must be position:fixed`);
  assert.ok(plant.h > h * 0.75, `${tag}: plant strip should span most of the screen (got ${plant.h}px of ${h})`);
  assert.ok(plant.x <= 0.5, `${tag}: plant should hug the left edge`);
  assert.ok(plant.contentLeft >= plant.w - 1, `${tag}: plant (${plant.w}px) overlaps the page text starting at ${Math.round(plant.contentLeft)}px`);
  assert.ok(plant.pageH > h * 1.8, `${tag}: page needs enough scroll room for growth`);

  const clip = { x: 0, y: Math.round(plant.h * 0.05) + 60, width: Math.round(plant.w), height: Math.round(plant.h * 0.9) };
  const atTop = await inkIn(page, clip);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await wait(2500);
  const atBottom = await inkIn(page, clip);
  assert.ok(atBottom > atTop * 2.5, `${tag}: plant should be much bigger at the bottom (top ${atTop.toFixed(3)}, bottom ${atBottom.toFixed(3)})`);
  await page.evaluate(() => scrollTo(0, 0));
  await wait(2500);
  assert.ok((await inkIn(page, clip)) < atBottom * 0.6, `${tag}: plant should shrink back when scrolling up`);
  console.log(`plant OK  ${tag}  (ink at top ${atTop.toFixed(3)} -> bottom ${atBottom.toFixed(3)})`);
  await page.close();
}

// ---- 2. Plan dial + week skyline ----------------------------------------------------------------------
{
  const page = await open(1440, 900);
  await click(page, 'Build my plan'); await click(page, 'Continue'); await click(page, 'Continue'); await click(page, 'Build my plan');
  await page.waitForFunction(() => document.querySelector('h1')?.textContent.includes('day on a plate'), { timeout: 20000 });
  await wait(2000);
  const dial = await page.evaluate(() => { const el = document.querySelector('canvas').parentElement, r = el.getBoundingClientRect(); return { pos: getComputedStyle(el).position, w: r.width, h: r.height }; });
  assert.equal(dial.pos, 'absolute'); assert.ok(Math.abs(dial.w - 192) < 2 && Math.abs(dial.h - 192) < 2, `dial should be 192x192, got ${dial.w}x${dial.h}`);
  console.log('dial OK');

  await click(page, 'Week', 'header'); await click(page, 'Build my week');
  await page.waitForFunction(() => document.querySelector('h1')?.textContent.includes('Your week'), { timeout: 20000 });
  await wait(2500);
  const sky = await page.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { y: r.y, h: r.height, w: r.width }; });
  assert.ok(sky.h > 200 && sky.w > 500, `skyline should be sized (${sky.w}x${sky.h})`);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('[role=tab]')].map((t) => { const r = t.getBoundingClientRect(); return r.x + r.width / 2; }));
  assert.equal(tabs.length, 7);
  for (const i of [4, 1, 6, 0]) {
    await page.mouse.click(tabs[i], sky.y + sky.h * 0.55);
    await wait(400);
    const sel = await page.evaluate(() => [...document.querySelectorAll('[role=tab]')].findIndex((t) => t.getAttribute('aria-selected') === 'true'));
    assert.equal(sel, i, `clicking the bar above tab ${i} selected tab ${sel}`);
  }
  console.log('skyline OK (bar clicks select the matching day)');
  await page.close();
}

await browser.close();
assert.deepEqual(problems, [], `browser reported problems:\n${problems.join('\n')}`);
console.log('browser checks OK');
