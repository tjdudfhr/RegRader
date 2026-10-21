// '기업별 적용법규 검색' 사용법 장면을 찍는다 → ../slides/regrader-intro/assets/use-g..k-*.jpg + use-targets-pro.json
// 흐름 (2026-10-19): 사이드바 맨 위 버튼 → 오른쪽 내용 영역에 RegRader Pro → 회사 검색 → 판정 → 'RegRader로 보내기' → 새 탭에 회사 화면
// 저장소 맨 위에서 서버를 띄운 뒤 (python3 -m http.server 8899) 실행한다:
//   SITE_URL=http://127.0.0.1:8899/docs/ node capture-pro.cjs
// 사이트 잠금은 docs/gate.js 의 해시를 이 브라우저 저장소에 넣어 통과한다 (비밀번호는 쓰지 않는다).
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const path = require('path');

const SITE = process.env.SITE_URL || 'http://127.0.0.1:8899/docs/';
const COMPANY = process.env.COMPANY || '포스코퓨처엠';
const OUT = path.join(__dirname, '..', 'slides', 'regrader-intro', 'assets');
const GATE = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'gate.js'), 'utf8').match(/HASH = '([0-9a-f]+)'/)[1];
const W = 1440;
const H = 900;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await ctx.addInitScript((h) => { try { localStorage.setItem('rr-gate', h); sessionStorage.setItem('rr-landing-seen', '1'); } catch (e) {} }, GATE);
  const page = await ctx.newPage();
  await page.goto(SITE + '?nc=' + Date.now());
  await page.waitForFunction(() => document.body.classList.contains('rr-ready'), null, { timeout: 60000 });
  await page.waitForTimeout(2500);

  const targets = {};
  const shot = async (p, name) => {
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(OUT, `use-${name}.jpg`), type: 'jpeg', quality: 86 });
  };
  const box = async (loc) => {
    const b = await loc.boundingBox();
    return { x: b.x / W, y: b.y / H, w: b.width / W, h: b.height / H };
  };

  // ① 종합 현황 → 사이드바 맨 위 '기업별 적용법규 검색'
  const cta = page.locator('.rr-pro-cta');
  targets.cta = await box(cta);
  await shot(page, 'g-home');

  // ② 오른쪽 내용 영역에 RegRader Pro
  await cta.click();
  const pro = page.frameLocator('#pro-content iframe');
  const hq = pro.locator('#hq');
  await hq.waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  targets.search = await box(hq);
  await hq.click();
  await hq.pressSequentially(COMPANY, { delay: 60 });
  await page.waitForTimeout(400);
  await shot(page, 'h-pop');

  // ③ 검색 → 회사 고르기
  await hq.press('Enter');
  const cand = pro.locator('#cands .cand').first();
  await cand.waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  targets.cand = await box(cand);
  await shot(page, 'i-cands');

  // ④ 판정 결과 (적용법규 수 · 판정 근거 · 확인한 사실의 색 점)
  await cand.click();
  const go = pro.locator('.rrx .go').first();
  await go.waitFor({ timeout: 120000 });
  await page.waitForTimeout(2500);
  targets.big = await box(pro.locator('.big').first());
  targets.go = await box(go);
  targets.legend = await box(pro.locator('#picked-n'));
  await shot(page, 'j-result');

  // ⑤ 'RegRader로 보내기' → 새 탭에 그 회사의 RegRader 화면
  const tabP = ctx.waitForEvent('page', { timeout: 120000 });
  await go.click();
  const tab = await tabP;
  await tab.waitForURL(/company=/, { timeout: 120000 });
  await tab.waitForFunction(() => document.querySelector('#rr-co') && document.body.classList.contains('rr-ready'), null, { timeout: 60000 });
  await tab.waitForTimeout(3000);
  await tab.evaluate(() => window.scrollTo(0, 0));
  targets.chip = await (async () => { const b = await tab.locator('#rr-co').boundingBox(); return { x: b.x / W, y: b.y / H, w: b.width / W, h: b.height / H }; })();
  await shot(tab, 'k-company');

  fs.writeFileSync(path.join(OUT, 'use-targets-pro.json'), JSON.stringify(targets, null, 1));
  console.log(JSON.stringify(targets));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
