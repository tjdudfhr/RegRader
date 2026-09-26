/* 헤더 ✉ 버튼: 메일로 공유
 *
 * 예전 방식은 법령 목록 전체를 mailto: 주소에 넣어 메일 앱을 열었다.
 * 335건이면 주소가 8만 자가 넘어 Outlook 등에서 본문이 잘리거나 아예 열리지 않았고,
 * 미리보기에는 법령명이 빠져 있었다 (없는 필드 lawName 을 읽음).
 *
 * 지금 방식:
 *  1) 범위(30일 이내 / 시행예정 / 분기 / 올해 전체)와 직무를 고른다
 *  2) [메일 작성] -> 표 형식 본문을 클립보드에 복사하고, 받는 사람·제목만 채운 메일 앱을 연다
 *  3) 메일 본문 칸에 붙여 넣으면(Ctrl+V / ⌘V) 표가 그대로 들어간다
 * 사이트는 서버가 없는 정적 페이지라 직접 메일을 보내지 못한다. 보내는 것은 각자의 메일 앱이다.
 */
(function () {
  var SITE = 'https://tjdudfhr.github.io/RegRader/';
  var LS_TO = 'rr_mail_to';
  var state = { range: 'upcoming', jobs: null };

  function items() { return window.__rrItems || window.lawsData || []; }
  function order() { return window.RR_CAT_ORDER || ['재무회계', '인사노무', '환경', '지식재산권', '공정거래', '안전', '지배구조', '정보보호']; }
  function color(c) { return window.rrCatColor ? window.rrCatColor(c) : '#667eea'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function jobOf(it) { return (it.categories || [])[0] || '기타'; }
  function days(it) {
    if (typeof it.daysUntil === 'number') return it.daysUntil;
    var k = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    var t = new Date(k.getFullYear(), k.getMonth(), k.getDate());
    return Math.round((new Date(it.effectiveDate + 'T00:00:00') - t) / 86400000);
  }
  function dday(d) { return d < 0 ? '시행완료' : d === 0 ? 'D-DAY' : 'D-' + d; }
  function link(it) {
    var adm = (it.meta && it.meta.admRulSeq) || '';
    if (adm) return 'https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=' + adm;   /* 행정규칙 */
    var seq = (it.meta && it.meta.lsiSeq) || '';
    if (seq) return 'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=' + seq + '&efYd=' + String(it.effectiveDate || '').replace(/-/g, '');
    return (it.source && it.source.url) || SITE;
  }
  /* 벌칙·과태료 등 개정 표시 (amend-ui.js). 메일에는 글자로 넣는다. */
  function tags(it) {
    var A = window.rrAmend;
    if (!A) return [];
    return A.codes(it).map(function (c) { return (A.META[c] && A.META[c].label) || c; });
  }
  function year() { return window.RR_YEAR || new Date().getFullYear(); }
  function todayStr() { return new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }); }

  var RANGES = [
    { id: 'd30', label: '30일 이내', test: function (it) { var d = days(it); return d >= 0 && d <= 30; } },
    { id: 'upcoming', label: '시행예정 전체', test: function (it) { return days(it) >= 0; } },
    { id: 'Q1', label: '1분기', test: function (it) { return q(it) === 1; } },
    { id: 'Q2', label: '2분기', test: function (it) { return q(it) === 2; } },
    { id: 'Q3', label: '3분기', test: function (it) { return q(it) === 3; } },
    { id: 'Q4', label: '4분기', test: function (it) { return q(it) === 4; } },
    { id: 'all', label: '올해 전체', test: function () { return true; } }
  ];
  function q(it) { var m = Number(String(it.effectiveDate || '').slice(5, 7)); return m ? Math.ceil(m / 3) : 0; }
  function range() { return RANGES.filter(function (r) { return r.id === state.range; })[0] || RANGES[1]; }
  function inRange() { var r = range(); return items().filter(r.test); }
  function picked() {
    var pool = inRange();
    return pool.filter(function (it) { return !state.jobs || state.jobs.indexOf(jobOf(it)) >= 0; })
      .sort(function (a, b) { return String(a.effectiveDate).localeCompare(String(b.effectiveDate)) || String(a.title).localeCompare(String(b.title)); });
  }
  function jobsIn(list) {
    var seen = {};
    list.forEach(function (it) { seen[jobOf(it)] = (seen[jobOf(it)] || 0) + 1; });
    return order().filter(function (j) { return seen[j]; }).concat(Object.keys(seen).filter(function (j) { return order().indexOf(j) < 0; }))
      .map(function (j) { return { job: j, n: seen[j] }; });
  }
  function jobLabel() {
    if (!state.jobs) return '전체 직무';
    return state.jobs.length <= 3 ? state.jobs.join('·') : state.jobs.length + '개 직무';
  }
  function subject(list) {
    var laws = {};
    list.forEach(function (it) { laws[it.title] = 1; });
    return '[RegRader] ' + year() + '년 법규 개정 알림 — ' + range().label + ' · ' + jobLabel() + ' (' + list.length + '건)';
  }

  /* ---------- 메일 본문 (표 형식 HTML + 일반 텍스트) ---------- */
  function bodyHTML(list) {
    var groups = jobsIn(list);
    var nLaws = Object.keys(list.reduce(function (a, it) { a[it.title] = 1; return a; }, {})).length;
    var th = 'style="text-align:left;padding:6px 8px;border-bottom:2px solid #cbd5e1;font-size:12px;color:#475569;white-space:nowrap"';
    var td = 'style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12.5px;vertical-align:top"';
    var tdn = 'style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12.5px;vertical-align:top;white-space:nowrap"';
    var h = '<div style="font-family:\'Malgun Gothic\',\'Apple SD Gothic Neo\',sans-serif;color:#1a202c;font-size:13px;line-height:1.5">';
    h += '<div style="font-size:18px;font-weight:bold;margin:0 0 4px">RegRader 법규 개정 알림</div>';
    h += '<div style="color:#64748b;font-size:12px;margin:0 0 14px">' + esc(todayStr()) + ' 기준 · 범위: ' + esc(range().label) + ' · ' + esc(jobLabel()) +
      ' · 총 <b>' + list.length + '건</b> (법령 ' + nLaws + '개)</div>';

    /* 요약 표: 직무별 건수 */
    h += '<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 18px"><tr><th ' + th + '>직무</th><th ' + th + '>건수</th><th ' + th + '>시행완료</th><th ' + th + '>30일 이내</th><th ' + th + '>31일 이후</th></tr>';
    groups.forEach(function (g) {
      var sub = list.filter(function (it) { return jobOf(it) === g.job; });
      var done = sub.filter(function (it) { return days(it) < 0; }).length;
      var soon = sub.filter(function (it) { var d = days(it); return d >= 0 && d <= 30; }).length;
      h += '<tr><td ' + tdn + '><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:' + color(g.job) + ';margin-right:6px"></span>' + esc(g.job) +
        '</td><td ' + tdn + '><b>' + g.n + '</b></td><td ' + tdn + '>' + done + '</td><td ' + tdn + '>' + (soon ? '<b style="color:#c2410c">' + soon + '</b>' : '0') + '</td><td ' + tdn + '>' + (g.n - done - soon) + '</td></tr>';
    });
    h += '</table>';

    /* 직무별 상세 표 */
    groups.forEach(function (g) {
      var sub = list.filter(function (it) { return jobOf(it) === g.job; });
      h += '<div style="font-size:14px;font-weight:bold;margin:16px 0 6px;padding-left:8px;border-left:4px solid ' + color(g.job) + '">' + esc(g.job) + ' <span style="color:#64748b;font-weight:normal">' + sub.length + '건</span></div>';
      h += '<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%"><tr><th ' + th + '>시행일</th><th ' + th + '>남은 날</th><th ' + th + '>법령명 · 개정 취지</th><th ' + th + '>구분</th><th ' + th + '>소관부처</th></tr>';
      sub.forEach(function (it) {
        var d = days(it);
        var dcol = d < 0 ? '#16a34a' : d <= 7 ? '#dc2626' : d <= 30 ? '#c2410c' : '#6d28d9';
        var why = String(it.summary || '').trim();
        if (why.length > 140) why = why.slice(0, 140) + '…';
        h += '<tr><td ' + tdn + '>' + esc(it.effectiveDate) + '</td><td ' + tdn + '><b style="color:' + dcol + '">' + dday(d) + '</b></td><td ' + td + '>' +
          '<a href="' + esc(link(it)) + '" style="color:#1d4ed8;font-weight:bold;text-decoration:none">' + esc(it.title) + '</a>' +
          (tags(it).length ? ' <span style="color:#c53030;font-size:11px;font-weight:bold">[' + esc(tags(it).join('·')) + ']</span>' : '') +
          (why ? '<div style="color:#64748b;font-size:11.5px;margin-top:2px">' + esc(why) + '</div>' : '') +
          '</td><td ' + tdn + '>' + (it.kind ? esc(it.kind) + ' ' : '') + esc(it.amendmentType || '') + '</td><td ' + td.replace('vertical-align:top', 'vertical-align:top;min-width:96px') + '>' + esc(it.ministry || '') + '</td></tr>';
      });
      h += '</table>';
    });
    h += '<div style="color:#64748b;font-size:11.5px;margin-top:18px">법령명을 누르면 국가법령정보센터의 해당 시행일 원문이 열립니다. 개정 취지·조항 등 상세 내용은 <a href="' + SITE + '" style="color:#1d4ed8">RegRader</a>에서 확인하세요.</div>';
    return h + '</div>';
  }
  function bodyText(list) {
    var t = 'RegRader 법규 개정 알림\n' + todayStr() + ' 기준 · 범위: ' + range().label + ' · ' + jobLabel() + ' · 총 ' + list.length + '건\n\n';
    jobsIn(list).forEach(function (g) {
      t += '■ ' + g.job + ' (' + g.n + '건)\n';
      list.filter(function (it) { return jobOf(it) === g.job; }).forEach(function (it) {
        t += '  · ' + it.effectiveDate + ' [' + dday(days(it)) + '] ' + it.title + ' (' + (it.amendmentType || '') + ')' + (tags(it).length ? ' [' + tags(it).join('·') + ']' : '') + '\n';
      });
      t += '\n';
    });
    return t + '상세: ' + SITE + '\n';
  }

  /* ---------- 클립보드 ---------- */
  function copyRich(html, text) {
    if (navigator.clipboard && window.ClipboardItem && window.isSecureContext) {
      return navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' })
      })]).then(function () { return true; }, function () { return legacyCopy(html); });
    }
    return Promise.resolve(legacyCopy(html));
  }
  function legacyCopy(html) {
    var box = document.createElement('div');
    box.contentEditable = 'true';
    box.style.cssText = 'position:fixed;left:-9999px;top:0;background:#fff;color:#000';
    box.innerHTML = html;
    document.body.appendChild(box);
    var r = document.createRange();
    r.selectNodeContents(box);
    var s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    s.removeAllRanges();
    box.remove();
    return ok;
  }

  /* ---------- 화면 ---------- */
  function css() {
    if (document.getElementById('rr-mail-css')) return;
    var st = document.createElement('style');
    st.id = 'rr-mail-css';
    st.textContent =
      '#email-modal .rr-mail{max-width:680px;width:95%;padding:0;overflow:hidden}' +
      '.rr-mail .mh{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border)}' +
      '.rr-mail .mh h2{margin:0;font-size:1.2rem;color:var(--text-primary)}' +
      '.rr-mail .mh button{border:0;background:none;font-size:1.5rem;line-height:1;cursor:pointer;color:var(--text-muted)}' +
      '.rr-mail .mb{padding:16px 20px 20px;max-height:74vh;overflow-y:auto}' +
      '.rr-mail .lb{display:flex;align-items:center;gap:8px;font-weight:700;font-size:.9rem;color:var(--text-primary);margin:0 0 8px}' +
      '.rr-mail .lb small{font-weight:500;color:var(--text-muted)}' +
      '.rr-mail .lb .sp{margin-left:auto;display:flex;gap:4px}' +
      '.rr-mail .lb .sp button{border:1px solid var(--border);background:var(--bg-card);color:var(--text-secondary);border-radius:6px;font-size:.75rem;padding:2px 8px;cursor:pointer}' +
      '.rr-mail .row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}' +
      '.rr-mail .ch{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-secondary);border-radius:999px;padding:5px 12px;font-size:.84rem;font-weight:600;cursor:pointer;font-family:inherit}' +
      '.rr-mail .ch:hover{border-color:var(--primary)}' +
      '.rr-mail .ch.on{background:rgba(102,126,234,.12);border-color:var(--primary);color:var(--text-primary)}' +
      '.rr-mail .ch i{width:9px;height:9px;border-radius:3px;flex:none}' +
      '.rr-mail .ch b{font-weight:700;color:var(--text-muted);font-size:.78rem}' +
      '.rr-mail .ch.off{opacity:.45}' +
      '.rr-mail .pv{border:1px solid var(--border);border-radius:10px;max-height:210px;overflow-y:auto;margin-bottom:16px;background:var(--bg-card)}' +
      '.rr-mail .pv div{display:grid;grid-template-columns:62px 58px minmax(0,1fr) auto;gap:8px;padding:6px 10px;border-bottom:1px solid var(--border);font-size:.82rem;color:var(--text-secondary);align-items:center}' +
      '.rr-mail .pv div:last-child{border-bottom:0}' +
      '.rr-mail .pv .t{color:var(--text-primary);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.rr-mail .pv .d{font-weight:700;font-variant-numeric:tabular-nums}' +
      '.rr-mail .pv .j{font-size:.74rem;color:#fff;border-radius:999px;padding:1px 8px}' +
      '.rr-mail .pv .more,.rr-mail .pv .none{display:block;text-align:center;color:var(--text-muted)}' +
      '.rr-mail textarea,.rr-mail input[type=text]{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:10px;padding:9px 12px;font:inherit;font-size:.9rem;background:var(--bg-card);color:var(--text-primary);margin-bottom:14px;resize:vertical}' +
      '.rr-mail .go{display:flex;gap:8px}' +
      '.rr-mail .go button{border-radius:10px;padding:12px 16px;font:inherit;font-weight:700;cursor:pointer}' +
      '.rr-mail .go .p{flex:1;border:0;color:#fff;background:linear-gradient(135deg,#667eea,#764ba2)}' +
      '.rr-mail .go .p:disabled{opacity:.5;cursor:default}' +
      '.rr-mail .go .s{border:1px solid var(--border);background:var(--bg-card);color:var(--text-secondary)}' +
      '.rr-mail .msg{margin-top:12px;font-size:.84rem;border-radius:10px;padding:10px 12px;display:none}' +
      '.rr-mail .msg.ok{display:block;background:rgba(34,197,94,.12);color:var(--text-primary)}' +
      '.rr-mail .msg.err{display:block;background:rgba(229,62,62,.12);color:var(--text-primary)}' +
      '.rr-mail .hint{margin-top:10px;font-size:.78rem;color:var(--text-muted);line-height:1.5}';
    document.head.appendChild(st);
  }

  function readTo() { try { return localStorage.getItem(LS_TO) || ''; } catch (e) { return ''; } }
  function saveTo(v) { try { localStorage.setItem(LS_TO, v); } catch (e) {} }
  function parseTo(raw) { return String(raw || '').split(/[,;\s]+/).map(function (s) { return s.trim(); }).filter(Boolean); }

  function paint() {
    var modal = document.getElementById('email-modal');
    if (!modal) return;
    css();
    var toVal = modal.querySelector('#rr-mail-to') ? modal.querySelector('#rr-mail-to').value : readTo();
    var pool = inRange();
    var jobs = jobsIn(pool);
    var list = picked();
    var nLaws = Object.keys(list.reduce(function (a, it) { a[it.title] = 1; return a; }, {})).length;

    var h = '<div class="modal-content rr-mail" role="dialog" aria-label="메일로 공유">' +
      '<div class="mh"><h2>📧 메일로 공유</h2><button type="button" data-a="close" aria-label="닫기">×</button></div><div class="mb">';
    h += '<div class="lb"><span>📅</span>범위</div><div class="row">' + RANGES.map(function (r) {
      var n = items().filter(r.test).length;
      return '<button type="button" class="ch' + (r.id === state.range ? ' on' : '') + '" data-range="' + r.id + '">' + r.label + ' <b>' + n + '</b></button>';
    }).join('') + '</div>';
    h += '<div class="lb"><span>👔</span>직무 <small>누르면 넣고 뺍니다</small><span class="sp"><button type="button" data-a="all">전체</button><button type="button" data-a="none">해제</button></span></div><div class="row">' +
      (jobs.length ? jobs.map(function (g) {
        var on = !state.jobs || state.jobs.indexOf(g.job) >= 0;
        return '<button type="button" class="ch' + (on ? ' on' : ' off') + '" data-job="' + esc(g.job) + '"><i style="background:' + color(g.job) + '"></i>' + esc(g.job) + ' <b>' + g.n + '</b></button>';
      }).join('') : '<span style="color:var(--text-muted);font-size:.85rem">이 범위에는 개정이 없습니다.</span>') + '</div>';
    h += '<div class="lb"><span>📋</span>보낼 목록 <small>' + list.length + '건 · 법령 ' + nLaws + '개</small></div><div class="pv">' +
      (list.length ? list.slice(0, 60).map(function (it) {
        var d = days(it), dc = d < 0 ? 'var(--text-muted)' : d <= 7 ? '#e53e3e' : d <= 30 ? '#dd6b20' : '#805ad5';
        return '<div><span>' + esc(String(it.effectiveDate).slice(5).replace('-', '.')) + '</span><span class="d" style="color:' + dc + '">' + dday(d) +
          '</span><span class="t" title="' + esc(it.title) + '">' + esc(it.title) + '</span><span class="j" style="background:' + color(jobOf(it)) + '">' + esc(jobOf(it)) + '</span></div>';
      }).join('') + (list.length > 60 ? '<span class="more">… 외 ' + (list.length - 60) + '건 (메일에는 전부 들어갑니다)</span>' : '')
        : '<span class="none">선택한 조건에 맞는 개정이 없습니다.</span>') + '</div>';
    h += '<div class="lb">받는 사람 <small>여러 명은 쉼표로 구분 · 비워 두면 메일 앱에서 직접 입력</small></div>' +
      '<textarea id="rr-mail-to" rows="2" placeholder="hong@company.com, kim@company.com">' + esc(toVal) + '</textarea>';
    h += '<div class="lb">제목</div><input type="text" id="rr-mail-subject" value="' + esc(subject(list)) + '">';
    h += '<div class="go"><button type="button" class="p" data-a="send"' + (list.length ? '' : ' disabled') + '>✉️ 메일 작성 (본문 복사 + 메일 앱 열기)</button>' +
      '<button type="button" class="s" data-a="copy"' + (list.length ? '' : ' disabled') + '>📋 본문만 복사</button></div>';
    h += '<div class="msg" id="rr-mail-msg"></div>';
    h += '<div class="hint">메일 앱이 열리면 본문 칸에 <b>붙여넣기(Ctrl+V / ⌘V)</b> 하세요. 직무별 표와 원문 링크가 그대로 들어갑니다.<br>' +
      '목록이 길면 메일 주소창 길이 제한에 걸려 본문이 잘리기 때문에, 본문은 복사해서 붙여 넣는 방식입니다.</div>';
    h += '</div></div>';
    modal.innerHTML = h;
  }

  function note(kind, text) {
    var m = document.getElementById('rr-mail-msg');
    if (!m) return;
    m.className = 'msg ' + kind;
    m.innerHTML = text;
  }

  function doCopy(openApp) {
    var list = picked();
    if (!list.length) return;
    var toEl = document.getElementById('rr-mail-to');
    var to = parseTo(toEl && toEl.value);
    var bad = to.filter(function (e) { return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); });
    if (openApp && bad.length) { note('err', '이메일 주소를 확인해 주세요: ' + esc(bad.join(', '))); return; }
    saveTo(to.join(', '));
    var subj = (document.getElementById('rr-mail-subject') || {}).value || subject(list);
    Promise.resolve(copyRich(bodyHTML(list), bodyText(list))).then(function (ok) {
      if (!ok) { note('err', '클립보드 복사에 실패했습니다. 브라우저에서 클립보드 권한을 허용한 뒤 다시 눌러 주세요.'); return; }
      if (openApp) {
        var a = document.createElement('a');
        a.href = 'mailto:' + to.map(encodeURIComponent).join(',') + '?subject=' + encodeURIComponent(subj);
        document.body.appendChild(a);
        a.click();
        a.remove();
        note('ok', '✅ 본문 ' + list.length + '건을 복사했고 메일 앱을 열었습니다. 메일 본문 칸에 <b>붙여넣기(Ctrl+V / ⌘V)</b> 하세요.<br>메일 앱이 열리지 않으면 쓰시는 메일에서 새 메일을 만들고 붙여 넣으면 됩니다.');
      } else {
        note('ok', '✅ 본문 ' + list.length + '건을 복사했습니다. 메일이나 메신저에 붙여 넣으세요.');
      }
    });
  }

  function onClick(e) {
    var t = e.target.closest ? e.target.closest('button') : null;
    var modal = document.getElementById('email-modal');
    if (!t) { if (e.target === modal) close(); return; }
    if (t.dataset.range) { state.range = t.dataset.range; state.jobs = null; paint(); return; }
    if (t.dataset.job) {
      var all = jobsIn(inRange()).map(function (g) { return g.job; });
      var cur = state.jobs ? state.jobs.slice() : all.slice();
      var i = cur.indexOf(t.dataset.job);
      if (i >= 0) cur.splice(i, 1); else cur.push(t.dataset.job);
      state.jobs = cur.length === all.length ? null : cur;
      paint();
      return;
    }
    var a = t.dataset.a;
    if (a === 'close') close();
    else if (a === 'all') { state.jobs = null; paint(); }
    else if (a === 'none') { state.jobs = []; paint(); }
    else if (a === 'send') doCopy(true);
    else if (a === 'copy') doCopy(false);
  }
  function open() {
    var modal = document.getElementById('email-modal');
    if (!modal) return;
    state.jobs = null;
    paint();
    modal.classList.add('show');
    if (!modal.__rrMail) { modal.__rrMail = true; modal.addEventListener('click', onClick); }
  }
  function close() {
    var modal = document.getElementById('email-modal');
    if (modal) modal.classList.remove('show');
  }
  window.openEmailModal = open;
  window.closeEmailModal = close;
  window.sendEmailViaMailto = function () { doCopy(true); };
  document.addEventListener('keydown', function (e) {
    var modal = document.getElementById('email-modal');
    if (e.key === 'Escape' && modal && modal.classList.contains('show')) close();
  });
})();
