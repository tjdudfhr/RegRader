/* Force-replace the header download modal with 2026 actions */
(function () {
  function items() {
    return window.__rrItems || window.lawsData || [];
  }
  function saveRows(rows, sheet, file) {
    if (!(window.XLSX && XLSX.utils)) {
      alert('엑셀 모듈을 아직 못 불러왔습니다. 2초 뒤 다시 눌러주세요.');
      return;
    }
    if (!rows.length) {
      alert('데이터가 없습니다. 메인 숫자가 뜬 뒤 다시 눌러주세요.');
      return;
    }
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheet.slice(0, 31));
    XLSX.writeFile(wb, file);
  }
  /* 파일 이름에 데이터 기준일을 붙인다 (매일 오전 7시 갱신본인지 알 수 있게) */
  function stamp() {
    var d = String((window.__rrMeta || {}).asOf || '').replace(/-/g, '');
    return d || new Date().toISOString().slice(0, 10).replace(/-/g, '');
  }
  function levelOf(title) {
    var f = window.rrFamilies && window.rrFamilies.familyOf ? window.rrFamilies.familyOf(title) : null;
    var m = f ? f.members.filter(function (x) { return x.title === title; })[0] : null;
    return { level: m ? m.level : (/시행령$/.test(title) ? '시행령' : /시행규칙$/.test(title) ? '시행규칙' : '법률'), root: f ? f.root : '' };
  }
  /* 당사 개정 목록: 화면과 같은 데이터(매일 갱신) · 제재·의무 표시 포함 */
  function downloadMatched() {
    var A = window.rrAmend;
    saveRows(items().slice().sort(function (a, b) { return String(a.effectiveDate).localeCompare(String(b.effectiveDate)) || String(a.title).localeCompare(String(b.title)); }).map(function (law) {
      var lv = law.kind ? { level: law.kind, root: law.family || '' } : levelOf(law.title);
      return {
        '시행일': law.effectiveDate || '',
        '상태': law.daysUntil < 0 ? '시행완료' : law.daysUntil === 0 ? '오늘 시행' : '시행예정',
        '법령명': law.title || '',
        '구분': law.kind ? '행정규칙' : '법령',
        '단계': lv.level,
        '개정구분': law.amendmentType || '',
        '직무': (law.categories || []).join(', '),
        '계열(법률)': lv.root || law.family || '',
        '소관부처': law.ministry || '',
        '제재·의무': A && A.codes ? A.codes(law).join(', ') : '',
        '올해개정회차': (law.eventIndex || 1) + '/' + (law.eventCount || 1),
        '원문URL': (law.source && law.source.url) || ''
      };
    }), '당사개정목록', window.RR_YEAR + '_당사_개정목록_' + stamp() + '.xlsx');
  }
  /* 당사 적용법규 목록: 법령(base_laws) + 계열에 연결된 행정규칙(참고용 제외) */
  function downloadBase() {
    var P = function (f) { return fetch('./' + f + '?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }); };
    Promise.all([P('base_laws_207.json'), P('admrul_index.json').catch(function () { return { items: [] }; })])
      .then(function (res) {
        var ORDER = { '법률': 0, '시행령': 1, '시행규칙': 2 };
        var laws = (res[0].items || []).map(function (b) {
          var lv = levelOf(b.title || '');
          return { t: b.title || '', kind: '법령', lv: lv.level, job: (b.categories || []).join(', '), root: lv.root || b.title, dept: '' };
        });
        var adm = ((res[1] && res[1].items) || []).filter(function (x) { return !x.g; }).map(function (x) {
          return { t: x.n || '', kind: '행정규칙', lv: x.k || '행정규칙', job: x.c || '', root: x.f || '', dept: '' };
        });
        var all = laws.concat(adm).sort(function (a, b) {
          return String(a.job).localeCompare(String(b.job)) || String(a.root).localeCompare(String(b.root)) ||
            (a.kind === b.kind ? (ORDER[a.lv] != null ? ORDER[a.lv] : 3) - (ORDER[b.lv] != null ? ORDER[b.lv] : 3) : a.kind === '법령' ? -1 : 1) || a.t.localeCompare(b.t);
        });
        saveRows(all.map(function (x, i) {
          return { '번호': i + 1, '직무': x.job, '계열(법률)': x.root, '구분': x.kind, '단계': x.lv, '법령명': x.t };
        }), '당사적용법규', '당사_적용법규_' + all.length + '개_' + stamp() + '.xlsx');
      })
      .catch(function () { alert('적용법규 목록 파일을 찾지 못했습니다.'); });
  }
  function paint(box) {
    if (!box) return;
    var inner = box.querySelector('.modal-content') || box;
    var M = window.__rrMeta || {}, U = M.universe || {};
    var fmt = function (n) { return n == null ? '–' : Number(n).toLocaleString('ko-KR'); };
    var baseN = window.__rrBaseCount ? fmt(window.__rrBaseCount) : '–';
    var ic = function (n) { return window.rrIcon ? window.rrIcon(n) : ''; };
    var asOf = String(M.asOf || '');
    inner.className = 'modal-content rr-dlg';
    inner.removeAttribute('style');
    inner.style.setProperty('--dlg-w', '640px');
    inner.innerHTML =
      '<div class="rr-dlg-h"><span class="rr-dlg-ic">' + ic('download') + '</span>' +
        '<div class="rr-dlg-t"><h2>보고서</h2><p>' + window.RR_YEAR + '년 데이터' + (asOf ? ' · ' + asOf.replace(/-/g, '.') + ' 기준' : '') + '</p></div>' +
        '<button type="button" class="rr-dlg-x" onclick="closeDownloadModal()" aria-label="닫기">' + ic('x') + '</button></div>' +
      '<div class="rr-dlg-b">' +
        '<section class="rr-box" id="rr-report-slot"></section>' +
        '<section class="rr-box"><div class="rr-box-h"><span class="rr-box-ic">' + ic('sheet') + '</span>엑셀 파일</div>' +
          '<button type="button" class="rr-opt" id="rr-dl-matched"><span class="rr-box-ic">' + ic('sheet') + '</span><span><b>당사 개정 목록</b><small>' + window.RR_YEAR + '년 개정 ' + (items().length ? fmt(items().length) : '–') + '건</small></span><span class="go">' + ic('download') + '</span></button>' +
          '<button type="button" class="rr-opt" id="rr-dl-base"><span class="rr-box-ic">' + ic('sheet') + '</span><span><b>당사 적용법규 목록</b><small>법령·행정규칙 ' + baseN + '개</small></span><span class="go">' + ic('download') + '</span></button>' +
        '</section>' +
      '</div>';
    if (window.rrReport) window.rrReport.mount(inner.querySelector('#rr-report-slot'));   /* 월간·분기 보고서 PPT (report-ppt.js) */
    var m = inner.querySelector('#rr-dl-matched');
    var b = inner.querySelector('#rr-dl-base');
    if (m) m.onclick = function (e) { e.preventDefault(); downloadMatched(); };
    if (b) b.onclick = function (e) { e.preventDefault(); downloadBase(); };
  }
  function hook() {
    if (window.openDownloadModal && window.openDownloadModal.__rrDl) return;
    window.downloadAllLaws = downloadMatched;
    window.downloadMatchedLaws = downloadMatched;
    window.downloadBaseLaws = downloadBase;
    var o1 = window.openDownloadModal;
    window.openDownloadModal = function () {
      if (o1) o1();
      setTimeout(function () { paint(document.getElementById('download-modal')); }, 0);
    };
    window.openDownloadModal.__rrDl = true;
    var o2 = window.openDataDownload;
    window.openDataDownload = function () {
      if (o2) o2();
      setTimeout(function () {
        var el = document.getElementById('dataDownloadModal');
        if (!el) return;
        el.innerHTML = '<div class="modal-content" style="background:#fff;max-width:560px;margin:auto;border-radius:16px;overflow:hidden"></div>';
        paint(el);
      }, 0);
    };
  }
  var n = 0;
  var t = setInterval(function () {
    hook();
    if (++n > 80) clearInterval(t);
  }, 200);
})();
