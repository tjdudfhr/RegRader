// '기업별 적용법규 검색' 사용법 장면을 찍는다 → ../slides/regrader-intro/assets/use-g..k-*.jpg + use-targets-pro.json
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
  await ctx.addInitScript((h) => { try { localStorage.setItem('rr-gate', h); } catch (e) {} }, GATE);
  const page = await ctx.newPage();
  await page.goto(SITE + '?nc=' + Date.now());
  await page.waitForTimeout(6000);

  const targets = {};
  const shot = async (name) => {
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `use-${name}.jpg`), type: 'jpeg', quality: 86 });
  };
  const box = async (loc) => {
    const b = await loc.boundingBox();
    return { x: b.x / W, y: b.y / H, w: b.width / W, h: b.height / H };
  };

  // ① 종합 현황 → 사이드바 맨 위 '기업별 적용법규 검색'
  const cta = page.locator('.rr-pro-cta');
  targets.cta = await box(cta);
  await shot('g-home');

  // ② 팝업 (RegRader Pro)
  await cta.click();
  const pro = page.frameLocator('#rr-pro-pop iframe');
  const hq = pro.locator('#hq');
  await hq.waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  targets.search = await box(hq);
  await hq.click();
  await hq.pressSequentially(COMPANY, { delay: 60 });
  await page.waitForTimeout(400);
  await shot('h-pop');

  // ③ 검색 → 회사 고르기
  await hq.press('Enter');
  const cand = pro.locator('#cands .cand').first();
  await cand.waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  targets.cand = await box(cand);
  await shot('i-cands');

  // ④ 판정 결과
  await cand.click();
  const go = pro.locator('.rrx .go').first();
  await go.waitFor({ timeout: 120000 });
  await page.waitForTimeout(2500);
  targets.big = await box(pro.locator('.big').first());
  targets.go = await box(go);
  await shot('j-result');

  // ⑤ 'RegRader 화면 열기' → 그 회사의 RegRader 화면
  await go.click();
  await page.waitForURL(/company=/, { timeout: 120000 });
  await page.waitForTimeout(8000);
  await page.evaluate(() => window.scrollTo(0, 0));
  targets.chip = await box(page.locator('#rr-co'));
  await shot('k-company');

  fs.writeFileSync(path.join(OUT, 'use-targets-pro.json'), JSON.stringify(targets, null, 1));
  console.log(JSON.stringify(targets));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
