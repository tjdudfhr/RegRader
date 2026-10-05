// 소개 슬라이드를 프레임 단위로 찍는다 (30fps, 1920×1080 JPEG → frames/).
// JS 시간(rAF · performance.now · 타이머)은 Playwright 가짜 시계로,
// CSS/WAAPI 애니메이션은 멈춘 뒤 한 프레임씩 직접 넘겨서 매 프레임이 정확하다.
//
//   DECK_URL   슬라이드 주소 (기본 http://localhost:5173/s/regrader-intro)
//   PLAYWRIGHT playwright 모듈 경로 (기본 'playwright')
//   --probe    몇 프레임만 찍어 확인
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const path = require('path');

const FPS = 30;
const DT = 1000 / FPS;
const OUT = path.join(__dirname, 'frames');
const PROBE = process.argv.includes('--probe');
const DECK_URL = (process.env.DECK_URL || 'http://localhost:5173/s/regrader-intro') + '?p=2';

// 페이지별 노출 시간(초). 슬라이드 순서와 같다.
const DUR = [9, 6, 6.5, 6.5, 6.5, 6, 7, 7, 8.5, 6, 8];
const LEAD = 10; // 2쪽 → 1쪽 전환 프레임은 찍지 않는다

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--hide-scrollbars'] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date('2026-10-05T07:43:00+09:00') });
  await page.goto(DECK_URL, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.keyboard.press('f'); // 발표 모드
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const tick = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
    window.__flush = async () => { for (let i = 0; i < 4; i++) await tick(); };
    window.__step = (dt) => {
      for (const a of document.getAnimations()) {
        if (!a.__rr) {
          a.__rr = true;
          a.pause();
          a.currentTime = 0;
          continue;
        }
        if (a.playState === 'finished') continue;
        const end = a.effect ? a.effect.getComputedTiming().endTime : Infinity;
        const next = (a.currentTime || 0) + dt;
        if (Number.isFinite(end) && next >= end) a.finish();
        else a.currentTime = next;
      }
    };
  });

  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);

  const step = async () => {
    await page.clock.runFor(DT);
    await page.evaluate(() => window.__flush());
    await page.evaluate((dt) => window.__step(dt), DT);
    await page.evaluate(() => window.__flush());
  };

  // 표지로 돌아가서 표지 애니메이션이 이 시계로 시작하게 한다
  await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < LEAD; i++) await step();

  const marks = [];
  let acc = 0;
  for (const d of DUR) { acc += Math.round(d * FPS); marks.push(acc); }
  const total = marks[marks.length - 1];
  const probeAt = new Set([15, 120, 255, 330, 600, 1200, 1700, 2000, total - 30]);

  let f = 0;
  let pageIdx = 0;
  const t0 = Date.now();
  while (f < total) {
    if (f === marks[pageIdx] && pageIdx < marks.length - 1) {
      await page.keyboard.press('ArrowRight');
      pageIdx++;
    }
    await step();
    if (!PROBE || probeAt.has(f)) {
      await page.screenshot({ path: path.join(OUT, `f${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 });
    }
    f++;
    if (f % 150 === 0) console.log(`frame ${f}/${total} page ${pageIdx + 1} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  console.log('done', total);
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
