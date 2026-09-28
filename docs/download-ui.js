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
  function downloadMatched() {
    saveRows(items().map(function (law) {
      return {
        '법령명': law.title || '',
        '시행일': law.effectiveDate || '',
        '상태': law.inForce ? '시행완료' : '시행예정',
        '제개정구분': law.amendmentType || '',
        '소관부처': law.ministry || '',
        '직무': (law.categories || []).join(', '),
        '법령유형': law.lawType || '',
        '올해개정회차': (law.eventIndex || 1) + '/' + (law.eventCount || 1),
        '복수개정': (law.eventCount || 1) > 1 ? 'Y' : 'N',
        '법령일련번호': (law.meta && law.meta.lsiSeq) || '',
        '원문URL': (law.source && law.source.url) || ''
      };
    }), '당사매칭개정', window.RR_YEAR + '_당사_매칭_개정결과.xlsx');
  }
  function downloadBase() {
    fetch('./base_laws_207.json?v=20260915n', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        saveRows((j.items || []).map(function (b, i) {
          return { '번호': i + 1, '법령명': b.title || '', '직무': (b.categories || []).join(', '), 'ID': b.id || '' };
        }), '당사적용국내법규', '당사_적용_국내법규_' + (j.items || []).length + '.xlsx');
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
        '<div class="rr-dlg-t"><h2>보고서 · 내보내기</h2><p>' + window.RR_YEAR + '년 데이터' + (asOf ? ' · ' + asOf.replace(/-/g, '.') + ' 기준' : '') + '</p></div>' +
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
