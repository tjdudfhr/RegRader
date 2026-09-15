/* Replace 2025 download modal + files with 2026 matched / nationwide exports */
(function () {
  function iso(d) {
    var s = String(d || '').replace(/[^\d]/g, '');
    if (s.length === 8) return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
    return d || '';
  }
  function items() { return window.__rrItems || window.lawsData || []; }
  function needX() {
    if (window.XLSX && XLSX.utils) return true;
    alert('엑셀 라이브러리를 아직 불러오지 못했습니다. 잠시 후 다시 눌러주세요.');
    return false;
  }
  function saveSheet(rows, sheetName, fileName) {
    if (!needX()) return;
    var ws = XLSX.utils.json_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    XLSX.writeFile(wb, fileName);
  }
  function downloadMatched() {
    var rows = items().map(function (law) {
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
    });
    if (!rows.length) { alert('매칭 데이터가 아직 없습니다.'); return; }
    saveSheet(rows, '당사매칭개정', '2026_당사_매칭_개정결과.xlsx');
  }
  function downloadAll() {
    if (!needX()) return;
    alert('전체 법령 엑셀은 용량 때문에 화면에서 바로 만들지 못 합니다. 채팅으로 올려 드린 파일을 써 주세요.');
  }
  function restyle(modal) {
    if (!modal || modal.getAttribute('data-rr-dl') === '1') return;
    modal.setAttribute('data-rr-dl', '1');
    modal.innerHTML = modal.innerHTML
      .replace(/2025년 법령 데이터 다운로드/g, '2026년 법령 데이터 다운로드')
      .replace(/2025년 시행법령 전체 데이터/g, '2026년 법령 데이터')
      .replace(/2,971/g, '7,423')
      .replace(/총 법령/g, '현행+예정 건')
      .replace(/1,716/g, '2,468')
      .replace(/213/g, '4,955')
      .replace(/1,042/g, '207')
      .replace(/연혁/g, '당사 적용')
      .replace(/2025년 시행법령 전체 \(Excel\)/g, '2026년 전체 법령 (현행 2,468 + 시행예정 4,955)')
      .replace(/2025년 시행법령 전체 \(JSON\)/g, '당사 매칭 개정 결과 (Excel)');
    modal.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (/2025_laws|laws_2025/.test(href)) {
        a.removeAttribute('href');
        a.addEventListener('click', function (ev) { ev.preventDefault(); downloadAll(); });
      } else if (/index\.json|matched_laws/.test(href)) {
        a.removeAttribute('href');
        a.addEventListener('click', function (ev) { ev.preventDefault(); downloadMatched(); });
      }
    });
  }
  function patchFns() {
    window.downloadAllLaws = downloadAll;
    window.downloadMatchedLaws = downloadMatched;
    var o1 = window.openDataDownload;
    window.openDataDownload = function () { if (o1) o1(); restyle(document.getElementById('dataDownloadModal')); };
    var o2 = window.openDownloadModal;
    window.openDownloadModal = function () { if (o2) o2(); restyle(document.getElementById('download-modal')); };
  }
  var n = 0, t = setInterval(function () { patchFns(); if (++n > 40) clearInterval(t); }, 250);
})();
