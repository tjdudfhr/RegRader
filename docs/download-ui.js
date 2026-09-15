/* Replace 2025 download modal + files with 2026 matched / nationwide exports */
(function () {
  function iso(d) {
    var s = String(d || '').replace(/[^\d]/g, '');
    if (s.length === 8) return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
    return d || '';
  }
  function items() {
    return window.__rrItems || window.lawsData || [];
  }
  function needX() {
    if (window.XLSX && XLSX.utils) return true;
    alert('엑셀 라이브러리를 아직 불러오지 못했습니다. 잠시 후 다시 눌러주세요.');
    return false;
  }
  function saveSheet(rows, sheetName, fileName) {
    if (!needX()) return;
    var ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0] || {}).map(function () { return { wch: 22 }; });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    XLSX.writeFile(wb, fileName);
  }
  function matchedRows() {
    return items().map(function (law) {
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
  }
  function downloadMatched() {
    var rows = matchedRows();
    if (!rows.length) {
      alert('매칭 데이터가 아직 없습니다. 화면이 뜬 뒤 다시 눌러주세요.');
      return;
    }
    saveSheet(rows, '당사매칭개정', '2026_당사_매칭_개정결과.xlsx');
  }
  function downloadBase() {
    fetch('./base_laws_207.json', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var list = (j.items || j || []).map(function (b, i) {
          return {
            '번호': i + 1,
            '법령명': b.title || b.t || '',
            '직무': (b.categories || b.c || []).toString(),
            'ID': b.id || ''
          };
        });
        saveSheet(list, '당사적용국내법규', '당사_적용_국내법규_207.xlsx');
      })
      .catch(function () { alert('207개 목록을 불러오지 못했습니다.'); });
  }
  function toRows(arr) {
    return (arr || []).map(function (r) {
      return {
        '구분': r.s || '',
        '법령명': r.t || '',
        '시행일': iso(r.d),
        '공포일': iso(r.p),
        '제개정구분': r.a || '',
        '법령구분': r.k || '',
        '소관부처': r.m || '',
        '법령일련번호': r.u || ''
      };
    });
  }
  function downloadAll() {
    if (!needX()) return;
    var files = ['./uni_cur.json', './uni_fut_a.json', './uni_fut_b.json'];
    Promise.all(files.map(function (u) {
      return fetch(u + '?v=20260915k', { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error(u + ' ' + r.status);
        return r.json();
      });
    })).then(function (parts) {
      var cur = toRows(parts[0]);
      var fut = toRows([].concat(parts[1] || [], parts[2] || []));
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cur), '현행_2026');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fut), '시행예정_2026');
      XLSX.writeFile(wb, '2026_전체법령_현행2468_시행예정4955.xlsx');
    }).catch(function (e) {
      alert('전체 법령 파일을 아직 배포하지 못했습니다. 매칭 결과만 먼저 받아주세요.\n' + e);
    });
  }
  function restyle(modal) {
    if (!modal || modal.getAttribute('data-rr-dl') === '1') return;
    modal.setAttribute('data-rr-dl', '1');
    var html = modal.innerHTML;
    html = html
      .replace(/2025년 법령 데이터 다운로드/g, '2026년 법령 데이터 다운로드')
      .replace(/2025년 시행법령 전체 데이터/g, '2026년 법령 데이터')
      .replace(/2,971/g, '7,423')
      .replace(/총 법령/g, '현행+예정 건')
      .replace(/1,716/g, '2,468')
      .replace(/>현행</g, '>현행(2026 시행)<')
      .replace(/213/g, '4,955')
      .replace(/>예정</g, '>시행예정<')
      .replace(/1,042/g, '207')
      .replace(/연혁/g, '당사 적용')
      .replace(/2025년 시행법령 전체 \(Excel\)/g, '2026년 전체 법령 (현행 2,468 + 시행예정 4,955)')
      .replace(/2,971개 법령 · 상태별\/월별\/부처별 통계 포함 · 약 2MB/g, '시행일 2026-01-01~12-31 · 2026-09-15 조회')
      .replace(/2025년 시행법령 전체 \(JSON\)/g, '당사 매칭 개정 결과 (Excel)')
      .replace(/원본 데이터 · API 연동 가능 · 상세 메타데이터 포함/g, '207개와 100% 일치하는 2026년 개정 건');
    modal.innerHTML = html;
    modal.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (/2025_laws_complete|laws_2025_complete/.test(href)) {
        a.removeAttribute('href');
        a.addEventListener('click', function (ev) { ev.preventDefault(); downloadAll(); });
      } else if (/index\.json|matched_laws/.test(href)) {
        a.removeAttribute('href');
        a.addEventListener('click', function (ev) { ev.preventDefault(); downloadMatched(); });
      } else if (/base_laws/.test(href)) {
        a.removeAttribute('href');
        a.addEventListener('click', function (ev) { ev.preventDefault(); downloadBase(); });
      }
    });
  }
  function patchFns() {
    window.downloadAllLaws = downloadAll;
    window.downloadMatchedLaws = downloadMatched;
    window.downloadBaseLaws = downloadBase;
    var origOpen = window.openDataDownload;
    window.openDataDownload = function () {
      if (origOpen) origOpen();
      restyle(document.getElementById('dataDownloadModal'));
    };
    var orig2 = window.openDownloadModal;
    window.openDownloadModal = function () {
      if (orig2) orig2();
      restyle(document.getElementById('download-modal'));
    };
  }
  var n = 0;
  var t = setInterval(function () {
    patchFns();
    if (++n > 40) clearInterval(t);
  }, 250);
})();
