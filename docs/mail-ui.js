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
 *  4) [바로 보내기] (2026-10-18) -> 사이트에서 바로 보낸다. 사이트는 서버가 없어서 Google Apps Script 웹 앱(scripts/mail_relay.gs)이
 *     앱 주인의 Gmail 로 대신 보낸다. '대응 현황 관리'에 로그인한 구성원만 (로그인 토큰을 같이 보내 그쪽에서 확인)
 */
(function () {
  var SITE = 'https://tjdudfhr.github.io/RegRader/';
  var LS_TO = 'rr_mail_to';
  var LS_CC = 'rr_mail_cc';
  /* 메일 중계(Google Apps Script 웹 앱) 주소 — scripts/mail_relay.gs 를 배포하면 나오는 /exec 주소 */
  var RELAY = window.RR_MAIL_RELAY || 'https://script.google.com/macros/s/AKfycbzGLU61AsXAvnk2uvrRUP2l-_Dw_rFLIKYar11TAsUxK3S6wuE-F1IOQv4uXaRU25tV/exec';
  // (주소가 공개돼도 괜찮다: 그쪽에서 로그인한 구성원인지 확인하고, 아니면 보내지 않는다)
  var MAX_BYTES = 190000;   // 개인 Gmail(Apps Script) 본문 한도 200KB 보다 조금 작게
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
      '.rr-mail .pv{border:1px solid var(--line);border-radius:10px;max-height:236px;overflow-y:auto;background:var(--surface)}' +
      '.rr-mail .pv div{display:grid;grid-template-columns:52px 52px minmax(0,1fr) auto;gap:10px;padding:8px 12px;border-bottom:1px solid var(--line-2);font-size:13px;color:var(--ink-3);align-items:center}' +
      '.rr-mail .pv div:last-child{border-bottom:0}' +
      '.rr-mail .pv .t{color:var(--ink);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.rr-mail .pv .d{font-weight:800;font-variant-numeric:tabular-nums}' +
      '.rr-mail .pv .j{font-size:11.5px;font-weight:700;color:var(--ink-2);display:inline-flex;align-items:center;gap:5px}' +
      '.rr-mail .pv .j i{width:7px;height:7px;border-radius:2px}' +
      '.rr-mail .pv .more,.rr-mail .pv .none{display:block;text-align:center;color:var(--ink-3);padding:10px;font-size:12.5px}' +
      '.rr-mail .rr-linkbtn{border:0;background:none;padding:0;color:var(--brand);font:inherit;font-weight:700;cursor:pointer;text-decoration:underline}' +
      '.rr-mail .rr-dlg-f .sp{font-size:12.5px}' +
      '.rr-mail .ppl{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border:1px dashed var(--line);border-radius:10px;background:var(--surface-2,#f8fafc)}' +
      '.rr-mail .ppl .top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.rr-mail .ppl .sp{flex:1}' +
      '.rr-mail .ppl .lab{font-size:12.5px;font-weight:700;color:var(--ink-2)}.rr-mail .ppl .hint{font-size:12.5px;color:var(--ink-3)}' +
      '.rr-mail .ppl .rr-chips{gap:6px}.rr-mail .rr-chipx.sm{padding:4px 9px;font-size:12px}' +
      '.rr-mail .rr-chipx.sm i{display:inline-block;width:7px;height:7px;border-radius:2px;margin-right:4px}';
    document.head.appendChild(st);
  }

  function readTo() { try { return localStorage.getItem(LS_TO) || ''; } catch (e) { return ''; } }
  function saveTo(v) { try { localStorage.setItem(LS_TO, v); } catch (e) {} }
  function readCc() { try { return localStorage.getItem(LS_CC) || ''; } catch (e) { return ''; } }
  function saveCc(v) { try { localStorage.setItem(LS_CC, v); } catch (e) {} }
  function parseTo(raw) { return String(raw || '').split(/[,;\s]+/).map(function (s) { return s.trim(); }).filter(Boolean); }

  /* ---------- 직무 담당자 불러오기 (대응 현황 관리의 담당자 관리와 같은 목록) ---------- */
  function members() { return window.rrTracker && window.rrTracker.members ? window.rrTracker.members() : null; }
  function peopleHTML(list) {
    var ms = members();
    var admin = window.rrTracker && window.rrTracker.isAdmin && window.rrTracker.isAdmin();
    var manage = '<button type="button" class="rr-btn mini" data-a="members"' + (admin ? '' : ' disabled title="담당자 등록 · 수정은 총괄만 할 수 있습니다"') + '>' +
      (window.rrIcon ? window.rrIcon('users') : '') + '담당자 관리</button>';
    if (!ms) return '<span class="lab">직무 담당자 불러오기</span><span class="hint">담당자 목록은 <button type="button" class="rr-linkbtn" data-a="login">담당자 로그인</button> 후 볼 수 있습니다</span>';
    var staff = ms.filter(function (m) { return m.role !== 'admin' && m.job; });
    var picked = jobsIn(list).map(function (g) { return g.job; });
    var mine = staff.filter(function (m) { return picked.indexOf(m.job) >= 0; });
    var chips = order().map(function (j) {
      var n = staff.filter(function (m) { return m.job === j; }).length;
      return '<button type="button" class="rr-chipx sm' + (n ? '' : ' off') + '" data-ppl="' + esc(j) + '"' + (n ? '' : ' disabled title="이 직무에 등록된 담당자가 없습니다"') + '><i style="background:' + color(j) + '"></i>' + esc(j) + (n ? ' <b>' + n + '</b>' : '') + '</button>';
    }).join('');
    var admins = ms.filter(function (m) { return m.role === 'admin'; }).length;
    return '<div class="top"><span class="lab">직무 담당자 불러오기</span>' +
      '<button type="button" class="rr-btn mini pri" data-ppl="__picked"' + (mine.length ? '' : ' disabled') + '>고른 직무 담당자 넣기' + (mine.length ? ' <b>' + mine.length + '명</b>' : '') + '</button>' +
      '<span class="sp"></span>' + manage + '</div><div class="rr-chips">' + chips +
      '<button type="button" class="rr-chipx sm' + (admins ? '' : ' off') + '" data-ppl="__admin"' + (admins ? '' : ' disabled') + '>총괄' + (admins ? ' <b>' + admins + '</b>' : '') + '</button></div>';
  }
  function paintPeople() {
    var box = document.getElementById('rr-mail-people');
    if (box) box.innerHTML = peopleHTML(picked());
  }
  function addPeople(which) {
    var ms = members() || [];
    var list = which === '__admin' ? ms.filter(function (m) { return m.role === 'admin'; })
      : which === '__picked' ? ms.filter(function (m) { return m.role !== 'admin' && jobsIn(picked()).some(function (g) { return g.job === m.job; }); })
      : ms.filter(function (m) { return m.role !== 'admin' && m.job === which; });
    var el = document.getElementById('rr-mail-to');
    if (!el || !list.length) return;
    var cur = parseTo(el.value), low = cur.map(function (x) { return x.toLowerCase(); }), added = [];
    list.forEach(function (m) { if (low.indexOf(m.email.toLowerCase()) < 0) { cur.push(m.email); low.push(m.email.toLowerCase()); added.push(m.name || m.email); } });
    el.value = cur.join(', ');
    var what = which === '__admin' ? '총괄' : which === '__picked' ? '고른 직무 담당자' : which + ' 담당자';
    note('ok', added.length ? what + ' <b>' + added.length + '명</b>을 받는 사람에 넣었습니다 (' + esc(added.join(', ')) + ')' : '이미 받는 사람에 모두 들어 있습니다 (' + what + ')');
  }

  function paint() {
    var modal = document.getElementById('email-modal');
    if (!modal) return;
    css();
    var toVal = modal.querySelector('#rr-mail-to') ? modal.querySelector('#rr-mail-to').value : readTo();
    var ccVal = modal.querySelector('#rr-mail-cc') ? modal.querySelector('#rr-mail-cc').value : readCc();
    var who = window.rrTracker && window.rrTracker.who ? window.rrTracker.who() : null;
    var pool = inRange();
    var jobs = jobsIn(pool);
    var list = picked();
    var nLaws = Object.keys(list.reduce(function (a, it) { a[it.title] = 1; return a; }, {})).length;

    var ic = function (n) { return window.rrIcon ? window.rrIcon(n) : ''; };
    var h = '<div class="modal-content rr-dlg rr-mail" style="--dlg-w:720px" role="dialog" aria-label="메일로 공유">' +
      '<div class="rr-dlg-h"><span class="rr-dlg-ic">' + ic('mail') + '</span><div class="rr-dlg-t"><h2>메일로 공유</h2><p>고른 개정 목록을 원하는 사람에게 바로 보냅니다</p></div>' +
      '<button type="button" class="rr-dlg-x" data-a="close" aria-label="닫기">' + ic('x') + '</button></div><div class="rr-dlg-b">';
    h += '<section class="rr-box"><div class="rr-box-h">범위</div><div class="rr-chips">' + RANGES.map(function (r) {
      var n = items().filter(r.test).length;
      return '<button type="button" class="rr-chipx' + (r.id === state.range ? ' on' : '') + '" data-range="' + r.id + '">' + r.label + ' <b>' + n + '</b></button>';
    }).join('') + '</div></section>';
    h += '<section class="rr-box"><div class="rr-box-h">직무<span class="sp"><button type="button" class="rr-btn mini" data-a="all">전체</button><button type="button" class="rr-btn mini" data-a="none">해제</button></span></div><div class="rr-chips">' +
      (jobs.length ? jobs.map(function (g) {
        var on = !state.jobs || state.jobs.indexOf(g.job) >= 0;
        return '<button type="button" class="rr-chipx' + (on ? ' on' : ' off') + '" data-job="' + esc(g.job) + '"><i style="background:' + color(g.job) + '"></i>' + esc(g.job) + ' <b>' + g.n + '</b></button>';
      }).join('') : '<span class="rr-hint">이 범위에는 개정이 없습니다.</span>') + '</div></section>';
    h += '<section class="rr-box"><div class="rr-box-h">보낼 목록<small>' + list.length + '건 · 법령 ' + nLaws + '개</small></div><div class="pv">' +
      (list.length ? list.slice(0, 60).map(function (it) {
        var d = days(it), dc = d < 0 ? 'var(--ink-4)' : d <= 7 ? 'var(--danger)' : d <= 30 ? 'var(--warn)' : 'var(--brand)';
        return '<div><span>' + esc(String(it.effectiveDate).slice(5).replace('-', '.')) + '</span><span class="d" style="color:' + dc + '">' + dday(d) +
          '</span><span class="t" title="' + esc(it.title) + '">' + esc(it.title) + '</span><span class="j"><i style="background:' + color(jobOf(it)) + '"></i>' + esc(jobOf(it)) + '</span></div>';
      }).join('') + (list.length > 60 ? '<span class="more">외 ' + (list.length - 60) + '건 (메일에는 전부 들어갑니다)</span>' : '')
        : '<span class="none">선택한 조건에 맞는 개정이 없습니다.</span>') + '</div></section>';
    h += '<section class="rr-box" style="display:flex;flex-direction:column;gap:10px">' +
      '<label class="rr-f"><span>받는 사람</span><textarea id="rr-mail-to" rows="2" placeholder="hong@company.com, kim@company.com (쉼표 · 줄바꿈으로 여러 명)">' + esc(toVal) + '</textarea></label>' +
      '<div class="ppl" id="rr-mail-people">' + peopleHTML(list) + '</div>' +
      '<label class="rr-f"><span>참조 <small>(선택)</small></span><input type="text" id="rr-mail-cc" value="' + esc(ccVal) + '" placeholder="팀장님 등 함께 받을 사람"></label>' +
      '<label class="rr-f"><span>제목</span><input type="text" id="rr-mail-subject" value="' + esc(subject(list)) + '"></label></section>';
    h += '<div class="rr-msg" id="rr-mail-msg"></div></div>';
    var hint = !RELAY ? '바로 보내기는 메일 중계 설정 후 쓸 수 있습니다 (지금은 메일 앱으로 작성)'
      : who ? esc(who.name || who.email) + ' 님 이름으로 보냅니다 · 답장은 ' + esc(who.email) + ' 로'
      : '바로 보내기는 <button type="button" class="rr-linkbtn" data-a="login">담당자 로그인</button> 후 쓸 수 있습니다';
    h += '<div class="rr-dlg-f"><span class="sp">' + hint + '</span>' +
      '<button type="button" class="rr-btn" data-a="copy"' + (list.length ? '' : ' disabled') + '>' + ic('clipboard') + '본문만 복사</button>' +
      '<button type="button" class="rr-btn" data-a="app"' + (list.length ? '' : ' disabled') + '>' + ic('mail') + '메일 앱으로 작성</button>' +
      '<button type="button" class="rr-btn pri" data-a="direct"' + (list.length ? '' : ' disabled') + '>' + ic('send') + '바로 보내기</button></div>';
    h += '</div>';
    modal.innerHTML = h;
  }

  function note(kind, text) {
    var m = document.getElementById('rr-mail-msg');
    if (!m) return;
    m.className = 'rr-msg ' + kind;
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
        note('ok', '본문 ' + list.length + '건을 복사하고 메일 앱을 열었습니다. 메일 본문에 <b>붙여넣기</b> 하세요.');
      } else {
        note('ok', '본문 ' + list.length + '건을 복사했습니다.');
      }
    });
  }

  /* 본문 200KB 안으로: 넘으면 시행일이 가까운 것부터 넣고 '외 N건은 사이트에서' 를 붙인다 */
  function bytes(s) { return window.TextEncoder ? new TextEncoder().encode(s).length : s.length * 3; }
  function fitBody(list) {
    var html = bodyHTML(list);
    if (bytes(html) <= MAX_BYTES) return { html: html, text: bodyText(list), n: list.length };
    var lo = 1, hi = list.length - 1, best = 1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (bytes(bodyHTML(list.slice(0, mid))) <= MAX_BYTES - 2000) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    var part = list.slice(0, best), more = list.length - best;
    var tail = '<p style="margin:16px 0 0;font-size:13px;color:#475467">외 <b>' + more + '건</b>은 메일 길이 제한으로 빠졌습니다. 전체 목록은 <a href="' + SITE + '">RegRader</a> 에서 보세요.</p>';
    return { html: bodyHTML(part) + tail, text: bodyText(part) + '\n\n외 ' + more + '건은 메일 길이 제한으로 빠졌습니다. 전체 목록: ' + SITE, n: part.length, more: more };
  }

  /* 바로 보내기: 메일 중계(Google Apps Script)로 보낸다 — 로그인한 구성원만 */
  function sendDirect(btn) {
    var list = picked();
    if (!list.length) return;
    if (!RELAY) { note('err', '바로 보내기는 아직 설정되지 않았습니다. 관리자가 메일 중계(Google Apps Script)를 한 번 배포해야 합니다. 지금은 <b>메일 앱으로 작성</b>을 써 주세요.'); return; }
    var to = parseTo((document.getElementById('rr-mail-to') || {}).value);
    var cc = parseTo((document.getElementById('rr-mail-cc') || {}).value);
    if (!to.length) { note('err', '받는 사람을 넣어 주세요.'); return; }
    var bad = to.concat(cc).filter(function (x) { return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x); });
    if (bad.length) { note('err', '이메일 주소를 확인해 주세요: ' + esc(bad.join(', '))); return; }
    if (!window.rrTracker || !window.rrTracker.token) { note('err', '로그인 기능을 불러오지 못했습니다. 화면을 새로 고친 뒤 다시 시도해 주세요.'); return; }
    var subj = (document.getElementById('rr-mail-subject') || {}).value || subject(list);
    var body = fitBody(list);
    var label = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = '보내는 중…';
    window.rrTracker.token().then(function (token) {
      if (!token) throw { login: true };
      return fetch(RELAY, { method: 'POST', body: JSON.stringify({ token: token, to: to, cc: cc, subject: subj, html: body.html, text: body.text }) })
        .then(function (r) { return r.text(); })
        .then(function (t) {
          try { return JSON.parse(t); } catch (e) {
            /* 구글이 결과 대신 오류 화면(HTML)을 돌려준 경우: 그 화면의 글자를 이유로 보여 준다 (메일은 이미 나갔을 수 있다) */
            var why = String(t || '').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#39;|&quot;/g, ' ').replace(/\s+/g, ' ').trim();
            return { ok: false, unsure: true, error: '메일 보내는 프로그램(구글)이 결과 대신 오류 화면을 돌려주었습니다' + (why ? ': ' + why.slice(0, 180) : '') };
          }
        });
    }).then(function (r) {
      if (r && r.unsure) { saveTo(to.join(', ')); saveCc(cc.join(', ')); throw new Error(r.error + ' — 메일이 실제로 갔는지 받은편지함(또는 보낸편지함)을 확인해 주세요. 갔다면 다시 보내지 않으셔도 됩니다.'); }
      if (!r || !r.ok) throw (r && r.code === 'auth') ? { login: true } : new Error((r && r.error) || '보내지 못했습니다.');
      saveTo(to.join(', '));
      saveCc(cc.join(', '));
      note('ok', '<b>' + r.sent + '명</b>에게 보냈습니다' + (body.more ? ' (메일 길이 제한으로 ' + body.n + '건만 넣고 나머지는 사이트 링크)' : ' (' + body.n + '건)') +
        (typeof r.left === 'number' ? ' · 오늘 더 보낼 수 있는 수 ' + r.left + '명' : ''));
    }).catch(function (err) {
      if (err && err.login) {
        note('err', "바로 보내기는 '대응 현황 관리'에 로그인한 구성원만 쓸 수 있습니다. <button type=\"button\" class=\"rr-linkbtn\" data-a=\"login\">담당자 로그인</button>");
      } else {
        var m = (err && err.message) || '보내지 못했습니다.';
        note('err', esc(m) + (/받은편지함/.test(m) ? '' : ' 잠시 뒤 다시 시도하거나 <b>메일 앱으로 작성</b>을 써 주세요.'));
      }
    }).then(function () { btn.disabled = false; btn.innerHTML = label; });
  }

  function onClick(e) {
    var t = e.target.closest ? e.target.closest('button') : null;
    var modal = document.getElementById('email-modal');
    if (!t) { if (e.target === modal) close(); return; }
    if (t.dataset.ppl) { addPeople(t.dataset.ppl); return; }
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
    else if (a === 'app' || a === 'send') doCopy(true);
    else if (a === 'copy') doCopy(false);
    else if (a === 'direct') sendDirect(t);
    else if (a === 'login') { close(); if (window.rrTracker && window.rrTracker.openLogin) window.rrTracker.openLogin(); }
    else if (a === 'members') { if (!(window.rrTracker && window.rrTracker.openMembers && window.rrTracker.openMembers())) note('err', '담당자 등록 · 수정은 총괄 계정으로 로그인해야 할 수 있습니다.'); }
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
  window.addEventListener('rr-trk-change', function () {
    var modal = document.getElementById('email-modal');
    if (modal && modal.classList.contains('show')) paintPeople();
  });
  window.openEmailModal = open;
  window.closeEmailModal = close;
  window.sendEmailViaMailto = function () { doCopy(true); };
  document.addEventListener('keydown', function (e) {
    var modal = document.getElementById('email-modal');
    if (e.key === 'Escape' && modal && modal.classList.contains('show')) close();
  });
})();
