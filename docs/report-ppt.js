/* 월간 · 분기 법규 제·개정 동향 보고서 (PowerPoint) — 임원 보고용
 *
 * 사이트에서 기간(월·분기)과 직무를 고르면 그 자리에서 .pptx 를 만들어 내려받는다 (서버 없음).
 * PptxGenJS 는 처음 만들 때만 받는다 (cdn.jsdelivr.net).
 *
 * 구성 (결론 먼저)
 *   표지 · 보고 요약(핵심 메시지 · 핵심 숫자 · 핵심 사항)
 *   Ⅰ 개정 현황      직무별(직무를 고르면 법령 계열별) · 법규 단계별 · 전기 대비
 *   Ⅱ 중점 관리 개정  제재·의무가 바뀐 개정 중 영향이 큰 것 · 법제처 개정이유의 주요내용을 줄여 적음
 *   Ⅲ 향후 시행 예정  다음 기간 · 월별
 *   Ⅳ 대응 현황      대응 현황 관리에 로그인했을 때만 · 직무별 진행률 · 조치 필요 항목
 *   별첨             제재·의무 변경 상세 · 시행 예정 목록 · 월별 추이 · 전체 개정 목록 · 집계 기준
 * 본문 슬라이드는 맨 위 한 줄(헤드 메시지)에 결론을 적는다. 문장·표·차트는 모두 PowerPoint 에서 고칠 수 있다.
 * 숫자 기준은 사이트와 같다: 시행일 기준, 개정 건수 = 법령 + 시행일 + 개정구분.
 *
 * build(PptxGenJS, input) 은 브라우저·Node 어디서나 돌도록 입력만 받아 만든다 (Node 는 디자인 확인용).
 */
(function (root) {
  var DEFAULT_FONT = 'Malgun Gothic';   /* 회사 PC(윈도우) 기본 한글 글꼴 '맑은 고딕' */
  var F = DEFAULT_FONT;
  var C = {
    navy: '1F2B5B', accent: '3949AB', ink: '1A202C', sub: '4A5568', muted: '718096', faint: 'A0AEC0',
    line: 'D9DEEA', band: 'EEF1F8', soft: 'F6F7FB', head: 'E8ECF6', white: 'FFFFFF',
    red: 'C53030', orange: 'C05621', amber: '975A16', purple: '6B46C1', teal: '2C7A7B', blue: '2B6CB0', gray: '4A5568', green: '2F855A'
  };
  var JOB_ORDER = ['재무회계', '인사노무', '환경', '지식재산권', '공정거래', '안전', '지배구조', '정보보호'];
  var JOB_COLOR = { '재무회계': '2A78D6', '인사노무': 'EB6834', '환경': '1BAF7A', '지식재산권': 'EDA100', '공정거래': 'E87BA4', '안전': '008300', '지배구조': '4A3AA7', '정보보호': 'E34948', '기타': 'A0AEC0' };
  var FLAG = {
    '벌칙': { c: C.red, w: 5 }, '과태료': { c: C.orange, w: 4 }, '과징금': { c: C.amber, w: 4 }, '처분': { c: C.purple, w: 3, label: '행정처분' },
    '의무': { c: C.teal, w: 2 }, '신설': { c: C.blue, w: 1, label: '조문 신설' }, '삭제': { c: C.gray, w: 0, label: '조문 삭제' }
  };
  var FLAG_ORDER = ['벌칙', '과태료', '과징금', '처분', '의무', '신설', '삭제'];
  var SANCTION = { '벌칙': 1, '과태료': 1, '과징금': 1, '처분': 1 };
  var LEVELS = ['법률', '시행령', '시행규칙', '행정규칙'];
  var ST = ['미검토', '검토중', '조치필요', '조치완료', '해당없음'];
  var ST_COLOR = { '미검토': C.muted, '검토중': C.orange, '조치필요': C.red, '조치완료': C.green, '해당없음': C.gray };
  var ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'];
  var W = 13.333, X0 = 0.6, CW = W - 1.2, TOP = 2.1, BOTTOM = 6.8;

  function fmt(n) { return Number(n || 0).toLocaleString('ko-KR'); }
  function md(d) { return Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10)); }
  function dot(d) { return d.slice(0, 4) + '. ' + Number(d.slice(5, 7)) + '. ' + Number(d.slice(8, 10)) + '.'; }
  function cut(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function pct(a, b) { return b ? Math.round(a * 100 / b) : 0; }
  function signed(n) { return n > 0 ? '▲' + fmt(n) : n < 0 ? '▼' + fmt(-n) : '±0'; }
  function change(n) { return n > 0 ? fmt(n) + '건 증가' : n < 0 ? fmt(-n) + '건 감소' : '변동 없음'; }
  function flagLabel(c) { return (FLAG[c] && FLAG[c].label) || c; }
  function hasSanction(it) { return (it.codes || []).some(function (c) { return SANCTION[c]; }); }
  function hasDuty(it) { return (it.codes || []).indexOf('의무') >= 0; }
  function isRisk(it) { return hasSanction(it) || hasDuty(it); }
  function score(it) { return (it.codes || []).reduce(function (a, c) { return a + ((FLAG[c] || {}).w || 0); }, 0); }
  function levelOf(it) {
    if (it.kind) return '행정규칙';
    if (LEVELS.indexOf(it.level) >= 0) return it.level;
    return /시행령$/.test(it.title) ? '시행령' : /시행규칙$/.test(it.title) ? '시행규칙' : '법률';
  }
  /* 중요도: 제재·의무 표시가 무거운 것 → 상위 법규(법률 > 시행령 > 시행규칙 > 행정규칙) */
  function prio(it) { return score(it) * 10 + (3 - LEVELS.indexOf(levelOf(it))); }
  function byPrio(a, b) { return prio(b) - prio(a) || a.date.localeCompare(b.date) || a.title.localeCompare(b.title); }
  function byDate(a, b) { return a.date.localeCompare(b.date) || a.title.localeCompare(b.title); }
  function inRange(d, a, b) { return d >= a && d <= b; }
  function count(list, f) { return list.filter(f).length; }
  function uniq(list) { var o = {}; list.forEach(function (x) { o[x] = 1; }); return Object.keys(o); }
  function chunk(list, n) { var out = []; for (var i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out.length ? out : [[]]; }
  function ministry(m) { return String(m || '').split(',')[0]; }

  /* ---------- 개정이유 → 주요 개정 내용 몇 줄 ----------
   * 법제처 개정이유는 대개 '◇ 개정이유 … ◇ 주요내용 가. … 나. …' 꼴이다. 주요내용 항목을 뽑아
   * 조문 표시((제3조 신설) 등)를 떼고, 제재·의무와 관련된 항목을 먼저 고른다. 긴 문장은 절(…하고,)에서 끊는다. */
  function reasonBody(r) {
    r = String(r || '').replace(/\r/g, '').replace(/ /g, ' ');
    var m = r.match(/◇[ \t]*주요[ \t]*내용[^\n]*\n/) || r.match(/◇[^\n]*내용[^\n]*\n/);
    var body = m ? r.slice(m.index + m[0].length) : (r.match(/◇[^\n]*\n/) ? r.slice(r.match(/◇[^\n]*\n/).index + r.match(/◇[^\n]*\n/)[0].length) : r);
    return { body: body.split(/\n[ \t]*◇/)[0], main: !!m };
  }
  function splitItems(body) {
    var re = null;
    if (/(?:^|\n)[ \t]*가\.[ \t]/.test(body)) re = /(?:^|\n)[ \t]*[가-하]\.[ \t]+/;
    else if (/(?:^|\n)[ \t]*1[.)][ \t]/.test(body)) re = /(?:^|\n)[ \t]*\d{1,2}[.)][ \t]+/;
    else if (/(?:^|\n)[ \t]*[○ㅇ◦•□■▶◆\-][ \t]/.test(body)) re = /(?:^|\n)[ \t]*[○ㅇ◦•□■▶◆\-][ \t]+/;
    if (!re) return [body];
    var parts = body.split(re);
    parts.shift();   /* 첫 표시 앞의 머리말 */
    return parts.filter(function (p) { return p.trim(); });
  }
  var REF_TAIL = /\s*[(<（〈\[［][^()<>（）〈〉\[\]［］]*(?:제\s*\d+\s*조|별표|별지|부칙|신설|삭제|안\s*제)[^()<>（）〈〉\[\]［］]*[)>）〉\]］]\s*$/;
  function tidy(t) {
    t = String(t || '').replace(/\s+/g, ' ').trim();
    var prev;
    do { prev = t; t = t.replace(/[\s.。]+$/, '').replace(REF_TAIL, ''); } while (t !== prev);
    return t.replace(/하려는 것임$/, '함').replace(/되려는 것임$/, '됨').replace(/하고자 함$/, '함').replace(/^[\s\-–·ㆍ]+/, '');
  }
  function toPoint(p) {
    var lines = p.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    if (!lines.length) return '';
    var h = lines[0];
    var isHead = lines.length > 1 && h.length <= 100 && !/[함임됨음다]\.?$/.test(h) &&
      (/[)>）〉]$/.test(h) || /^[○ㅇ◦•□■▶◆\-]/.test(lines[1]) || h.length <= 40);
    return tidy(isHead ? h : lines.join(' '));
  }
  /* 문장 나누기 ('2026. 2. 27.' 같은 날짜의 마침표는 문장 끝이 아니다) */
  function sentences(t) {
    var out = [], re = /[임함음됨다]\.(?:\s+|$)/g, m, last = 0;
    while ((m = re.exec(t))) { out.push(t.slice(last, m.index + 1)); last = m.index + m[0].length; }
    if (t.slice(last).trim()) out.push(t.slice(last));
    return out.map(function (x) { return x.trim(); }).filter(Boolean);
  }
  /* 길면 줄인다: 위임 문구 → '…에 따라,' 앞 → '종전에는 …' → 배경(…는바,) → 목적절(…하기 위하여) → 절 경계(…하고,) → 조건절(…경우에는) */
  var DELEG = /(하는)?\s*등\s*(?:의 내용으로\s*)?(?:법률|대통령령|시행령|법|영|부령)에서 위임된 사항과 그 시행에 필요한 사항을 정(함|하는 한편|하고|하며)/;
  var BOILER = /(하는)?\s*등\s*(?:[^,]{0,70}?(?:하기 위하여|위하여)\s*)?(?:현행 제도의 )?운영(?:상|과정에서) 나타난 (?:일부 )?(?:미비점|문제점)을 (?:개선ㆍ보완|개선·보완|개선하고 보완|정비|개선)함$/;
  var BOILER_ONLY = /^(?:그 밖에\s*)?(?:현행 제도의 )?운영(?:상|과정에서) 나타난 (?:일부 )?(?:미비점|문제점)을/;
  var STEPS = [
    function (t) { return t.replace(BOILER, function (m, a) { return a ? '함' : ''; }); },
    function (t) { return t.replace(/1차 위반 시 ([\d천백만억,.]*?원)(?:, \d차 위반 시 [\d천백만억,.]*?원)*, (\d차(?: 이상)?) 위반 시 ([\d천백만억,.]*?원)/, '1차 $1 ~ $2 $3'); },
    function (t) { return t.replace(DELEG, function (m, a, x) { return a ? (x === '함' ? '함' : x) : ' 등을 정' + x; }); },
    function (t) { var m = t.match(/^.*(?:에 따라|에 맞추어|에 맞춰|과 관련하여),\s/); return m && t.length - m[0].length > 26 ? t.slice(m[0].length) : t; },
    function (t) { var k = t.indexOf('앞으로는 '); return k > 0 && t.length - k > 26 ? t.slice(k + 5) : t; },
    function (t) { var m = t.match(/^.{10,}?(?:[가-힣]바|하였으나|있으나|없으나|되었으나|어려워|없어),\s/); return m && t.length - m[0].length >= 25 ? t.slice(m[0].length) : t; },
    function (t) { var m = t.match(/^.{8,140}?(?:하기 위하여|위하여),?\s+/); return m && t.length - m[0].length >= 20 && !BOILER_ONLY.test(t.slice(m[0].length)) ? t.slice(m[0].length) : t; }
  ];
  var CLAUSE = /(하|되|이|없애|두|받|있|않|높이|줄이|늘리|낮추|갖추|넓히|바꾸|고치|알리|올리|내리|나누|맡기)(?:고|며|으며|되|는 한편),\s|(함으로써)\s/g;
  /* 동사 줄기 → 명사형 (하→함, 낮추→낮춤, 받→받음, 만들→만듦) */
  function nominal(stem) {
    var c = stem.charCodeAt(stem.length - 1) - 0xAC00, fin = c % 28, head = stem.slice(0, -1);
    if (c < 0 || c > 11171) return stem + '함';
    if (fin === 0) return head + String.fromCharCode(0xAC00 + c + 16);
    if (fin === 8) return head + String.fromCharCode(0xAC00 + c + 2);
    return stem + '음';
  }
  function shorten(t, n) {
    var again = true;
    while (again && t.length > n) {
      again = false;
      for (var i = 0; i < STEPS.length && t.length > n; i++) {
        var u = STEPS[i](t).replace(/^이에\s+/, '');
        if (u !== t) { t = u; again = true; }
      }
    }
    if (t.length <= n) return t;
    /* 절 경계에서 자른 앞부분들과 절 하나하나 가운데, 제재·의무 말이 든 것(같으면 긴 것)을 고른다 */
    var cuts = [], m, cands = [];
    CLAUSE.lastIndex = 0;
    while ((m = CLAUSE.exec(t))) cuts.push({ at: m.index, next: m.index + m[0].length, end: m[1] ? nominal(m[1]) : '함', why: !!m[2] });
    cuts.forEach(function (c, i) {
      if (c.at >= 15 && c.at + 1 <= n) cands.push(t.slice(0, c.at) + c.end);
      if (c.why) return;   /* '…함으로써' 뒤는 효과·목적이라 따로 고르지 않는다 */
      var nx = cuts[i + 1], seg = nx ? t.slice(c.next, nx.at) + nx.end : t.slice(c.next);
      if (seg.length >= 15 && seg.length <= n) cands.push(seg);
    });
    if (cands.length) {
      cands.sort(function (a, b) { return textScore(b) - textScore(a) || b.length - a.length; });
      return cands[0];
    }
    var c = t.match(/^.*(?:경우|때)(?:에는|에도|에)?\s/);
    if (c && t.length - c[0].length >= 25 && t.length - c[0].length <= n) return t.slice(c[0].length);
    return t.slice(0, n - 1) + '…';
  }
  function textScore(t) { var s = 0; PKW.forEach(function (k) { if (k[0].test(t)) s += k[1]; }); return s; }
  var PKW = [
    [/과징금|과태료|벌칙|벌금|징역|형사처벌|몰수|추징/, 4],
    [/영업정지|업무정지|허가\S{0,3}\s?취소|등록\S{0,3}\s?취소|시정명령|제재/, 2],
    [/의무|하여야|공시|신고|통지|인증|보고|제출|선임|지정|교육|설치|책임|금지|준수|손해배상/, 2],
    [/강화|상향|확대|신설|도입/, 1],
    [/명칭|자구|인용|용어|정비|재검토|위원회의?\s?(?:구성|운영|위원|심의사항)|정의|이관|소관/, -2],
    [/미비점|운영상 나타난|위임된 사항과 그 시행에 필요한/, -3]
  ];
  function pointScore(raw, refs) {
    var s = 0;
    PKW.forEach(function (k) { if (k[0].test(raw)) s += k[1]; });
    if (refs.some(function (n) { return raw.indexOf(n) >= 0; })) s += 3;
    return s;
  }
  function keyPoints(it, max, len, budget) {
    var d = it.detail || {};
    if (!String(d.reason || '').trim()) return [];
    var rb = reasonBody(d.reason);
    var refs = [];
    ['penalty', 'fine', 'surcharge', 'sanction'].forEach(function (f) {
      ((d.flags || {})[f] || []).forEach(function (x) { if (x.strong) refs.push(x.ref); });
    });
    (d.newArticles || []).forEach(function (x) { refs.push(x); });
    refs = refs.map(function (x) { var m = /제\d+조(의\d+)?/.exec(x); return m ? m[0] : ''; }).filter(Boolean);
    var parts = splitItems(rb.body), pts = [];
    parts.forEach(function (p) {
      if (parts.length > 1) { pts.push({ i: pts.length, raw: p, t: toPoint(p) }); return; }
      /* 문단 하나: 주요내용이면 문장마다 한 항목, 개정이유뿐이면 마지막 문장(…하려는 것임)이 알맹이 */
      var ss = sentences(p.replace(/\s+/g, ' ').trim());
      if (!rb.main && ss.length > 1) ss = ss.slice(-1);
      ss.forEach(function (x) { pts.push({ i: pts.length, raw: x, t: tidy(x) }); });
    });
    /* 'A하는 한편, B' 는 두 항목으로 나눠 따로 고른다 */
    pts = [].concat.apply([], pts.map(function (x) {
      var g = x.t.split(/(하|되)는 한편,\s*/);
      if (g.length < 3) return [x];
      var out = [];
      for (var k = 0; k < g.length; k += 2) out.push({ raw: g[k], t: g[k] + (k + 1 < g.length ? (g[k + 1] === '되' ? '됨' : '함') : '') });
      return out;
    })).filter(function (x) { return x.t.length >= 6 && !BOILER_ONLY.test(x.t); });
    pts.forEach(function (x, i) { x.i = i; });
    pts.forEach(function (x) { x.s = pointScore(x.raw, refs) - (/…$/.test(shorten(x.t, len)) ? 3 : 0); });
    /* 점수 높은 것부터, 칸에 들어갈 만큼(budget 글자)만. 두 번째부터는 잘려야 하면 넣지 않는다 */
    var out = [], used = 0;
    pts.slice().sort(function (a, b) { return b.s - a.s || a.i - b.i; }).forEach(function (x) {
      if (out.length >= max) return;
      var room = out.length && budget ? budget - used : (budget && pts.length > 1 ? Math.min(len, Math.round(budget * 0.6)) : len);
      if (out.length && room < 24) return;
      var t = shorten(x.t, Math.min(len, room));
      if (!out.length && /…$/.test(t) && room < len) t = shorten(x.t, len);   /* 첫 항목은 짧게 자르다 잘리면 원래 길이로 */
      if (out.length && /…$/.test(t)) return;
      out.push({ i: x.i, t: t });
      used += t.length;
    });
    return out.sort(function (a, b) { return a.i - b.i; }).map(function (x) { return x.t; });
  }
  function flagPhrase(it) {
    var s = FLAG_ORDER.filter(function (c) { return SANCTION[c] && (it.codes || []).indexOf(c) >= 0; }).map(flagLabel);
    var out = [];
    if (s.length) out.push(s.join('·') + ' 신설·변경');
    if (hasDuty(it)) out.push('회사 의무 조항 변경');
    return out.join(' 및 ') || '조문 신설·삭제';
  }
  /* 보고 요약에 넣을 짧은 말: 개정이유의 짧은 제목이 있으면 그것, 없으면 제재·의무 표시 */
  function headline(it) {
    var p = keyPoints(it, 1, 200)[0] || '';
    return p && p.length <= 32 ? p : flagPhrase(it);
  }
  /* 별첨의 조문 근거 한 줄 */
  function refLine(it) {
    var d = it.detail || {};
    var out = [];
    [['penalty', '벌칙'], ['fine', '과태료'], ['surcharge', '과징금'], ['sanction', '행정처분']].forEach(function (p) {
      var refs = ((d.flags || {})[p[0]] || []).filter(function (x) { return x.strong; }).map(function (x) { return x.ref.replace(/\(.*$/, ''); });
      if (refs.length) out.push(p[1] + ' ' + refs.slice(0, 2).join('·') + (refs.length > 2 ? ' 외' : ''));
    });
    if ((d.newArticles || []).length) out.push('신설 ' + d.newArticles.slice(0, 2).map(function (x) { return x.replace(/\(.*$/, ''); }).join('·') + (d.newArticles.length > 2 ? ' 외' : ''));
    return out.join(' · ');
  }

  /* 발표자 노트: 개정 한 건의 요지 (보고 중 질문에 답할 때 보는 용도) */
  function brief(it, n) {
    var kp = keyPoints(it, n || 5, 160), rl = refLine(it);
    return '■ ' + it.title + ' (' + md(it.date) + ' 시행 · ' + levelOf(it) + ' · ' + it.job + ')' + (isRisk(it) ? ' — ' + flagPhrase(it) : '') +
      (kp.length ? '\n' + kp.map(function (p) { return '  - ' + p; }).join('\n') : '') + (rl ? '\n  근거 조문: ' + rl : '');
  }

  /* ---------- 공통 조각 ---------- */
  function master(pptx, footer, secret) {
    var objs = [
      { rect: { x: 0, y: 0, w: W, h: 0.07, fill: { color: C.navy }, line: { color: C.navy } } },
      { line: { x: X0, y: 7.0, w: CW, h: 0, line: { color: C.line, width: 0.75 } } },
      { text: { text: footer, options: { x: X0, y: 7.05, w: 10.5, h: 0.3, fontFace: F, fontSize: 9, color: C.faint, margin: 0 } } }
    ];
    if (secret) objs.push({ text: { text: '대외비', options: { x: W - X0 - 0.95, y: 0.38, w: 0.95, h: 0.32, fontFace: F, fontSize: 10.5, bold: true, color: C.red, align: 'center', valign: 'middle', margin: 0, line: { color: C.red, width: 1 } } } });
    pptx.defineSlideMaster({
      title: 'RR', background: { color: C.white }, objects: objs,
      slideNumber: { x: W - X0 - 0.6, y: 7.05, w: 0.6, h: 0.3, fontFace: F, fontSize: 9, color: C.muted, align: 'right' }
    });
  }
  /* 본문 머리: 제목 + 헤드 메시지(결론 한두 줄) */
  function frame(s, pptx, head, msg) {
    s.addText(head, { x: X0, y: 0.3, w: CW - 1.3, h: 0.55, fontFace: F, fontSize: 20, bold: true, color: C.navy, margin: 0, valign: 'middle' });
    s.addShape(pptx.ShapeType.line, { x: X0, y: 0.93, w: CW, h: 0, line: { color: C.navy, width: 1.5 } });
    if (!msg) return;
    s.addShape(pptx.ShapeType.rect, { x: X0, y: 1.1, w: CW, h: 0.78, fill: { color: C.band }, line: { color: C.band } });
    s.addShape(pptx.ShapeType.rect, { x: X0, y: 1.1, w: 0.07, h: 0.78, fill: { color: C.accent }, line: { color: C.accent } });
    s.addText(msg, { x: X0 + 0.28, y: 1.1, w: CW - 0.45, h: 0.78, fontFace: F, fontSize: 14, bold: true, color: C.ink, margin: 0, valign: 'middle', lineSpacingMultiple: 1.05 });
  }
  /* 별첨 머리: 제목 + 설명 한 줄 */
  function aframe(s, pptx, head, sub) {
    s.addText(head, { x: X0, y: 0.3, w: CW - 1.3, h: 0.55, fontFace: F, fontSize: 18, bold: true, color: C.navy, margin: 0, valign: 'middle' });
    s.addShape(pptx.ShapeType.line, { x: X0, y: 0.93, w: CW, h: 0, line: { color: C.navy, width: 1.5 } });
    if (sub) s.addText(sub, { x: X0, y: 1.02, w: CW, h: 0.32, fontFace: F, fontSize: 10.5, color: C.muted, margin: 0, valign: 'middle' });
  }
  function kpi(s, pptx, x, y, w, h, label, value, note, color, delta) {
    s.addShape(pptx.ShapeType.rect, { x: x, y: y, w: w, h: h, fill: { color: C.white }, line: { color: C.line, width: 0.75 } });
    s.addShape(pptx.ShapeType.rect, { x: x, y: y, w: w, h: 0.07, fill: { color: color }, line: { color: color } });
    s.addText(label, { x: x + 0.22, y: y + 0.2, w: w - 0.4, h: 0.3, fontFace: F, fontSize: 11, bold: true, color: C.sub, margin: 0 });
    var runs = [{ text: value, options: { fontSize: 26, bold: true, color: C.ink } }];
    if (delta) runs.push({ text: '  ' + delta, options: { fontSize: 11, bold: true, color: C.sub } });
    s.addText(runs, { x: x + 0.22, y: y + 0.5, w: w - 0.4, h: 0.52, fontFace: F, margin: 0, valign: 'middle' });
    if (note) s.addText(note, { x: x + 0.22, y: y + 1.04, w: w - 0.4, h: 0.28, fontFace: F, fontSize: 9.5, color: C.muted, margin: 0, valign: 'top' });
  }
  function head(cells, align) {
    return cells.map(function (t, i) {
      return { text: t, options: { bold: true, color: C.navy, fill: { color: C.head }, fontSize: 10, align: (align && align[i]) || 'left' } };
    });
  }
  function num(v, o) { return { text: typeof v === 'number' ? fmt(v) : v, options: Object.assign({ align: 'right' }, o || {}) }; }
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
  function jobCell(j, o) {
    return { text: [{ text: '● ', options: { color: JOB_COLOR[j] || C.faint } }, { text: j || '기타', options: { color: C.ink } }], options: o || {} };
  }
  function table(s, rows, x, y, w, colW, fontSize, extra) {
    s.addTable(rows, Object.assign({
      x: x, y: y, w: w, colW: colW, fontFace: F, fontSize: fontSize || 10, color: C.ink, valign: 'middle',
      border: { type: 'solid', pt: 0.5, color: C.line }, fill: { color: C.white }, margin: [3, 6, 3, 6], autoPage: false
    }, extra || {}));
  }
  function note(s, text, y) {
    s.addText(text, { x: X0, y: y || 6.62, w: CW, h: 0.3, fontFace: F, fontSize: 9, color: C.muted, margin: 0, valign: 'middle' });
  }
  function emptyCard(s, pptx, text, y) {
    s.addShape(pptx.ShapeType.rect, { x: X0, y: y || TOP, w: CW, h: 1.2, fill: { color: C.soft }, line: { color: C.line, width: 0.75 } });
    s.addText(text, { x: X0, y: y || TOP, w: CW, h: 1.2, fontFace: F, fontSize: 13, color: C.sub, align: 'center', valign: 'middle', margin: 0 });
  }
  function monthSplit(list, start, end) {
    var out = [], y = Number(start.slice(0, 4)), m = Number(start.slice(5, 7));
    var ey = Number(end.slice(0, 4)), em = Number(end.slice(5, 7));
    while (y < ey || (y === ey && m <= em)) {
      var k = y + '-' + pad(m);
      out.push({ label: m + '월', key: k, items: list.filter(function (x) { return x.date.slice(0, 7) === k; }) });
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }

  /* ---------- 보고서 ---------- */
  function build(PptxGenJS, input) {
    F = input.fontFace || DEFAULT_FONT;
    var pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = input.dept || 'RegRader';
    pptx.company = input.company || '';
    pptx.title = input.label + ' 법규 제·개정 동향 보고' + (input.job ? ' (' + input.job + ')' : '');
    master(pptx, 'RegRader 법규 개정 모니터링 · 자료: 국가법령정보센터 · ' + dot(input.asOf) + ' 기준' + (input.job ? ' · ' + input.job + ' 직무' : ''), input.secret);
    var page = 0, secNo = 0;
    function add(bare) { page++; return bare ? pptx.addSlide() : pptx.addSlide({ masterName: 'RR' }); }
    function sec(t) { return ROMAN[secNo++] + '. ' + t; }

    var byJob = function (it) { return !input.job || it.job === input.job; };
    var pick = function (a, b) { return input.items.filter(function (it) { return inRange(it.date, a, b) && byJob(it); }).sort(byDate); };
    var P = pick(input.start, input.end);
    var N = input.next ? pick(input.next.start, input.next.end) : [];
    var PV = input.prev ? pick(input.prev.start, input.prev.end) : null;
    var R = P.filter(isRisk).sort(byPrio);
    var laws = uniq(P.map(function (x) { return x.title; }));
    var sanc = P.filter(hasSanction), duty = P.filter(hasDuty);
    var nRisk = N.filter(isRisk);
    var lvN = function (list, l) { return count(list, function (x) { return levelOf(x) === l; }); };
    var ofJob = function (list, j) { return list.filter(function (x) { return x.job === j; }); };
    var T = input.track && input.track.resp ? input.track : null;
    var rowOf = function (it) { return (T && T.resp[it.key]) || null; };
    var stOf = function (it) { var r = rowOf(it); return r && r.status ? r.status : '미검토'; };
    var owner = function (j) {
      var m = ((T && T.members) || []).filter(function (x) { return x.job === j && x.role !== 'admin'; })[0];
      return m ? (m.name || m.email.split('@')[0]) : '';
    };
    var who = input.job ? input.job + ' 직무' : '당사';
    var nextLabel = input.next ? input.next.label : '';
    var msN = input.next ? monthSplit(N, input.next.start, input.next.end) : [];
    var jobRank = JOB_ORDER.concat(['기타']).map(function (j) { return [j, ofJob(P, j).length]; })
      .filter(function (x) { return x[1]; }).sort(function (a, b) { return b[1] - a[1]; });
    var famOf = function (list) {
      var fam = {};
      list.forEach(function (x) { var r = x.family || x.title; (fam[r] = fam[r] || []).push(x); });
      return Object.keys(fam).map(function (r) { return [r, fam[r]]; }).sort(function (a, b) { return b[1].length - a[1].length || a[0].localeCompare(b[0]); });
    };
    var fams = famOf(P);
    /* 같은 계열(법률·시행령…)은 하나만: 요약에서 서로 다른 법을 보이도록 */
    var topFam = function (list, n) {
      var seen = {}, out = [];
      list.forEach(function (it) { var f = it.family || it.title; if (out.length < n && !seen[f]) { seen[f] = 1; out.push(it); } });
      return out;
    };
    var lower = lvN(P, '시행규칙') + lvN(P, '행정규칙');
    /* 대응 현황: 이번 기간 시행분 + 다음 기간 예정분 */
    var TG = P.concat(N), stc = {};
    ST.forEach(function (x) { stc[x] = 0; });
    if (T) TG.forEach(function (it) { stc[stOf(it)]++; });
    var done = stc['조치완료'] + stc['해당없음'];
    var overdue = T ? TG.filter(function (it) { var r = rowOf(it); return r && r.due_date && r.due_date < input.asOf && ['조치완료', '해당없음'].indexOf(r.status) < 0; }).length : 0;

    /* ===== 표지 ===== */
    var s = add(true);
    s.background = { color: C.white };
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.3, h: 7.5, fill: { color: C.navy }, line: { color: C.navy } });
    s.addShape(pptx.ShapeType.rect, { x: 0.3, y: 0, w: 0.08, h: 7.5, fill: { color: C.accent }, line: { color: C.accent } });
    if (input.secret) s.addText('대외비', { x: W - X0 - 1.1, y: 0.55, w: 1.1, h: 0.38, fontFace: F, fontSize: 12, bold: true, color: C.red, align: 'center', valign: 'middle', margin: 0, line: { color: C.red, width: 1.25 } });
    s.addText('법규 모니터링 ' + (input.kindLabel || '정기 보고'), { x: 1.15, y: 1.7, w: 9, h: 0.4, fontFace: F, fontSize: 14, bold: true, color: C.accent, margin: 0 });
    s.addText(input.label, { x: 1.15, y: 2.2, w: 11, h: 0.7, fontFace: F, fontSize: 28, bold: true, color: C.navy, margin: 0 });
    s.addText('법규 제·개정 동향 보고', { x: 1.15, y: 2.9, w: 11.4, h: 1.0, fontFace: F, fontSize: 44, bold: true, color: C.ink, margin: 0 });
    s.addShape(pptx.ShapeType.rect, { x: 1.15, y: 4.18, w: 1.1, h: 0.06, fill: { color: C.accent }, line: { color: C.accent } });
    s.addText((input.job ? input.job + ' 직무 · ' : '') + '당사 적용법규 ' + fmt(input.baseCount) + '개 · ' + input.periodText + ' 시행분',
      { x: 1.15, y: 4.42, w: 11, h: 0.42, fontFace: F, fontSize: 15, color: C.sub, margin: 0 });
    var sign = [{ text: dot(input.reportDate || input.asOf), options: { breakLine: !!input.dept } }];
    if (input.dept) sign.push({ text: input.dept, options: { bold: true, fontSize: 18 } });
    s.addText(sign, { x: W - X0 - 4.5, y: 5.55, w: 4.5, h: 0.95, fontFace: F, fontSize: 16, color: C.ink, align: 'right', valign: 'bottom', margin: 0, lineSpacingMultiple: 1.15 });
    s.addText('자료: 국가법령정보센터 OpenAPI · RegRader 법규 개정 모니터링 (' + dot(input.asOf) + ' 기준)',
      { x: 1.15, y: 6.85, w: 8, h: 0.3, fontFace: F, fontSize: 10, color: C.faint, margin: 0 });

    /* ===== 보고 요약 ===== */
    s = add();
    var msg0 = input.label + ' ' + who + ' 적용 법규 개정 ' + fmt(P.length) + '건 시행';
    if (R.length) msg0 += ' — 제재·의무 변경 ' + R.length + '건';
    if (input.next) msg0 += (R.length ? ', ' : ' — ') + nextLabel + ' 시행 예정 ' + N.length + '건' + (nRisk.length ? '(제재·의무 ' + nRisk.length + '건)' : '') + (N.length ? ' 사전 대응 필요' : '');
    frame(s, pptx, '보고 요약', msg0);
    var kw = (CW - 3 * 0.22) / 4, kh = 1.36;
    kpi(s, pptx, X0, TOP, kw, kh, '시행 개정', fmt(P.length) + '건',
      '법규 ' + fmt(laws.length) + '개' + (PV ? ' · ' + input.prev.label + ' ' + fmt(PV.length) + '건' : ''), C.navy, PV ? signed(P.length - PV.length) : '');
    kpi(s, pptx, X0 + (kw + 0.22), TOP, kw, kh, '제재·의무 변경', fmt(R.length) + '건', '제재 ' + sanc.length + '건 · 의무 ' + duty.length + '건 (중복 제외)', C.red);
    kpi(s, pptx, X0 + 2 * (kw + 0.22), TOP, kw, kh, input.next ? nextLabel + ' 시행 예정' : '다음 기간 예정', fmt(N.length) + '건', '제재·의무 변경 ' + nRisk.length + '건', C.orange);
    if (T) kpi(s, pptx, X0 + 3 * (kw + 0.22), TOP, kw, kh, '대응 완료율', pct(done, TG.length) + '%', '완료 ' + done + ' / 대상 ' + TG.length + ' · 조치 필요 ' + stc['조치필요'], C.green);
    else kpi(s, pptx, X0 + 3 * (kw + 0.22), TOP, kw, kh, '법률·시행령 개정', fmt(lvN(P, '법률') + lvN(P, '시행령')) + '건', '시행규칙 ' + lvN(P, '시행규칙') + ' · 행정규칙 ' + lvN(P, '행정규칙') + '건', C.accent);

    var pts = [];
    var t1 = input.label + ' 시행 개정 ' + fmt(P.length) + '건(법규 ' + fmt(laws.length) + '개)' + (PV ? ', ' + input.prev.label + ' 대비 ' + change(P.length - PV.length) : '') + '. ';
    if (!input.job) t1 += jobRank.slice(0, 3).map(function (x) { return x[0] + ' ' + x[1] + '건(' + pct(x[1], P.length) + '%)'; }).join('·') + ' 순이며, ';
    else if (fams.length) t1 += fams.slice(0, 2).map(function (f) { return cut(f[0], 20) + ' 계열 ' + f[1].length + '건'; }).join('·') + ' 등 ' + fams.length + '개 계열이며, ';
    t1 += '법률 ' + lvN(P, '법률') + '·시행령 ' + lvN(P, '시행령') + '·시행규칙 ' + lvN(P, '시행규칙') + '·행정규칙 ' + lvN(P, '행정규칙') + '건';
    pts.push(['개정 현황', t1]);
    pts.push(['중점 관리', R.length
      ? '제재·의무가 바뀐 개정 ' + R.length + '건 — ' + topFam(R, 2).map(function (it) { return '「' + cut(it.title, 26) + '」(' + md(it.date) + ') ' + headline(it); }).join(', ') + (R.length > 2 ? ' 등' : '')
      : '벌칙·과태료·과징금·행정처분이나 회사 의무가 바뀐 개정 없음']);
    if (input.next) pts.push(['향후 시행', N.length
      ? nextLabel + ' 시행 예정 ' + N.length + '건' + (msN.length > 1 ? '(' + msN.map(function (m) { return m.label + ' ' + m.items.length; }).join('·') + ')' : '') +
        (nRisk.length ? ' 중 제재·의무 변경 ' + nRisk.length + '건' : '') + ' — 시행 전 사내 규정·업무 절차 반영 필요'
      : nextLabel + ' 시행 예정으로 확인된 개정 없음 (' + dot(input.asOf) + ' 기준)']);
    if (T) pts.push(['대응 현황', '이번 기간 시행분과 ' + (nextLabel || '다음 기간') + ' 예정분 ' + TG.length + '건 중 검토 완료 ' + done + '건(' + pct(done, TG.length) + '%) · 조치 필요 ' + stc['조치필요'] + '건 · 검토 중 ' + stc['검토중'] + '건 · 미검토 ' + stc['미검토'] + '건' + (overdue ? ' — 조치 기한 지난 ' + overdue + '건 확인 필요' : '')]);
    s.addNotes(['[보고 요약] ' + msg0, ''].concat(pts.map(function (p, i) { return (i + 1) + '. ' + p[0] + ' — ' + p[1]; }))
      .concat(['', '※ 시행일 기준 집계 · 개정 1건 = 법령 + 시행일 + 개정 구분 · 자료: 국가법령정보센터 (' + dot(input.asOf) + ' 기준)']).join('\n'));
    var py = TOP + kh + 0.3, ph = Math.min(0.98, (BOTTOM - py) / pts.length);
    pts.forEach(function (p, i) {
      var y = py + i * ph;
      s.addText(String(i + 1), { shape: pptx.ShapeType.ellipse, x: X0 + 0.04, y: y + 0.12, w: 0.34, h: 0.34, fill: { color: C.navy }, line: { color: C.navy }, fontFace: F, fontSize: 11.5, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0 });
      s.addText(p[0], { x: X0 + 0.52, y: y + 0.1, w: 1.4, h: 0.38, fontFace: F, fontSize: 13, bold: true, color: C.navy, margin: 0, valign: 'middle' });
      s.addText(p[1], { x: X0 + 1.95, y: y + 0.1, w: CW - 1.95, h: ph - 0.16, fontFace: F, fontSize: 12, color: C.ink, margin: 0, valign: 'top', lineSpacingMultiple: 1.12 });
      if (i < pts.length - 1) s.addShape(pptx.ShapeType.line, { x: X0, y: y + ph - 0.03, w: CW, h: 0, line: { color: C.line, width: 0.75, dashType: 'dash' } });
    });

    /* ===== Ⅰ. 개정 현황 ===== */
    s = add();
    var tx = 6.05, tw = CW - (tx - X0);
    if (!input.job) {
      frame(s, pptx, sec('개정 현황'), input.label + ' 시행 개정 ' + fmt(P.length) + '건' + (PV ? '(' + input.prev.label + ' 대비 ' + change(P.length - PV.length) + ')' : '') +
        (jobRank.length ? ' — ' + jobRank.slice(0, 2).map(function (x) { return x[0] + ' ' + x[1] + '건'; }).join('·') + ' 순' : '') +
        (P.length ? ', 시행규칙·행정규칙 등 세부 기준 개정이 ' + pct(lower, P.length) + '%' : ''));
      var jobs = JOB_ORDER.filter(function (j) { return ofJob(P, j).length || ofJob(N, j).length; });
      if (jobs.length) {
        s.addChart(pptx.ChartType.bar, jobs.map(function (j) {
          return { name: j, labels: jobs, values: jobs.map(function (k) { return k === j ? ofJob(P, j).length : 0; }) };
        }), {
          x: X0 - 0.1, y: TOP - 0.05, w: 5.4, h: 4.55, barDir: 'bar', barGrouping: 'stacked', overlap: 100, barGapWidthPct: 45,
          chartColors: jobs.map(function (j) { return JOB_COLOR[j]; }), showLegend: false,
          showValue: true, dataLabelFormatCode: '#,##0;;;', dataLabelFontFace: F, dataLabelFontSize: 10, dataLabelColor: C.white, dataLabelPosition: 'inEnd',
          catAxisLabelFontFace: F, catAxisLabelFontSize: 11, catAxisLabelColor: C.ink, catAxisOrientation: 'maxMin',
          valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' }
        });
      }
      var hasPV = !!PV;
      var hdr = ['직무', '계', '법률', '시행령', '시행규칙', '행정규칙', '제재·의무'].concat(hasPV ? [input.prev.short || '전기'] : []);
      var rows = [head(hdr, hdr.map(function (x, i) { return i ? 'right' : 'left'; }))];
      jobs.forEach(function (j) {
        var pj = ofJob(P, j);
        rows.push([jobCell(j), num(pj.length, { bold: true }), num(lvN(pj, '법률')), num(lvN(pj, '시행령')), num(lvN(pj, '시행규칙')), num(lvN(pj, '행정규칙')),
          num(count(pj, isRisk), { color: count(pj, isRisk) ? C.red : C.ink, bold: !!count(pj, isRisk) })].concat(hasPV ? [num(ofJob(PV, j).length, { color: C.muted })] : []));
      });
      var tot = { bold: true, fill: { color: C.soft } };
      rows.push([{ text: '합계', options: tot }, num(P.length, tot), num(lvN(P, '법률'), tot), num(lvN(P, '시행령'), tot), num(lvN(P, '시행규칙'), tot), num(lvN(P, '행정규칙'), tot),
        num(R.length, Object.assign({ color: C.red }, tot))].concat(hasPV ? [num(PV.length, Object.assign({ color: C.muted }, tot))] : []));
      var rh = Math.min(0.4, 3.75 / rows.length);
      table(s, rows, tx, TOP, tw, hasPV ? [1.3, 0.62, 0.62, 0.72, 0.86, 0.86, 0.9, 0.8] : [1.45, 0.72, 0.72, 0.8, 0.95, 0.95, 1.09], 10.5, { rowH: rh });
      s.addNotes(['[개정 현황] 직무별 (계 · 법률/시행령/시행규칙/행정규칙 · 제재·의무)'].concat(jobRank.map(function (x) {
        var pj = ofJob(P, x[0]);
        return '- ' + x[0] + ' ' + x[1] + '건 (' + LEVELS.map(function (l) { return l + ' ' + lvN(pj, l); }).join(' · ') + ' · 제재·의무 ' + count(pj, isRisk) + ')';
      })).join('\n'));
      var ms = monthSplit(P, input.start, input.end);
      var mline = (ms.length > 1 ? '월별 시행: ' + ms.map(function (m) { return m.label + ' ' + m.items.length + '건'; }).join(' · ') + '    ' : '');
      s.addText(mline + '제재·의무: 벌칙·과태료·과징금·행정처분이 신설·변경되거나 회사 의무 조항이 바뀐 개정(개정문 자동 분석)',
        { x: tx, y: TOP + rh * rows.length + 0.18, w: tw, h: 0.55, fontFace: F, fontSize: 9, color: C.muted, margin: 0, valign: 'top' });
    } else {
      var top = fams.slice(0, 10);
      frame(s, pptx, sec('개정 현황 (법령 계열별)'), input.label + ' ' + input.job + ' 직무 시행 개정 ' + fmt(P.length) + '건' + (PV ? '(' + input.prev.label + ' 대비 ' + change(P.length - PV.length) + ')' : '') +
        (top.length ? ' — ' + top.slice(0, 2).map(function (f) { return cut(f[0], 22) + ' 계열 ' + f[1].length + '건'; }).join('·') + ' 순' : ''));
      if (top.length) {
        s.addChart(pptx.ChartType.bar, [{ name: '개정', labels: top.map(function (t) { return cut(t[0], 16); }), values: top.map(function (t) { return t[1].length; }) }], {
          x: X0 - 0.1, y: TOP - 0.05, w: 5.4, h: 4.55, barDir: 'bar', chartColors: [JOB_COLOR[input.job] || C.accent], showLegend: false,
          showValue: true, dataLabelFontFace: F, dataLabelFontSize: 10, dataLabelColor: C.ink, dataLabelPosition: 'outEnd', catAxisOrientation: 'maxMin',
          catAxisLabelFontFace: F, catAxisLabelFontSize: 10, catAxisLabelColor: C.ink, valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' }
        });
      } else emptyCard(s, pptx, '이 기간에 시행된 개정이 없습니다.');
      var fr = [head(['계열(법률)', '계', '법률', '시행령', '시행규칙', '행정규칙', '제재·의무'], ['left', 'right', 'right', 'right', 'right', 'right', 'right'])];
      top.forEach(function (t) {
        fr.push([cut(t[0], 18), num(t[1].length, { bold: true }), num(lvN(t[1], '법률')), num(lvN(t[1], '시행령')), num(lvN(t[1], '시행규칙')), num(lvN(t[1], '행정규칙')),
          num(count(t[1], isRisk), { color: count(t[1], isRisk) ? C.red : C.ink })]);
      });
      if (top.length) table(s, fr, tx, TOP, tw, [2.6, 0.55, 0.55, 0.65, 0.75, 0.75, 0.83], 10);
      note(s, '같은 법률의 시행령·시행규칙·행정규칙을 한 계열로 묶음(국가법령정보센터 법령체계도 기준)' + (fams.length > top.length ? ' · 상위 ' + top.length + '개 계열 표시' : ''));
    }

    /* ===== Ⅱ. 중점 관리 개정 사항 ===== */
    if (R.length) {
      var K = R.slice(0, 5);
      s = add();
      frame(s, pptx, sec('중점 관리 개정 사항'), '제재·의무가 바뀐 개정 ' + R.length + '건' + (R.length > K.length ? ' 중 영향이 큰 ' + K.length + '건' : '') +
        ' — 사내 규정·업무 절차 반영 여부 점검 필요');
      var withT = !!T;
      var cols = withT ? [2.55, 5.25, 1.55, 2.78] : [2.8, 7.28, 2.05];
      var krow = [head(['법령 (시행일 · 단계 · 직무)', '주요 개정 내용', '제재·의무'].concat(withT ? ['대응 현황'] : []))];
      K.forEach(function (it) {
        var kp = keyPoints(it, 2, 110, withT ? 150 : 180);
        if (!kp.length) kp = [refLine(it) || flagPhrase(it)];
        var r = [
          { text: [{ text: cut(it.title, 42), options: { bold: true, color: C.ink, breakLine: true } },
            { text: md(it.date) + ' 시행 · ' + levelOf(it) + ' · ' + it.job, options: { color: C.muted, fontSize: 9 } }] },
          { text: kp.map(function (p, i) { return { text: '· ' + p, options: { breakLine: i < kp.length - 1 } }; }), options: { fontSize: 10, color: C.ink } },
          { text: flagRuns(it.codes), options: { fontSize: 9.5 } }
        ];
        if (withT) {
          var tr = rowOf(it), runs = [];
          if (!tr) runs.push({ text: '미검토', options: { color: C.muted, bold: true } });
          else {
            runs.push({ text: (tr.status || '미검토') + (tr.impact ? ' · 영향 ' + tr.impact : ''), options: { bold: true, color: ST_COLOR[tr.status] || C.muted } });
            if (tr.action) runs.push({ text: cut(tr.action, 46), options: { color: C.sub, fontSize: 9 } });
            var tail = [];
            if (tr.due_date) tail.push('기한 ' + md(tr.due_date));
            if (owner(it.job)) tail.push(owner(it.job));
            if (tail.length) runs.push({ text: tail.join(' · '), options: { color: C.muted, fontSize: 9 } });
          }
          runs.forEach(function (x, i) { if (i < runs.length - 1) x.options.breakLine = true; });
          r.push({ text: runs, options: { fontSize: 9.5 } });
        }
        krow.push(r);
      });
      table(s, krow, X0, TOP, CW, cols, 10, { valign: 'top', margin: [5, 6, 5, 6] });
      s.addNotes(['[중점 관리 개정 사항] 개정이유 주요내용 (질문 대비)'].concat(K.map(function (it) { return brief(it, 5); }))
        .concat(R.length > K.length ? ['그 밖의 제재·의무 변경: ' + R.slice(K.length).map(function (it) { return it.title + '(' + md(it.date) + ')'; }).join(', ')] : []).join('\n\n'));
      note(s, (R.length > K.length ? '외 ' + (R.length - K.length) + '건은 별첨 1 「제재·의무 변경 상세」 참조 · ' : '') +
        '주요 개정 내용은 법제처 개정이유를 줄인 것이며, 제재·의무 표시는 개정문 자동 분석 결과임(최종 판단은 원문 확인)');
    }

    /* ===== Ⅲ. 향후 시행 예정 ===== */
    if (input.next) {
      s = add();
      frame(s, pptx, sec('향후 시행 예정'), N.length
        ? nextLabel + ' 시행 예정 ' + N.length + '건' + (msN.length > 1 ? '(' + msN.map(function (m) { return m.label + ' ' + m.items.length; }).join('·') + ')' : '') +
          (nRisk.length ? ' — 제재·의무 변경 ' + nRisk.length + '건은 시행 전 사내 규정·절차 반영 필요' : ' — 시행일 전 적용 여부 확인 필요')
        : nextLabel + ' 시행 예정으로 확인된 개정 없음');
      if (!N.length) emptyCard(s, pptx, input.next.empty || '현재 확인된 시행 예정 개정이 없습니다.');
      else if (msN.length > 1) {
        var gap = 0.22, cw = (CW - gap * (msN.length - 1)) / msN.length, ch = 4.3, maxRows = 7;
        msN.forEach(function (m, i) {
          var x = X0 + i * (cw + gap), mr = count(m.items, isRisk);
          s.addShape(pptx.ShapeType.rect, { x: x, y: TOP, w: cw, h: ch, fill: { color: C.white }, line: { color: C.line, width: 0.75 } });
          s.addShape(pptx.ShapeType.rect, { x: x, y: TOP, w: cw, h: 0.52, fill: { color: C.head }, line: { color: C.head } });
          var hr = [{ text: m.label, options: { bold: true, color: C.navy, fontSize: 15 } }, { text: '  ' + m.items.length + '건', options: { bold: true, color: C.sub, fontSize: 12 } }];
          if (mr) hr.push({ text: '   제재·의무 ' + mr + '건', options: { bold: true, color: C.red, fontSize: 10 } });
          s.addText(hr, { x: x + 0.2, y: TOP, w: cw - 0.3, h: 0.52, fontFace: F, margin: 0, valign: 'middle' });
          if (!m.items.length) {
            s.addText('예정 없음', { x: x + 0.2, y: TOP + 0.7, w: cw - 0.4, h: 0.4, fontFace: F, fontSize: 10.5, color: C.muted, margin: 0 });
            return;
          }
          var sel = m.items.slice().sort(byPrio).slice(0, maxRows).sort(byDate);
          var runs = [];
          sel.forEach(function (it, k) {
            if (!input.job) runs.push({ text: '● ', options: { color: JOB_COLOR[it.job] || C.faint, fontSize: 8 } });
            runs.push({ text: md(it.date) + '  ', options: { bold: true, color: C.sub, fontSize: 10 } });
            var fl = FLAG_ORDER.filter(function (c) { return (SANCTION[c] || c === '의무') && (it.codes || []).indexOf(c) >= 0; });
            runs.push({ text: cut(it.title, 40), options: { color: C.ink, fontSize: 10, bold: fl.length > 0, breakLine: !fl.length && k < sel.length - 1 } });
            if (fl.length) runs.push({ text: '  ' + fl.map(flagLabel).join('·'), options: { color: C.red, fontSize: 9, bold: true, breakLine: k < sel.length - 1 } });
          });
          s.addText(runs, { x: x + 0.2, y: TOP + 0.66, w: cw - 0.35, h: ch - 1.12, fontFace: F, margin: 0, valign: 'top', paraSpaceAfter: 5, lineSpacingMultiple: 1.05 });
          if (m.items.length > sel.length) s.addText('외 ' + (m.items.length - sel.length) + '건', { x: x + 0.2, y: TOP + ch - 0.42, w: cw - 0.4, h: 0.3, fontFace: F, fontSize: 9.5, color: C.muted, margin: 0, align: 'right' });
        });
      } else {
        var sel1 = N.slice().sort(byPrio).slice(0, 12).sort(byDate);
        var nr = [head(['시행일', 'D-day', '법령명', '단계', '직무', '제재·의무'])];
        sel1.forEach(function (it) {
          nr.push([md(it.date), { text: it.daysUntil === 0 ? 'D-DAY' : 'D-' + it.daysUntil, options: { color: it.daysUntil <= 30 ? C.red : C.sub, bold: true } },
            { text: cut(it.title, 46), options: { bold: isRisk(it) } }, levelOf(it), jobCell(it.job), { text: flagRuns(it.codes, true) }]);
        });
        table(s, nr, X0, TOP, CW, [0.8, 0.8, 5.33, 1.0, 1.3, 2.9], 10);
      }
      s.addNotes(nRisk.length ? ['[향후 시행 예정] 제재·의무가 바뀌는 개정 ' + nRisk.length + '건'].concat(nRisk.slice().sort(byDate).map(function (it) { return brief(it, 3); })).join('\n\n')
        : '[향후 시행 예정] 제재·의무가 바뀌는 개정은 확인되지 않음');
      if (N.length) note(s, (N.length > (msN.length > 1 ? 0 : 12) ? '전체 ' + N.length + '건 목록은 별첨 2 · ' : '') + dot(input.asOf) + ' 기준 공포된 개정만 반영(이후 공포분은 다음 보고에 반영)' +
        (msN.length > 1 ? ' · 달마다 제재·의무 변경과 상위 법규를 먼저 표시' : ''));
    }

    /* ===== Ⅳ. 대응 현황 (대응 현황 관리에 로그인한 경우) ===== */
    if (T) {
      s = add();
      frame(s, pptx, sec('대응 현황'), '대상 ' + TG.length + '건 중 검토 완료 ' + done + '건(' + pct(done, TG.length) + '%) — 조치 필요 ' + stc['조치필요'] + '건 · 검토 중 ' + stc['검토중'] + '건 · 미검토 ' + stc['미검토'] + '건' +
        (overdue ? ', 기한 지난 ' + overdue + '건' : ''));
      var tj = (input.job ? [input.job] : JOB_ORDER).filter(function (j) { return ofJob(TG, j).length; });
      var al = ['left', 'left', 'right', 'right', 'right', 'right', 'right', 'right'];
      var trows = [head(['직무', '담당', '대상', '완료', '조치필요', '검토중', '미검토', '완료율'], al)];
      tj.forEach(function (j) {
        var l = ofJob(TG, j), c = {};
        ST.forEach(function (x) { c[x] = 0; });
        l.forEach(function (it) { c[stOf(it)]++; });
        var dn = c['조치완료'] + c['해당없음'];
        trows.push([jobCell(j), owner(j) || { text: '미지정', options: { color: C.faint } }, num(l.length), num(dn), num(c['조치필요'], { color: c['조치필요'] ? C.red : C.ink, bold: !!c['조치필요'] }),
          num(c['검토중']), num(c['미검토'], { color: c['미검토'] ? C.orange : C.ink }), num(pct(dn, l.length) + '%', { bold: true })]);
      });
      var tt = { bold: true, fill: { color: C.soft } };
      trows.push([{ text: '합계', options: tt }, { text: '', options: tt }, num(TG.length, tt), num(done, tt), num(stc['조치필요'], Object.assign({ color: C.red }, tt)), num(stc['검토중'], tt), num(stc['미검토'], tt), num(pct(done, TG.length) + '%', tt)]);
      table(s, trows, X0, TOP, 6.6, [1.25, 1.1, 0.62, 0.62, 0.8, 0.72, 0.72, 0.77], 10.5);
      var ax = X0 + 6.9, aw = CW - 6.9;
      s.addText('조치 필요 · 검토 중 항목', { x: ax, y: TOP - 0.02, w: aw, h: 0.3, fontFace: F, fontSize: 11.5, bold: true, color: C.navy, margin: 0 });
      var todo = TG.filter(function (it) { return ['조치필요', '검토중'].indexOf(stOf(it)) >= 0; }).sort(function (a, b) {
        var ra = rowOf(a) || {}, rb = rowOf(b) || {};
        return (stOf(a) === '조치필요' ? 0 : 1) - (stOf(b) === '조치필요' ? 0 : 1) || String(ra.due_date || '9999').localeCompare(String(rb.due_date || '9999')) || byDate(a, b);
      });
      if (!todo.length) emptyCard(s, pptx, '조치가 필요한 항목이 없습니다.', TOP + 0.4);
      else {
        var lr = [head(['법령 (시행일)', '조치 내용', '기한', '상태'])];
        todo.slice(0, 7).forEach(function (it) {
          var r = rowOf(it) || {};
          lr.push([{ text: [{ text: cut(it.title, 26), options: { bold: true, breakLine: true } }, { text: md(it.date) + ' · ' + it.job, options: { color: C.muted, fontSize: 8.5 } }] },
            { text: cut(r.action || '–', 34), options: { color: r.action ? C.sub : C.faint } },
            { text: r.due_date ? md(r.due_date) : '–', options: { color: r.due_date && r.due_date < input.asOf ? C.red : C.ink, bold: !!(r.due_date && r.due_date < input.asOf) } },
            { text: stOf(it), options: { color: ST_COLOR[stOf(it)], bold: true } }]);
        });
        table(s, lr, ax, TOP + 0.36, aw, [2.15, 1.65, 0.55, 0.88], 9.5);
        if (todo.length > 7) s.addText('외 ' + (todo.length - 7) + '건', { x: ax, y: 6.3, w: aw, h: 0.28, fontFace: F, fontSize: 9, color: C.muted, align: 'right', margin: 0 });
      }
      note(s, '대상: 이번 기간 시행분 + ' + (nextLabel || '다음 기간') + ' 시행 예정분 · 완료 = 조치완료 + 해당없음 · 대응 현황 관리(RegRader) 기록 기준');
      var od = TG.filter(function (it) { var r = rowOf(it); return r && r.due_date && r.due_date < input.asOf && ['조치완료', '해당없음'].indexOf(r.status) < 0; });
      s.addNotes('[대응 현황] 조치 기한이 지난 항목 ' + od.length + '건' + (od.length ? '\n' + od.map(function (it) { var r = rowOf(it); return '- ' + it.title + ' (' + md(it.date) + ' 시행 · ' + it.job + (owner(it.job) ? ' · ' + owner(it.job) : '') + ') 기한 ' + md(r.due_date) + ' · ' + r.status + (r.action ? ' · ' + r.action : ''); }).join('\n') : ''));
    }

    /* ===== 별첨 ===== */
    var apx = [];
    if (R.length) apx.push({ t: '제재·의무 변경 상세', n: chunk(R, 7).length, c: R.length + '건' });
    if (input.next && N.length) apx.push({ t: nextLabel + ' 시행 예정 목록', n: chunk(N, 18).length, c: N.length + '건' });
    apx.push({ t: '월별·직무별 추이', n: 1 });
    if (input.appendix && P.length) apx.push({ t: '전체 개정 목록', n: chunk(P, 22).length, c: P.length + '건' });
    apx.push({ t: '집계 기준과 방법', n: 1 });
    s = add();
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0.07, w: 4.3, h: 6.88, fill: { color: C.navy }, line: { color: C.navy } });
    s.addText('별첨', { x: 0.9, y: 2.6, w: 3, h: 1.0, fontFace: F, fontSize: 40, bold: true, color: C.white, margin: 0 });
    s.addText('상세 자료', { x: 0.9, y: 3.55, w: 3, h: 0.5, fontFace: F, fontSize: 16, color: 'C9CEF7', margin: 0 });
    var at = page + 1, alist = [];
    apx.forEach(function (a, i) {
      alist.push({ text: '별첨 ' + (i + 1) + '.  ', options: { bold: true, color: C.accent } });
      alist.push({ text: a.t + (a.c ? ' (' + a.c + ')' : ''), options: { color: C.ink, bold: true } });
      alist.push({ text: '    ' + at + '쪽', options: { color: C.muted, breakLine: i < apx.length - 1 } });
      a.no = i + 1;
      at += a.n;
    });
    s.addText(alist, { x: 5.1, y: 1.5, w: 7.6, h: 4.6, fontFace: F, fontSize: 15, margin: 0, valign: 'middle', paraSpaceAfter: 16 });
    var apxNo = function (t) { var a = apx.filter(function (x) { return x.t === t; })[0]; return a ? a.no : ''; };

    /* 별첨: 제재·의무 변경 상세 */
    if (R.length) {
      var rp = chunk(R, 7);
      rp.forEach(function (pg, i) {
        s = add();
        aframe(s, pptx, '별첨 ' + apxNo('제재·의무 변경 상세') + '. 제재·의무 변경 상세' + (rp.length > 1 ? ' (' + (i + 1) + '/' + rp.length + ')' : ''),
          '벌칙·과태료·과징금·행정처분이 신설·변경되거나 회사 의무 조항이 바뀐 개정 ' + R.length + '건 (중요도순) · 개정문 자동 분석 — 최종 판단은 원문 확인');
        var rows = [head(['시행일', '법령명', '직무', '제재·의무', '주요 개정 내용 · 근거 조문'])];
        pg.forEach(function (it) {
          var kp = keyPoints(it, 2, 100, 150), rl = refLine(it), runs = [];
          kp.forEach(function (p) { runs.push({ text: '· ' + p, options: { color: C.ink, breakLine: true } }); });
          if (rl) runs.push({ text: rl, options: { color: C.muted, fontSize: 8.5 } });
          if (!runs.length) runs.push({ text: '–', options: { color: C.faint } });
          else if (!rl) runs[runs.length - 1].options.breakLine = false;
          rows.push([md(it.date), { text: [{ text: cut(it.title, 40), options: { bold: true, breakLine: true } }, { text: levelOf(it) + (it.type ? ' · ' + it.type : ''), options: { color: C.muted, fontSize: 8.5 } }] },
            jobCell(it.job), { text: flagRuns(it.codes) }, { text: runs, options: { fontSize: 9 } }]);
        });
        table(s, rows, X0, 1.45, CW, [0.62, 2.9, 1.05, 1.55, 6.01], 9.5, { valign: 'top' });
      });
    }

    /* 별첨: 다음 기간 시행 예정 목록 */
    if (input.next && N.length) {
      var np = chunk(N, 18);
      np.forEach(function (pg, i) {
        s = add();
        aframe(s, pptx, '별첨 ' + apxNo(nextLabel + ' 시행 예정 목록') + '. ' + nextLabel + ' 시행 예정 목록' + (np.length > 1 ? ' (' + (i + 1) + '/' + np.length + ')' : ''),
          input.next.periodText + ' 시행 예정 ' + N.length + '건 (시행일순) · ' + dot(input.asOf) + ' 기준 확인된 것');
        var rows = [head(['시행일', 'D-day', '법령명', '단계', '직무', '구분', '제재·의무'])];
        pg.forEach(function (it) {
          rows.push([md(it.date), { text: it.daysUntil === 0 ? 'D-DAY' : 'D-' + it.daysUntil, options: { color: it.daysUntil <= 30 ? C.red : C.sub, bold: true } },
            { text: cut(it.title, 46), options: { bold: isRisk(it) } }, levelOf(it), jobCell(it.job), (it.kind ? it.kind + ' ' : '') + (it.type || ''), { text: flagRuns(it.codes, true) }]);
        });
        table(s, rows, X0, 1.45, CW, [0.72, 0.72, 4.9, 0.9, 1.2, 1.3, 2.39], 9.5);
      });
    }

    /* 별첨: 월별·직무별 추이 */
    s = add();
    aframe(s, pptx, '별첨 ' + apxNo('월별·직무별 추이') + '. 월별·직무별 추이', input.trendNote);
    var tv = function (b, j) { return input.items.filter(function (x) { return x.job === j && inRange(x.date, b.start, b.end); }).length; };
    var tjobs = input.job ? [input.job] : JOB_ORDER.filter(function (j) { return input.trend.some(function (b) { return tv(b, j) > 0; }); });
    if (tjobs.length) {
      s.addChart(pptx.ChartType.bar, tjobs.map(function (j) {
        return { name: j, labels: input.trend.map(function (b) { return b.label; }), values: input.trend.map(function (b) { return tv(b, j); }) };
      }), {
        x: X0, y: 1.45, w: CW, h: 4.75, barDir: 'col', barGrouping: 'stacked', overlap: 100, barGapWidthPct: 60, valAxisLabelFormatCode: '0',
        chartColors: tjobs.map(function (j) { return JOB_COLOR[j]; }), showLegend: true, legendPos: 't', legendFontFace: F, legendFontSize: 10, legendColor: C.sub,
        catAxisLabelFontFace: F, catAxisLabelFontSize: 11, catAxisLabelColor: C.ink, valAxisLabelFontSize: 9, valAxisLabelColor: C.muted,
        valGridLine: { color: 'EDF2F7', size: 0.5 }, catGridLine: { style: 'none' }
      });
    }
    s.addText(input.trend.map(function (b) {
      var n = input.items.filter(function (x) { return byJob(x) && inRange(x.date, b.start, b.end); }).length;
      return { text: b.label + ' ' + fmt(n) + '건', options: { bold: !!b.current, color: b.current ? C.ink : C.muted } };
    }).reduce(function (a, r, i) { if (i) a.push({ text: '   ·   ', options: { color: C.faint } }); a.push(r); return a; }, []),
      { x: X0, y: 6.3, w: CW, h: 0.32, fontFace: F, fontSize: 10.5, align: 'center', margin: 0 });

    /* 별첨: 전체 개정 목록 */
    if (input.appendix && P.length) {
      var ap = chunk(P, 22);
      ap.forEach(function (pg, i) {
        s = add();
        aframe(s, pptx, '별첨 ' + apxNo('전체 개정 목록') + '. 전체 개정 목록' + (ap.length > 1 ? ' (' + (i + 1) + '/' + ap.length + ')' : ''), input.label + ' 시행 개정 ' + fmt(P.length) + '건 (시행일순)');
        var rows = [head(['시행일', '법령명', '단계', '구분', '직무', '소관부처', '제재·의무'])];
        pg.forEach(function (it) {
          rows.push([md(it.date), cut(it.title, 44), levelOf(it), (it.kind ? it.kind + ' ' : '') + (it.type || ''), jobCell(it.job), cut(ministry(it.ministry), 14), { text: flagRuns(it.codes, true) }]);
        });
        table(s, rows, X0, 1.45, CW, [0.66, 4.7, 0.85, 1.25, 1.15, 1.55, 1.97], 9);
      });
    }

    /* 별첨: 집계 기준과 방법 */
    s = add();
    aframe(s, pptx, '별첨 ' + apxNo('집계 기준과 방법') + '. 집계 기준과 방법');
    var how = [
      ['자료', '국가법령정보센터 OpenAPI (매일 오전 7시 자동 확인, ' + dot(input.asOf) + ' 기준). 공포됐지만 아직 시행되지 않은 개정도 포함'],
      ['대상', '당사 적용법규 ' + fmt(input.baseCount) + '개 = 법령(법률·시행령·시행규칙) ' + fmt(input.lawCount) + '개 + 그 계열에 법령체계도로 연결된 행정규칙(고시·훈령·예규 등) ' + fmt(input.admCandidates) + '개'],
      ['집계', '시행일 기준. 개정 1건 = 법령 + 시행일 + 개정 구분 (같은 법령이 여러 번 바뀌면 각각 셈)'],
      ['제재·의무', '개정문과 조문 제목을 자동 분석. 벌칙·과태료·과징금·행정처분 조항이 신설·변경된 경우만 표시하고 인용·용어만 바뀐 경우는 제외. 의무는 회사(사업주·사용자 등)가 주어인 “…하여야 한다 / …아니 된다” 문장 기준'],
      ['주요 개정 내용', '법제처가 공개한 개정이유(주요내용)에서 제재·의무와 관련된 항목을 먼저 골라 줄여 적음. 원문 표현을 줄인 것이므로 정확한 내용은 원문 확인'],
      ['행정규칙', '기관 내부 사무·기관별 개인정보 지침·위원회 운영·특정 지역 대상 등은 참고용으로 분류해 적용법규에서 제외(사이트 계열 보기에서 흐리게 표시)'],
      ['원문', '개정 취지·조문·신구조문 비교: ' + (input.site || 'RegRader 사이트')]
    ];
    table(s, how.map(function (h) { return [{ text: h[0], options: { bold: true, color: C.navy, fill: { color: C.head } } }, h[1]]; }),
      X0, 1.45, CW, [1.9, CW - 1.9], 11, { margin: [7, 10, 7, 10] });
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

  /* 기간: 이번 기간 · 다음 기간 · 전기(같은 해 안에서만 — 지난해 자료는 따로 보관) · 추이 */
  function period(kind, n, year) {
    var p = {};
    if (kind === 'quarter') {
      var q = QN[n - 1];
      Object.assign(p, span(year, q[1], q[2]), { label: year + '년 ' + q[0], kindLabel: '분기 보고', periodText: periodText(year, q[1], q[2]) });
      var nq = n === 4 ? [year + 1, 1] : [year, n + 1];
      var qq = QN[nq[1] - 1];
      p.next = Object.assign(span(nq[0], qq[1], qq[2]), { label: (nq[0] !== year ? nq[0] + '년 ' : '') + qq[0], short: '분기', periodText: periodText(nq[0], qq[1], qq[2]) });
      if (n > 1) p.prev = Object.assign(span(year, QN[n - 2][1], QN[n - 2][2]), { label: QN[n - 2][0], short: '전분기' });
      p.trend = [];
      for (var m = 1; m <= q[2]; m++) p.trend.push(Object.assign(span(year, m, m), { label: m + '월', current: m >= q[1] }));
      p.trendNote = year + '년 1월 ~ ' + q[2] + '월 직무별 시행 건수 (굵은 글씨가 이번 보고 기간)';
    } else {
      Object.assign(p, span(year, n, n), { label: year + '년 ' + n + '월', kindLabel: '월간 보고', periodText: periodText(year, n, n) });
      var nm = n === 12 ? [year + 1, 1] : [year, n + 1];
      p.next = Object.assign(span(nm[0], nm[1], nm[1]), { label: (nm[0] !== year ? nm[0] + '년 ' : '') + nm[1] + '월', short: '달', periodText: periodText(nm[0], nm[1], nm[1]) });
      if (n > 1) p.prev = Object.assign(span(year, n - 1, n - 1), { label: (n - 1) + '월', short: '전월' });
      p.trend = [];
      for (var k = Math.max(1, n - 5); k <= n; k++) p.trend.push(Object.assign(span(year, k, k), { label: k + '월', current: k === n }));
      p.trendNote = '최근 ' + p.trend.length + '개월 직무별 시행 건수 (' + n + '월이 이번 보고)';
    }
    if (p.next && p.next.start.slice(0, 4) !== String(year)) p.next.empty = '다음 해 시행분은 연말에 미리 모은 1~2월분만 반영됩니다.';
    return p;
  }


  var API = { build: build, period: period, keyPoints: keyPoints };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  /* ================= 브라우저: 기간·직무 고르기 + 만들기 ================= */
  if (typeof window === 'undefined') return;
  var LIB = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
  var PREF = 'rr-report-pref';
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
  function short(t) { return t === '일부개정' ? '일' : t === '타법개정' ? '타' : (t || ''); }
  function getPref() { try { return JSON.parse(localStorage.getItem(PREF) || '{}') || {}; } catch (e) { return {}; } }
  function setPref(p) { try { localStorage.setItem(PREF, JSON.stringify(p)); } catch (e) {} }
  function trackSnap() {
    try { return window.rrTracker && window.rrTracker.snapshot ? window.rrTracker.snapshot() : null; } catch (e) { return null; }
  }

  function collect(opts) {
    var year = window.RR_YEAR || new Date().getFullYear();
    var A = window.rrAmend;
    var fam = window.rrFamilies;
    return Promise.all([
      A && A.loadDetails ? A.loadDetails() : Promise.resolve(),
      fetch(dataPath('upcoming_next.json') + '?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
    ]).then(function (res) {
      var next = Array.isArray(res[1]) ? res[1] : [];
      var today = todayKST();
      var levelIn = function (title) {
        var f = fam && fam.familyOf ? fam.familyOf(title) : null;
        var m = f ? f.members.filter(function (x) { return x.title === title; })[0] : null;
        return { root: f ? f.root : '', level: m ? m.level : '' };
      };
      var items = (window.__rrItems || []).map(function (it) {
        var lv = levelIn(it.title);
        return {
          title: it.title, date: it.effectiveDate, type: it.amendmentType || '', ministry: it.ministry || '',
          job: (it.categories || [])[0] || '기타', daysUntil: typeof it.daysUntil === 'number' ? it.daysUntil : 0,
          codes: A ? A.codes(it) : [], detail: A ? A.details(it) : null, summary: it.summary || '', family: it.family || lv.root, kind: it.kind || '',
          level: it.kind ? '행정규칙' : lv.level, key: it._key || (it.title + '|' + it.effectiveDate + '|' + short(it.amendmentType))
        };
      });
      /* 연말: 다음 해 1~2월 시행분 (upcoming_next.json) */
      next.forEach(function (r) {
        if (!r || !r.t || !r.d) return;
        var lv = levelIn(r.t);
        items.push({ title: r.t, date: r.d, type: r.a === '일' ? '일부개정' : r.a === '타' ? '타법개정' : r.a || '', ministry: r.m || '',
          job: r.c || '기타', daysUntil: Math.round((new Date(r.d) - new Date(today)) / 86400000), codes: [], detail: null, summary: '', family: lv.root,
          kind: r.k || '', level: r.k ? '행정규칙' : lv.level, key: r.t + '|' + r.d + '|' + (r.a || '') });
      });
      var p = period(opts.kind, opts.n, year);
      var M = window.__rrMeta || {};
      var pref = getPref();
      return Object.assign(p, {
        year: year, job: opts.job || '', asOf: today, items: items,
        lawCount: M.baseLaws || 0, admCandidates: M.admrulLaws || 0, baseCount: (M.baseLaws || 0) + (M.admrulLaws || 0) || window.__rrBaseCount || '',
        appendix: opts.appendix !== false, site: 'https://tjdudfhr.github.io/RegRader/',
        dept: opts.dept != null ? opts.dept : (pref.dept || ''), secret: opts.secret != null ? !!opts.secret : pref.secret !== false,
        track: opts.track === false ? null : trackSnap()
      });
    });
  }

  function fileName(input) {
    return (input.label + ' 법규 제·개정 동향 보고' + (input.job ? ' (' + input.job + ')' : '') + '.pptx').replace(/[\\/:*?"<>|]/g, '');
  }
  function generate(opts) {
    return loadLib().then(function () { return collect(opts); }).then(function (input) {
      var pptx = build(window.PptxGenJS, input);
      var name = fileName(input);
      return pptx.writeFile({ fileName: name, compression: true }).then(function () { return name; });
    });
  }

  /* 다운로드 창 안의 '보고서' 칸 */
  function mount(slot) {
    if (!slot) return;
    var year = window.RR_YEAR || new Date().getFullYear();
    var t = todayKST(), m = Number(t.slice(5, 7)), q = Math.ceil(m / 3);
    var st = { kind: 'quarter', n: q };
    var pref = getPref();
    var box = 'padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;font-size:13px';
    slot.innerHTML =
      '<div style="border:1px solid #c7d2fe;border-radius:12px;padding:14px;margin:0 0 12px;background:#fafbff">' +
      '<div style="font-weight:800;margin-bottom:10px">📑 법규 제·개정 동향 보고서 (임원 보고용 PPT)</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">' +
        '<span id="rr-rep-kind" style="display:inline-flex;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden">' +
          '<button type="button" data-k="month" style="border:0;padding:6px 12px;cursor:pointer;font:inherit;font-size:13px">월간</button>' +
          '<button type="button" data-k="quarter" style="border:0;padding:6px 12px;cursor:pointer;font:inherit;font-size:13px">분기</button></span>' +
        '<select id="rr-rep-n" style="' + box + '"></select>' +
        '<select id="rr-rep-job" style="' + box + '"><option value="">전체 직무</option>' +
          JOB_ORDER.map(function (j) { return '<option value="' + j + '">' + j + '</option>'; }).join('') + '</select>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">' +
        '<input id="rr-rep-dept" type="text" maxlength="30" placeholder="보고 부서 (예: 법무팀)" style="' + box + ';flex:1;min-width:150px">' +
      '</div>' +
      '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:#475569;margin-bottom:6px">' +
        '<label><input type="checkbox" id="rr-rep-secret"> 대외비 표시</label>' +
        '<label><input type="checkbox" id="rr-rep-app" checked> 별첨: 전체 개정 목록</label>' +
        '<label id="rr-rep-trk-l" style="display:none"><input type="checkbox" id="rr-rep-trk" checked> 대응 현황 포함</label></div>' +
      '<div id="rr-rep-trk-msg" style="font-size:12px;color:#64748b;margin-bottom:10px"></div>' +
      '<button type="button" id="rr-rep-go" style="width:100%;padding:11px;border:0;border-radius:10px;background:linear-gradient(135deg,#5b67e5,#7c3aed);color:#fff;font:inherit;font-weight:800;cursor:pointer">PPT 만들기</button>' +
      '<div id="rr-rep-msg" style="font-size:12px;color:#64748b;margin-top:8px;line-height:1.5">보고 요약 → 개정 현황 → 중점 관리 개정 사항 → 향후 시행 예정 → 대응 현황 순으로, 슬라이드마다 결론 한 줄이 먼저 나옵니다. 상세 목록은 별첨으로 들어가고, 문장·표·차트는 PowerPoint에서 바로 고칠 수 있습니다.</div>' +
      '</div>';
    var sel = slot.querySelector('#rr-rep-n');
    var dept = slot.querySelector('#rr-rep-dept'), secret = slot.querySelector('#rr-rep-secret');
    dept.value = pref.dept || '';
    secret.checked = pref.secret !== false;
    function savePref() { setPref({ dept: dept.value.trim(), secret: secret.checked }); }
    dept.onchange = savePref;
    secret.onchange = savePref;
    var snap = trackSnap(), trkL = slot.querySelector('#rr-rep-trk-l'), trkMsg = slot.querySelector('#rr-rep-trk-msg');
    if (snap) {
      trkL.style.display = '';
      trkMsg.textContent = '대응 현황 관리 기록(' + Object.keys(snap.resp || {}).length + '건)이 ‘Ⅳ. 대응 현황’과 중점 관리 표에 들어갑니다.';
    } else trkMsg.textContent = '대응 현황 관리에 로그인하면 직무별 진행률과 조치 필요 항목이 함께 들어갑니다.';
    function paint() {
      slot.querySelectorAll('#rr-rep-kind button').forEach(function (b) {
        var on = b.dataset.k === st.kind;
        b.style.background = on ? '#4a57cf' : '#fff';
        b.style.color = on ? '#fff' : '#334155';
      });
      if (st.kind === 'quarter') {
        sel.innerHTML = QN.map(function (x, i) { return '<option value="' + (i + 1) + '">' + year + '년 ' + x[0] + '</option>'; }).join('');
      } else {
        var o = '';
        for (var i = 1; i <= 12; i++) o += '<option value="' + i + '">' + year + '년 ' + i + '월</option>';
        sel.innerHTML = o;
      }
      sel.value = String(st.n);
    }
    slot.querySelectorAll('#rr-rep-kind button').forEach(function (b) {
      b.onclick = function () { st.kind = b.dataset.k; st.n = st.kind === 'quarter' ? q : m; paint(); };
    });
    sel.onchange = function () { st.n = Number(sel.value); };
    paint();
    var go = slot.querySelector('#rr-rep-go'), msg = slot.querySelector('#rr-rep-msg');
    go.onclick = function () {
      if (!(window.__rrItems || []).length) { msg.textContent = '데이터를 불러오는 중입니다. 잠시 뒤 다시 눌러 주세요.'; return; }
      savePref();
      go.disabled = true;
      go.textContent = '만드는 중…';
      generate({ kind: st.kind, n: st.n, job: slot.querySelector('#rr-rep-job').value, appendix: slot.querySelector('#rr-rep-app').checked,
        dept: dept.value.trim(), secret: secret.checked, track: snap && slot.querySelector('#rr-rep-trk').checked ? undefined : false })
        .then(function (name) { msg.innerHTML = '✅ <b>' + name.replace(/</g, '&lt;') + '</b> 을(를) 내려받았습니다.'; })
        .catch(function (e) { msg.textContent = '만들지 못했습니다: ' + (e && e.message || e); })
        .then(function () { go.disabled = false; go.textContent = 'PPT 만들기'; });
    };
  }

  window.rrReport = { build: build, generate: generate, mount: mount, period: period };
})(this);
