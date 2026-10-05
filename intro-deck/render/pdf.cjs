// frames/ 에서 페이지마다 애니메이션이 끝난 장면 1장씩 골라 11쪽 PDF 를 만든다.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const path = require('path');

// 페이지가 끝나기 직전 장면을 고른다. 9쪽(대응 현황)은 상태가 '조치완료'인 순간(시작 후 6.5초).
const TIMING = path.join(__dirname, 'timing.json');
const DUR = fs.existsSync(TIMING)
  ? JSON.parse(fs.readFileSync(TIMING, 'utf8')).pages.map((p) => p.dur)
  : [9, 6, 6.5, 6.5, 6.5, 6, 7, 7, 8.5, 6, 8];
const PICKS = [];
let acc = 0;
DUR.forEach((d, i) => {
  const start = acc;
  acc += Math.round(d * 30);
  PICKS.push(i === 8 ? start + Math.round(6.5 * 30) : acc - 8);
});

(async () => {
  const imgs = PICKS.map((f) => 'file://' + path.join(__dirname, 'frames', `f${String(f).padStart(5, '0')}.jpg`));
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>RegRader 소개</title><style>
    @page { size: 1920px 1080px; margin: 0; }
    html, body { margin: 0; padding: 0; background: #0a1431; }
    img { display: block; width: 1920px; height: 1080px; break-after: page; }
    img:last-child { break-after: auto; }
  </style></head><body>${imgs.map((s) => `<img src="${s}">`).join('')}</body></html>`;
  const tmp = path.join(__dirname, 'pdf.html');
  fs.writeFileSync(tmp, html);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.goto('file://' + tmp);
  await page.waitForLoadState('load');
  await page.pdf({ path: path.join(__dirname, 'regrader-intro.pdf'), width: '1920px', height: '1080px', printBackground: true });
  await browser.close();
  fs.rmSync(tmp);
  console.log('pdf ok');
})().catch((e) => { console.error(e); process.exit(1); });
