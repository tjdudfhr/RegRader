// 사용법 장면(실제 사이트 화면)을 찍는다 → ../slides/regrader-intro/assets/use-*.jpg + use-targets.json
// 영상의 다른 숫자와 맞추려고 2026-10-05 데이터 시점의 docs/ 를 띄워 찍는다:
//   git archive f0babfa docs | tar -x -C /tmp/site105 && (cd /tmp/site105/docs && python3 -m http.server 8766)
//   SITE_URL=http://127.0.0.1:8766/ node capture.cjs
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const path = require('path');

const SITE = process.env.SITE_URL || 'http://127.0.0.1:8766/';
const OUT = path.join(__dirname, '..', 'slides', 'regrader-intro', 'assets');
const W = 1440;
const H = 900;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date('2026-10-05T08:10:00+09:00') });
  await page.goto(SITE + '?nc=' + Date.now());
  await page.waitForTimeout(6000);

  const targets = {};
  const shot = async (name) => {
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `use-${name}.jpg`), type: 'jpeg', quality: 86 });
  };
  // 화면 비율 좌표(0~1)로 저장한다
  const box = async (loc) => {
    const b = await loc.boundingBox();
    return { x: b.x / W, y: b.y / H, w: b.width / W, h: b.height / H };
  };

  // ① 직무별 개정 현황 → 환경
  await page.evaluate(() => window.switchMainTab('business'));
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.scrollTo(0, 0));
  const envChip = page.locator('#business-content .filter-tab').filter({ hasText: '에너지' }).first();
  targets.envChip = await box(envChip);
  await shot('a-business');
  await envChip.click();
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.scrollTo(0, 0));
  const cards = page.locator('#business-content .rr-job-tile');
  targets.soonCard = await box(cards.nth(2));
  targets.flagDonut = await box(page.locator('#business-content').getByText('제재 · 의무 변경').first());
  await shot('b-env');

  // ② 다가오는 시행 목록에서 대기환경보전법 → 상세 창
  await page.evaluate(() => window.scrollTo(0, 640));
  const row = page.locator('#business-content .rr-jn-row').filter({ hasText: '11.12대기환경보전법' }).first();
  await row.evaluate((r) => {
    let box = r.parentElement;
    while (box && !(box.scrollHeight > box.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
    if (box) box.scrollTop += r.getBoundingClientRect().top - box.getBoundingClientRect().top - 90;
  });
  await page.waitForTimeout(500);
  targets.lawRow = await box(row);
  await shot('c-list');
  await row.click();
  await page.waitForTimeout(2500);
  targets.flagSection = await box(page.getByText('벌칙·과태료·의무 변경').last());
  targets.diffBtn = await box(page.getByText('신구조문 비교').first());
  await shot('d-drawer');

  // ③ 시행 임박 → 보고서
  // 상세 창 닫기 (오른쪽 위 ×)
  await page.evaluate(() => {
    const m = document.getElementById('law-modal');
    const x = m && [...m.querySelectorAll('button, [role="button"], .close, [onclick]')].find((b) => /×|✕|닫기|close/i.test(b.textContent + (b.getAttribute('aria-label') || '') + b.className));
    if (x) x.click();
  });
  await page.waitForTimeout(800);
  if (await page.locator('#law-modal.show').count()) await page.mouse.click(1403, 36);
  await page.waitForTimeout(800);
  const watchTab = page.locator('.main-tab[data-tab="watch"]');
  targets.watchTab = await box(watchTab);
  await watchTab.click();
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.scrollTo(0, 0));
  const reportBtn = page.locator('button, a').filter({ hasText: '보고서' }).first();
  targets.reportBtn = await box(reportBtn);
  await shot('e-watch');
  await reportBtn.click();
  await page.waitForTimeout(1500);
  await shot('f-report');

  fs.writeFileSync(path.join(OUT, 'use-targets.json'), JSON.stringify(targets, null, 1));
  console.log(JSON.stringify(targets));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
