// frames/ 에서 페이지마다 애니메이션이 끝난 장면 1장씩 골라 11쪽 PDF 를 만든다.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const path = require('path');

// 9쪽(대응 현황)은 상태가 '조치완료'인 순간을 고른다
const PICKS = [262, 442, 637, 832, 1027, 1207, 1417, 1627, 1830, 2062, 2300];

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
