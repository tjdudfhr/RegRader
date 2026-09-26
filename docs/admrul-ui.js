/* 행정규칙 탭: 적용법규 계열에 연결된 고시·훈령·예규 등의 올해 개정
 *   admrul_events.json      올해 시행되는 개정 (scripts/admin_rules.py, 매일 갱신)
 *   admrul_candidates.json  모니터링 대상 전체 (scripts/law_families.py) — '대상 목록'을 펼칠 때만 받는다
 * '참고'(정부 내부 사무·기관별 개인정보 지침·위원회 운영·특정 지역 대상 등)는 기본으로 접어 둔다.
 */
(function () {
  var DATA = null, CAND = null, charts = {};
  var S = { job: 'all', kind: 'all', ref: false, q: '' };
  var KINDS = ['고시', '훈령', '예규', '공고'];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dataPath(f) { return window.rrDataPath ? window.rrDataPath(f) : './' + f; }
  function color(c) { return window.rrCatColor ? window.rrCatColor(c) : '#667eea'; }
  function order() { return window.RR_CAT_ORDER || ['재무회계', '인사노무', '환경', '지식재산권', '공정거래', '안전', '지배구조', '정보보호']; }
  function today() {
    var k = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    return new Date(k.getFullYear(), k.getMonth(), k.getDate());
  }
  function days(d) { return Math.round((new Date(d + 'T00:00:00') - today()) / 86400000); }
  function link(x) { return 'https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=' + encodeURIComponent(x.q); }
  function job(x) { return (x.c || [])[0] || '기타'; }
  function kindOf(x) { return KINDS.indexOf(x.k) >= 0 ? x.k : '기타'; }

  function load() {
    return fetch(dataPath('admrul_events.json') + '?v=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { DATA = j || { items: [] }; })
      .catch(function () { DATA = { items: [] }; });
  }

  function pool() {
    return (DATA.items || []).filter(function (x) {
      if (!S.ref && x.g) return false;
      if (S.job !== 'all' && (x.c || []).indexOf(S.job) < 0) return false;
      if (S.kind !== 'all' && kindOf(x) !== S.kind) return false;
      if (S.q) {
        var hay = (x.t + ' ' + x.m + ' ' + (x.f || []).join(' ') + ' ' + x.k).toLowerCase();
        if (hay.indexOf(S.q) < 0) return false;
      }
      return true;
    });
  }

  function row(x) {
    var d = days(x.d);
    var dd = d < 0 ? '<span class="rr-dd done">시행</span>' : d === 0 ? '<span class="rr-dd hot">D-DAY</span>' : '<span class="rr-dd ' + (d <= 30 ? 'hot' : 'later') + '">D-' + d + '</span>';
    var isNew = /제정/.test(x.a) && !/폐지/.test(x.a);
    return '<a class="rr-adm-row" href="' + esc(link(x)) + '" target="_blank" rel="noopener" title="국가법령정보센터에서 원문 보기 (새 창)">' +
      '<span class="rr-adm-date">' + esc(x.d.slice(5).replace('-', '.')) + '</span>' + dd +
      '<span class="rr-adm-title"><span class="t">' + esc(x.t) + '</span>' +
        '<span class="rr-adm-k">' + esc(x.k) + '</span>' + (isNew ? '<span class="rr-adm-k new">제정</span>' : '') +
        (x.a && !isNew && x.a !== '일부개정' ? '<span class="rr-adm-k">' + esc(x.a) + '</span>' : '') +
        (x.g ? '<span class="rr-adm-k ref" title="회사 준수사항과 거리가 멀어 참고용으로 분류">참고</span>' : '') + '</span>' +
      '<span class="rr-adm-meta"><i style="background:' + color(job(x)) + '"></i>' + esc(job(x)) + ' · ' + esc((x.f || [])[0] || '') + ' · ' + esc(x.m) + '</span>' +
      '</a>';
  }

  function tiles(list) {
    var up = list.filter(function (x) { return days(x.d) >= 0; }).length;
    var recent = list.filter(function (x) { var d = days(x.d); return d < 0 && d >= -30; }).length;
    var made = list.filter(function (x) { return /제정/.test(x.a) && !/폐지/.test(x.a); }).length;
    var ids = {};
    list.forEach(function (x) { ids[x.id] = 1; });
    return [
      ['올해 개정', list.length, '행정규칙 ' + Object.keys(ids).length + '개'],
      ['최근 30일 시행', recent, '지난 30일 동안 시행'],
      ['시행 예정', up, up ? '오늘 이후 시행' : '행정규칙은 대부분 발령일에 바로 시행'],
      ['신규 제정', made, '새로 만들어진 행정규칙']
    ].map(function (t, i) {
      return '<div class="rr-job-tile' + (i === 2 && t[1] ? ' hot' : '') + '"><span>' + t[0] + '</span><b>' + t[1] + '</b><small>' + t[2] + '</small></div>';
    }).join('');
  }

  function split(list, key, labels) {
    var n = {};
    list.forEach(function (x) { var k = key(x); n[k] = (n[k] || 0) + 1; });
    var keys = labels.filter(function (k) { return n[k]; }).concat(Object.keys(n).filter(function (k) { return labels.indexOf(k) < 0; }));
    var total = list.length || 1;
    var R = (window.rrChartKit ? window.rrChartKit.ramp() : ['#32379a', '#4a57cf', '#6a79e2', '#8f9bec']).concat(['#a0aec0', '#cbd5e0']);
    return '<div class="rr-an-split">' + keys.map(function (k, i) {
      return '<span style="flex:' + n[k] + ';background:' + R[i % R.length] + '" title="' + esc(k) + ' ' + n[k] + '건"></span>';
    }).join('') + '</div><div class="rr-an-legend">' + keys.map(function (k, i) {
      return '<div class="rr-an-li"><span class="rr-an-sw" style="background:' + R[i % R.length] + '"></span>' + esc(k) + '<b>' + n[k] + '</b><small>' + Math.round(n[k] / total * 100) + '%</small></div>';
    }).join('') + '</div>';
  }

  function drawCharts(list) {
    if (!window.Chart) return;
    var K = window.rrChartKit, k = K ? K.ink() : { text: '#718096', grid: '#e2e8f0' };
    var year = (DATA && DATA.year) || new Date().getFullYear();
    var jobs = order().filter(function (j) { return list.some(function (x) { return job(x) === j; }); });
    var months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    Object.keys(charts).forEach(function (id) { charts[id].destroy(); });
    charts = {};
    var c1 = document.getElementById('rr-adm-month');
    if (c1) {
      charts.m = new Chart(c1, {
        type: 'bar',
        data: {
          labels: months.map(function (m) { return m + '월'; }),
          datasets: jobs.map(function (j) {
            return { label: j, backgroundColor: color(j), borderRadius: 3, borderSkipped: false, maxBarThickness: 34,
              data: months.map(function (m) { return list.filter(function (x) { return job(x) === j && Number(x.d.slice(5, 7)) === m; }).length; }) };
          })
        },
        options: { responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
          scales: { x: { stacked: true, grid: { display: false }, ticks: { color: k.text } }, y: { stacked: true, beginAtZero: true, ticks: { color: k.text, precision: 0 }, grid: { color: k.grid } } },
          plugins: { legend: { position: 'top', align: 'end', labels: { color: k.text, boxWidth: 10, boxHeight: 10 } },
            tooltip: { mode: 'index', filter: function (c) { return c.raw > 0; }, callbacks: { title: function (c) { return year + '년 ' + c[0].label; }, footer: function (cs) { return '합계 ' + cs.reduce(function (a, c) { return a + c.raw; }, 0) + '건'; } } } } }
      });
    }
    var c2 = document.getElementById('rr-adm-min');
    if (c2) {
      var n = {};
      list.forEach(function (x) { var m = (x.m || '').split(',')[0] || '기타'; n[m] = (n[m] || 0) + 1; });
      var mins = Object.keys(n).map(function (m) { return [m, n[m]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
      var R = K ? K.ramp() : ['#667eea'];
      charts.n = new Chart(c2, {
        type: 'bar',
        data: { labels: mins.map(function (m) { return m[0]; }), datasets: [{ data: mins.map(function (m) { return m[1]; }), backgroundColor: R[1] || '#667eea', borderRadius: 4, borderSkipped: 'start', barPercentage: 0.72, maxBarThickness: 22 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 400 }, layout: { padding: { right: 24 } },
          plugins: { legend: { display: false }, rrEndLabels: { color: k.text }, tooltip: { callbacks: { label: function (c) { return ' 개정 ' + c.parsed.x + '건'; } } } },
          scales: K ? K.hbarScales(k, mins[0] ? mins[0][1] : 1) : {} },
        plugins: K ? [K.endLabels] : []
      });
    }
  }

  function listHTML(list) {
    var up = list.filter(function (x) { return days(x.d) >= 0; }).sort(function (a, b) { return a.d.localeCompare(b.d); });
    var past = list.filter(function (x) { return days(x.d) < 0; }).sort(function (a, b) { return b.d.localeCompare(a.d) || a.t.localeCompare(b.t); });
    var h = '';
    if (up.length) h += '<div class="rr-q-month"><div class="rr-q-month-h">시행 예정 <span>' + up.length + '건</span></div>' + up.map(row).join('') + '</div>';
    var byMonth = {};
    past.forEach(function (x) { var m = x.d.slice(0, 7); (byMonth[m] = byMonth[m] || []).push(x); });
    Object.keys(byMonth).sort().reverse().forEach(function (m) {
      h += '<div class="rr-q-month"><div class="rr-q-month-h">' + Number(m.slice(5)) + '월 시행 <span>' + byMonth[m].length + '건</span></div>' + byMonth[m].map(row).join('') + '</div>';
    });
    return h || '<div class="rr-adm-empty">조건에 맞는 개정이 없습니다.</div>';
  }

  function render() {
    var host = document.getElementById('rr-adm');
    if (!host) return;
    if (!DATA) { host.innerHTML = '<div class="rr-adm-empty">불러오는 중…</div>'; load().then(render); return; }
    var all = DATA.items || [];
    var base = all.filter(function (x) { return S.ref || !x.g; });
    var list = pool();
    var jobCount = {};
    base.forEach(function (x) { (x.c || []).forEach(function (j) { jobCount[j] = (jobCount[j] || 0) + 1; }); });
    var refN = all.filter(function (x) { return x.g; }).length;
    var year = DATA.year || '';
    if (!host.dataset.built) {
      host.dataset.built = '1';
      host.innerHTML =
        '<div class="rr-adm-head">' +
          '<div><div class="rr-adm-h1">📜 <span class="rr-year">' + esc(year) + '</span>년 행정규칙 개정 현황</div>' +
          '<div class="rr-adm-sub" id="rr-adm-sub"></div></div>' +
        '</div>' +
        '<div class="rr-an" id="rr-adm-an">' +
          '<div class="rr-adm-filters">' +
            '<div class="rr-adm-chips" id="rr-adm-jobs"></div>' +
            '<div class="rr-adm-row2">' +
              '<div class="rr-adm-seg" id="rr-adm-kinds"></div>' +
              '<label class="rr-adm-ref"><input type="checkbox" id="rr-adm-ref"> 참고용도 보기 <small id="rr-adm-refn"></small></label>' +
              '<input type="search" id="rr-adm-q" placeholder="행정규칙명 · 상위 법령 · 부처 검색">' +
            '</div>' +
          '</div>' +
          '<div class="rr-job-tiles" id="rr-adm-tiles"></div>' +
          '<div class="rr-an-grid">' +
            '<div class="rr-an-card wide"><div class="rr-an-h"><b>월별 시행 · 직무별</b><span>시행일 기준</span></div><div class="rr-an-plot" style="height:230px"><canvas id="rr-adm-month" role="img" aria-label="월별 행정규칙 개정 건수 직무별 누적 막대 차트"></canvas></div></div>' +
            '<div class="rr-an-card"><div class="rr-an-h"><b>종류 · 개정 구분</b><span>고시 · 훈령 · 예규 …</span></div><div id="rr-adm-kind"></div><div id="rr-adm-type"></div></div>' +
            '<div class="rr-an-card"><div class="rr-an-h"><b>소관부처 TOP 8</b><span>개정 건수 기준</span></div><div class="rr-an-plot" style="height:240px"><canvas id="rr-adm-min" role="img" aria-label="소관부처별 행정규칙 개정 건수 가로 막대 차트"></canvas></div></div>' +
          '</div>' +
        '</div>' +
        '<div class="rr-an" id="rr-adm-listbox">' +
          '<div class="rr-q-listhead"><div class="filter-title">📋 행정규칙 개정 목록</div><span class="cnt" id="rr-adm-count"></span>' +
          '<span class="rr-adm-hint">누르면 국가법령정보센터 원문이 새 창으로 열립니다</span></div>' +
          '<div id="rr-adm-list"></div>' +
          '<details class="rr-adm-cands" id="rr-adm-cands"><summary>모니터링 대상 행정규칙 전체 보기</summary><div id="rr-adm-cand-body">불러오는 중…</div></details>' +
        '</div>';
      host.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-job]');
        if (b) { S.job = b.dataset.job; render(); return; }
        var kb = e.target.closest('button[data-kind]');
        if (kb) { S.kind = kb.dataset.kind; render(); }
      });
      host.querySelector('#rr-adm-ref').addEventListener('change', function (e) { S.ref = e.target.checked; render(); });
      host.querySelector('#rr-adm-q').addEventListener('input', function (e) { S.q = e.target.value.trim().toLowerCase(); render(); });
      host.querySelector('#rr-adm-cands').addEventListener('toggle', function (e) { if (e.target.open) renderCandidates(); });
    }
    document.getElementById('rr-adm-sub').innerHTML =
      '적용법규 계열에 국가법령정보센터 법령체계도로 연결된 고시·훈령·예규 등 <b>' + (DATA.candidates || 0).toLocaleString('ko-KR') + '개</b>를 매일 확인합니다 · ' +
      '기관 내부 사무·특정 지역 대상 등은 참고용으로 접어 둡니다 (' + refN + '건)';
    document.getElementById('rr-adm-jobs').innerHTML =
      '<button type="button" data-job="all" class="' + (S.job === 'all' ? 'on' : '') + '">전체 <b>' + base.length + '</b></button>' +
      order().filter(function (j) { return jobCount[j]; }).map(function (j) {
        return '<button type="button" data-job="' + esc(j) + '" class="' + (S.job === j ? 'on' : '') + '"><i style="background:' + color(j) + '"></i>' + esc(j) + ' <b>' + jobCount[j] + '</b></button>';
      }).join('');
    document.getElementById('rr-adm-kinds').innerHTML = ['all'].concat(KINDS, ['기타']).map(function (kd) {
      return '<button type="button" data-kind="' + kd + '" class="' + (S.kind === kd ? 'on' : '') + '">' + (kd === 'all' ? '전체 종류' : kd) + '</button>';
    }).join('');
    document.getElementById('rr-adm-refn').textContent = refN ? '(' + refN + '건)' : '';
    document.getElementById('rr-adm-tiles').innerHTML = tiles(list);
    document.getElementById('rr-adm-kind').innerHTML = split(list, kindOf, KINDS.concat(['기타']));
    document.getElementById('rr-adm-type').innerHTML = split(list, function (x) { return x.a || '기타'; }, ['일부개정', '제정', '전부개정', '타법개정', '폐지제정', '폐지']);
    document.getElementById('rr-adm-count').textContent = list.length + '건';
    document.getElementById('rr-adm-list').innerHTML = listHTML(list);
    drawCharts(list);
    if (document.getElementById('rr-adm-cands').open) renderCandidates();
  }

  function renderCandidates() {
    var body = document.getElementById('rr-adm-cand-body');
    if (!CAND) {
      fetch(dataPath('admrul_candidates.json') + '?v=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : { items: [] }; })
        .then(function (j) { CAND = j.items || []; renderCandidates(); })
        .catch(function () { body.textContent = '대상 목록을 불러오지 못했습니다.'; });
      return;
    }
    var amended = {};
    (DATA.items || []).forEach(function (x) { amended[x.id] = (amended[x.id] || 0) + 1; });
    var list = CAND.filter(function (c) {
      if (!S.ref && c.tag) return false;
      if (S.job !== 'all' && (c.jobs || []).indexOf(S.job) < 0) return false;
      if (S.kind !== 'all' && (KINDS.indexOf(c.kind) >= 0 ? c.kind : '기타') !== S.kind) return false;
      if (S.q && (c.name + ' ' + (c.links || []).join(' ')).toLowerCase().indexOf(S.q) < 0) return false;
      return true;
    });
    body.innerHTML = '<div class="rr-adm-cnote">' + list.length.toLocaleString('ko-KR') + '개 (위 직무·종류·검색 조건 적용) · 이름을 누르면 원문</div>' +
      '<div class="rr-adm-ctable"><table><thead><tr><th>행정규칙</th><th>종류</th><th>연결된 법령</th><th>현행 시행일</th><th>올해</th></tr></thead><tbody>' +
      list.slice(0, 400).map(function (c) {
        var ef = String(c.effective || '');
        return '<tr><td><a href="https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=' + esc(c.seq) + '" target="_blank" rel="noopener">' + esc(c.name) + '</a>' +
          (c.tag ? ' <span class="rr-adm-k ref">참고 · ' + esc(c.tag) + '</span>' : '') + '</td><td>' + esc(c.kind) + '</td><td>' + esc((c.links || []).slice(0, 2).join(', ')) + ((c.links || []).length > 2 ? ' 외' : '') +
          '</td><td>' + (ef.length === 8 ? ef.slice(0, 4) + '-' + ef.slice(4, 6) + '-' + ef.slice(6) : '') + '</td><td>' + (amended[c.id] ? '<b>' + amended[c.id] + '건</b>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' + (list.length > 400 ? '<div class="rr-adm-cnote">앞의 400개만 표시합니다. 검색으로 좁혀 보세요.</div>' : '');
  }

  /* 탭을 열 때 그린다 (숨겨진 상태에서 그리면 차트 크기가 0) */
  function hook() {
    if (typeof window.switchMainTab !== 'function' || window.switchMainTab.__adm) return;
    var orig = window.switchMainTab;
    window.switchMainTab = function (t) {
      var r = orig.apply(this, arguments);
      if (t === 'admrul') setTimeout(render, 60);
      return r;
    };
    window.switchMainTab.__adm = true;
  }
  var n = 0, t = setInterval(function () { hook(); if (++n > 40) clearInterval(t); }, 250);
  load().then(function () {
    var pane = document.getElementById('admrul-content');
    if (pane && pane.classList.contains('active')) render();
  });

  var st = document.createElement('style');
  st.textContent = [
    '.rr-adm-head { background:var(--bg-glass); backdrop-filter:blur(20px); border:1px solid var(--glass-border); border-radius:16px; padding:1.2rem 1.5rem; margin-bottom:1.25rem; box-shadow:var(--glass-shadow); }',
    '.rr-adm-h1 { font-size:1.3rem; font-weight:800; color:var(--text-primary); }',
    '.rr-adm-sub { font-size:.85rem; color:var(--text-muted); margin-top:.3rem; line-height:1.55; }',
    '.rr-adm-sub b { color:var(--text-primary); }',
    '.rr-adm-filters { display:flex; flex-direction:column; gap:.6rem; margin-bottom:.4rem; }',
    '.rr-adm-chips { display:flex; flex-wrap:wrap; gap:.4rem; }',
    '.rr-adm-chips button, .rr-adm-seg button { border:1px solid var(--border); background:var(--bg-card); color:var(--text-secondary); border-radius:999px; padding:.35rem .8rem; font:inherit; font-size:.82rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:.35rem; }',
    '.rr-adm-chips button i { width:9px; height:9px; border-radius:3px; }',
    '.rr-adm-chips button b { color:var(--text-muted); font-weight:700; }',
    '.rr-adm-chips button.on, .rr-adm-seg button.on { border-color:var(--primary); background:rgba(102,126,234,.12); color:var(--text-primary); }',
    '.rr-adm-row2 { display:flex; flex-wrap:wrap; gap:.6rem; align-items:center; }',
    '.rr-adm-seg { display:flex; flex-wrap:wrap; gap:.3rem; }',
    '.rr-adm-seg button { border-radius:8px; padding:.3rem .65rem; font-size:.78rem; }',
    '.rr-adm-ref { font-size:.82rem; color:var(--text-secondary); display:inline-flex; align-items:center; gap:.35rem; cursor:pointer; }',
    '.rr-adm-ref small { color:var(--text-muted); }',
    '#rr-adm-q { margin-left:auto; min-width:240px; padding:.5rem .8rem; border-radius:10px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-primary); font:inherit; font-size:.86rem; }',
    '.rr-adm-hint { margin-left:auto; font-size:.76rem; color:var(--text-muted); }',
    '.rr-adm-row { display:grid; grid-template-columns:52px 58px minmax(0,1.4fr) minmax(0,1.3fr); align-items:center; gap:.7rem; padding:.6rem .8rem; margin:0 0 .35rem; border:1px solid var(--border); border-radius:10px; background:var(--bg-card); color:var(--text-primary); text-decoration:none; transition:transform .15s ease, box-shadow .15s ease; }',
    '.rr-adm-row:hover { transform:translateY(-1px); box-shadow:0 6px 16px rgba(31,38,135,.10); border-color:rgba(102,126,234,.45); }',
    '.rr-adm-date { font-size:.82rem; color:var(--text-muted); font-variant-numeric:tabular-nums; }',
    '.rr-adm-title { display:flex; align-items:center; gap:.35rem; min-width:0; font-weight:700; font-size:.9rem; }',
    '.rr-adm-title .t { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }',
    '.rr-adm-k { flex:none; font-size:.68rem; font-weight:800; padding:.05rem .45rem; border-radius:6px; background:var(--bg-primary); border:1px solid var(--border); color:var(--text-secondary); }',
    '.rr-adm-k.new { color:#2b6cb0; background:rgba(66,153,225,.12); border-color:transparent; }',
    '.rr-adm-k.ref { color:var(--text-muted); border-style:dashed; }',
    '.rr-adm-meta { font-size:.76rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:.3rem; }',
    '.rr-adm-meta i { width:8px; height:8px; border-radius:2px; flex:none; }',
    '.rr-adm-empty { padding:2rem; text-align:center; color:var(--text-muted); }',
    '.rr-adm-cands { margin-top:1rem; font-size:.85rem; }',
    '.rr-adm-cands summary { cursor:pointer; color:var(--primary); font-weight:700; }',
    '.rr-adm-cnote { margin:.5rem 0; font-size:.78rem; color:var(--text-muted); }',
    '.rr-adm-ctable { max-height:420px; overflow:auto; border:1px solid var(--border); border-radius:10px; }',
    '.rr-adm-ctable table { width:100%; border-collapse:collapse; font-size:.8rem; }',
    '.rr-adm-ctable th, .rr-adm-ctable td { text-align:left; padding:.4rem .6rem; border-bottom:1px solid var(--border); color:var(--text-secondary); vertical-align:top; }',
    '.rr-adm-ctable th { position:sticky; top:0; background:var(--bg-card); color:var(--text-muted); font-weight:700; }',
    '.rr-adm-ctable a { color:var(--text-primary); text-decoration:none; font-weight:600; }',
    '.rr-adm-ctable a:hover { color:var(--primary); text-decoration:underline; }',
    '@media (max-width: 900px) { .rr-adm-row { grid-template-columns:48px 54px minmax(0,1fr); } .rr-adm-meta { grid-column:3; } #rr-adm-q { margin-left:0; min-width:0; flex:1; } }'
  ].join('\n');
  document.head.appendChild(st);
})();
