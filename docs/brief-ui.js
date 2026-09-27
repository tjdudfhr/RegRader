/* 개정요지 UI overlay */
(function () {
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function lines(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    return String(v).split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  /* 팝업 섹션: 카드 하나씩, 머리에 선 아이콘(system-ui.js 의 rrIcon)과 제목. 위쪽 바로가기 탭이 섹션으로 옮겨 준다. */
  var SEC = {
    track: { icon: 'check', color: '#2f855a', nav: '대응' },
    risk:  { icon: 'alert', color: '#d92d20', nav: '제재·의무' },
    riskc: { icon: 'search', color: '#6b7280', nav: '제재 조문' },
    why:   { icon: 'info', color: '#3056d3', nav: '개정 취지' },
    what:  { icon: 'filetext', color: '#0284c7', nav: '주요 내용' },
    arts:  { icon: 'pin', color: '#d97706', nav: '개정 조항' },
    diff:  { icon: 'refresh', color: '#6b7280', nav: '신구 대조' },
    fam:   { icon: 'layers', color: '#0d9488', nav: '같은 계열' },
    act:   { icon: 'ok', color: '#16a34a', nav: '실무 지침' },
    cmp:   { icon: 'book', color: '#7c3aed', nav: '신구비교' }
  };
  function ic(n) { return window.rrIcon ? window.rrIcon(n) : ''; }
  function section(key, no, name, body, extra) {
    var c = SEC[key];
    return '<section class="rr-sec rr-sec-' + key + '" id="rr-s-' + key + '" data-nav="' + c.nav + '" style="--sec:' + c.color + '">' +
      '<header class="rr-sec-h"><span class="rr-sec-ic" aria-hidden="true">' + ic(c.icon) + '</span>' +
      '<h4>' + name + '</h4>' + (extra || '') + '</header>' +
      '<div class="rr-sec-b">' + body + '</div></section>';
  }
  (function () {
    if (document.getElementById('rr-sec-style')) return;
    var st = document.createElement('style');
    st.id = 'rr-sec-style';
    st.textContent = [
      '#rr-brief.rr-brief { border:0; padding:0; background:transparent; margin:0; }',
      '.rr-sec { position:relative; background:var(--bg-card,#fff); border:1px solid var(--border,#e2e8f0); border-radius:14px; padding:16px 18px; margin:0 0 14px; scroll-margin-top:14px; }',
      '.rr-sec-h { display:flex; align-items:center; gap:10px; margin:0 0 10px; }',
      '.rr-sec-h h4 { margin:0; font-size:15px; font-weight:800; letter-spacing:-.02em; color:var(--text-primary,#1a202c); }',
      '.rr-sec-ic { width:30px; height:30px; flex:none; display:inline-flex; align-items:center; justify-content:center; border-radius:9px; font-size:16px; color:var(--sec); background:color-mix(in srgb, var(--sec) 12%, transparent); }',
      '.rr-sec-h .rr-sec-extra { margin-left:auto; font-size:12px; font-weight:700; color:var(--text-muted,#718096); text-decoration:none; }',
      '.rr-sec-b { font-size:14.5px; line-height:1.8; color:var(--text-primary,#1a202c); }',
      '.rr-sec-b ul { margin:0; padding-left:20px; }',
      '.rr-sec-b li { margin:0 0 6px; }',
      '.rr-sec-b li::marker { color:var(--sec); }',
      '.rr-chip { display:inline-block; margin:3px 6px 3px 0; padding:3px 10px; border-radius:7px; font-size:13px; font-weight:600; background:color-mix(in srgb, #d97706 10%, transparent); color:var(--text-primary,#1a202c); border:1px solid color-mix(in srgb, #d97706 30%, transparent); }',
      '.rr-sec table { width:100%; border-collapse:collapse; font-size:14px; line-height:1.5; }',
      '.rr-sec th { text-align:left; padding:8px; font-size:12px; color:var(--text-muted,#718096); border-bottom:1px solid var(--border,#e2e8f0); }',
      '.rr-sec td { padding:8px; border-bottom:1px solid var(--border,#e2e8f0); vertical-align:top; }',
      '.rr-sec td.old { color:#b45309; } .rr-sec td.new { color:#047857; }',
      '.rr-what p { margin:0 0 4px; } .rr-what p.h { font-weight:700; color:var(--text-primary,#1a202c); margin-top:12px; } .rr-what p.h:first-child { margin-top:0; } .rr-what p.b { padding-left:12px; }',
      '.rr-sec iframe { width:100%; height:520px; border:1px solid var(--border,#e2e8f0); border-radius:10px; background:#fff; display:block; }'
    ].join('\n');
    document.head.appendChild(st);
  })();
  /* 주요 개정내용: '가. …' 항목 제목은 굵게, 나머지는 문단 */
  function fmtWhat(t) {
    return '<div class="rr-what">' + String(t || '').split(/\n+/).map(function (l) {
      l = l.trim();
      if (!l) return '';
      var cls = /^[가-하]\.\s/.test(l) ? 'h' : /^[○ㅇ◦•\-]\s/.test(l) ? 'b' : '';
      return '<p' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(l) + '</p>';
    }).join('') + '</div>';
  }
  var JOB_DOT = function (j) { return window.rrCatColor ? window.rrCatColor(j) : '#a0aec0'; };
  function levelOf(item) {
    if (item.kind) return item.kind;
    var t = String(item.title || '');
    return /시행령$/.test(t) ? '시행령' : /시행규칙$/.test(t) ? '시행규칙' : /(규칙|규정|고시|훈령|예규)$/.test(t) ? '하위법령' : '법률';
  }
  function dotDate(d) { d = String(d || ''); return d.length >= 10 ? d.slice(0, 4) + '. ' + Number(d.slice(5, 7)) + '. ' + Number(d.slice(8, 10)) + '.' : (d || '-'); }
  /* 머리: 단계·직무·D-day, 핵심 정보 4칸, 원문 버튼 */
  function hero(item, facts, links) {
    var d = item.daysUntil;
    var dd = typeof d !== 'number' ? '' : d < 0 ? '<span class="rr-hp dd done">시행완료</span>' : d === 0 ? '<span class="rr-hp dd hot">오늘 시행</span>' :
      '<span class="rr-hp dd' + (d <= 30 ? ' hot' : '') + '">D-' + d + '</span>';
    var job = (item.categories && item.categories[0]) || '';
    var pills = '<div id="rr-hero-pills"><span class="rr-hp">' + esc(levelOf(item)) + '</span>' +
      (job ? '<span class="rr-hp"><i style="background:' + JOB_DOT(job) + '"></i>' + esc(job) + '</span>' : '') + dd + '</div>';
    var body = '<div id="rr-hero">' +
      '<div class="rr-hero-facts">' + facts.map(function (f) { return '<div><span>' + f[0] + '</span><b>' + f[1] + '</b></div>'; }).join('') + '</div>' +
      (links.length ? '<div class="rr-hero-act">' + links.map(function (l, i) {
        return '<a class="' + (i ? '' : 'pri') + '" href="' + esc(l[1]) + '" target="_blank" rel="noopener"' + (l[2] ? ' title="' + esc(l[2]) + '"' : '') + '>' + ic(l[3] || 'link') + '<span>' + l[0] + '</span></a>';
      }).join('') + '</div>' : '') +
      '</div><nav id="rr-snav" aria-label="바로가기"></nav>';
    return { pills: pills, body: body };
  }
  function findItem() {
    var box = document.getElementById('modal-subtitle');
    var data = window.__rrItems || window.lawsData || [];
    var sub = box ? box.textContent : '';
    var head = document.getElementById('modal-title');
    var name = head ? head.textContent.trim() : '';
    var date = (sub.match(/\d{4}-\d{2}-\d{2}/) || [])[0];
    return data.find(function (x) { return x.title === name && (!date || x.effectiveDate === date); }) ||
      data.find(function (x) { return x.title === name; }) || null;
  }
  function diffTable(diffs) {
    if (!diffs || !diffs.length) return '';
    var rows = diffs.map(function (d) {
      return '<tr><td style="white-space:nowrap">' + esc(d.a || '—') + '</td><td style="color:var(--text-muted,#64748b)">' + esc(d.k || '변경') +
        '</td><td class="old">' + esc(d.b || '') + '</td><td class="new">' + esc(d.n || '') + '</td></tr>';
    }).join('');
    return '<div style="overflow:auto"><table><thead><tr><th>조항</th><th>구분</th><th>종전</th><th>개정</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  /* 행정규칙(고시·훈령·예규 등) 팝업: 개정 취지·주요내용은 법령정보센터 제개정이유, 원문·첨부(고시 전문) 링크 */
  function admrulHtml(item) {
    var A = window.rrAmend;
    var d = A ? A.details(item) : null;
    var fill = A ? A.briefFill(item) : null;
    var seq = (item.meta && item.meta.admRulSeq) || '';
    var src = seq ? 'https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=' + seq : '';
    var iss = d && d.issued ? String(d.issued).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '';
    var facts = [['시행일', esc(dotDate(item.effectiveDate))], ['구분', esc(item.kind) + ' · ' + esc(item.amendmentType || '-')],
      ['소관 부처', esc(item.ministry || '-') + (d && d.dept ? '<small>' + esc(String(d.dept).replace(/^.*?\(/, '').replace(/\)$/, '')) + '</small>' : '')],
      [iss ? '발령일' : '계열', iss ? esc(dotDate(iss)) : esc(item.family || '-')]];
    var links = [];
    if (src) links.push(['행정규칙 원문', src, '', 'file']);
    if (d && d.attach) links.push(['첨부 파일', d.attach, d.attachName || '', 'download']);
    var fam = window.rrFamilies && window.rrFamilies.popupSection ? window.rrFamilies.popupSection(item) : null;
    var why = fill && fill.why ? fill.why : (d ? '법령정보센터에 개정 이유가 등록되어 있지 않습니다.' : '개정 이유를 불러오는 중입니다…');
    var n = function () { return ''; };
    return { hero: hero(item, facts, links), body: '<div id="rr-brief" class="summary-section rr-brief">' +
      (window.rrTracker ? (function (t) { return section('track', n(), '대응 현황', t.body, t.extra); })(window.rrTracker.popupSection(item)) : '') +
      section('why', n(), '개정 취지', '<div style="white-space:pre-wrap">' + esc(why) + '</div>') +
      (fill && fill.what ? section('what', n(), '주요 개정내용', fmtWhat(fill.what)) : '') +
      (fam ? section('fam', n(), '같은 계열 올해 개정', fam.body, fam.extra) : '') +
      '</div>' };
  }
  function html(item) {
    if (item && item.kind) return admrulHtml(item);
    var b = item.brief || {};
    /* 새로 잡힌 개정은 개정요지가 비어 있다 -> 법령정보센터 제개정이유·개정 조항으로 채운다 (amend-ui.js) */
    var A = window.rrAmend;
    var fill = A && (A.isPlaceholder(b.why || item.summary) || !(b.articles || []).length || A.isPlaceholder(b.what)) ? A.briefFill(item) : null;
    var artList = (b.articles || []).length ? b.articles : (fill && fill.arts.length ? fill.arts : []);
    var arts = artList.map(function (a) { return '<span class="rr-chip">' + esc(a) + '</span>'; }).join('');
    var risk = A ? A.popupSection(item) : null;
    var trk = window.rrTracker ? window.rrTracker.popupSection(item) : null;   /* 대응 현황 (tracker.js) */
    var det = A && A.details ? A.details(item) : null;
    var lsi = (item.meta && item.meta.lsiSeq) || '';
    var efYd = String(item.effectiveDate || '').replace(/-/g, '');
    var src = lsi ? ('https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=' + lsi + (efYd ? '&efYd=' + efYd : '') + '&viewCls=lsRvsDocInfoR') : '';
    var live = 'https://www.law.go.kr/lsSc.do?menuId=1&query=' + encodeURIComponent(item.title || '');
    var cmp = lsi ? ('https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=' + lsi + '&viewCls=lsOldAndNew') : '';
    var points = (b.points || []).map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('');
    var acts = lines(b.action);   /* 실무 지침은 따로 적어 둔 것이 있을 때만 */
    var rawWhat = String(b.what || '');
    if (fill && fill.what && (!rawWhat || A.isPlaceholder(rawWhat))) rawWhat = fill.what;
    var isPromul = /이에 공포한다|국회에서 의결된/.test(rawWhat.slice(0, 80));
    var whatBody = points ? '<ul>' + points + '</ul>' : (rawWhat && !isPromul ? fmtWhat(rawWhat) : '');
    var n = function () { return ''; };
    var whyText = b.why || item.summary || '';
    if (fill && fill.why && A.isPlaceholder(whyText)) whyText = fill.why;
    var diffHtml = diffTable(b.diff);
    var fam = window.rrFamilies && window.rrFamilies.popupSection ? window.rrFamilies.popupSection(item) : null;
    var prom = det && det.promulgated ? String(det.promulgated) : '';
    var facts = [['시행일', esc(dotDate(item.effectiveDate))], ['개정 구분', esc(item.amendmentType || '-')], ['소관 부처', esc(String(item.ministry || '-').split(',')[0])],
      prom.length === 8 ? ['공포일', esc(dotDate(prom.slice(0, 4) + '-' + prom.slice(4, 6) + '-' + prom.slice(6)))] : ['조항', artList.length ? artList.length + '개' : '-']];
    var links = [];
    if (src) links.push(['개정문 원문', src, '', 'file']);
    if (cmp) links.push(['신구조문 비교', cmp, '', 'refresh']);
    links.push(['현행 법령', live, '', 'book']);
    return { hero: hero(item, facts, links), body: '<div id="rr-brief" class="summary-section rr-brief">' +
      (trk ? section('track', n(), '대응 현황', trk.body, trk.extra) : '') +
      (risk ? section(risk.tone === 'hot' ? 'risk' : 'riskc', n(), risk.tone === 'hot' ? '벌칙·과태료·의무 변경' : '제재 조문 정비', risk.body, risk.extra) : '') +
      (whyText ? section('why', n(), '개정 취지', '<div style="white-space:pre-wrap">' + esc(whyText) + '</div>') : '') +
      (whatBody ? section('what', n(), '주요 개정내용', whatBody) : '') +
      (arts ? section('arts', n(), '개정 조항', '<div>' + arts + '</div>', '<span class="rr-sec-extra">' + artList.length + '개</span>') : '') +
      (diffHtml ? section('diff', n(), '신구 대조', diffHtml) : '') +
      (fam ? section('fam', n(), '같은 계열 올해 개정', fam.body, fam.extra) : '') +
      (acts.length ? section('act', n(), '실무 지침', '<ul>' + acts.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>') : '') +
      (cmp ? section('cmp', n(), '신구조문 비교',
        '<iframe sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-modals" referrerpolicy="no-referrer" src="' + cmp + '" loading="lazy"></iframe>',
        '<a class="rr-sec-extra" href="' + cmp + '" target="_blank" rel="noopener">새 창 ↗</a>') : '') +
      '</div>' };
  }
  /* 바로가기 탭: 있는 섹션만, 스크롤하면 지금 보는 섹션이 켜진다 */
  function paintNav() {
    var nav = document.getElementById('rr-snav'), body = document.querySelector('#law-modal .modal-body');
    if (!nav || !body) return;
    var secs = [].slice.call(body.querySelectorAll('.rr-sec[id]'));
    nav.innerHTML = secs.map(function (s) { return '<button type="button" data-go="' + s.id + '">' + esc(s.getAttribute('data-nav') || '') + '</button>'; }).join('');
    function spy() {
      var top = body.scrollTop + 60, cur = secs[0];
      secs.forEach(function (s) { if (s.offsetTop - body.offsetTop <= top) cur = s; });
      nav.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', !!cur && b.getAttribute('data-go') === cur.id); });
    }
    if (!body.__rrSpy) {
      body.__rrSpy = true;
      body.addEventListener('scroll', function () { if (window.__rrSpy) window.__rrSpy(); }, { passive: true });
      nav.addEventListener('click', function () {});
    }
    window.__rrSpy = spy;
    spy();
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#rr-snav button[data-go]');
    if (!b) return;
    var el = document.getElementById(b.getAttribute('data-go')), body = document.querySelector('#law-modal .modal-body');
    if (el && body) body.scrollTo({ top: el.offsetTop - body.offsetTop - 14, behavior: 'smooth' });
  });
  function prune(box) {
    box.querySelectorAll('.summary-section').forEach(function (sec) {
      if (sec.id === 'rr-brief' || sec.id === 'rr-meta') return;
      if (sec.querySelector('.info-grid')) { sec.parentNode && sec.parentNode.removeChild(sec); return; }
      var h = sec.querySelector('h4');
      var label = h ? h.textContent : sec.textContent.slice(0, 24);
      if (/개정\s*요지|주요 개정 사항|개정 조항|실무 개정요지|왜 개정|무엇이 바뀌|개정 유형|소관 부처/.test(label + sec.textContent.slice(0, 80))) {
        sec.parentNode && sec.parentNode.removeChild(sec);
      }
    });
  }
  function refresh() {
    try {
      var box = document.getElementById('modal-summary');
      if (!box) return;
      var item = findItem();
      if (!item) return;
      prune(box);
      var oldB = document.getElementById('rr-brief');
      if (oldB && oldB.parentNode) oldB.parentNode.removeChild(oldB);
      var oldM = document.getElementById('rr-meta');
      if (oldM && oldM.parentNode) oldM.parentNode.removeChild(oldM);
      prune(box);
      var h = html(item);
      box.insertAdjacentHTML('afterbegin', h.body);
      var head = document.querySelector('#law-modal .modal-header'), ttl = document.getElementById('modal-title');
      if (head && ttl) {
        ['rr-hero-pills', 'rr-hero', 'rr-snav'].forEach(function (id) { var o = document.getElementById(id); if (o) o.remove(); });
        ttl.insertAdjacentHTML('beforebegin', h.hero.pills);
        head.insertAdjacentHTML('beforeend', h.hero.body);
        paintNav();
      }
    } catch (e) { console.warn('brief refresh', e); }
  }
  window.__rrBriefRefresh = refresh;
  function patch() {
    if (window.showLawDetail && !window.showLawDetail.__briefUi) {
      var orig = window.showLawDetail;
      window.showLawDetail = function (id) {
        try { orig(id); } catch (e) { console.warn('showLawDetail', e); }
        setTimeout(refresh, 40);
        setTimeout(refresh, 400);
        setTimeout(refresh, 1200);
      };
      window.showLawDetail.__briefUi = true;
    }
  }
  var n = 0;
  var t = setInterval(function () { patch(); if (++n > 50) clearInterval(t); }, 200);
})();
