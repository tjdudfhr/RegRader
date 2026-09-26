/* 법령 계열(법률 → 시행령 → 시행규칙) 묶어 보기
 *
 * law_families.json: 국가법령정보센터 법령체계도로 만든 공식 상하위 관계 (scripts/law_families.py, 매일 갱신 때 필요하면 다시 만든다).
 * 파일이 없으면 이름 규칙('OO법 시행령')으로만 묶는다.
 *
 * window.rrFamilies
 *   .ready                 계열 자료를 다 읽으면 끝나는 Promise
 *   .familyOf(title)       { root, members:[{title, level, kind, inBase, category, parent, lsiSeq, notFound}] } | null
 *   .all()                 계열 전체 (가나다순)
 *   .events(title)         그 법령의 올해 개정 이벤트 (시행일순)
 *   .chips(title, curId)   개정 이벤트 칩 HTML (누르면 그 개정의 팝업이 열린다: data-eid)
 *   .popupSection(item)    법령 팝업의 '같은 계열 올해 개정' 본문 { body, extra } | null
 */
(function () {
  var FAMS = [], BY = {};

  function compact(s) { return String(s || '').replace(/[\s·ㆍ・.]/g, ''); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function levelByName(t) { t = String(t || '').trim(); return /시행령$/.test(t) ? '시행령' : /시행규칙$/.test(t) ? '시행규칙' : '법률'; }
  function guessRoot(t) { var m = String(t || '').trim().match(/^(.*\S)\s*(시행령|시행규칙)$/); return m ? m[1] : String(t || '').trim(); }

  function index(list) {
    FAMS = list;
    BY = {};
    list.forEach(function (f) { f.members.forEach(function (m) { if (m.inBase) BY[compact(m.title)] = f; }); });
  }
  function fromFile(j) {
    if (!j || !Array.isArray(j.families) || !j.families.length) throw new Error('empty');
    index(j.families);
  }
  function fromBase(items) {
    var map = {};
    (items || []).forEach(function (b) {
      var r = guessRoot(b.title);
      (map[r] = map[r] || []).push({ title: b.title, level: levelByName(b.title), kind: b.lawType || '', inBase: true, category: (b.categories || [])[0] });
    });
    var order = { '법률': 0, '시행령': 1, '시행규칙': 2 };
    index(Object.keys(map).sort().map(function (r) {
      return { root: r, members: map[r].sort(function (a, b) { return (order[a.level] || 0) - (order[b.level] || 0); }) };
    }));
  }
  var ready = fetch('./law_families.json?v=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(fromFile)
    .catch(function () {
      return fetch('./base_laws_207.json?v=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (j) { fromBase(j.items || []); })
        .catch(function () {});
    });

  function events(title) {
    var c = compact(title);
    return (window.__rrItems || []).filter(function (x) { return compact(x.title) === c; })
      .sort(function (a, b) { return String(a.effectiveDate).localeCompare(String(b.effectiveDate)) || String(a.amendmentType).localeCompare(String(b.amendmentType)); });
  }
  function shortType(t) {
    t = String(t || '');
    return t === '일부개정' ? '일부' : t === '타법개정' ? '타법' : t === '전부개정' ? '전부' : t.replace(/개정$/, '') || '개정';
  }
  function tier(it) {
    var d = typeof it.daysUntil === 'number' ? it.daysUntil : (it.inForce ? -1 : 1);
    return d < 0 ? 'done' : d === 0 ? 'today' : d <= 30 ? 'soon' : 'later';
  }
  function chip(it, curId, sameDate) {
    var d = it.daysUntil;
    var st = d < 0 ? '시행완료' : d === 0 ? '오늘 시행' : '시행예정 D-' + d;
    var cls = 'rr-evc ' + tier(it) + (it.id === curId ? ' cur' : '') + (sameDate && it.effectiveDate === sameDate && it.id !== curId ? ' same' : '');
    return '<button type="button" class="' + cls + '" data-eid="' + esc(it.id) + '" title="' + esc(it.effectiveDate + ' ' + (it.amendmentType || '') + ' · ' + st + ' — 눌러서 개정 내용 보기') + '">' +
      esc(String(it.effectiveDate).slice(5).replace('-', '.')) + ' <small>' + esc(shortType(it.amendmentType)) + '</small></button>';
  }
  function chips(title, curId, sameDate) {
    return events(title).map(function (it) { return chip(it, curId, sameDate); }).join('');
  }
  function lawLink(m) {
    return m.lsiSeq ? 'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=' + encodeURIComponent(m.lsiSeq)
      : 'https://www.law.go.kr/lsSc.do?menuId=1&query=' + encodeURIComponent(m.title);
  }
  function depth(f, m) {
    if (m.level === '법률') return 0;
    if (m.level === '시행령') return 1;
    return 2;
  }
  /* 계열 한 줄: 단계 표시 · 법령명 · 올해 개정 칩 (또는 개정 없음 / 적용법규 아님) */
  function row(f, m, curTitle, curId, sameDate) {
    var isCur = curTitle && compact(m.title) === compact(curTitle);
    var right;
    if (!m.inBase) {
      right = '<span class="rr-fam-out">적용법규 아님</span><a class="rr-fam-lnk" href="' + esc(lawLink(m)) + '" target="_blank" rel="noopener" title="국가법령정보센터에서 보기">원문 ↗</a>';
    } else if (m.notFound) {
      right = '<span class="rr-fam-warn" title="국가법령정보센터에서 이 이름의 법령을 찾지 못했습니다. 법령명이 바뀌었거나 폐지됐는지 확인이 필요합니다.">⚠ 법령명 확인 필요</span>';
    } else {
      var ch = chips(m.title, curId, sameDate);
      right = ch || '<span class="rr-fam-none">올해 개정 없음</span>';
    }
    return '<div class="rr-fam-row lv' + depth(f, m) + (isCur ? ' cur' : '') + (m.inBase ? '' : ' out') + '">' +
      '<span class="rr-fam-lv" title="' + esc(m.kind || m.level) + '">' + esc(m.level || '') + '</span>' +
      '<span class="rr-fam-name">' + esc(m.title) + (isCur ? ' <em>이 법령</em>' : '') + '</span>' +
      '<span class="rr-fam-evs">' + right + '</span></div>';
  }
  function familyOf(title) { return BY[compact(title)] || null; }

  function popupSection(item) {
    var f = familyOf(item && item.title);
    if (!f || f.members.length < 2) return null;
    var same = [];
    f.members.forEach(function (m) {
      if (!m.inBase || compact(m.title) === compact(item.title)) return;
      events(m.title).forEach(function (it) { if (it.effectiveDate === item.effectiveDate) same.push(it); });
    });
    var total = 0;
    f.members.forEach(function (m) { if (m.inBase) total += events(m.title).length; });
    var note = same.length
      ? '<div class="rr-fam-note">📎 같은 날(' + esc(item.effectiveDate) + ') 시행되는 계열 개정이 <b>' + same.length + '건</b> 있습니다. 함께 검토하세요.</div>'
      : '';
    var body = note + '<div class="rr-fam">' + f.members.map(function (m) { return row(f, m, item.title, item.id, item.effectiveDate); }).join('') + '</div>' +
      '<div class="rr-fam-foot">국가법령정보센터 법령체계도 기준 · 날짜를 누르면 그 개정 내용이 열립니다.</div>';
    return { body: body, extra: '<span class="rr-sec-extra">' + esc(f.root) + ' 계열 · 올해 ' + total + '건</span>' };
  }

  /* 팝업 안에서 다른 개정으로 넘어가면 새 법령을 처음부터 보도록 맨 위로 올린다 */
  document.addEventListener('click', function (e) {
    var chipEl = e.target.closest && e.target.closest('.rr-sec-fam .rr-evc');
    if (!chipEl) return;
    var body = chipEl.closest('.modal-body');
    if (body) setTimeout(function () { body.scrollTop = 0; }, 60);
  }, true);

  window.rrFamilies = {
    ready: ready,
    familyOf: familyOf,
    all: function () { return FAMS; },
    events: events,
    chips: chips,
    row: row,
    popupSection: popupSection
  };

  /* 스타일: 팝업(같은 계열) + 적용법규 탭(계열 보기) 공통 */
  var st = document.createElement('style');
  st.textContent = [
    '.rr-fam-note { margin:0 0 10px; padding:8px 12px; border-radius:10px; font-size:14px; background:color-mix(in srgb, #dd6b20 12%, transparent); color:var(--text-primary,#1a202c); }',
    '.rr-fam { display:flex; flex-direction:column; gap:2px; }',
    '.rr-fam-row { display:grid; grid-template-columns:58px minmax(0,1fr) auto; align-items:center; gap:10px; padding:7px 8px; border-radius:8px; }',
    '.rr-fam-row.lv1 { padding-left:22px; } .rr-fam-row.lv2 { padding-left:36px; }',
    '.rr-fam-row.lv1 .rr-fam-lv, .rr-fam-row.lv2 .rr-fam-lv { position:relative; }',
    '.rr-fam-row.cur { background:color-mix(in srgb, var(--primary,#667eea) 10%, transparent); }',
    '.rr-fam-row.out { opacity:.62; }',
    '.rr-fam-lv { font-size:11.5px; font-weight:800; text-align:center; padding:2px 0; border-radius:6px; border:1px solid var(--border,#e2e8f0); color:var(--text-secondary,#4a5568); background:var(--bg-card,#fff); }',
    '.rr-fam-row.lv0 .rr-fam-lv { color:var(--primary,#667eea); border-color:color-mix(in srgb, var(--primary,#667eea) 45%, transparent); }',
    '.rr-fam-name { font-size:14.5px; font-weight:600; color:var(--text-primary,#1a202c); line-height:1.4; }',
    '.rr-fam-name em { font-style:normal; font-size:11px; font-weight:800; color:var(--primary,#667eea); margin-left:4px; }',
    '.rr-fam-evs { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:4px; }',
    '.rr-evc { border:1px solid var(--border,#e2e8f0); background:var(--bg-card,#fff); color:var(--text-secondary,#4a5568); border-radius:999px; padding:2px 9px; font-family:inherit; font-size:12.5px; font-weight:600; line-height:1.5; font-variant-numeric:tabular-nums; cursor:pointer; white-space:nowrap; }',
    '.rr-evc small { font-size:11px; font-weight:600; color:var(--text-muted,#718096); }',
    '.rr-evc:hover { border-color:var(--primary,#667eea); }',
    '.rr-evc.done { color:var(--text-muted,#718096); }',
    '.rr-evc.today { color:#c53030; border-color:rgba(229,62,62,.5); }',
    '.rr-evc.soon { color:#c05621; border-color:rgba(221,107,32,.5); }',
    '.rr-evc.later { color:#6b46c1; border-color:rgba(128,90,213,.45); }',
    '.rr-evc.cur { background:var(--primary,#667eea); color:#fff; border-color:var(--primary,#667eea); }',
    '.rr-evc.cur small { color:rgba(255,255,255,.85); }',
    '.rr-evc.same { box-shadow:0 0 0 2px color-mix(in srgb, #dd6b20 55%, transparent); }',
    '.rr-fam-none, .rr-fam-out { font-size:12px; color:var(--text-muted,#718096); white-space:nowrap; }',
    '.rr-fam-warn { font-size:12px; font-weight:700; color:#c05621; white-space:nowrap; }',
    '.rr-fam-lnk { font-size:12px; font-weight:700; color:var(--primary,#667eea); text-decoration:none; margin-left:6px; white-space:nowrap; }',
    '.rr-fam-foot { margin-top:8px; font-size:12px; color:var(--text-muted,#718096); }',
    '@media (prefers-color-scheme: dark) { .rr-evc.soon { color:#f6ad55; } .rr-evc.later { color:#b794f4; } .rr-evc.today { color:#fc8181; } .rr-fam-warn { color:#f6ad55; } }',
    '@media (max-width: 640px) { .rr-fam-row { grid-template-columns:52px minmax(0,1fr); } .rr-fam-evs { grid-column:1 / -1; justify-content:flex-start; padding-left:62px; } }'
  ].join('\n');
  document.head.appendChild(st);
})();
