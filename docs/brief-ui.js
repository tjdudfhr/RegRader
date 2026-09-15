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
      return '<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;white-space:nowrap">' + esc(d.a || '—') +
        '</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#64748b">' + esc(d.k || '변경') +
        '</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#b45309">' + esc(d.b || '') +
        '</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#047857">' + esc(d.n || '') +
        '</td></tr>';
    }).join('');
    return title('신구 대조') +
      '<div style="overflow:auto;border:1px solid #e5e7eb;border-radius:10px"><table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.5">' +
      '<thead><tr style="background:#f1f5f9;text-align:left"><th style="padding:8px">조항</th><th style="padding:8px">구분</th><th style="padding:8px">종전</th><th style="padding:8px">개정</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
  }
  function metaBox(item) {
    var cat = (item.categories && item.categories[0]) || item.lawType || '-';
    var status = item.inForce ? '시행완료' : '시행예정';
    return '<div class="summary-section" id="rr-meta" style="margin:0 0 12px">' +
      '<div class="info-grid">' +
      '<div class="info-cell"><div class="info-label">개정 유형</div><div class="info-value">' + esc(item.amendmentType || '-') + '</div></div>' +
      '<div class="info-cell"><div class="info-label">소관 부처</div><div class="info-value">' + esc(item.ministry || '-') + '</div></div>' +
      '<div class="info-cell"><div class="info-label">시행일</div><div class="info-value">' + esc(item.effectiveDate || '-') + ' · ' + status + '</div></div>' +
      '<div class="info-cell"><div class="info-label">분류</div><div class="info-value">' + esc(cat) + '</div></div>' +
      '</div></div>';
  }
  function html(item) {
    var b = item.brief || {};
    var arts = (b.articles || []).map(function (a) {
      return '<span style="display:inline-block;margin:2px 4px 2px 0;padding:3px 10px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:13px">' + esc(a) + '</span>';
    }).join('');
    var lsi = (item.meta && item.meta.lsiSeq) || '';
    var src = lsi ? ('https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=' + lsi + '&viewCls=lsRvsDocInfoR') : '';
    var live = 'https://www.law.go.kr/lsSc.do?menuId=1&query=' + encodeURIComponent(item.title || '');
    var cmp = lsi ? ('https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=' + lsi + '&viewCls=lsOldAndNew') : '';
    var points = (b.points || []).map(function (p) { return '<li style="margin:0 0 8px">' + esc(p) + '</li>'; }).join('');
    var acts = lines(b.action);
    if (!acts.length) acts = ['개정 조문을 기준으로 사내 규정·계약·서식의 인용 조항을 현행화하십시오.', '시행일 전 담당 부서 역할을 나누고 미해당 여부까지 기록으로 남기십시오.'];
    var bodyStyle = 'font-size:16px;line-height:1.85;color:#0f172a';
    var rawWhat = String(b.what || '');
    var isPromul = /이에 공포한다|국회에서 의결된/.test(rawWhat.slice(0, 80));
    var bodyWhat;
    if (points) {
      bodyWhat = title('주요 개정내용') + '<ul style="margin:0;padding-left:20px;' + bodyStyle + '">' + points + '</ul>';
    } else if (rawWhat && !isPromul) {
      bodyWhat = title('주요 개정내용') + '<div style="' + bodyStyle + ';white-space:pre-wrap">' + esc(rawWhat) + '</div>';
    } else {
      bodyWhat = title('주요 개정내용') + '<div style="' + bodyStyle + '">' +
        (arts ? '확인 대상 조문은 아래 칩과 신구대조를 기준으로 요건·기한·서식·인용 조항을 현행화하십시오.' :
         '조문 단위 변경은 신구대조표와 국가법령정보센터 신구비교에서 확인하십시오.') + '</div>';
    }
    return metaBox(item) +
      '<div id="rr-brief" class="summary-section" style="border:1px solid #c7d2fe;border-radius:14px;padding:18px;margin:0 0 12px;background:#f8fafc">' +
      '<div style="font-size:16px;color:#312e81;margin-bottom:6px;font-weight:800">개정요지</div>' +
      title('개정 취지') +
      '<div style="font-size:16px;line-height:1.85;color:#0f172a;white-space:pre-wrap">' + esc(b.why || item.summary || '개정 취지를 확인하는 중입니다.') + '</div>' +
      bodyWhat +
      (arts ? (title('개정 조항') + '<div>' + arts + '</div>') : '') +
      diffTable(b.diff) +
      title('실무 지침') +
      '<ul style="margin:0;padding-left:20px;' + bodyStyle + '">' + acts.map(function (x) { return '<li style="margin:0 0 8px">' + esc(x) + '</li>'; }).join('') + '</ul>' +
      (cmp ? (title('법령 신구비교') +
        '<iframe sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-modals" referrerpolicy="no-referrer" src="' + cmp +
        '" style="width:100%;height:460px;border:1px solid #e5e7eb;border-radius:10px;background:#fff" loading="lazy"></iframe>' +
        '<div style="margin-top:6px;font-size:14px"><a href="' + cmp + '" target="_blank" rel="noopener">신구비교 새 창</a></div>') : '') +
      '<div style="margin-top:12px;font-size:15px">' +
      (src ? ('<a href="' + src + '" target="_blank" rel="noopener">이 개정문</a> · ') : '') +
      '<a href="' + live + '" target="_blank" rel="noopener">현행 법령</a></div></div>';
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
