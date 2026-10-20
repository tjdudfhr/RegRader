// 브라우저판 회사 찾기(web/static-api.js)를 그대로 불러 회사마다 '자기 이름으로 찾으면 3위 안에 나오는지' 잰다.
//   node engine/searchcheck_web.cjs web/static-api.js out/static/companies/index.json [결과.json] [표본 수]
//   (2026-10-20: 4.9만 곳 중 3위 안 99.3% · 결과 없음 0 — 고치기 전 약 90%. 남은 것은 대부분 두 글자 이름. 놓친 곳은 결과.json 의 fails)
const fs = require('fs'), vm = require('vm');
const [api, ixPath, outPath, sample] = process.argv.slice(2);
const IX = fs.readFileSync(ixPath, 'utf8');
const win = { RR_PRO_NO_PRELOAD: true, RR_PRO_DATA: 'data/' };
win.fetch = (url) => Promise.resolve(new Response(String(url).endsWith('companies/index.json') ? IX : '{}', { status: 200 }));
const ctx = { window: win, location: { href: 'http://x/' }, URL, Response, crypto: globalThis.crypto, TextEncoder, setTimeout, console, Promise, Math, JSON, Array, Set, Object, String, Number, RegExp };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(api, 'utf8'), ctx);
const ix = JSON.parse(IX);
const CORP = /\(주\)|㈜|주식회사|\(유\)|유한회사|유한책임회사|\(합\)|합자회사|합명회사|\(사\)|사단법인|\(재\)|재단법인|농업회사법인|영농조합법인|의료법인|학교법인|사회복지법인|\(株\)/g;
// 사람이 칠 이름: 법인 표시를 뗀 회사 이름 ('현대건설(주)' → '현대건설')
const typed = (name) => name.normalize('NFKC').replace(CORP, ' ').replace(/\s+/g, ' ').trim();
(async () => {
  let rows = ix.rows;
  if (sample) { const n = +sample, step = Math.max(1, Math.floor(rows.length / n)); rows = rows.filter((_, i) => i % step === 0); }
  const fails = []; let top1 = 0, top3 = 0;
  for (const r of rows) {
    const q = typed(r[2]);
    const res = await (await win.fetch('/api/company?q=' + encodeURIComponent(q))).json();
    const keys = (res.results || []).map((x) => x.key);
    const i = keys.indexOf(r[0]);
    if (i === 0) top1++;
    if (i >= 0 && i < 3) top3++; else fails.push({ key: r[0], name: r[2], q, members: r[3], got: (res.results || []).slice(0, 3).map((x) => x.name + ' ' + x.employees) });
  }
  const out = { n: rows.length, top1, top3, fails };
  if (outPath) fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
  console.log(`회사 ${rows.length}곳: 1위 ${(top1 / rows.length * 100).toFixed(1)}% · 3위 안 ${(top3 / rows.length * 100).toFixed(1)}% · 놓침 ${fails.length}`);
})();
