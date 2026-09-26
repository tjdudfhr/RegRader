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
  function title(t) {
    return '<div style="font-size:15px;letter-spacing:.02em;color:#3730a3;margin:18px 0 8px;font-weight:800">' + t + '</div>';
  }
  /* 팝업 섹션 박스: 개정 취지 · 주요 개정내용 · 개정 조항 · 신구 대조 · 실무 지침 · 법령 신구비교를 각각 상자로 나눈다.
     색 띠는 구분용이고, 글자는 글자색(다크 모드 대응)을 쓴다. */
  var SEC = {
    why:   { icon: '💡', color: '#667eea' },
    what:  { icon: '📝', color: '#0ea5e9' },
    arts:  { icon: '📌', color: '#f59e0b' },
    diff:  { icon: '🔁', color: '#94a3b8' },
    track: { icon: '✅', color: '#2f855a' },
    risk:  { icon: '⚠️', color: '#e53e3e' },
    riskc: { icon: '🔎', color: '#a0aec0' },
    fam:   { icon: '🔗', color: '#14b8a6' },
    act:   { icon: '✅', color: '#10b981' },
    cmp:   { icon: '📖', color: '#8b5cf6' }
  };
  function section(key, no, name, body, extra) {
    var c = SEC[key];
    return '<section class="rr-sec rr-sec-' + key + '" style="--sec:' + c.color + '">' +
      '<header class="rr-sec-h"><span class="rr-sec-ic" aria-hidden="true">' + c.icon + '</span>' +
      '<span class="rr-sec-no">' + no + '</span><h4>' + name + '</h4>' + (extra || '') + '</header>' +
      '<div class="rr-sec-b">' + body + '</div></section>';
  }
  (function () {
    if (document.getElementById('rr-sec-style')) return;
    var st = document.createElement('style');
    st.id = 'rr-sec-style';
    st.textContent = [
      '#rr-brief.rr-brief { border:0; padding:0; background:transparent; margin:0 0 12px; }',
      '.rr-brief-h { display:flex; align-items:center; gap:8px; margin:4px 0 12px; font-size:17px; font-weight:800; color:var(--text-primary,#1a202c); }',
      '.rr-brief-h small { font-size:12px; font-weight:600; color:var(--text-muted,#718096); }',
      '.rr-sec { position:relative; background:var(--bg-card,#fff); border:1px solid var(--border,#e2e8f0); border-left:4px solid var(--sec); border-radius:12px; padding:14px 16px 14px 16px; margin:0 0 12px; }',
      '.rr-sec-h { display:flex; align-items:center; gap:8px; margin:0 0 8px; }',
      '.rr-sec-h h4 { margin:0; font-size:15px; font-weight:800; color:var(--text-primary,#1a202c); }',
      '.rr-sec-ic { width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; border-radius:8px; font-size:15px; background:color-mix(in srgb, var(--sec) 14%, transparent); }',
      '.rr-sec-no { font-size:11px; font-weight:800; color:var(--sec); letter-spacing:.04em; }',
      '.rr-sec-h .rr-sec-extra { margin-left:auto; font-size:12px; font-weight:600; color:var(--text-muted,#718096); }',
      '.rr-sec-b { font-size:15.5px; line-height:1.8; color:var(--text-primary,#1a202c); }',
      '.rr-sec-b ul { margin:0; padding-left:20px; }',
      '.rr-sec-b li { margin:0 0 6px; }',
      '.rr-sec-b li::marker { color:var(--sec); }',
      '.rr-sec-act { background:color-mix(in srgb, #10b981 7%, var(--bg-card,#fff)); }',
      '.rr-chip { display:inline-block; margin:3px 6px 3px 0; padding:4px 11px; border-radius:999px; font-size:13px; font-weight:600;',
      '  background:color-mix(in srgb, #f59e0b 14%, transparent); color:var(--text-primary,#1a202c); border:1px solid color-mix(in srgb, #f59e0b 45%, transparent); }',
      '.rr-sec table { width:100%; border-collapse:collapse; font-size:14px; line-height:1.5; }',
      '.rr-sec th { text-align:left; padding:8px; font-size:12px; color:var(--text-muted,#718096); border-bottom:1px solid var(--border,#e2e8f0); }',
      '.rr-sec td { padding:8px; border-bottom:1px solid var(--border,#e2e8f0); vertical-align:top; }',
      '.rr-sec td.old { color:#b45309; } .rr-sec td.new { color:#047857; }',
      '.rr-sec iframe { width:100%; height:460px; border:1px solid var(--border,#e2e8f0); border-radius:10px; background:#fff; }',
      '.rr-links { display:flex; flex-wrap:wrap; gap:8px; margin:4px 0 0; }',
      '.rr-links a { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; font-size:14px; font-weight:700; text-decoration:none;',
      '  color:var(--primary,#667eea); border:1px solid color-mix(in srgb, var(--primary,#667eea) 45%, transparent); background:color-mix(in srgb, var(--primary,#667eea) 8%, transparent); }',
      '.rr-links a:hover { background:color-mix(in srgb, var(--primary,#667eea) 16%, transparent); }',
      '@media (prefers-color-scheme: dark) { .rr-sec td.old { color:#fbbf24; } .rr-sec td.new { color:#34d399; } }'
    ].join('\n');
    document.head.appendChild(st);
  })();
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
  function metaBox(item) {
    var cat = (item.categories && item.categories[0]) || item.lawType || '-';
    var status = item.daysUntil === 0 ? '오늘 시행' : (item.inForce ? '시행완료' : '시행예정');
    return '<div class="summary-section" id="rr-meta" style="margin:0 0 12px">' +
      '<div class="info-grid">' +
      '<div class="info-cell"><div class="info-label">개정 유형</div><div class="info-value">' + esc(item.amendmentType || '-') + '</div></div>' +
      '<div class="info-cell"><div class="info-label">소관 부처</div><div class="info-value">' + esc(item.ministry || '-') + '</div></div>' +
      '<div class="info-cell"><div class="info-label">시행일</div><div class="info-value">' + esc(item.effectiveDate || '-') + ' · ' + status + '</div></div>' +
      '<div class="info-cell"><div class="info-label">분류</div><div class="info-value">' + esc(cat) + '</div></div>' +
      '</div></div>';
  }
  /* 행정규칙(고시·훈령·예규 등) 팝업: 개정 취지·주요내용은 법령정보센터 제개정이유, 원문·첨부(고시 전문) 링크 */
  function admrulHtml(item) {
    var A = window.rrAmend;
    var d = A ? A.details(item) : null;
    var fill = A ? A.briefFill(item) : null;
    var seq = (item.meta && item.meta.admRulSeq) || '';
    var src = seq ? 'https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=' + seq : '';
    var cat = (item.categories && item.categories[0]) || '-';
    var status = item.daysUntil === 0 ? '오늘 시행' : (item.inForce ? '시행완료' : '시행예정');
    var iss = d && d.issued ? String(d.issued).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : '';
    var meta = '<div class="summary-section" id="rr-meta" style="margin:0 0 12px"><div class="info-grid">' +
      '<div class="info-cell"><div class="info-label">행정규칙 종류</div><div class="info-value">' + esc(item.kind) + ' · ' + esc(item.amendmentType || '-') + '</div></div>' +
      '<div class="info-cell"><div class="info-label">소관 부처</div><div class="info-value">' + esc(item.ministry || '-') + (d && d.dept ? '<br><small style="color:var(--text-muted)">' + esc(d.dept) + '</small>' : '') + '</div></div>' +
      '<div class="info-cell"><div class="info-label">시행일</div><div class="info-value">' + esc(item.effectiveDate || '-') + ' · ' + status + (iss ? '<br><small style="color:var(--text-muted)">발령 ' + esc(iss) + '</small>' : '') + '</div></div>' +
      '<div class="info-cell"><div class="info-label">분류 · 계열</div><div class="info-value">' + esc(cat) + (item.family ? '<br><small style="color:var(--text-muted)">' + esc(item.family) + ' 계열</small>' : '') + '</div></div>' +
      '</div></div>';
    var fam = window.rrFamilies && window.rrFamilies.popupSection ? window.rrFamilies.popupSection(item) : null;
    var no = 0;
    var n = function () { no++; return String(no).padStart(2, '0'); };
    var why = fill && fill.why ? fill.why : (d ? '법령정보센터에 이 행정규칙의 개정 이유가 등록되어 있지 않습니다. 원문에서 확인하세요.' : '개정 이유를 불러오는 중입니다…');
    return meta + '<div id="rr-brief" class="summary-section rr-brief">' +
      '<div class="rr-brief-h">개정요지 <small>행정규칙 · 국가법령정보센터 제개정이유</small></div>' +
      (window.rrTracker ? (function (t) { return section('track', n(), '대응 현황', t.body, t.extra); })(window.rrTracker.popupSection(item)) : '') +
      section('why', n(), '개정 취지', '<div style="white-space:pre-wrap">' + esc(why) + '</div>') +
      (fill && fill.what ? section('what', n(), '주요 개정내용', '<div style="white-space:pre-wrap">' + esc(fill.what) + '</div>') : '') +
      (fam ? section('fam', n(), '같은 계열 올해 개정', fam.body, fam.extra) : '') +
      '<div class="rr-links">' +
      (src ? '<a href="' + src + '" target="_blank" rel="noopener">📄 행정규칙 원문</a>' : '') +
      (d && d.attach ? '<a href="' + esc(d.attach) + '" target="_blank" rel="noopener" title="' + esc(d.attachName || '') + '">📎 첨부 (' + esc((d.attachName || '파일').slice(0, 24)) + ')</a>' : '') +
      '</div></div>';
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
    var lsi = (item.meta && item.meta.lsiSeq) || '';
    var efYd = String(item.effectiveDate || '').replace(/-/g, '');
    var src = lsi ? ('https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=' + lsi + (efYd ? '&efYd=' + efYd : '') + '&viewCls=lsRvsDocInfoR') : '';
    var live = 'https://www.law.go.kr/lsSc.do?menuId=1&query=' + encodeURIComponent(item.title || '');
    var cmp = lsi ? ('https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=' + lsi + '&viewCls=lsOldAndNew') : '';
    var points = (b.points || []).map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('');
    var acts = lines(b.action);
    if (!acts.length) acts = ['개정 조문을 기준으로 사내 규정·계약·서식의 인용 조항을 현행화하십시오.', '시행일 전 담당 부서 역할을 나누고 미해당 여부까지 기록으로 남기십시오.'];
    var rawWhat = String(b.what || '');
    if (fill && fill.what && (!rawWhat || A.isPlaceholder(rawWhat))) rawWhat = fill.what;
    var isPromul = /이에 공포한다|국회에서 의결된/.test(rawWhat.slice(0, 80));
    var whatBody;
    if (points) {
      whatBody = '<ul>' + points + '</ul>';
    } else if (rawWhat && !isPromul) {
      whatBody = '<div style="white-space:pre-wrap">' + esc(rawWhat) + '</div>';
    } else {
      whatBody = '<div>' + (arts ? '확인 대상 조문은 아래 칩과 신구대조를 기준으로 요건·기한·서식·인용 조항을 현행화하십시오.' :
         '조문 단위 변경은 신구대조표와 국가법령정보센터 신구비교에서 확인하십시오.') + '</div>';
    }
    var no = 0;
    var n = function () { no++; return String(no).padStart(2, '0'); };
    var artCount = artList.length;
    var whyText = b.why || item.summary || '';
    if (fill && fill.why && A.isPlaceholder(whyText)) whyText = fill.why;
    var diffHtml = diffTable(b.diff);
    /* 같은 계열(법률·시행령·시행규칙)의 올해 개정: family-ui.js */
    var fam = window.rrFamilies && window.rrFamilies.popupSection ? window.rrFamilies.popupSection(item) : null;
    return metaBox(item) +
      '<div id="rr-brief" class="summary-section rr-brief">' +
      '<div class="rr-brief-h">개정요지 <small>항목별로 나눠 보기</small></div>' +
      (trk ? section('track', n(), '대응 현황', trk.body, trk.extra) : '') +
      (risk ? section(risk.tone === 'hot' ? 'risk' : 'riskc', n(), risk.tone === 'hot' ? '벌칙·과태료·의무 변경' : '제재 조문 정비', risk.body, risk.extra) : '') +
      section('why', n(), '개정 취지', '<div style="white-space:pre-wrap">' + esc(whyText || '개정 취지를 확인하는 중입니다.') + '</div>') +
      section('what', n(), '주요 개정내용', whatBody) +
      (arts ? section('arts', n(), '개정 조항', '<div>' + arts + '</div>', '<span class="rr-sec-extra">' + artCount + '개 조항</span>') : '') +
      (diffHtml ? section('diff', n(), '신구 대조', diffHtml) : '') +
      (fam ? section('fam', n(), '같은 계열 올해 개정', fam.body, fam.extra) : '') +
      section('act', n(), '실무 지침', '<ul>' + acts.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>') +
      (cmp ? section('cmp', n(), '법령 신구비교',
        '<iframe sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-modals" referrerpolicy="no-referrer" src="' + cmp + '" loading="lazy"></iframe>',
        '<a class="rr-sec-extra" href="' + cmp + '" target="_blank" rel="noopener">새 창으로 ↗</a>') : '') +
      '<div class="rr-links">' +
      (src ? ('<a href="' + src + '" target="_blank" rel="noopener">📄 이 개정문</a>') : '') +
      '<a href="' + live + '" target="_blank" rel="noopener">⚖️ 현행 법령</a></div></div>';
  }
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
      box.insertAdjacentHTML('afterbegin', html(item));
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
