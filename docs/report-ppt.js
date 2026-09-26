/* 월간 · 분기 법규 개정 동향 보고서 (PowerPoint)
 *
 * 사이트에서 기간(월·분기)과 직무를 고르면 그 자리에서 .pptx 를 만들어 내려받는다 (서버 없음).
 * PptxGenJS 는 처음 만들 때만 받는다 (cdn.jsdelivr.net).
 *
 * 구성: 표지 · 요약 · 직무별(또는 계열별) 현황 · 월별 추이 · 제재·의무 변경 상세 · 다음 기간 시행 예정
 *       · 행정규칙 · 부록(전체 개정 목록, 행정규칙 목록) · 기준과 방법
 * 숫자 기준은 사이트와 같다: 시행일 기준, 개정 건수 = 법령 + 시행일 + 개정구분.
 *
 * build(PptxGenJS, input) 은 브라우저·Node 어디서나 돌도록 입력만 받아 만든다 (Node 는 디자인 확인용).
 */
(function (root) {
  var DEFAULT_FONT = 'Malgun Gothic';   /* 회사 PC(윈도우) 기본 한글 글꼴 '맑은 고딕' */
  var F = DEFAULT_FONT;
  var C = {
    primary: '4A57CF', primaryDark: '32379A', ink: '1A202C', sub: '4A5568', muted: '718096', faint: 'A0AEC0',
    line: 'E2E8F0', soft: 'F6F7FB', band: 'EEF0FB', white: 'FFFFFF',
    red: 'C53030', orange: 'C05621', amber: '975A16', purple: '6B46C1', teal: '2C7A7B', blue: '2B6CB0', gray: '4A5568', green: '0F766E'
  };
  var JOB_ORDER = ['재무회계', '인사노무', '환경', '지식재산권', '공정거래', '안전', '지배구조', '정보보호'];
  var JOB_COLOR = { '재무회계': '2A78D6', '인사노무': 'EB6834', '환경': '1BAF7A', '지식재산권': 'EDA100', '공정거래': 'E87BA4', '안전': '008300', '지배구조': '4A3AA7', '정보보호': 'E34948', '기타': 'A0AEC0' };
  var FLAG = {
    '벌칙': { c: C.red, w: 5 }, '과태료': { c: C.orange, w: 4 }, '과징금': { c: C.amber, w: 4 }, '처분': { c: C.purple, w: 3, label: '행정처분' },
    '의무': { c: C.teal, w: 2 }, '신설': { c: C.blue, w: 1, label: '조문 신설' }, '삭제': { c: C.gray, w: 0, label: '조문 삭제' }
  };
  var FLAG_ORDER = ['벌칙', '과태료', '과징금', '처분', '의무', '신설', '삭제'];
  var SANCTION = { '벌칙': 1, '과태료': 1, '과징금': 1, '처분': 1 };
  var W = 13.333, X0 = 0.6, CW = W - 1.2;

  function fmt(n) { return Number(n || 0).toLocaleString('ko-KR'); }
  function md(d) { return Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10)); }
  function dot(d) { return d.slice(0, 4) + '. ' + Number(d.slice(5, 7)) + '. ' + Number(d.slice(8, 10)) + '.'; }
  function cut(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function flagLabel(c) { return (FLAG[c] && FLAG[c].label) || c; }
  function isRisk(it) { return (it.codes || []).some(function (c) { return SANCTION[c] || c === '의무'; }); }
  function score(it) { return (it.codes || []).reduce(function (a, c) { return a + ((FLAG[c] || {}).w || 0); }, 0); }
  function inRange(d, a, b) { return d >= a && d <= b; }
  function uniq(list) { var o = {}; list.forEach(function (x) { o[x] = 1; }); return Object.keys(o); }

  /* ---------- 공통 조각 ---------- */
  function master(pptx, footer) {
    pptx.defineSlideMaster({
      title: 'RR',
      background: { color: C.white },
      objects: [
        { rect: { x: 0, y: 0, w: W, h: 0.09, fill: { color: C.primary }, line: { color: C.primary } } },
        { text: { text: footer, options: { x: X0, y: 7.05, w: 9, h: 0.3, fontFace: F, fontSize: 9, color: C.faint } } }
      ],
      slideNumber: { x: W - 1.1, y: 7.05, w: 0.5, h: 0.3, fontFace: F, fontSize: 9, color: C.faint, align: 'right' }
    });
  }
  function title(s, t, sub) {
    s.addText(t, { x: X0, y: 0.35, w: CW, h: 0.6, fontFace: F, fontSize: 24, bold: true, color: C.ink, margin: 0 });
    if (sub) s.addText(sub, { x: X0, y: 0.95, w: CW, h: 0.35, fontFace: F, fontSize: 12, color: C.muted, margin: 0 });
  }
  function card(s, pptx, x, y, w, h, fill) {
    s.addShape(pptx.ShapeType.roundRect, { x: x, y: y, w: w, h: h, fill: { color: fill || C.white }, line: { color: C.line, width: 1 }, rectRadius: 0.08 });
  }
  function kpi(s, pptx, x, y, w, h, label, value, note, color) {
    card(s, pptx, x, y, w, h);
    s.addShape(pptx.ShapeType.rect, { x: x + 0.001, y: y + 0.2, w: 0.07, h: h - 0.4, fill: { color: color }, line: { color: color } });
    s.addText(label, { x: x + 0.28, y: y + 0.16, w: w - 0.4, h: 0.32, fontFace: F, fontSize: 11, bold: true, color: C.sub, margin: 0 });
    s.addText(value, { x: x + 0.28, y: y + 0.5, w: w - 0.4, h: 0.62, fontFace: F, fontSize: 30, bold: true, color: C.ink, margin: 0 });
    if (note) s.addText(note, { x: x + 0.28, y: y + 1.14, w: w - 0.4, h: 0.5, fontFace: F, fontSize: 9.5, color: C.muted, margin: 0, valign: 'top' });
  }
  function head(cells) {
    return cells.map(function (t) {
      return { text: t, options: { bold: true, color: C.primaryDark, fill: { color: C.band }, fontSize: 10 } };
    });
  }
  function flagRuns(codes, short) {
    var list = FLAG_ORDER.filter(function (c) { return (codes || []).indexOf(c) >= 0; });
    if (!list.length) return [{ text: '–', options: { color: C.faint } }];
    var runs = [];
    list.forEach(function (c, i) {
      if (i) runs.push({ text: ' · ', options: { color: C.faint } });
      runs.push({ text: short ? c : flagLabel(c), options: { color: FLAG[c].c, bold: true } });
    });
    return runs;
  }
  function ministry(m) { return String(m || '').split(',')[0]; }
  function jobCell(j) {
    return { text: [{ text: '● ', options: { color: JOB_COLOR[j] || C.faint } }, { text: j || '기타', options: { color: C.ink } }] };
  }
  function table(s, rows, x, y, w, colW, fontSize) {
    s.addTable(rows, {
      x: x, y: y, w: w, colW: colW, fontFace: F, fontSize: fontSize || 9.5, color: C.ink, valign: 'middle',
      border: { type: 'solid', pt: 0.5, color: C.line }, fill: { color: C.white }, margin: [3, 5, 3, 5], autoPage: false
    });
  }
  function chunk(list, n) { var out = []; for (var i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out.length ? out : [[]]; }
  function note(s, text, y) {
    s.addText(text, { x: X0, y: y || 6.62, w: CW, h: 0.32, fontFace: F, fontSize: 9, color: C.muted, margin: 0 });
  }

  /* 제재·의무 변경의 '주요 내용' 한 칸 */
  function detailText(it) {
    var d = it.detail || {};
    var lines = [];
    var names = [['penalty', '벌칙'], ['fine', '과태료'], ['surcharge', '과징금'], ['sanction', '행정처분']];
    var sanc = [];
    names.forEach(function (p) {
      var refs = ((d.flags || {})[p[0]] || []).filter(function (x) { return x.strong; }).map(function (x) { return x.ref; });
      if (refs.length) sanc.push(p[1] + ' ' + refs.slice(0, 2).join(', ') + (refs.length > 2 ? ' 외 ' + (refs.length - 2) : ''));
    });
    if (sanc.length) lines.push(cut(sanc.join(' · '), 96));
    if ((d.newArticles || []).length) lines.push('신설 조문: ' + cut(d.newArticles.slice(0, 2).join(', ') + (d.newArticles.length > 2 ? ' 외' : ''), 84));
    var du = (d.duty || []).map(function (x) { return x.replace(/^제\d+조(의\d+)?\([^)]*\)\s*/, '').replace(/^[①-⑳]\s*/, ''); })
      .filter(function (x) { return x.length >= 12; })[0];
    if (du) lines.push('의무: “' + cut(du, 84) + '”');
    return lines.length ? lines.join('\n') : cut(it.summary || '', 110);
  }
  function highlight(it) {
    var d = it.detail || {};
    var parts = [];
    var names = [['penalty', '벌칙'], ['fine', '과태료'], ['surcharge', '과징금'], ['sanction', '행정처분']];
    names.forEach(function (p) {
      var refs = ((d.flags || {})[p[0]] || []).filter(function (x) { return x.strong; }).map(function (x) { return x.ref.replace(/\(.*$/, ''); });
      if (refs.length) parts.push(p[1] + ' 신설·변경(' + refs.slice(0, 2).join(', ') + ')');
    });
    if ((d.newArticles || []).length) parts.push('조문 신설 ' + d.newArticles.length + '개');
    if ((d.duty || []).length) parts.push('회사 의무 조항');
    if (!parts.length) parts = (it.codes || []).map(flagLabel);
    return it.title + ' (' + md(it.date) + ' 시행) — ' + parts.join(' · ');
  }

  /* ---------- 보고서 ---------- */
  function build(PptxGenJS, input) {
    F = input.fontFace || DEFAULT_FONT;
    var pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'RegRader';
    pptx.company = input.company || '';
    pptx.title = input.label + ' 법규 개정 동향 보고';
    var jobTag = input.job ? ' · ' + input.job : '';
    master(pptx, 'RegRader · ' + input.label + ' 법규 개정 동향 보고' + jobTag + ' · ' + dot(input.asOf) + ' 기준');

    var byJob = function (it) { return !input.job || it.job === input.job; };
    var P = input.items.filter(function (it) { return inRange(it.date, input.start, input.end) && byJob(it); })
      .sort(function (a, b) { return a.date.localeCompare(b.date) || a.title.localeCompare(b.title); });
    var N = input.items.filter(function (it) { return input.next && inRange(it.date, input.next.start, input.next.end) && byJob(it); })
      .sort(function (a, b) { return a.date.localeCompare(b.date) || a.title.localeCompare(b.title); });
    var R = P.filter(isRisk).sort(function (a, b) { return score(b) - score(a) || a.date.localeCompare(b.date); });
    var A = (input.admrul || []).filter(function (x) {
      return !x.g && inRange(x.d, input.start, input.end) && (!input.job || (x.c || []).indexOf(input.job) >= 0);
    }).sort(function (a, b) { return b.d.localeCompare(a.d) || a.t.localeCompare(b.t); });
    var laws = uniq(P.map(function (x) { return x.title; }));
    var sanc = P.filter(function (it) { return (it.codes || []).some(function (c) { return SANCTION[c]; }); });
    var duty = P.filter(function (it) { return (it.codes || []).indexOf('의무') >= 0; });
    var nRisk = N.filter(isRisk);
    var fc = function (c) { return P.filter(function (it) { return (it.codes || []).indexOf(c) >= 0; }).length; };

    /* 1. 표지 */
    var s = pptx.addSlide();
    s.background = { color: C.white };
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 6.1, h: 7.5, fill: { color: C.primary }, line: { color: C.primary } });
    s.addText('REGRADER · 법규 개정 모니터링', { x: 0.7, y: 0.8, w: 5, h: 0.4, fontFace: F, fontSize: 12, bold: true, color: 'D9DDFB', charSpacing: 1, margin: 0 });
    s.addText([{ text: input.label, options: { breakLine: true } }, { text: '법규 개정 동향 보고' }],
      { x: 0.7, y: 1.9, w: 5.2, h: 1.9, fontFace: F, fontSize: 34, bold: true, color: C.white, margin: 0, valign: 'top', lineSpacingMultiple: 1.05 });
    if (input.job) s.addText(input.job + ' 직무', { x: 0.7, y: 3.85, w: 5, h: 0.45, fontFace: F, fontSize: 18, bold: true, color: 'D9DDFB', margin: 0 });
    s.addText(input.periodText + ' 시행 기준', { x: 0.7, y: 4.45, w: 5.2, h: 0.4, fontFace: F, fontSize: 14, color: 'E6E9FC', margin: 0 });
    s.addText(dot(input.asOf) + ' 기준 · 국가법령정보센터 OpenAPI', { x: 0.7, y: 6.55, w: 5.3, h: 0.35, fontFace: F, fontSize: 11, color: 'C9CEF7', margin: 0 });
    var big = [
      [fmt(P.length) + '건', '시행된 개정 (법령 ' + fmt(laws.length) + '개)', C.primary],
      [fmt(sanc.length + duty.filter(function (x) { return sanc.indexOf(x) < 0; }).length) + '건', '제재·의무 변경', C.red],
      [fmt(N.length) + '건', input.next ? '다음 ' + input.next.short + ' 시행 예정' : '다음 기간 시행 예정', C.orange]
    ];
    big.forEach(function (b, i) {
      var y = 1.25 + i * 1.55;
      s.addShape(pptx.ShapeType.rect, { x: 6.9, y: y + 0.12, w: 0.08, h: 0.95, fill: { color: b[2] }, line: { color: b[2] } });
      s.addText(b[0], { x: 7.2, y: y, w: 5.4, h: 0.75, fontFace: F, fontSize: 36, bold: true, color: C.ink, margin: 0 });
      s.addText(b[1], { x: 7.2, y: y + 0.75, w: 5.4, h: 0.4, fontFace: F, fontSize: 13, color: C.sub, margin: 0 });
    });
    s.addText('모니터링 범위 · 적용법규 ' + fmt(input.baseCount) + '개 (법률·시행령·시행규칙) · 행정규칙 ' + fmt(input.admCandidates) + '개',
      { x: 6.9, y: 6.1, w: 5.9, h: 0.6, fontFace: F, fontSize: 10.5, color: C.muted, margin: 0, valign: 'top' });

    /* 2. 요약 */
    s = pptx.addSlide({ masterName: 'RR' });
    title(s, '요약', input.label + ' (' + input.periodText + ') 시행 기준' + (input.job ? ' · ' + input.job + ' 직무' : ''));
    var kw = (CW - 4 * 0.2) / 5, ky = 1.55, kh = 1.75;
    kpi(s, pptx, X0 + 0 * (kw + 0.2), ky, kw, kh, '시행된 개정', fmt(P.length) + '건', '법령 ' + fmt(laws.length) + '개', C.primary);
    kpi(s, pptx, X0 + 1 * (kw + 0.2), ky, kw, kh, '제재 변경', fmt(sanc.length) + '건', '벌칙 ' + fc('벌칙') + ' · 과태료 ' + fc('과태료') + ' · 과징금 ' + fc('과징금') + ' · 처분 ' + fc('처분'), C.red);
    kpi(s, pptx, X0 + 2 * (kw + 0.2), ky, kw, kh, '의무 신설·변경', fmt(duty.length) + '건', '회사가 지는 의무 문장 기준', C.teal);
    kpi(s, pptx, X0 + 3 * (kw + 0.2), ky, kw, kh, input.next ? '다음 ' + input.next.short + ' 예정' : '다음 기간 예정', fmt(N.length) + '건', '제재·의무 변경 ' + nRisk.length + '건', C.orange);
    kpi(s, pptx, X0 + 4 * (kw + 0.2), ky, kw, kh, '행정규칙 개정', fmt(A.length) + '건', '신규 제정 ' + A.filter(function (x) { return /제정/.test(x.a) && !/폐지/.test(x.a); }).length + '건 · 참고용 제외', C.green);
    card(s, pptx, X0, 3.55, CW, 3.3, C.soft);
    s.addText('주요 사항', { x: X0 + 0.3, y: 3.7, w: 4, h: 0.4, fontFace: F, fontSize: 14, bold: true, color: C.ink, margin: 0 });
    var bullets = R.slice(0, 5).map(function (it) { return cut(highlight(it), 120); });
    if (!bullets.length) bullets.push('이 기간에 벌칙·과태료·과징금·행정처분이나 회사 의무가 바뀐 개정은 없습니다.');
    if (input.next) bullets.push('다음 ' + input.next.label + '(' + input.next.periodText + ') 시행 예정 ' + N.length + '건 중 제재·의무 변경 ' + nRisk.length + '건 — 시행 전 대응이 필요합니다.');
    if (A.length) bullets.push('행정규칙(고시·훈령·예규) ' + A.length + '건이 바뀌었습니다. 세부 기준 변경은 부록 목록을 확인하세요.');
    s.addText(bullets.map(function (b) { return { text: b, options: { bullet: { code: '25A0' }, paraSpaceAfter: 6 } }; }),
      { x: X0 + 0.3, y: 4.15, w: CW - 0.6, h: 2.6, fontFace: F, fontSize: 12, color: C.ink, valign: 'top', margin: 0, lineSpacingMultiple: 1.1 });

    /* 3. 직무별 현황 (직무를 고르면 계열별) */
    s = pptx.addSlide({ masterName: 'RR' });
    if (!input.job) {
      title(s, '직무별 개정 현황', input.label + ' 시행 개정을 직무별로 나눴습니다 · 표의 제재·의무는 해당 표시가 붙은 개정 수');
      var jobs = JOB_ORDER.filter(function (j) { return P.some(function (x) { return x.job === j; }) || N.some(function (x) { return x.job === j; }); });
      if (jobs.length) {
        s.addChart(pptx.ChartType.bar, jobs.map(function (j) {
          return { name: j, labels: jobs, values: jobs.map(function (k) { return k === j ? P.filter(function (x) { return x.job === j; }).length : 0; }) };
        }), {
          x: X0, y: 1.5, w: 6.3, h: 5.1, barDir: 'bar', barGrouping: 'stacked', overlap: 100, barGapWidthPct: 45,
          chartColors: jobs.map(function (j) { return JOB_COLOR[j]; }), showLegend: false,
          showValue: true, dataLabelFormatCode: '#,##0;;;', dataLabelFontFace: F, dataLabelFontSize: 10, dataLabelColor: C.ink, dataLabelPosition: 'inEnd',
          catAxisLabelFontFace: F, catAxisLabelFontSize: 11, catAxisLabelColor: C.ink, catAxisOrientation: 'maxMin',
          valAxisLabelFontFace: F, valAxisLabelFontSize: 9, valAxisLabelColor: C.muted, valGridLine: { color: 'EDF2F7', size: 0.5 }, catGridLine: { style: 'none' }
        });
      }
      var rows = [head(['직무', '개정', '법령', '제재', '의무', '다음 예정'])];
      jobs.forEach(function (j) {
        var pj = P.filter(function (x) { return x.job === j; });
        rows.push([jobCell(j), fmt(pj.length), fmt(uniq(pj.map(function (x) { return x.title; })).length),
          fmt(pj.filter(function (x) { return (x.codes || []).some(function (c) { return SANCTION[c]; }); }).length),
          fmt(pj.filter(function (x) { return (x.codes || []).indexOf('의무') >= 0; }).length),
          fmt(N.filter(function (x) { return x.job === j; }).length)]);
      });
      rows.push([{ text: '합계', options: { bold: true } }, { text: fmt(P.length), options: { bold: true } }, { text: fmt(laws.length), options: { bold: true } },
        { text: fmt(sanc.length), options: { bold: true } }, { text: fmt(duty.length), options: { bold: true } }, { text: fmt(N.length), options: { bold: true } }]);
      rows = rows.map(function (r, i) { return i ? r.map(function (c, k) { return k ? (typeof c === 'string' ? { text: c, options: { align: 'right' } } : Object.assign(c, { options: Object.assign({ align: 'right' }, c.options || {}) })) : c; }) : r; });
      table(s, rows, 7.2, 1.55, CW - 6.6, [1.55, 0.72, 0.72, 0.72, 0.72, 1.1], 10.5);
      /* 이 기간에 여러 번 바뀐 법령 */
      var cnt = {};
      P.forEach(function (x) { cnt[x.title] = (cnt[x.title] || []).concat([x]); });
      var tops = Object.keys(cnt).map(function (t) { return [t, cnt[t]]; }).filter(function (t) { return t[1].length > 1; })
        .sort(function (a, b) { return b[1].length - a[1].length || a[0].localeCompare(b[0]); }).slice(0, 5);
      if (tops.length) {
        var ty = 1.55 + 0.27 * (rows.length) + 0.45;
        s.addText('이 기간에 여러 번 바뀐 법령', { x: 7.2, y: ty, w: CW - 6.6, h: 0.3, fontFace: F, fontSize: 11, bold: true, color: C.ink, margin: 0 });
        var trows = [head(['법령명', '직무', '횟수'])];
        tops.forEach(function (t) {
          trows.push([cut(t[0], 26), jobCell(t[1][0].job), { text: t[1].length + '회', options: { align: 'right' } }]);
        });
        table(s, trows, 7.2, ty + 0.35, CW - 6.6, [3.43, 1.3, 0.8], 10);
      }
    } else {
      title(s, input.job + ' · 법령 계열별 개정 현황', '같은 법률의 시행령·시행규칙을 한 계열로 묶었습니다 (국가법령정보센터 법령체계도 기준)');
      var fam = {};
      P.forEach(function (x) { var r = x.family || x.title; (fam[r] = fam[r] || []).push(x); });
      var top = Object.keys(fam).map(function (r) { return [r, fam[r]]; }).sort(function (a, b) { return b[1].length - a[1].length || a[0].localeCompare(b[0]); }).slice(0, 10);
      if (top.length) {
        s.addChart(pptx.ChartType.bar, [{ name: '개정', labels: top.map(function (t) { return cut(t[0], 16); }), values: top.map(function (t) { return t[1].length; }) }], {
          x: X0, y: 1.5, w: 6.3, h: 5.1, barDir: 'bar', chartColors: [JOB_COLOR[input.job] || C.primary], showLegend: false,
          valAxisMajorUnit: top[0][1].length <= 10 ? 1 : undefined, valAxisLabelFormatCode: '0',
          showValue: true, dataLabelFontFace: F, dataLabelFontSize: 10, dataLabelColor: C.ink, catAxisOrientation: 'maxMin',
          catAxisLabelFontFace: F, catAxisLabelFontSize: 10, catAxisLabelColor: C.ink, valAxisLabelFontSize: 9, valAxisLabelColor: C.muted,
          valGridLine: { color: 'EDF2F7', size: 0.5 }, catGridLine: { style: 'none' }
        });
      }
      var fr = [head(['계열(법률)', '개정', '제재', '의무'])];
      top.forEach(function (t) {
        fr.push([cut(t[0], 22), { text: fmt(t[1].length), options: { align: 'right' } },
          { text: fmt(t[1].filter(function (x) { return (x.codes || []).some(function (c) { return SANCTION[c]; }); }).length), options: { align: 'right' } },
          { text: fmt(t[1].filter(function (x) { return (x.codes || []).indexOf('의무') >= 0; }).length), options: { align: 'right' } }]);
      });
      table(s, fr, 7.2, 1.55, CW - 6.6, [3.13, 0.8, 0.8, 0.8], 10.5);
    }

    /* 4. 월별 추이 */
    s = pptx.addSlide({ masterName: 'RR' });
    title(s, '월별 추이', input.trendNote);
    var tv = function (b, j) { return input.items.filter(function (x) { return x.job === j && inRange(x.date, b.start, b.end); }).length; };
    var tj = input.job ? [input.job] : JOB_ORDER.filter(function (j) { return input.trend.some(function (b) { return tv(b, j) > 0; }); });
    var mixed = input.trend.some(function (b) { return !b.current; });
    s.addChart(pptx.ChartType.bar, tj.map(function (j) {
      return { name: j, labels: input.trend.map(function (b) { return b.label; }), values: input.trend.map(function (b) { return tv(b, j); }) };
    }), {
      x: X0, y: 1.45, w: CW, h: 4.75, barDir: 'col', barGrouping: 'stacked', overlap: 100, barGapWidthPct: 70, valAxisLabelFormatCode: '0',
      chartColors: tj.map(function (j) { return JOB_COLOR[j]; }), showLegend: true, legendPos: 't', legendFontFace: F, legendFontSize: 10, legendColor: C.sub,
      catAxisLabelFontFace: F, catAxisLabelFontSize: 11, catAxisLabelColor: C.ink, valAxisLabelFontSize: 9, valAxisLabelColor: C.muted,
      valGridLine: { color: 'EDF2F7', size: 0.5 }, catGridLine: { style: 'none' }
    });
    var tot = input.trend.map(function (b) {
      var n = input.items.filter(function (x) { return byJob(x) && inRange(x.date, b.start, b.end); }).length;
      return b.label + ' ' + fmt(n) + '건' + (mixed && b.current ? ' (이번 보고)' : '');
    }).join('   ·   ');
    s.addText(tot, { x: X0, y: 6.3, w: CW, h: 0.35, fontFace: F, fontSize: 11, color: C.sub, align: 'center', margin: 0 });

    /* 5. 제재·의무 변경 상세 */
    var rpages = chunk(R, 8);
    rpages.forEach(function (pg, i) {
      s = pptx.addSlide({ masterName: 'RR' });
      title(s, '제재·의무 변경 상세' + (rpages.length > 1 ? ' (' + (i + 1) + '/' + rpages.length + ')' : ''),
        '벌칙·과태료·과징금·행정처분이 신설·변경되거나 회사 의무 문장이 들어간 개정 · 개정문 자동 분석 (최종 판단은 원문 확인)');
      if (!pg.length) {
        card(s, pptx, X0, 1.6, CW, 1.2, C.soft);
        s.addText('이 기간에는 해당하는 개정이 없습니다.', { x: X0, y: 1.6, w: CW, h: 1.2, fontFace: F, fontSize: 14, color: C.sub, align: 'center', valign: 'middle' });
        return;
      }
      var rows = [head(['시행일', '법령명', '직무', '변경 유형', '주요 내용'])];
      pg.forEach(function (it) {
        rows.push([md(it.date), { text: cut(it.title, 34), options: { bold: true } }, jobCell(it.job), { text: flagRuns(it.codes) },
          { text: detailText(it), options: { fontSize: 9, color: C.sub } }]);
      });
      table(s, rows, X0, 1.5, CW, [0.7, 2.95, 1.05, 1.75, 5.68], 9.5);
    });

    /* 6. 다음 기간 시행 예정 */
    if (input.next) {
      var npages = chunk(N, 18);
      npages.forEach(function (pg, i) {
        s = pptx.addSlide({ masterName: 'RR' });
        title(s, '다음 ' + input.next.label + ' 시행 예정' + (npages.length > 1 ? ' (' + (i + 1) + '/' + npages.length + ')' : ''),
          input.next.periodText + ' · 시행 전에 사내 규정·절차 반영이 필요한 개정 (' + dot(input.asOf) + ' 기준 확인된 것)');
        if (!pg.length) {
          card(s, pptx, X0, 1.6, CW, 1.2, C.soft);
          s.addText(input.next.empty || '현재 확인된 시행 예정 개정이 없습니다.', { x: X0, y: 1.6, w: CW, h: 1.2, fontFace: F, fontSize: 14, color: C.sub, align: 'center', valign: 'middle' });
          return;
        }
        var rows = [head(['시행일', 'D-day', '법령명', '직무', '구분', '제재·의무 표시'])];
        pg.forEach(function (it) {
          rows.push([md(it.date), { text: it.daysUntil === 0 ? 'D-DAY' : 'D-' + it.daysUntil, options: { color: it.daysUntil <= 30 ? C.red : C.sub, bold: true } },
            { text: cut(it.title, 44), options: { bold: isRisk(it) } }, jobCell(it.job), it.type || '', { text: flagRuns(it.codes, true) }]);
        });
        table(s, rows, X0, 1.5, CW, [0.8, 0.8, 5.1, 1.2, 1.1, 3.13], 10);
      });
    }

    /* 7. 행정규칙 */
    if (input.includeAdmrul) {
      s = pptx.addSlide({ masterName: 'RR' });
      title(s, '행정규칙 개정 (고시·훈령·예규 등)', '적용법규 계열에 연결된 행정규칙 ' + fmt(input.admCandidates) + '개 중 ' + input.label + ' 시행 ' + fmt(A.length) + '건 · 기관 내부 사무 등 참고용은 제외');
      var kinds = {}, types = {};
      A.forEach(function (x) { kinds[x.k] = (kinds[x.k] || 0) + 1; types[x.a] = (types[x.a] || 0) + 1; });
      var kindText = Object.keys(kinds).sort(function (a, b) { return kinds[b] - kinds[a]; }).map(function (k) { return k + ' ' + kinds[k]; }).join(' · ');
      var typeText = Object.keys(types).sort(function (a, b) { return types[b] - types[a]; }).map(function (k) { return k + ' ' + types[k]; }).join(' · ');
      s.addText([{ text: '종류  ', options: { bold: true, color: C.sub } }, { text: kindText || '–' }, { text: '      개정 구분  ', options: { bold: true, color: C.sub } }, { text: typeText || '–' }],
        { x: X0, y: 1.45, w: CW, h: 0.35, fontFace: F, fontSize: 11, color: C.ink, margin: 0 });
      var rows = [head(['시행일', '행정규칙명', '종류', '구분', '직무', '소관부처'])];
      A.slice(0, 16).forEach(function (x) {
        rows.push([md(x.d), { text: cut(x.t, 46), options: { bold: /제정/.test(x.a) && !/폐지/.test(x.a) } }, x.k, x.a, jobCell((x.c || [])[0]), cut(ministry(x.m), 16)]);
      });
      if (A.length) table(s, rows, X0, 1.95, CW, [0.8, 6.1, 0.75, 1.1, 1.2, 2.18], 9.5);
      else s.addText('이 기간에 시행된 행정규칙 개정이 없습니다.', { x: X0, y: 2.2, w: CW, h: 0.8, fontFace: F, fontSize: 14, color: C.sub, align: 'center' });
      if (A.length > 16) note(s, '최근 시행 16건만 표시했습니다. 전체 ' + A.length + '건은 ' + (input.appendix ? '부록과 ' : '') + '사이트의 「행정규칙」 탭에서 볼 수 있습니다.');
    }

    /* 8. 부록 */
    if (input.appendix) {
      var apages = chunk(P, 22);
      apages.forEach(function (pg, i) {
        s = pptx.addSlide({ masterName: 'RR' });
        title(s, '부록 · 개정 목록' + (apages.length > 1 ? ' (' + (i + 1) + '/' + apages.length + ')' : ''), input.label + ' 시행 개정 ' + fmt(P.length) + '건 (시행일순)');
        var rows = [head(['시행일', '법령명', '구분', '직무', '소관부처', '표시'])];
        pg.forEach(function (it) {
          rows.push([md(it.date), cut(it.title, 44), it.type || '', jobCell(it.job), cut(ministry(it.ministry), 14), { text: flagRuns(it.codes, true) }]);
        });
        table(s, rows, X0, 1.45, CW, [0.75, 5.0, 0.95, 1.15, 1.6, 2.68], 9);
      });
      if (input.includeAdmrul && A.length > 16) {
        var bpages = chunk(A.slice().sort(function (a, b) { return a.d.localeCompare(b.d); }), 24);
        bpages.forEach(function (pg, i) {
          s = pptx.addSlide({ masterName: 'RR' });
          title(s, '부록 · 행정규칙 개정 목록' + (bpages.length > 1 ? ' (' + (i + 1) + '/' + bpages.length + ')' : ''), input.label + ' 시행 ' + fmt(A.length) + '건 (시행일순, 참고용 제외)');
          var rows = [head(['시행일', '행정규칙명', '종류', '구분', '직무', '소관부처'])];
          pg.forEach(function (x) { rows.push([md(x.d), cut(x.t, 50), x.k, x.a, jobCell((x.c || [])[0]), cut(ministry(x.m), 16)]); });
          table(s, rows, X0, 1.45, CW, [0.75, 6.2, 0.75, 1.05, 1.15, 2.23], 9);
        });
      }
    }

    /* 9. 기준과 방법 */
    s = pptx.addSlide({ masterName: 'RR' });
    title(s, '기준과 방법');
    var how = [
      '자료: 국가법령정보센터 OpenAPI (매일 오전 7시 자동 확인, ' + dot(input.asOf) + ' 기준)',
      '대상: 당사 적용법규 ' + fmt(input.baseCount) + '개(법률·시행령·시행규칙)와 법령명이 정확히 같은 법령의 개정 · 행정규칙은 적용법규 계열에 법령체계도로 연결된 ' + fmt(input.admCandidates) + '개',
      '집계: 시행일 기준. 개정 1건 = 법령 + 시행일 + 개정 구분 (같은 법령이 여러 번 바뀌면 각각 셈)',
      '제재·의무 표시: 개정문과 조문 제목을 자동 분석. 벌칙·과태료·과징금·행정처분 조항이 신설·변경된 경우만 표시하고, 인용·용어만 바뀐 경우는 제외. 의무는 회사(사업주·사용자 등)가 주어인 “…하여야 한다 / …아니 된다” 문장 기준',
      '행정규칙 참고용 분류: 기관 내부 사무·기관별 개인정보 지침·위원회 운영·특정 지역 대상 등은 이 보고서에서 제외(사이트에서는 볼 수 있음)',
      '자세한 개정 취지·조문·신구비교: ' + (input.site || 'RegRader 사이트')
    ];
    s.addText(how.map(function (b) { return { text: b, options: { bullet: { code: '25A0' }, paraSpaceAfter: 10 } }; }),
      { x: X0, y: 1.4, w: CW, h: 5.2, fontFace: F, fontSize: 12.5, color: C.ink, valign: 'top', margin: 0, lineSpacingMultiple: 1.15 });
    return pptx;
  }

  var QN = [['1분기', 1, 3], ['2분기', 4, 6], ['3분기', 7, 9], ['4분기', 10, 12]];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function last(y, m) { return new Date(y, m, 0).getDate(); }
  function todayKST() {
    var k = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    return k.getFullYear() + '-' + pad(k.getMonth() + 1) + '-' + pad(k.getDate());
  }
  function span(y, m1, m2) { return { start: y + '-' + pad(m1) + '-01', end: y + '-' + pad(m2) + '-' + pad(last(y, m2)) }; }
  function periodText(y, m1, m2) { return y + '. ' + m1 + '. 1. ~ ' + (m1 === m2 ? '' : m2 + '. ') + last(y, m2) + '.'; }

  function period(kind, n, year) {
    var p = {};
    if (kind === 'quarter') {
      var q = QN[n - 1];
      Object.assign(p, span(year, q[1], q[2]), { label: year + '년 ' + q[0], periodText: periodText(year, q[1], q[2]) });
      var nq = n === 4 ? [year + 1, 1] : [year, n + 1];
      var qq = QN[nq[1] - 1];
      p.next = Object.assign(span(nq[0], qq[1], qq[2]), { label: (nq[0] !== year ? nq[0] + '년 ' : '') + qq[0], short: '분기', periodText: periodText(nq[0], qq[1], qq[2]) });
      p.trend = [];
      for (var m = q[1]; m <= q[2]; m++) p.trend.push(Object.assign(span(year, m, m), { label: m + '월', current: true }));
      p.trendNote = p.label + ' 3개월 · 직무별 시행 건수';
    } else {
      Object.assign(p, span(year, n, n), { label: year + '년 ' + n + '월', periodText: periodText(year, n, n) });
      var nm = n === 12 ? [year + 1, 1] : [year, n + 1];
      p.next = Object.assign(span(nm[0], nm[1], nm[1]), { label: (nm[0] !== year ? nm[0] + '년 ' : '') + nm[1] + '월', short: '달', periodText: periodText(nm[0], nm[1], nm[1]) });
      p.trend = [];
      for (var k = Math.max(1, n - 5); k <= n; k++) p.trend.push(Object.assign(span(year, k, k), { label: k + '월', current: k === n }));
      p.trendNote = '최근 ' + p.trend.length + '개월 · 직무별 시행 건수 (' + n + '월이 이번 보고)';
    }
    if (p.next && p.next.start.slice(0, 4) !== String(year)) p.next.empty = '다음 해 시행분은 연말에 미리 모은 1~2월분만 반영됩니다.';
    return p;
  }


  var API = { build: build, period: period };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  /* ================= 브라우저: 기간·직무 고르기 + 만들기 ================= */
  if (typeof window === 'undefined') return;
  var LIB = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
  function loadLib() {
    if (window.PptxGenJS) return Promise.resolve();
    return new Promise(function (ok, bad) {
      var sc = document.createElement('script');
      sc.src = LIB;
      sc.onload = function () { ok(); };
      sc.onerror = function () { bad(new Error('PPT 모듈을 받지 못했습니다')); };
      document.head.appendChild(sc);
    });
  }
  function dataPath(f) { return window.rrDataPath ? window.rrDataPath(f) : './' + f; }

  function collect(opts) {
    var year = window.RR_YEAR || new Date().getFullYear();
    var A = window.rrAmend;
    var fam = window.rrFamilies;
    return Promise.all([
      A && A.loadDetails ? A.loadDetails() : Promise.resolve(),
      fetch(dataPath('admrul_events.json') + '?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : { items: [] }; }).catch(function () { return { items: [] }; }),
      fetch(dataPath('upcoming_next.json') + '?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
    ]).then(function (res) {
      var adm = res[1] || { items: [] };
      var next = Array.isArray(res[2]) ? res[2] : [];
      var today = todayKST();
      var items = (window.__rrItems || []).map(function (it) {
        var f = fam && fam.familyOf ? fam.familyOf(it.title) : null;
        return {
          title: it.title, date: it.effectiveDate, type: it.amendmentType || '', ministry: it.ministry || '',
          job: (it.categories || [])[0] || '기타', daysUntil: typeof it.daysUntil === 'number' ? it.daysUntil : 0,
          codes: A ? A.codes(it) : [], detail: A ? A.details(it) : null, summary: it.summary || '', family: f ? f.root : ''
        };
      });
      /* 연말: 다음 해 1~2월 시행분 (upcoming_next.json) */
      next.forEach(function (r) {
        if (!r || !r.t || !r.d) return;
        items.push({ title: r.t, date: r.d, type: r.a === '일' ? '일부개정' : r.a === '타' ? '타법개정' : r.a || '', ministry: r.m || '',
          job: r.c || '기타', daysUntil: Math.round((new Date(r.d) - new Date(today)) / 86400000), codes: [], detail: null, summary: '', family: '' });
      });
      var p = period(opts.kind, opts.n, year);
      return Object.assign(p, {
        year: year, job: opts.job || '', asOf: today, items: items, admrul: adm.items || [],
        baseCount: (window.__rrMeta && window.__rrMeta.baseLaws) || window.__rrBaseCount || '', admCandidates: adm.candidates || 0,
        includeAdmrul: opts.admrul !== false, appendix: opts.appendix !== false, site: 'https://tjdudfhr.github.io/RegRader/'
      });
    });
  }

  function generate(opts) {
    return loadLib().then(function () { return collect(opts); }).then(function (input) {
      var pptx = build(window.PptxGenJS, input);
      var name = 'RegRader_' + input.label.replace(/\s+/g, '_') + (input.job ? '_' + input.job : '') + '_법규개정동향.pptx';
      return pptx.writeFile({ fileName: name, compression: true }).then(function () { return name; });
    });
  }

  /* 다운로드 창 안의 '보고서' 칸 */
  function mount(slot) {
    if (!slot) return;
    var year = window.RR_YEAR || new Date().getFullYear();
    var t = todayKST(), m = Number(t.slice(5, 7)), q = Math.ceil(m / 3);
    var st = { kind: 'quarter', n: q };
    var jobs = JOB_ORDER;
    slot.innerHTML =
      '<div style="border:1px solid #c7d2fe;border-radius:12px;padding:14px;margin:0 0 12px;background:#fafbff">' +
      '<div style="font-weight:800;margin-bottom:10px">📑 법규 개정 동향 보고서 (PPT)</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">' +
        '<span id="rr-rep-kind" style="display:inline-flex;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden">' +
          '<button type="button" data-k="month" style="border:0;padding:6px 12px;cursor:pointer;font:inherit;font-size:13px">월간</button>' +
          '<button type="button" data-k="quarter" style="border:0;padding:6px 12px;cursor:pointer;font:inherit;font-size:13px">분기</button></span>' +
        '<select id="rr-rep-n" style="padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;font-size:13px"></select>' +
        '<select id="rr-rep-job" style="padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;font-size:13px"><option value="">전체 직무</option>' +
          jobs.map(function (j) { return '<option value="' + j + '">' + j + '</option>'; }).join('') + '</select>' +
      '</div>' +
      '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:#475569;margin-bottom:10px">' +
        '<label><input type="checkbox" id="rr-rep-adm" checked> 행정규칙 포함</label>' +
        '<label><input type="checkbox" id="rr-rep-app" checked> 부록: 전체 개정 목록</label></div>' +
      '<button type="button" id="rr-rep-go" style="width:100%;padding:11px;border:0;border-radius:10px;background:linear-gradient(135deg,#5b67e5,#7c3aed);color:#fff;font:inherit;font-weight:800;cursor:pointer">PPT 만들기</button>' +
      '<div id="rr-rep-msg" style="font-size:12px;color:#64748b;margin-top:8px;line-height:1.5">요약 · 직무별 현황 · 월별 추이 · 제재·의무 변경 상세 · 다음 기간 시행 예정 · 행정규칙 · 부록으로 구성됩니다. 차트와 표는 PowerPoint에서 바로 고칠 수 있습니다.</div>' +
      '</div>';
    var sel = slot.querySelector('#rr-rep-n');
    function paint() {
      slot.querySelectorAll('#rr-rep-kind button').forEach(function (b) {
        var on = b.dataset.k === st.kind;
        b.style.background = on ? '#4a57cf' : '#fff';
        b.style.color = on ? '#fff' : '#334155';
      });
      if (st.kind === 'quarter') {
        sel.innerHTML = QN.map(function (x, i) { return '<option value="' + (i + 1) + '">' + year + '년 ' + x[0] + '</option>'; }).join('');
        sel.value = String(st.kind === 'quarter' ? st.n : q);
      } else {
        var o = '';
        for (var i = 1; i <= 12; i++) o += '<option value="' + i + '">' + year + '년 ' + i + '월</option>';
        sel.innerHTML = o;
        sel.value = String(st.n);
      }
    }
    slot.querySelectorAll('#rr-rep-kind button').forEach(function (b) {
      b.onclick = function () { st.kind = b.dataset.k; st.n = st.kind === 'quarter' ? q : m; paint(); };
    });
    sel.onchange = function () { st.n = Number(sel.value); };
    paint();
    var go = slot.querySelector('#rr-rep-go'), msg = slot.querySelector('#rr-rep-msg');
    go.onclick = function () {
      if (!(window.__rrItems || []).length) { msg.textContent = '데이터를 불러오는 중입니다. 잠시 뒤 다시 눌러 주세요.'; return; }
      go.disabled = true;
      go.textContent = '만드는 중…';
      generate({ kind: st.kind, n: st.n, job: slot.querySelector('#rr-rep-job').value, admrul: slot.querySelector('#rr-rep-adm').checked, appendix: slot.querySelector('#rr-rep-app').checked })
        .then(function (name) { msg.innerHTML = '✅ <b>' + name + '</b> 을(를) 내려받았습니다.'; })
        .catch(function (e) { msg.textContent = '만들지 못했습니다: ' + (e && e.message || e); })
        .then(function () { go.disabled = false; go.textContent = 'PPT 만들기'; });
    };
  }

  window.rrReport = { build: build, generate: generate, mount: mount, period: period };
})(this);
