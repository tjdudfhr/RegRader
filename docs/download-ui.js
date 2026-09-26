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
    var baseN = window.__rrBaseCount || '–';
    inner.innerHTML =
      '<div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #e5e7eb">' +
      '<h2 style="margin:0;font-size:1.25rem">' + window.RR_YEAR + '년 보고서 · 데이터 다운로드</h2>' +
      '<button type="button" onclick="closeDownloadModal()" style="border:0;background:none;font-size:22px;cursor:pointer;color:#888">×</button>' +
      '</div>' +
      '<div style="padding:18px 20px">' +
      '<div style="background:linear-gradient(135deg,#5b67e5,#7c3aed);color:#fff;border-radius:12px;padding:14px 16px;margin-bottom:14px;display:flex;gap:18px;flex-wrap:wrap">' +
      '<div><div style="font-size:22px;font-weight:800">' + fmt(U.openapiCurrent) + '</div><div style="opacity:.9;font-size:12px">현행(' + window.RR_YEAR + ' 시행)</div></div>' +
      '<div><div style="font-size:22px;font-weight:800">' + fmt(U.openapiUpcoming) + '</div><div style="opacity:.9;font-size:12px">시행예정(연말까지)</div></div>' +
      '<div><div style="font-size:22px;font-weight:800">' + baseN + '</div><div style="opacity:.9;font-size:12px">당사 적용 국내법규</div></div>' +
      '<div><div style="font-size:22px;font-weight:800">' + (items().length || '-') + '</div><div style="opacity:.9;font-size:12px">일치 개정 건</div></div>' +
      '</div>' +
      '<div id="rr-report-slot"></div>' +
      '<button type="button" id="rr-dl-matched" style="width:100%;text-align:left;margin:0 0 10px;padding:14px;border:1px solid #c7d2fe;border-radius:12px;background:#eef2ff;cursor:pointer">' +
      '<div style="font-weight:700">당사 매칭 개정 결과 (Excel)</div>' +
      '<div style="font-size:13px;color:#4c1d95;margin-top:4px">' + baseN + '개와 제목 100% 일치하는 ' + window.RR_YEAR + '년 개정 건</div></button>' +
      '<button type="button" id="rr-dl-base" style="width:100%;text-align:left;margin:0 0 10px;padding:14px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc;cursor:pointer">' +
      '<div style="font-weight:700">당사 적용 국내법규 ' + baseN + ' (Excel)</div>' +
      '<div style="font-size:13px;color:#64748b;margin-top:4px">기본 적용 목록</div></button>' +
      '<div style="font-size:12px;color:#64748b;line-height:1.55">조회 기준 ' + (M.asOf || '–') + '. 전체 현행 ' + fmt(U.openapiCurrent) + ' · 올해 시행일 전체(연혁 포함) ' + fmt(U.openapiFuture) + ' 파일은 채팅으로 받은 엑셀을 사용하세요.</div>' +
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
