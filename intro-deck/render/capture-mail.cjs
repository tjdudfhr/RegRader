// '메일로 공유 · 바로 보내기' 사용법 장면 → ../slides/regrader-intro/assets/use-m..p-*.jpg (o-mail-before · o-mail-ppl 포함) + use-targets-mail.json
// 로그인한 총괄처럼 보이게 담당자 목록 · 로그인을 흉내 내고(예시 이름 · 주소), 실제 발송 대신 '보냈습니다' 답을 돌려준다 — 메일은 나가지 않는다.
//   SITE_URL=http://127.0.0.1:8899/docs/ node capture-mail.cjs
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const path = require('path');

const SITE = process.env.SITE_URL || 'http://127.0.0.1:8899/docs/';
const OUT = path.join(__dirname, '..', 'slides', 'regrader-intro', 'assets');
const GATE = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'gate.js'), 'utf8').match(/HASH = '([0-9a-f]+)'/)[1];
const W = 1440;
const H = 900;
const MEMBERS = [
  { email: 'boss@company.com', name: '총괄', job: '', role: 'admin' },
  { email: 'kim@company.com', name: '김환경', job: '환경', role: 'member' },
  { email: 'lee@company.com', name: '이안전', job: '안전', role: 'member' },
  { email: 'park@company.com', name: '박재무', job: '재무회계', role: 'member' },
  { email: 'choi@company.com', name: '최인사', job: '인사노무', role: 'member' },
  { email: 'jung@company.com', name: '정공정', job: '공정거래', role: 'member' },
];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await ctx.addInitScript((h) => { try { localStorage.setItem('rr-gate', h); sessionStorage.setItem('rr-landing-seen', '1'); localStorage.removeItem('rr_mail_to'); localStorage.removeItem('rr_mail_cc'); } catch (e) {} }, GATE);
  const page = await ctx.newPage();
  await page.route('https://script.google.com/**', (r) => {
    const b = JSON.parse(r.request().postData() || '{}');
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, sent: (b.to || []).length + (b.cc || []).length, left: 96 }) });
  });
  await page.goto(SITE + '?nc=' + Date.now());
  await page.waitForFunction(() => document.body.classList.contains('rr-ready'), null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.evaluate((ms) => {
    Object.assign(window.rrTracker, {
      members: () => ms, isAdmin: () => true, openMembers: () => true, token: () => Promise.resolve('demo'),
      who: () => ({ email: 'boss@company.com', name: '총괄', role: 'admin' }),
    });
  }, MEMBERS);

  const targets = {};
  const shot = async (name) => { await page.waitForTimeout(450); await page.screenshot({ path: path.join(OUT, `use-${name}.jpg`), type: 'jpeg', quality: 86 }); };
  const box = async (loc) => { const b = await loc.boundingBox(); return { x: b.x / W, y: b.y / H, w: b.width / W, h: b.height / H }; };

  // ① 종합 현황 → 오른쪽 위 ✉
  const mailBtn = page.locator('.header button[onclick="openEmailModal()"]');
  targets.mailBtn = await box(mailBtn);
  await shot('m-home');

  // ② 메일 창: 범위 '30일 이내' · 보낼 목록
  await mailBtn.click();
  await page.waitForSelector('#email-modal.show');
  await page.click('#email-modal [data-range="d30"]');
  await page.waitForTimeout(400);
  targets.range = await box(page.locator('#email-modal [data-range="d30"]'));
  targets.list = await box(page.locator('#email-modal .pv'));
  await shot('n-mail');

  // ③ 받는 사람 · 직무 담당자 불러오기 (창 안을 받는 사람까지 내린다)
  await page.evaluate(() => { const b = document.querySelector('#email-modal .rr-dlg-b'); const t = document.getElementById('rr-mail-to'); b.scrollTop += t.getBoundingClientRect().top - b.getBoundingClientRect().top - 24; });
  await page.waitForTimeout(400);
  targets.ppl = await box(page.locator('#email-modal [data-ppl="__picked"]'));
  targets.manage = await box(page.locator('#email-modal [data-a="members"]'));
  await shot('o-mail-before');
  await page.click('#email-modal [data-ppl="__picked"]');
  await page.waitForTimeout(300);
  targets.to = await box(page.locator('#rr-mail-to'));
  await shot('o-mail-ppl');

  // ④ 바로 보내기 → 'N명에게 보냈습니다'
  const direct = page.locator('#email-modal [data-a="direct"]');
  targets.direct = await box(direct);
  await direct.click();
  await page.waitForFunction(() => /보냈습니다/.test((document.getElementById('rr-mail-msg') || {}).textContent || ''), null, { timeout: 20000 });
  await page.evaluate(() => { const b = document.querySelector('#email-modal .rr-dlg-b'); b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(300);
  targets.msg = await box(page.locator('#rr-mail-msg'));
  targets.manage2 = await box(page.locator('#email-modal [data-a="members"]'));
  await shot('p-mail-sent');

  fs.writeFileSync(path.join(OUT, 'use-targets-mail.json'), JSON.stringify(targets, null, 1));
  console.log(JSON.stringify(targets));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
