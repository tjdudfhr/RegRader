/* 개정 표시: 벌칙 · 과태료 · 과징금 · 행정처분 · 조문 신설 · 의무 · 조문 삭제
 *
 * 근거 자료 (scripts/amend_details.py 가 매일 갱신 때 국가법령정보센터 개정문으로 만든다)
 *   amend_flags.json    이벤트 키 -> 표시 코드 (목록 배지용, 작다)
 *   amend_details.json  이벤트 키 -> 근거 (조문·별표, 개정문 줄, 의무 문장, 개정 취지). 조금 뒤에 받아 둔다.
 *
 * window.rrAmend
 *   .ready                     표시 코드를 다 읽으면 끝나는 Promise
 *   .codes(item)               ['벌칙', '과태료', ...]
 *   .badges(codes)             배지 HTML
 *   .isRisk(item)              벌칙·과태료·과징금·처분·의무 중 하나라도 있는가 (목록 필터용)
 *   .details(item)             근거 (받기 전이면 null)
 *   .popupSection(item)        법령 팝업의 '벌칙·과태료·의무 변경' 칸 { body, extra, tone } | null
 *   .briefFill(item)           새로 잡혀 개정요지가 비어 있는 개정용 { why, what, arts } | null
 */
(function () {
  var FLAGS = {}, DET = null, detPromise = null;
  var META = {
    '벌칙':   { label: '벌칙',     cls: 'pen',  icon: '⚖️', tip: '벌칙 조항이 신설·변경됨 (처벌 대상·형량)' },
    '과태료': { label: '과태료',   cls: 'fine', icon: '💸', tip: '과태료 조항 또는 부과기준이 신설·변경됨' },
    '과징금': { label: '과징금',   cls: 'sur',  icon: '💰', tip: '과징금 조항 또는 부과기준이 신설·변경됨' },
    '처분':   { label: '행정처분', cls: 'san',  icon: '⛔', tip: '영업정지·등록취소 등 행정처분 조항 또는 기준이 신설·변경됨' },
    '신설':   { label: '조문 신설', cls: 'new', icon: '🆕', tip: '새 조문이 생김' },
    '의무':   { label: '의무',     cls: 'duty', icon: '📌', tip: '회사(사업주·사용자 등)에 대한 의무·절차 문장이 새로 들어가거나 바뀜' },
    '삭제':   { label: '조문 삭제', cls: 'del', icon: '🗑️', tip: '조문이 삭제됨' }
  };
  var ORDER = ['벌칙', '과태료', '과징금', '처분', '의무', '신설', '삭제'];
  var RISK = { '벌칙': 1, '과태료': 1, '과징금': 1, '처분': 1, '의무': 1 };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function short(t) { return t === '일부개정' ? '일' : t === '타법개정' ? '타' : (t || ''); }
  function keyOf(it) { return it ? (it.title + '|' + it.effectiveDate + '|' + short(it.amendmentType)) : ''; }
  function codes(it) {
    var c = FLAGS[keyOf(it)] || [];
    return ORDER.filter(function (k) { return c.indexOf(k) >= 0; });
  }
  function isRisk(it) { return codes(it).some(function (c) { return RISK[c]; }); }
  function badges(cs, opt) {
    if (!cs || !cs.length) return '';
    return '<span class="rr-rbs">' + cs.map(function (c) {
      var m = META[c];
      return m ? '<span class="rr-rb ' + m.cls + '" title="' + esc(m.tip) + '">' + esc(m.label) + '</span>' : '';
    }).join('') + '</span>';
  }

  function dataPath(f) { return window.rrDataPath ? window.rrDataPath(f) : './' + f; }
  var ready = fetch(dataPath('amend_flags.json') + '?v=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : { items: {} }; })
    .then(function (j) { FLAGS = (j && j.items) || {}; })
    .catch(function () { FLAGS = {}; });

  function loadDetails() {
    if (!detPromise) {
      detPromise = fetch(dataPath('amend_details.json') + '?v=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          DET = j || { items: {}, reasons: [] };
          /* 팝업이 열려 있으면 새 근거로 다시 그린다 */
          var m = document.getElementById('law-modal');
          if (m && m.classList.contains('show') && window.__rrBriefRefresh) window.__rrBriefRefresh();
        })
        .catch(function () { DET = { items: {}, reasons: [] }; });
    }
    return detPromise;
  }
  /* 첫 화면을 방해하지 않도록 조금 뒤에 받아 둔다 (팝업을 먼저 열면 그때 받는다) */
  setTimeout(loadDetails, 2500);

  function details(it) {
    if (!DET) { loadDetails(); return null; }
    var d = DET.items && DET.items[keyOf(it)];
    if (!d) return null;
    return Object.assign({}, d, { reason: (DET.reasons || [])[d.r] || '' });
  }

  /* ---------- 팝업: 벌칙·과태료·의무 변경 ---------- */
  var FLAG_NAMES = [['penalty', '벌칙'], ['fine', '과태료'], ['surcharge', '과징금'], ['sanction', '처분']];
  function popupSection(item) {
    var cs = codes(item);
    var d = details(item);
    if (!d) {
      if (!cs.length) return null;
      return { body: '<div class="rr-risk-b">' + badges(cs) + '<div class="rr-risk-wait">근거를 불러오는 중입니다…</div></div>', extra: '' };
    }
    var rows = [];
    var weak = [];
    FLAG_NAMES.forEach(function (p) {
      var list = (d.flags && d.flags[p[0]]) || [];
      var strong = list.filter(function (x) { return x.strong; }).map(function (x) { return x.ref; });
      var soft = list.filter(function (x) { return !x.strong; }).map(function (x) { return x.ref; });
      if (strong.length) rows.push([META[p[1]].icon + ' ' + META[p[1]].label, strong.map(esc).join('<br>') + ' <span class="rr-risk-tag">신설·변경</span>']);
      if (soft.length) weak.push(META[p[1]].label + ': ' + soft.join(', '));
    });
    if (d.newArticles && d.newArticles.length) rows.push([META['신설'].icon + ' 조문 신설', d.newArticles.map(esc).join('<br>')]);
    if (d.duty && d.duty.length) rows.push([META['의무'].icon + ' 의무', d.duty.map(function (s) { return '<q>' + esc(s) + '</q>'; }).join('')]);
    if (d.deleted && d.deleted.length) rows.push([META['삭제'].icon + ' 조문 삭제', esc(d.deleted.join(', '))]);
    if (!rows.length && !weak.length) return null;
    var h = '<div class="rr-risk-b">' + (cs.length ? badges(cs) : '') +
      (rows.length ? '<dl class="rr-risk-dl">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>' : '') +
      (weak.length ? '<div class="rr-risk-weak">인용·용어만 바뀐 조문 (제재 내용은 그대로): ' + esc(weak.join(' · ')) + '</div>' : '');
    if (d.evidence && d.evidence.length) {
      h += '<details class="rr-risk-ev"><summary>근거 · 개정문 ' + d.evidence.length + '줄</summary><ul>' +
        d.evidence.map(function (e) { return '<li>' + esc(e).replace(/ ⏎ /g, '<br><span class="rr-risk-ins">') + (e.indexOf(' ⏎ ') >= 0 ? '</span>' : '') + '</li>'; }).join('') + '</ul></details>';
    }
    if (d.otherDates && d.otherDates.length) {
      var p = String(d.promulgated || '');
      h += '<div class="rr-risk-note">시행일이 나뉜 개정입니다' + (p.length === 8 ? ' (공포 ' + p.slice(0, 4) + '-' + p.slice(4, 6) + '-' + p.slice(6) + ')' : '') +
        '. 이 시행일(' + esc(item.effectiveDate) + ')에 시행되는 조항만 표시했습니다. 다른 시행일: ' + esc(d.otherDates.join(', ')) + '</div>';
    }
    h += '<div class="rr-risk-foot">국가법령정보센터 개정문과 조문 제목으로 자동 분석한 결과입니다. 최종 판단은 원문(신구비교)으로 확인하세요.</div></div>';
    var extra = cs.filter(function (c) { return RISK[c]; }).length ? '<span class="rr-sec-extra">제재·의무 ' + cs.filter(function (c) { return RISK[c]; }).length + '종</span>' : '';
    return { body: h, extra: extra, tone: cs.some(function (c) { return RISK[c]; }) ? 'hot' : 'calm' };
  }

  /* ---------- 새로 잡힌 개정: 개정요지가 비어 있으면 법령정보센터 제개정이유·개정 조항으로 채운다 ---------- */
  function isPlaceholder(s) {
    s = String(s || '');
    return !s.trim() || /이\(가\)\s*\d{4}년\s*\d{4}-\d{2}-\d{2}부터/.test(s) || /^본 법령의 조문·절차가 바뀝니다/.test(s) || /^다른 법령 개정에 따른 인용·용어 정비입니다/.test(s) || /개정 취지를 확인하는 중/.test(s);
  }
  function briefFill(item) {
    var d = details(item);
    if (!d) return null;
    var reason = String(d.reason || '').trim();
    var why = reason, what = '';
    var m = reason.split(/◇\s*주요\s*내용/);
    if (m.length > 1 && !/◇\s*개정이유\s*및\s*주요\s*내용/.test(reason)) {
      why = m[0].replace(/◇\s*(제정|개정)\s*이유/, '').trim();
      what = m.slice(1).join('\n').trim();
    } else {
      why = reason.replace(/◇\s*(제정|개정)\s*이유\s*(및\s*주요\s*내용)?/, '').trim();
    }
    var arts = (d.articles || []).map(function (a) { return a.ref + (a.title ? '(' + a.title + ')' : ''); });
    /* 제개정이유에 '주요내용'이 따로 없으면 조문별로 무엇이 바뀌었는지 적는다 */
    if (!what && d.changes && d.changes.length) {
      what = d.changes.map(function (c) { return '• ' + c.ref + (c.title ? '(' + c.title + ')' : '') + ': ' + c.ops.join(', '); }).join('\n');
    }
    return { why: why, what: what, arts: arts };
  }

  /* ---------- 목록 배지: 직무별 목록(#law-list) · 적용법규 계열 칩 ---------- */
  function findItem(id) {
    var list = window.__rrItems || [];
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      if (x.id === id || x._key === id || (x.altIds && x.altIds.indexOf(id) >= 0)) return x;
    }
    return null;
  }
  function decorate() {
    document.querySelectorAll('#law-list .law-item[data-eid]:not([data-rr-am])').forEach(function (n) {
      n.setAttribute('data-rr-am', '1');
      var it = findItem(n.getAttribute('data-eid'));
      var cs = codes(it);
      if (!cs.length) return;
      if (isRisk(it)) n.setAttribute('data-risk', '1');
      var t = n.querySelector('.law-title');
      if (t) t.insertAdjacentHTML('beforeend', ' ' + badges(cs));
    });
    document.querySelectorAll('.rr-evc[data-eid]:not([data-rr-am])').forEach(function (n) {
      n.setAttribute('data-rr-am', '1');
      var it = findItem(n.getAttribute('data-eid'));
      var cs = codes(it).filter(function (c) { return RISK[c]; });
      if (!cs.length) return;
      n.classList.add('has-risk');
      n.title = (n.title || '') + ' · ' + cs.map(function (c) { return META[c].label; }).join('·') + ' 변경';
    });
  }
  var pend = null;
  function schedule() { if (pend) return; pend = setTimeout(function () { pend = null; decorate(); }, 120); }
  ready.then(function () {
    decorate();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    renderPanel();
  });

  /* ---------- 종합 현황: 벌칙·과태료·의무 변경 요약 ---------- */
  var panelState = { code: null, past: false };
  function renderPanel() {
    var host = document.getElementById('rr-risk-panel');
    var sum = document.querySelector('#overview-content .rr-summary');
    if (!host && sum) {
      host = document.createElement('section');
      host.id = 'rr-risk-panel';
      host.className = 'rr-risk-panel';
      sum.parentNode.insertBefore(host, sum.nextSibling);
      host.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-code]');
        if (b) { panelState.code = panelState.code === b.dataset.code ? null : b.dataset.code; renderPanel(); return; }
        var p = e.target.closest('button[data-past]');
        if (p) { panelState.past = !panelState.past; renderPanel(); }
      });
    }
    if (!host) return;
    var items = window.__rrItems || [];
    if (!items.length) { setTimeout(renderPanel, 500); return; }
    var year = window.RR_YEAR || '';
    var count = {};
    ORDER.forEach(function (c) { count[c] = 0; });
    items.forEach(function (it) { codes(it).forEach(function (c) { count[c]++; }); });
    var riskAll = items.filter(isRisk);
    var list = items.filter(function (it) {
      var cs = codes(it);
      if (panelState.code ? cs.indexOf(panelState.code) < 0 : !isRisk(it)) return false;
      return panelState.past || !it.inForce;
    }).sort(function (a, b) {
      return panelState.past ? String(b.effectiveDate).localeCompare(String(a.effectiveDate)) : String(a.effectiveDate).localeCompare(String(b.effectiveDate));
    });
    var tiles = ORDER.map(function (c) {
      var m = META[c];
      return '<button type="button" class="rr-rp-tile ' + m.cls + (panelState.code === c ? ' on' : '') + '" data-code="' + c + '" title="' + esc(m.tip) + '">' +
        '<b>' + count[c] + '</b><span>' + m.icon + ' ' + esc(m.label) + '</span></button>';
    }).join('');
    var rows = list.slice(0, 12).map(function (it) {
      var d = it.daysUntil;
      var dd = d < 0 ? '<span class="rr-rp-dd done">시행완료</span>' : d === 0 ? '<span class="rr-rp-dd hot">D-DAY</span>' : '<span class="rr-rp-dd ' + (d <= 30 ? 'hot' : '') + '">D-' + d + '</span>';
      var cat = (it.categories || [])[0] || '';
      return '<button type="button" class="rr-rp-row" data-eid="' + esc(it.id) + '">' +
        '<span class="rr-rp-date">' + esc(String(it.effectiveDate).slice(5).replace('-', '.')) + '</span>' + dd +
        '<span class="rr-rp-title">' + esc(it.title) + '</span>' +
        '<span class="rr-rp-cat"><i style="background:' + (window.rrCatColor ? window.rrCatColor(cat) : '#999') + '"></i>' + esc(cat) + '</span>' +
        badges(codes(it).filter(function (c) { return !panelState.code || c === panelState.code || RISK[c]; })) + '</button>';
    }).join('');
    var label = panelState.code ? META[panelState.code].label : '제재·의무 변경';
    host.innerHTML =
      '<div class="rr-rp-h"><div><h3>⚠️ ' + esc(year) + '년 벌칙·과태료·의무 변경</h3>' +
      '<p>국가법령정보센터 개정문으로 개정마다 무엇이 바뀌었는지 분석했습니다. 칸을 누르면 그 유형만 봅니다. 개정 ' + items.length + '건 중 제재·의무 변경 ' + riskAll.length + '건</p></div></div>' +
      '<div class="rr-rp-tiles">' + tiles + '</div>' +
      '<div class="rr-rp-lh"><b>' + (panelState.past ? '전체 (최근 시행 먼저)' : '앞으로 시행') + ' · ' + esc(label) + '</b><span>' + list.length + '건</span>' +
      '<button type="button" class="rr-rp-past" data-past="1">' + (panelState.past ? '앞으로 시행만 보기' : '이미 시행된 것도 보기') + '</button></div>' +
      '<div class="rr-rp-list">' + (rows || '<div class="rr-rp-empty">해당하는 개정이 없습니다.</div>') + '</div>' +
      (list.length > 12 ? '<div class="rr-rp-more">외 ' + (list.length - 12) + '건은 분기별 개정 현황 목록에서 「벌칙·과태료·의무 변경만」으로 볼 수 있습니다.</div>' : '');
  }
  window.addEventListener('rr-year-changed', function () { renderPanel(); });

  window.rrAmend = {
    ready: ready, codes: codes, isRisk: isRisk, badges: badges, details: details, keyOf: keyOf,
    popupSection: popupSection, briefFill: briefFill, isPlaceholder: isPlaceholder, loadDetails: loadDetails, META: META
  };

  /* ---------- 스타일 ---------- */
  var st = document.createElement('style');
  st.textContent = [
    '.rr-rbs { display:inline-flex; flex-wrap:wrap; gap:3px; margin-left:6px; vertical-align:middle; }',
    '.rr-rb { display:inline-block; font-size:10.5px; font-weight:800; line-height:1.5; padding:0 6px; border-radius:6px; white-space:nowrap; letter-spacing:-.01em; }',
    '.rr-rb.pen  { color:#c53030; background:rgba(229,62,62,.12); }',
    '.rr-rb.fine { color:#c05621; background:rgba(221,107,32,.13); }',
    '.rr-rb.sur  { color:#975a16; background:rgba(214,158,46,.18); }',
    '.rr-rb.san  { color:#6b46c1; background:rgba(128,90,213,.13); }',
    '.rr-rb.duty { color:#2c7a7b; background:rgba(56,178,172,.15); }',
    '.rr-rb.new  { color:#2b6cb0; background:rgba(66,153,225,.13); }',
    '.rr-rb.del  { color:#4a5568; background:rgba(160,174,192,.22); }',
    '@media (prefers-color-scheme: dark) { .rr-rb.pen{color:#feb2b2} .rr-rb.fine{color:#fbd38d} .rr-rb.sur{color:#faf089} .rr-rb.san{color:#d6bcfa} .rr-rb.duty{color:#81e6d9} .rr-rb.new{color:#90cdf4} .rr-rb.del{color:#cbd5e0} }',
    '.rr-evc.has-risk { position:relative; }',
    '.rr-evc.has-risk::after { content:""; position:absolute; top:-2px; right:-2px; width:7px; height:7px; border-radius:50%; background:#e53e3e; box-shadow:0 0 0 2px var(--bg-card,#fff); }',
    /* 팝업 칸 */
    '.rr-risk-b .rr-rbs { margin:0 0 8px; }',
    '.rr-risk-b .rr-rb { font-size:12px; padding:2px 8px; }',
    '.rr-risk-dl { display:grid; grid-template-columns:auto 1fr; gap:6px 14px; margin:4px 0 8px; font-size:14.5px; line-height:1.6; }',
    '.rr-risk-dl dt { font-weight:800; white-space:nowrap; color:var(--text-primary,#1a202c); }',
    '.rr-risk-dl dd { margin:0; color:var(--text-primary,#1a202c); }',
    '.rr-risk-dl q { display:block; quotes:none; margin:0 0 6px; padding:6px 10px; border-left:3px solid #38b2ac; background:color-mix(in srgb, #38b2ac 8%, transparent); border-radius:0 8px 8px 0; font-size:13.5px; }',
    '.rr-risk-tag { font-size:11px; font-weight:800; color:#c53030; margin-left:4px; }',
    '.rr-risk-weak { font-size:12.5px; color:var(--text-muted,#718096); margin:4px 0 6px; }',
    '.rr-risk-ev { margin:6px 0 4px; font-size:13px; }',
    '.rr-risk-ev summary { cursor:pointer; font-weight:700; color:var(--primary,#667eea); }',
    '.rr-risk-ev ul { margin:6px 0 0; padding-left:18px; color:var(--text-secondary,#4a5568); }',
    '.rr-risk-ev li { margin:0 0 6px; }',
    '.rr-risk-ins { display:inline-block; margin-top:2px; color:var(--text-primary,#1a202c); }',
    '.rr-risk-note { margin:8px 0 0; padding:8px 10px; border-radius:8px; font-size:12.5px; background:color-mix(in srgb, #dd6b20 10%, transparent); color:var(--text-primary,#1a202c); }',
    '.rr-risk-foot, .rr-risk-wait { margin-top:8px; font-size:12px; color:var(--text-muted,#718096); }',
    /* 종합 현황 칸 */
    '.rr-risk-panel { background:var(--bg-glass); backdrop-filter:blur(20px); border:1px solid var(--glass-border, var(--border)); border-radius:16px; padding:1.2rem 1.4rem; margin:0 0 1.75rem; box-shadow:var(--glass-shadow); }',
    '.rr-rp-h h3 { margin:0; font-size:1.15rem; color:var(--text-primary); }',
    '.rr-rp-h p { margin:.25rem 0 0; font-size:.84rem; color:var(--text-muted); }',
    '.rr-rp-tiles { display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); gap:.5rem; margin:.9rem 0 1rem; }',
    '.rr-rp-tile { text-align:left; border:1px solid var(--border); background:var(--bg-card); border-radius:12px; padding:.55rem .7rem; cursor:pointer; font:inherit; position:relative; overflow:hidden; }',
    '.rr-rp-tile::before { content:""; position:absolute; left:0; top:0; bottom:0; width:3px; background:currentColor; opacity:.8; }',
    '.rr-rp-tile b { display:block; font-size:1.45rem; font-weight:800; line-height:1.2; color:var(--text-primary); font-variant-numeric:tabular-nums; }',
    '.rr-rp-tile span { font-size:.76rem; font-weight:700; white-space:nowrap; }',
    '.rr-rp-tile.pen{color:#c53030} .rr-rp-tile.fine{color:#c05621} .rr-rp-tile.sur{color:#975a16} .rr-rp-tile.san{color:#6b46c1} .rr-rp-tile.duty{color:#2c7a7b} .rr-rp-tile.new{color:#2b6cb0} .rr-rp-tile.del{color:#4a5568}',
    '@media (prefers-color-scheme: dark) { .rr-rp-tile.pen{color:#feb2b2} .rr-rp-tile.fine{color:#fbd38d} .rr-rp-tile.sur{color:#faf089} .rr-rp-tile.san{color:#d6bcfa} .rr-rp-tile.duty{color:#81e6d9} .rr-rp-tile.new{color:#90cdf4} .rr-rp-tile.del{color:#cbd5e0} }',
    '.rr-rp-tile:hover { border-color:currentColor; }',
    '.rr-rp-tile.on { border-color:currentColor; box-shadow:0 0 0 2px color-mix(in srgb, currentColor 30%, transparent); }',
    '.rr-rp-lh { display:flex; align-items:center; gap:.6rem; margin:0 0 .5rem; font-size:.88rem; color:var(--text-primary); }',
    '.rr-rp-lh span { color:var(--text-muted); font-weight:600; }',
    '.rr-rp-past { margin-left:auto; border:1px solid var(--border); background:var(--bg-card); color:var(--text-secondary); border-radius:8px; padding:.25rem .65rem; font:inherit; font-size:.78rem; font-weight:700; cursor:pointer; }',
    '.rr-rp-list { display:flex; flex-direction:column; gap:.35rem; }',
    '.rr-rp-row { display:grid; grid-template-columns:44px 64px minmax(0,1fr) auto auto; align-items:center; gap:.6rem; text-align:left; width:100%; border:1px solid var(--border); background:var(--bg-card); border-radius:10px; padding:.5rem .7rem; cursor:pointer; font:inherit; color:var(--text-primary); }',
    '.rr-rp-row:hover { border-color:var(--primary); }',
    '.rr-rp-date { font-size:.8rem; color:var(--text-muted); font-variant-numeric:tabular-nums; }',
    '.rr-rp-dd { font-size:.74rem; font-weight:800; color:#6b46c1; }',
    '.rr-rp-dd.hot { color:#c53030; } .rr-rp-dd.done { color:var(--text-muted); font-weight:600; }',
    '.rr-rp-title { font-weight:700; font-size:.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
    '.rr-rp-cat { font-size:.75rem; color:var(--text-muted); white-space:nowrap; display:inline-flex; align-items:center; gap:4px; }',
    '.rr-rp-cat i { width:8px; height:8px; border-radius:2px; }',
    '.rr-rp-row .rr-rbs { margin:0; justify-content:flex-end; }',
    '.rr-rp-empty, .rr-rp-more { font-size:.82rem; color:var(--text-muted); padding:.4rem .2rem; }',
    '@media (max-width: 1100px) { .rr-rp-tiles { grid-template-columns:repeat(4, minmax(0,1fr)); } .rr-rp-row { grid-template-columns:44px 64px minmax(0,1fr); } .rr-rp-row .rr-rp-cat, .rr-rp-row .rr-rbs { grid-column:3; } }'
  ].join('\n');
  document.head.appendChild(st);
})();
