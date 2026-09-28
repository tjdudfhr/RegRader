/* 분기별 엑셀 다운로드 재작성.
 *
 * 예전 downloadQuarterlyExcel 은 옛 lawsData 의 amendments[0].reason 을 읽어
 * parseAmendmentText 로 쪼갰다. 그 reason 은 "○○법이(가) 2026년 …부터 시행됩니다"
 * 같은 자동 생성 문구라서, 실제로 받아보면
 *   개정법률조항 = 327건 전부 빈칸
 *   개정사유     = 자동 문구
 *   주요 개정내용 = "다. 직접 의무가 바뀌는지 원문 조문을 확인하세요."
 * 만 들어 있었다.
 *
 * 팝업이 쓰는 법제처 원문 데이터(window.__rrItems 의 item.brief)를 그대로 쓰고,
 * 엑셀에 맞게 길이를 줄여서 넣는다.
 *
 * 대응 현황(tracker.js)의 엑셀도 이 양식을 쓴다 — window.rrExcel.build().
 */
(function () {
  var AUTO = /원문·신구비교에서 변경 조문을 확인|직접 의무가 바뀌는지 원문 조문을 확인|본 법령의 조문·절차가 바뀝니다|다른 법령 개정에 따른 인용·용어 정비입니다/;

  function flat(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  /* 문장 끝에서 자른다. 한국어 법령문은 '…함.' '…한다.' '…음.' 으로 끝난다. */
  function clip(s, n) {
    s = flat(s);
    if (s.length <= n) return s;
    var cut = s.slice(0, n);
    var m = cut.match(/^[\s\S]*[.。]\s/);
    if (m && m[0].length > n * 0.5) return m[0].trim();
    return cut.replace(/\S*$/, '').trim() + '…';
  }

  /* 주요내용을 항목 단위로 줄인다. 항목이 안 나뉘어 있으면 '가. 나. 다.' 로 쪼갠다. */
  function digest(text, maxItems, perItem, budget) {
    var raw = String(text || '').split('\n').map(flat).filter(Boolean);
    if (raw.length === 1 && raw[0].length > 200) {
      var parts = raw[0].split(/(?=(?:^|\s)[가-하]\.\s)/).map(flat).filter(Boolean);
      if (parts.length > 1) raw = parts;
    }
    var out = [], used = 0;
    for (var i = 0; i < raw.length && out.length < maxItems; i++) {
      var line = clip(raw[i], perItem);
      if (!line) continue;
      if (used + line.length > budget && out.length) break;
      out.push(/^[가-하]\.\s/.test(line) ? line : '· ' + line);
      used += line.length;
    }
    if (raw.length > out.length) out.push('… 외 ' + (raw.length - out.length) + '개 항목 (사이트 팝업에서 전문 확인)');
    return out.join('\n');
  }

  /* 개정이유 원문은 '…신설하고, …확대하며, …금지하며,' 처럼 연결어미로 죽 이어진다.
     그대로 한 칸에 넣으면 벽 같은 글이라, 연결어미 뒤에서 끊어 항목으로 만든다. */
  function bulletize(s, minLen) {
    s = flat(s);
    if (s.length < minLen) return s;
    var parts = s.replace(/((?:하고|하며|하되|되며|으며|이며|되고|짓고|두고),)\s+/g, '$1\u0001')
                 .split('\u0001').map(flat).filter(Boolean);
    if (parts.length < 2) return s;
    return parts.map(function (p) { return '· ' + p; }).join('\n');
  }

  /* 타법개정: 원인 법령과 이 법에서 실제로 바뀐 문장을 보여준다. */
  function otherCause(x) {
    if (!x || !x.cause) return '';
    return '「' + x.cause + '」' + (x.no ? ' ' + x.no : '');
  }
  function otherBody(x) {
    if (!x) return '';
    if (x.mode === 'rename' && x.subs && x.subs.length) {
      var pairs = x.subs.slice(0, 8).map(function (p) { return '· ' + p[0] + ' → ' + p[1]; });
      if (x.subs.length > 8) pairs.push('… 외 ' + (x.subs.length - 8) + '개');
      return pairs.join('\n') +
        '\n※ ' + (x.arts || 0) + '개 조문에 반영 · 용어·부처명 정비로 실질 의무 변화는 없습니다.';
    }
    var body = (x.body || []).slice(0, 8).map(function (b) { return '· ' + clip(b, 180); });
    if ((x.body || []).length > 8) body.push('… 외 ' + (x.body.length - 8) + '개 조문');
    return body.join('\n');
  }

  /* 대응 칸: 조치 내용은 사이트 '대응 현황'(tracker.js)에서만 입력한다.
     로그인해 있으면 그 기록으로 채우고, 아니면 빈칸이다 (공개 사이트라 기록은 로그인해야 보인다). */
  var STATUSES = ['미검토', '검토중', '조치필요', '조치완료', '해당없음'];
  var ST_STYLE = {
    '미검토': ['FFF1F3F6', 'FF6B7280'], '검토중': ['FFE8EEFC', 'FF3056D3'], '조치필요': ['FFFDEEE3', 'FFC2571A'],
    '조치완료': ['FFE3F4EA', 'FF1F7A45'], '해당없음': ['FFF1F3F6', 'FF8A93A3']
  };

  function kst(d) { return new Date((d || new Date()).toLocaleString('en-US', { timeZone: 'Asia/Seoul' })); }
  function kstToday() { var k = kst(); return k.getFullYear() + '-' + String(k.getMonth() + 1).padStart(2, '0') + '-' + String(k.getDate()).padStart(2, '0'); }
  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var k = kst(d);
    return (k.getMonth() + 1) + '/' + k.getDate() + ' ' + String(k.getHours()).padStart(2, '0') + ':' + String(k.getMinutes()).padStart(2, '0');
  }
  function pct(a, n) { return n ? Math.round(a / n * 100) : 0; }

  function context() {
    var t = window.rrTracker, s = t && t.snapshot ? t.snapshot() : null;
    if (!s || !t.keyOf) return null;
    var M = s.members || [], resp = s.resp || {};
    var nameOf = function (m) { return m.name || String(m.email || '').split('@')[0]; };
    return {
      resp: resp, keyOf: t.keyOf, jobOf: t.jobOf,
      owner: function (it) { var j = t.jobOf(it); return M.filter(function (x) { return x.job === j && x.role !== 'admin'; }).map(nameOf).join(', '); },
      who: function (e) { var m = M.filter(function (x) { return x.email === e; })[0]; return m ? nameOf(m) : String(e || '').split('@')[0]; },
      statusOf: function (it) { var r = resp[t.keyOf(it)]; return (r && r.status) || '미검토'; }
    };
  }

  function rowFor(item, no, ctx) {
    var br = item.brief || {};
    var x = br.x;
    var isOther = !!(x && x.cause);

    var gist, contents;
    if (isOther) {
      gist = otherCause(x) + ' 개정에 따른 정비';
      if (br.why) gist += '\n(원인 법령 개정이유) ' + clip(br.why, 220);
      contents = otherBody(x);
    } else {
      gist = br.summaryShort || item.summary || '';
      var w = br.what || '';
      if (w && !AUTO.test(w)) contents = digest(w, 6, 220, 1100);
      else if (br.why) contents = bulletize(clip(br.why, 900), 260);  // 이유·내용 통합형은 원문이 곧 내용
      else contents = '';
    }

    var r = ctx ? (ctx.resp[ctx.keyOf(item)] || {}) : {};
    return {
      no: no,
      category: (item.categories || []).join(', '),
      effectiveDate: item.effectiveDate || '',
      lawName: item.title || '',
      lawType: item.lawType || '',
      kind: item.amendmentType || '',
      ministry: (item.ministry || '').replace(/,/g, ', '),
      gist: flat(gist).length > 400 ? clip(gist, 400) : gist,
      contents: contents,
      clause: ((br.changedArticles && br.changedArticles.length ? br.changedArticles : br.articles) || []).join(', '),
      cause: isOther ? otherCause(x) : '',
      link: (item.source && item.source.url) || '',
      person: ctx ? ctx.owner(item) : '',
      status: ctx ? (r.status || '미검토') : '',
      impact: r.impact || '',
      action: r.action || '',
      due: r.due_date || '',
      doneDate: r.done_date || '',
      evidence: r.evidence_url || '',
      updated: r.updated_at ? ctx.who(r.updated_by) + ' ' + when(r.updated_at) : ''
    };
  }

  var COLS = [
    { header: '순번', key: 'no', width: 6 },
    { header: '직무분류', key: 'category', width: 13 },
    { header: '시행일자', key: 'effectiveDate', width: 12 },
    { header: '법령명', key: 'lawName', width: 34 },
    { header: '법령종류', key: 'lawType', width: 10 },
    { header: '개정구분', key: 'kind', width: 10 },
    { header: '소관부처', key: 'ministry', width: 18 },
    { header: '개정요지', key: 'gist', width: 48 },
    { header: '주요 개정내용', key: 'contents', width: 62 },
    { header: '개정 조항', key: 'clause', width: 24 },
    { header: '원인 법령(타법개정)', key: 'cause', width: 24 },
    { header: '법제처 원문', key: 'link', width: 13 },
    /* 13열부터 대응 칸 — 사이트 '대응 현황'과 같은 항목 */
    { header: '담당자', key: 'person', width: 11 },
    { header: '상태', key: 'status', width: 10 },
    { header: '영향도', key: 'impact', width: 8 },
    { header: '조치 내용', key: 'action', width: 36 },
    { header: '조치 기한', key: 'due', width: 12 },
    { header: '완료일', key: 'doneDate', width: 12 },
    { header: '증빙', key: 'evidence', width: 9 },
    { header: '최종 수정', key: 'updated', width: 16 }
  ];
  var RESP_COL = 13;
  var WRAP = { 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 16: 1 };   // 줄바꿈 표시할 열
  var CAT_BG = {
    '인사노무': 'FFE8F5E9', '공정거래': 'FFFFF3E0', '정보보호': 'FFE3F2FD',
    '지식재산권': 'FFF3E5F5', '재무회계': 'FFFFF8E1', '안전': 'FFFFEBEE',
    '환경': 'FFE0F2F1', '지배구조': 'FFEDE7F6'
  };
  var THIN = { style: 'thin', color: { argb: 'FFE0E0E0' } };

  function styleHeader(ws) {
    var r = ws.getRow(1);
    r.height = 30;
    r.eachCell(function (cell) {
      cell.font = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: THIN, left: THIN, bottom: { style: 'medium', color: { argb: 'FF2C3E50' } }, right: THIN };
    });
  }

  function buildDetail(wb, name, items, ctx) {
    var ws = wb.addWorksheet(name, { views: [{ state: 'frozen', xSplit: 4, ySplit: 1 }] });
    ws.columns = COLS;
    styleHeader(ws);
    ws.getRow(1).eachCell(function (cell, c) {
      if (c < RESP_COL) return;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3056D3' } };
      cell.border = { top: THIN, left: THIN, bottom: { style: 'medium', color: { argb: 'FF3056D3' } }, right: THIN };
    });
    var today = kstToday();
    var WIDTH = {};
    COLS.forEach(function (c) { WIDTH[c.key] = c.width; });

    items.forEach(function (item, i) {
      var d = rowFor(item, i + 1, ctx);
      var row = ws.addRow(d);
      var cat = (item.categories || [])[0] || '';
      var bg = CAT_BG[cat] || (i % 2 ? 'FFFFFFFF' : 'FFF8F9FA');
      var late = d.due && d.due < today && d.status !== '조치완료' && d.status !== '해당없음';

      var lines = 1;
      ['gist', 'contents', 'clause', 'cause', 'lawName', 'action'].forEach(function (k) {
        var n = 0;
        String(d[k] || '').split('\n').forEach(function (l) { n += Math.max(1, Math.ceil(l.length / (WIDTH[k] * 1.35))); });
        if (n > lines) lines = n;
      });
      row.height = Math.max(26, Math.min(lines * 15 + 8, 320));

      row.eachCell({ includeEmpty: true }, function (cell, c) {
        cell.font = { name: '맑은 고딕', size: 10 };
        cell.border = { top: THIN, left: THIN, bottom: THIN, right: THIN };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c >= RESP_COL ? 'FFFFFFFF' : bg } };
        if (c === 1 || c === 3 || c === 5 || c === 6) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (c === 2) {
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.font = { name: '맑은 고딕', size: 10, bold: true };
        } else if (c === 4) {
          cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
          cell.font = { name: '맑은 고딕', size: 10, bold: true };
        } else if (c === 12 || c === 19) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          var url = c === 12 ? d.link : d.evidence;
          if (url) {
            cell.value = { text: c === 12 ? '원문 보기' : '링크', hyperlink: url };
            cell.font = { name: '맑은 고딕', size: 10, color: { argb: 'FF1565C0' }, underline: true };
          }
        } else if (c === 14 && ST_STYLE[d.status]) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ST_STYLE[d.status][0] } };
          cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: ST_STYLE[d.status][1] } };
        } else if (WRAP[c]) {
          cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          if (c === 17 && late) cell.font = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFD32F2F' } };
        }
      });
    });

    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: items.length + 1, column: COLS.length } };
    return ws;
  }

  function buildSummary(wb, title, items, ctx) {
    var ws = wb.addWorksheet('요약', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
      { header: '구분', key: 'k', width: 16 },
      { header: '항목', key: 'a', width: 26 },
      { header: '건수', key: 'n', width: 10 },
      { header: '비고', key: 'b', width: 64 }
    ];
    styleHeader(ws);

    function tally(pick) {
      var m = {};
      items.forEach(function (it) {
        var ks = pick(it);
        (Array.isArray(ks) ? ks : [ks]).forEach(function (k) { if (k) m[k] = (m[k] || 0) + 1; });
      });
      return Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }).map(function (k) { return [k, m[k]]; });
    }

    var blocks = [
      ['전체', [[title, items.length]], '시행일 기준'],
      ['개정구분', tally(function (it) { return it.amendmentType; }), ''],
      ['직무분류', tally(function (it) { return it.categories || []; }), '한 법령이 여러 직무에 걸칠 수 있어 합계가 전체와 다를 수 있음'],
      ['법령종류', tally(function (it) { return it.lawType; }), ''],
      ['시행월', tally(function (it) { return (it.effectiveDate || '').slice(0, 7); }), ''],
      ['소관부처', tally(function (it) { return (it.ministry || '').split(',')[0].trim(); }).slice(0, 12), '상위 12개']
    ];

    if (ctx) {
      var today = kstToday();
      var open = function (it) { var s = ctx.statusOf(it); return s !== '조치완료' && s !== '해당없음'; };
      var lateOf = function (list) { return list.filter(function (it) { return open(it) && it.effectiveDate < today; }).length; };
      var count = function (list) { var c = {}; list.forEach(function (it) { var s = ctx.statusOf(it); c[s] = (c[s] || 0) + 1; }); return c; };
      var byJob = {};
      items.forEach(function (it) { var j = ctx.jobOf(it); (byJob[j] = byJob[j] || []).push(it); });
      var tc = count(items);
      blocks.splice(1, 0,
        ['대응 상태', STATUSES.map(function (s) { return [s, tc[s] || 0]; }).concat([['시행 후 미처리', lateOf(items)]]),
          '검토 완료 ' + pct((tc['조치완료'] || 0) + (tc['해당없음'] || 0), items.length) + '% · 사이트 대응 현황 ' + today + ' 기준'],
        ['직무별 대응', Object.keys(byJob).map(function (j) {
          var l = byJob[j], c = count(l), o = ctx.owner(l[0]), lt = lateOf(l);
          var rest = ['조치필요', '검토중', '미검토'].filter(function (s) { return c[s]; }).map(function (s) { return s + ' ' + c[s]; });
          if (lt) rest.push('시행 후 미처리 ' + lt);
          return [j + (o ? ' · ' + o : ''), l.length,
            '검토 완료 ' + pct((c['조치완료'] || 0) + (c['해당없음'] || 0), l.length) + '%' + (rest.length ? ' · ' + rest.join(' · ') : '')];
        }), '']
      );
    }

    blocks.forEach(function (b) {
      b[1].forEach(function (p, i) {
        var r = ws.addRow({ k: i === 0 ? b[0] : '', a: p[0], n: p[1], b: p[2] != null ? p[2] : (i === 0 ? b[2] : '') });
        r.eachCell({ includeEmpty: true }, function (cell, c) {
          cell.font = { name: '맑은 고딕', size: 10, bold: c === 1 };
          cell.border = { top: THIN, left: THIN, bottom: THIN, right: THIN };
          cell.alignment = c === 3 ? { horizontal: 'center' } : { horizontal: 'left', vertical: 'middle', wrapText: c === 4 };
        });
      });
      ws.addRow({});
    });
    return ws;
  }

  /* 분기별·대응 현황 엑셀이 같이 쓰는 한 가지 양식 */
  async function build(o) {
    if (typeof ExcelJS === 'undefined') { alert('엑셀 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도하세요.'); return; }
    var items = (o.items || []).slice().sort(function (a, b) {
      var ca = (a.categories || [])[0] || '힣', cb = (b.categories || [])[0] || '힣';
      if (ca !== cb) return ca.localeCompare(cb, 'ko-KR');
      if (a.effectiveDate !== b.effectiveDate) return a.effectiveDate < b.effectiveDate ? -1 : 1;
      return String(a.title || '').localeCompare(String(b.title || ''), 'ko-KR');
    });
    if (!items.length) { alert(o.empty || '내려받을 법령이 없습니다.'); return; }

    try {
      var ctx = context();
      var wb = new ExcelJS.Workbook();
      wb.creator = 'RegRader';
      wb.created = new Date();
      buildDetail(wb, o.sheet, items, ctx);
      buildSummary(wb, o.title, items, ctx);

      var buf = await wb.xlsx.writeBuffer();
      var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = o.file.replace('{date}', kstToday().replace(/-/g, ''));
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    } catch (e) {
      console.error('Excel download error:', e);
      alert('엑셀 생성 중 오류: ' + e.message);
    }
  }
  window.rrExcel = { build: build };

  var Q = {
    Q1: { months: [1, 2, 3], name: '1분기 (1~3월)', short: '1분기' },
    Q2: { months: [4, 5, 6], name: '2분기 (4~6월)', short: '2분기' },
    Q3: { months: [7, 8, 9], name: '3분기 (7~9월)', short: '3분기' },
    Q4: { months: [10, 11, 12], name: '4분기 (10~12월)', short: '4분기' }
  };

  window.downloadQuarterlyExcel = function (quarter, event) {
    if (event && event.stopPropagation) event.stopPropagation();
    var info = Q[quarter];
    if (!info) { alert('잘못된 분기 정보입니다.'); return; }
    var all = window.__rrItems || window.lawsData || [];
    var items = all.filter(function (it) {
      var d = it.effectiveDate || '';
      if (d.slice(0, 4) !== String(window.RR_YEAR)) return false;
      return info.months.indexOf(parseInt(d.slice(5, 7), 10)) >= 0;
    });
    return build({
      items: items, sheet: info.name, title: window.RR_YEAR + '년 ' + info.name,
      file: window.RR_YEAR + '_' + info.short + '_법령개정_{date}.xlsx', empty: '해당 분기에 개정 법령이 없습니다.'
    });
  };
})();
