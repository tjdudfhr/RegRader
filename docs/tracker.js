/* 대응 현황 관리 (Supabase)
 *
 * 직무별 담당자가 개정마다 대응 상태를 기록하고 함께 본다. 총괄(admin)은 전체를 고칠 수 있다.
 *   - 로그인: 이메일로 받은 링크 (비밀번호 없음). members 에 등록된 이메일만 보고 고칠 수 있다 (DB 행 단위 권한).
 *   - 기록: 상태(미검토·검토중·조치필요·조치완료·해당없음) · 영향도 · 조치 내용 · 조치 기한 · 완료일 · 증빙 링크
 *   - 이력: 누가 언제 무엇을 바꿨는지 자동으로 남는다 (response_log)
 * 표·권한은 scripts/supabase_tracker.sql. 여기 있는 키는 브라우저용 공개 키(anon)이며, 데이터는 로그인 + 권한으로 보호된다.
 *
 * window.rrTracker
 *   .popupSection(item)   법령 팝업의 '대응 현황' 칸 { body, extra } (brief-ui.js 가 쓴다)
 *   .status(item)         그 개정의 대응 상태 (없으면 '')
 */
(function () {
  var URL_ = 'https://gzlyjwvounwdubdvwjen.supabase.co';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6bHlqd3ZvdW53ZHViZHZ3amVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNTg1NTcsImV4cCI6MjEwNTkzNDU1N30.zpEcAFk2xg87xYAEminrsGNJM79NWDeuzKhgL707ShM';
  var LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
  var SITE = 'https://tjdudfhr.github.io/RegRader/';
  var STATUSES = ['미검토', '검토중', '조치필요', '조치완료', '해당없음'];
  var ST_CLS = { '미검토': 'none', '검토중': 'rev', '조치필요': 'need', '조치완료': 'done', '해당없음': 'na' };
  var JOBS = ['재무회계', '인사노무', '환경', '지식재산권', '공정거래', '안전', '지배구조', '정보보호'];

  var sb = null, libP = null;
  var me = null;            // { email, name, job, role }
  var session = null;
  var RESP = {};            // key -> row
  var MEMBERS = [];
  var DRAFT = {};           // key -> 편집 중인 값 (팝업이 다시 그려져도 유지)
  var loaded = false;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function short(t) { return t === '일부개정' ? '일' : t === '타법개정' ? '타' : (t || ''); }
  function keyOf(it) { return it ? (it._key || (it.title + '|' + it.effectiveDate + '|' + short(it.amendmentType))) : ''; }
  function jobOf(it) { return (it && it.categories && it.categories[0]) || '기타'; }
  function canEdit(it) { return !!me && (me.role === 'admin' || me.job === jobOf(it)); }
  function items() { return window.__rrItems || []; }
  function findByKey(k) { var l = items(); for (var i = 0; i < l.length; i++) if (keyOf(l[i]) === k) return l[i]; return null; }
  function fmtTime(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function who(email) {
    var m = MEMBERS.filter(function (x) { return x.email === email; })[0];
    return m && m.name ? m.name : (email || '').split('@')[0];
  }
  function statusOf(it) { var r = RESP[keyOf(it)]; return r ? r.status : ''; }

  /* ---------- 연결 ---------- */
  function lib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    if (!libP) {
      libP = new Promise(function (ok, bad) {
        var s = document.createElement('script');
        s.src = LIB;
        s.onload = function () { ok(); };
        s.onerror = function () { libP = null; bad(new Error('로그인 모듈을 받지 못했습니다')); };
        document.head.appendChild(s);
      });
    }
    return libP;
  }
  function client() {
    return lib().then(function () {
      if (!sb) {
        sb = window.supabase.createClient(URL_, ANON, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } });
        sb.auth.onAuthStateChange(function (ev, s) {
          session = s;
          if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT' || ev === 'TOKEN_REFRESHED') afterAuth();
        });
      }
      return sb;
    });
  }
  function hasStoredSession() {
    try {
      for (var i = 0; i < localStorage.length; i++) { if (/^sb-.*-auth-token$/.test(localStorage.key(i))) return true; }
    } catch (e) {}
    return /access_token=|type=magiclink/.test(location.hash || '');
  }
  function afterAuth() {
    return client().then(function (c) { return c.auth.getSession(); }).then(function (r) {
      session = r && r.data ? r.data.session : null;
      if (!session) { me = null; RESP = {}; MEMBERS = []; loaded = false; paintAll(); return; }
      if (/access_token=/.test(location.hash || '')) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
      return load();
    });
  }
  function load() {
    var email = String(session.user.email || '').toLowerCase();
    return Promise.all([
      sb.from('members').select('*'),
      sb.from('responses').select('*').limit(10000)
    ]).then(function (res) {
      MEMBERS = (res[0].data || []);
      me = MEMBERS.filter(function (m) { return m.email === email; })[0] || { email: email, name: '', job: null, role: 'guest' };
      RESP = {};
      (res[1].data || []).forEach(function (r) { RESP[r.key] = r; });
      loaded = true;
      paintAll();
    }).catch(function (e) { console.warn('[tracker] load', e); });
  }

  /* ---------- 저장 ---------- */
  function save(key) {
    var it = findByKey(key);
    if (!it || !canEdit(it)) return Promise.reject(new Error('이 개정은 ' + jobOf(it) + ' 담당만 고칠 수 있습니다.'));
    var cur = RESP[key] || {};
    var d = DRAFT[key] || {};
    var row = {
      key: key, job: jobOf(it), title: it.title, effective_date: it.effectiveDate || null, amendment_type: (it.kind ? it.kind + ' ' : '') + (it.amendmentType || ''),
      status: d.status != null ? d.status : (cur.status || '미검토'),
      impact: (d.impact != null ? d.impact : cur.impact) || null,
      action: d.action != null ? d.action : (cur.action || ''),
      due_date: (d.due_date != null ? d.due_date : cur.due_date) || null,
      done_date: (d.done_date != null ? d.done_date : cur.done_date) || null,
      evidence_url: d.evidence_url != null ? d.evidence_url : (cur.evidence_url || '')
    };
    if (row.status === '조치완료' && !row.done_date) row.done_date = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).toISOString().slice(0, 10);
    return sb.from('responses').upsert(row).select().then(function (r) {
      if (r.error) throw r.error;
      RESP[key] = (r.data && r.data[0]) || row;
      delete DRAFT[key];
      paintAll();
      return RESP[key];
    });
  }

  /* ---------- 팝업 칸 ---------- */
  function popupSection(item) {
    var key = keyOf(item);
    if (!session || !loaded) {
      return { body: '<div class="rr-trk-login">개정마다 <b>검토 · 조치 · 완료</b>를 기록하고 직무 담당자와 함께 봅니다. ' +
        '<button type="button" class="rr-trk-btn" data-trk="login">담당자 로그인</button></div>', extra: '' };
    }
    if (!me || me.role === 'guest') {
      return { body: '<div class="rr-trk-login">' + esc(session.user.email) + ' 은(는) 등록된 담당자가 아닙니다. 총괄에게 등록을 요청하세요. ' +
        '<button type="button" class="rr-trk-btn ghost" data-trk="logout">로그아웃</button></div>', extra: '' };
    }
    var cur = RESP[key] || {};
    var d = DRAFT[key] || {};
    var v = function (f, dft) { return d[f] != null ? d[f] : (cur[f] != null ? cur[f] : dft); };
    var st = v('status', '미검토');
    var edit = canEdit(item);
    var dis = edit ? '' : ' disabled';
    var h = '<div class="rr-trk" data-tk="' + esc(key) + '">' +
      '<div class="rr-trk-grid">' +
        '<label>상태<select data-f="status"' + dis + '>' + STATUSES.map(function (s) { return '<option' + (s === st ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label>' +
        '<label>영향도<select data-f="impact"' + dis + '><option value="">-</option>' + ['상', '중', '하'].map(function (s) { return '<option' + (s === v('impact', '') ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label>' +
        '<label>조치 기한<input type="date" data-f="due_date" value="' + esc(v('due_date', '') || '') + '"' + dis + '></label>' +
        '<label>완료일<input type="date" data-f="done_date" value="' + esc(v('done_date', '') || '') + '"' + dis + '></label>' +
      '</div>' +
      '<textarea data-f="action" rows="2" placeholder="검토 결과 · 조치 내용 (예: 안전보건관리규정 제12조 개정, 10/15 교육 실시)"' + dis + '>' + esc(v('action', '')) + '</textarea>' +
      '<input type="url" data-f="evidence_url" placeholder="증빙 문서 링크 (사내 문서함 등)" value="' + esc(v('evidence_url', '')) + '"' + dis + '>' +
      '<div class="rr-trk-foot">' +
        (edit ? '<button type="button" class="rr-trk-btn" data-trk="save">저장</button>' : '<span class="rr-trk-ro">' + esc(jobOf(item)) + ' 담당(또는 총괄)만 고칠 수 있습니다</span>') +
        '<span class="rr-trk-msg">' + (cur.updated_at ? '마지막 수정 ' + esc(who(cur.updated_by)) + ' · ' + esc(fmtTime(cur.updated_at)) : '아직 기록이 없습니다') + '</span>' +
        (cur.updated_at ? '<button type="button" class="rr-trk-link" data-trk="log">변경 이력</button>' : '') +
        (v('evidence_url', '') ? '<a class="rr-trk-link" href="' + esc(v('evidence_url', '')) + '" target="_blank" rel="noopener">증빙 열기 ↗</a>' : '') +
      '</div><div class="rr-trk-log" hidden></div></div>';
    return { body: h, extra: '<span class="rr-sec-extra"><span class="rr-st ' + ST_CLS[st] + '">' + esc(st) + '</span></span>' };
  }

  /* 팝업 안 입력 · 저장 · 이력 */
  document.addEventListener('input', function (e) {
    var box = e.target.closest && e.target.closest('.rr-trk[data-tk]');
    if (!box || !e.target.dataset.f) return;
    var k = box.dataset.tk;
    (DRAFT[k] = DRAFT[k] || {})[e.target.dataset.f] = e.target.value;
  });
  document.addEventListener('change', function (e) {
    var box = e.target.closest && e.target.closest('.rr-trk[data-tk]');
    if (!box || !e.target.dataset.f) return;
    (DRAFT[box.dataset.tk] = DRAFT[box.dataset.tk] || {})[e.target.dataset.f] = e.target.value;
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-trk]');
    if (!b) return;
    var a = b.dataset.trk;
    if (a === 'login') { e.preventDefault(); openLogin(); return; }
    if (a === 'logout') { e.preventDefault(); client().then(function (c) { return c.auth.signOut(); }).then(afterAuth); return; }
    var box = b.closest('.rr-trk[data-tk]');
    if (a === 'save' && box) {
      b.disabled = true; b.textContent = '저장 중…';
      save(box.dataset.tk).then(function () {
        var msg = box.querySelector('.rr-trk-msg'); if (msg) msg.textContent = '✅ 저장했습니다';
      }).catch(function (err) {
        var msg = box.querySelector('.rr-trk-msg'); if (msg) msg.textContent = '저장하지 못했습니다: ' + (err && err.message || err);
      }).then(function () { b.disabled = false; b.textContent = '저장'; });
    }
    if (a === 'log' && box) {
      var logEl = box.querySelector('.rr-trk-log');
      if (!logEl.hidden) { logEl.hidden = true; return; }
      logEl.hidden = false; logEl.textContent = '불러오는 중…';
      sb.from('response_log').select('*').eq('key', box.dataset.tk).order('changed_at', { ascending: false }).limit(20).then(function (r) {
        var rows = r.data || [];
        logEl.innerHTML = rows.length ? rows.map(function (x) {
          var o = x.old_row || {}, n = x.new_row || {};
          var ch = ['status', 'impact', 'action', 'due_date', 'done_date', 'evidence_url'].filter(function (f) { return String(o[f] || '') !== String(n[f] || ''); })
            .map(function (f) { return ({ status: '상태', impact: '영향도', action: '조치 내용', due_date: '기한', done_date: '완료일', evidence_url: '증빙' })[f] + (f === 'status' ? ' → ' + n.status : ''); });
          return '<div><b>' + esc(fmtTime(x.changed_at)) + '</b> ' + esc(who(x.changed_by)) + ' · ' + esc(ch.join(', ') || '저장') + '</div>';
        }).join('') : '이력이 없습니다.';
      });
    }
  });

  /* ---------- 로그인 창 ---------- */
  function openLogin() {
    var m = document.getElementById('rr-trk-modal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'rr-trk-modal';
      m.className = 'rr-trk-modal';
      m.innerHTML = '<div class="rr-trk-dialog" role="dialog" aria-label="담당자 로그인">' +
        '<div class="rr-trk-dh"><b>🔐 담당자 로그인</b><button type="button" data-x="1" aria-label="닫기">×</button></div>' +
        '<p>등록된 이메일을 넣으면 로그인 링크를 보내 드립니다. 메일의 링크를 누르면 이 사이트로 돌아와 로그인됩니다. 한 번 로그인하면 이 브라우저에서는 계속 유지됩니다.</p>' +
        '<input type="email" id="rr-trk-email" placeholder="name@company.com" autocomplete="email">' +
        '<button type="button" class="rr-trk-btn wide" id="rr-trk-send">로그인 링크 받기</button>' +
        '<div class="rr-trk-note" id="rr-trk-note"></div></div>';
      document.body.appendChild(m);
      m.addEventListener('click', function (e) { if (e.target === m || e.target.dataset.x) m.classList.remove('show'); });
      m.querySelector('#rr-trk-send').addEventListener('click', function () {
        var email = m.querySelector('#rr-trk-email').value.trim().toLowerCase();
        var note = m.querySelector('#rr-trk-note');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { note.textContent = '이메일 주소를 확인해 주세요.'; return; }
        var btn = this; btn.disabled = true; note.textContent = '보내는 중…';
        client().then(function (c) {
          return c.auth.signInWithOtp({ email: email, options: { emailRedirectTo: /github\.io/.test(location.host) ? SITE : location.origin + location.pathname } });
        }).then(function (r) {
          if (r.error) throw r.error;
          note.innerHTML = '✅ <b>' + esc(email) + '</b> 으로 로그인 링크를 보냈습니다. 메일함(스팸함 포함)을 확인하세요.';
        }).catch(function (e) {
          note.textContent = '보내지 못했습니다: ' + (e && e.message || e) + (/rate|limit|seconds/i.test(String(e && e.message)) ? ' (잠시 뒤 다시 시도하세요)' : '');
        }).then(function () { btn.disabled = false; });
      });
    }
    m.classList.add('show');
    setTimeout(function () { var i = m.querySelector('#rr-trk-email'); if (i) i.focus(); }, 50);
  }

  /* ---------- 왼쪽 메뉴 아래: 로그인 상태 ---------- */
  function paintBadge() {
    var nav = document.querySelector('.main-tab-navigation .main-tab-container') || document.querySelector('.main-tab-navigation');
    if (!nav) return;
    var el = document.getElementById('rr-trk-who');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rr-trk-who';
      el.className = 'rr-trk-who';
      nav.appendChild(el);
    }
    if (session && me && me.role !== 'guest') {
      var nm = me.name || me.email.split('@')[0], rl = me.role === 'admin' ? '총괄' : (me.job || '') + ' 담당';
      el.innerHTML = '<span class="n">👤 ' + esc(nm) + '</span>' + (nm === rl ? '' : '<span class="j">' + esc(rl) + '</span>') +
        '<button type="button" data-trk="logout">로그아웃</button>';
    } else if (session) {
      el.innerHTML = '<span class="n">미등록 계정</span><button type="button" data-trk="logout">로그아웃</button>';
    } else {
      el.innerHTML = '<button type="button" class="in" data-trk="login">🔐 담당자 로그인</button>';
    }
  }

  /* ---------- 목록 배지: 분기별(.rr-q-row) · 직무별(#law-list .law-item) ---------- */
  function badge(it) {
    var st = statusOf(it);
    return st ? '<span class="rr-st ' + ST_CLS[st] + '" title="대응 현황">' + esc(st) + '</span>' : '';
  }
  function decorate() {
    if (!loaded) return;
    document.querySelectorAll('.rr-q-row[data-key]').forEach(function (n) {
      var it = findByKey(n.getAttribute('data-key')) || items().filter(function (x) { return x.id === n.getAttribute('data-key'); })[0];
      var old = n.querySelector('.rr-st');
      var html = badge(it);
      if (old) old.outerHTML = html || '';
      else if (html) { var t = n.querySelector('.rr-q-title'); if (t) t.insertAdjacentHTML('beforeend', html); }
    });
    document.querySelectorAll('#law-list .law-item[data-eid]').forEach(function (n) {
      var id = n.getAttribute('data-eid');
      var it = items().filter(function (x) { return x.id === id; })[0];
      var old = n.querySelector('.rr-st');
      var html = badge(it);
      if (old) old.outerHTML = html || '';
      else if (html) { var t = n.querySelector('.law-title'); if (t) t.insertAdjacentHTML('beforeend', ' ' + html); }
    });
  }
  var pend = null;
  new MutationObserver(function () { if (pend) return; pend = setTimeout(function () { pend = null; decorate(); }, 150); })
    .observe(document.documentElement, { childList: true, subtree: true });

  /* ---------- 대응 현황 탭 ---------- */
  var F = { job: '', status: '', q: '', scope: 'attention' };
  function todayISO() { var k = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })); return k.getFullYear() + '-' + String(k.getMonth() + 1).padStart(2, '0') + '-' + String(k.getDate()).padStart(2, '0'); }
  function paintDash() {
    var host = document.getElementById('rr-trk-dash');
    if (!host) return;
    if (!session || !loaded) {
      host.innerHTML = '<div class="rr-trk-hero"><h2>✅ 대응 현황</h2><p>직무별 담당자가 개정마다 <b>검토 · 조치 · 완료</b>를 기록하고, 총괄이 한눈에 확인합니다. 누가 언제 바꿨는지 이력이 자동으로 남습니다.</p>' +
        '<button type="button" class="rr-trk-btn" data-trk="login">담당자 로그인</button><p class="sm">등록된 이메일로만 로그인할 수 있습니다. 등록은 총괄이 합니다.</p></div>';
      return;
    }
    if (!me || me.role === 'guest') {
      host.innerHTML = '<div class="rr-trk-hero"><h2>✅ 대응 현황</h2><p>' + esc(session.user.email) + ' 은(는) 등록된 담당자가 아닙니다. 총괄에게 등록을 요청하세요.</p><button type="button" class="rr-trk-btn ghost" data-trk="logout">로그아웃</button></div>';
      return;
    }
    if (!F.job && me.role !== 'admin' && me.job) F.job = me.job;
    var today = todayISO();
    var all = items();
    var rows = all.map(function (it) { var r = RESP[keyOf(it)]; return { it: it, st: r ? r.status : '미검토', r: r || null }; });
    var open = function (x) { return x.st !== '조치완료' && x.st !== '해당없음'; };
    /* 직무별 진행 */
    var table = JOBS.map(function (j) {
      var mine = rows.filter(function (x) { return jobOf(x.it) === j; });
      var c = {}; STATUSES.forEach(function (s) { c[s] = mine.filter(function (x) { return x.st === s; }).length; });
      var closed = c['조치완료'] + c['해당없음'];
      var overdue = mine.filter(function (x) { return open(x) && x.it.effectiveDate < today; }).length;
      var soon = mine.filter(function (x) { return open(x) && x.it.effectiveDate >= today && x.it.daysUntil <= 30; }).length;
      var pct = mine.length ? Math.round(closed / mine.length * 100) : 0;
      return '<tr' + (F.job === j ? ' class="on"' : '') + ' data-tjob="' + j + '"><td><i style="background:' + (window.rrCatColor ? window.rrCatColor(j) : '#999') + '"></i>' + j + '</td><td>' + mine.length + '</td>' +
        STATUSES.map(function (s) { return '<td>' + (c[s] || '') + '</td>'; }).join('') +
        '<td><div class="rr-trk-bar"><span style="width:' + pct + '%"></span></div>' + pct + '%</td><td class="' + (soon ? 'warn' : '') + '">' + (soon || '') + '</td><td class="' + (overdue ? 'bad' : '') + '">' + (overdue || '') + '</td></tr>';
    }).join('');
    /* 목록 */
    var list = rows.filter(function (x) {
      if (F.job && jobOf(x.it) !== F.job) return false;
      if (F.status && x.st !== F.status) return false;
      if (F.q && (x.it.title + ' ' + ((x.r && x.r.action) || '')).toLowerCase().indexOf(F.q) < 0) return false;
      if (F.scope === 'attention') return open(x) && x.it.daysUntil <= 30 && x.it.daysUntil >= -30;   /* 시행 30일 이내 · 최근 30일 사이 시행됐는데 미완료 */
      if (F.scope === 'upcoming') return x.it.daysUntil >= 0;
      return true;
    }).sort(function (a, b) { return String(a.it.effectiveDate).localeCompare(String(b.it.effectiveDate)); });
    var canAny = me.role === 'admin' || !!me.job;
    host.innerHTML =
      '<div class="rr-trk-head"><div><h2>✅ 대응 현황</h2><p>' + esc(me.name || me.email) + ' · ' + esc(me.role === 'admin' ? '총괄 (전체 수정 가능)' : (me.job || '') + ' 담당') + '</p></div>' +
      '<div class="rr-trk-actions"><button type="button" class="rr-trk-btn ghost" id="rr-trk-xls">엑셀로 내려받기</button>' +
      (me.role === 'admin' ? '<button type="button" class="rr-trk-btn ghost" id="rr-trk-mem">담당자 관리</button>' : '') + '</div></div>' +
      '<div class="rr-trk-card"><div class="rr-trk-ct">직무별 진행 <small>줄을 누르면 그 직무만 봅니다 · 진행률 = (조치완료 + 해당없음) / 전체</small></div>' +
      '<div class="rr-trk-tw"><table class="rr-trk-t"><thead><tr><th>직무</th><th>전체</th>' + STATUSES.map(function (s) { return '<th>' + s + '</th>'; }).join('') + '<th>진행률</th><th>30일 내 미완료</th><th>시행 후 미완료(누적)</th></tr></thead><tbody>' + table + '</tbody></table></div></div>' +
      '<div class="rr-trk-card"><div class="rr-trk-filters">' +
        '<select id="rr-trk-fjob"><option value="">전체 직무</option>' + JOBS.map(function (j) { return '<option' + (F.job === j ? ' selected' : '') + '>' + j + '</option>'; }).join('') + '</select>' +
        '<select id="rr-trk-fscope"><option value="attention"' + (F.scope === 'attention' ? ' selected' : '') + '>챙길 것 (30일 내 시행 · 최근 30일 시행 미완료)</option><option value="upcoming"' + (F.scope === 'upcoming' ? ' selected' : '') + '>시행 예정 전체</option><option value="all"' + (F.scope === 'all' ? ' selected' : '') + '>올해 전체</option></select>' +
        '<select id="rr-trk-fst"><option value="">모든 상태</option>' + STATUSES.map(function (s) { return '<option' + (F.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
        '<input type="search" id="rr-trk-fq" placeholder="법규명 · 조치 내용 검색" value="' + esc(F.q) + '"><span class="cnt">' + list.length + '건</span></div>' +
      '<div class="rr-trk-list">' + (list.slice(0, 300).map(function (x) {
        var it = x.it, d = it.daysUntil;
        var dd = d < 0 ? '<span class="dd past">시행 +' + (-d) + '일</span>' : d === 0 ? '<span class="dd hot">D-DAY</span>' : '<span class="dd ' + (d <= 30 ? 'hot' : '') + '">D-' + d + '</span>';
        var edit = canEdit(it);
        return '<div class="rr-trk-row" data-tk="' + esc(keyOf(it)) + '">' +
          '<span class="dt">' + esc(String(it.effectiveDate).slice(5).replace('-', '.')) + '</span>' + dd +
          '<button type="button" class="ttl" data-eid="' + esc(it.id) + '" title="개정 내용 보기">' + esc(it.title) + (it.kind ? ' <small>' + esc(it.kind) + '</small>' : '') + '</button>' +
          '<span class="jb"><i style="background:' + (window.rrCatColor ? window.rrCatColor(jobOf(it)) : '#999') + '"></i>' + esc(jobOf(it)) + '</span>' +
          (edit ? '<select class="qs" data-quick="1">' + STATUSES.map(function (s) { return '<option' + (s === x.st ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>'
            : '<span class="rr-st ' + ST_CLS[x.st] + '">' + esc(x.st) + '</span>') +
          '<span class="ac" title="' + esc((x.r && x.r.action) || '') + '">' + esc((x.r && x.r.action) || '') + '</span></div>';
      }).join('') || '<div class="rr-trk-empty">해당하는 개정이 없습니다.</div>') + (list.length > 300 ? '<div class="rr-trk-empty">앞의 300건만 표시합니다. 조건을 좁혀 보세요.</div>' : '') + '</div></div>' +
      '<div class="rr-trk-card" id="rr-trk-members" hidden></div>';
    if (!canAny) host.querySelector('.rr-trk-head p').textContent += ' (직무가 지정되지 않아 볼 수만 있습니다)';
  }
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'rr-trk-fjob') { F.job = t.value; paintDash(); }
    else if (t.id === 'rr-trk-fscope') { F.scope = t.value; paintDash(); }
    else if (t.id === 'rr-trk-fst') { F.status = t.value; paintDash(); }
    else if (t.dataset && t.dataset.quick) {
      var rowEl = t.closest('.rr-trk-row');
      var k = rowEl && rowEl.dataset.tk;
      if (!k) return;
      (DRAFT[k] = DRAFT[k] || {}).status = t.value;
      t.disabled = true;
      save(k).catch(function (err) { alert('저장하지 못했습니다: ' + (err && err.message || err)); paintDash(); });
    }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'rr-trk-fq') {
      F.q = e.target.value.trim().toLowerCase();
      clearTimeout(paintDash._t);
      paintDash._t = setTimeout(function () { paintDash(); var i = document.getElementById('rr-trk-fq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250);
    }
  });
  document.addEventListener('click', function (e) {
    var tr = e.target.closest && e.target.closest('.rr-trk-t tbody tr[data-tjob]');
    if (tr) { F.job = F.job === tr.dataset.tjob ? '' : tr.dataset.tjob; paintDash(); return; }
    if (e.target.id === 'rr-trk-xls') exportXlsx();
    if (e.target.id === 'rr-trk-mem') paintMembers();
    var mb = e.target.closest && e.target.closest('[data-mem]');
    if (mb) memberAction(mb);
  });

  function exportXlsx() {
    if (!(window.XLSX && XLSX.utils)) { alert('엑셀 모듈을 불러오는 중입니다. 잠시 뒤 다시 눌러 주세요.'); return; }
    var rows = items().filter(function (it) { return !F.job || jobOf(it) === F.job; }).map(function (it) {
      var r = RESP[keyOf(it)] || {};
      return { '시행일': it.effectiveDate, '법규명': it.title, '종류': it.kind || it.lawType || '', '개정구분': it.amendmentType || '', '직무': jobOf(it), '소관부처': it.ministry || '',
        '상태': r.status || '미검토', '영향도': r.impact || '', '조치 내용': r.action || '', '조치 기한': r.due_date || '', '완료일': r.done_date || '', '증빙 링크': r.evidence_url || '',
        '마지막 수정': r.updated_at ? who(r.updated_by) + ' ' + fmtTime(r.updated_at) : '' };
    }).sort(function (a, b) { return String(a['시행일']).localeCompare(String(b['시행일'])); });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), '대응현황');
    XLSX.writeFile(wb, 'RegRader_대응현황_' + (F.job || '전체') + '_' + todayISO() + '.xlsx');
  }

  /* 총괄: 담당자 관리 */
  function paintMembers() {
    var box = document.getElementById('rr-trk-members');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = '<div class="rr-trk-ct">담당자 관리 <small>총괄만 보입니다 · 등록한 이메일로 로그인 링크를 받을 수 있습니다</small></div>' +
      '<table class="rr-trk-t mem"><thead><tr><th>이메일</th><th>이름</th><th>직무</th><th>역할</th><th></th></tr></thead><tbody>' +
      MEMBERS.slice().sort(function (a, b) { return String(a.job || '').localeCompare(String(b.job || '')); }).map(function (m) {
        return '<tr><td>' + esc(m.email) + '</td><td>' + esc(m.name) + '</td><td>' + esc(m.job || '-') + '</td><td>' + (m.role === 'admin' ? '총괄' : '담당') + '</td>' +
          '<td>' + (m.email === me.email ? '' : '<button type="button" class="rr-trk-link" data-mem="del" data-email="' + esc(m.email) + '">삭제</button>') + '</td></tr>';
      }).join('') +
      '<tr class="add"><td><input id="rr-mem-email" type="email" placeholder="name@company.com"></td><td><input id="rr-mem-name" placeholder="이름"></td>' +
      '<td><select id="rr-mem-job">' + JOBS.map(function (j) { return '<option>' + j + '</option>'; }).join('') + '</select></td>' +
      '<td><select id="rr-mem-role"><option value="member">담당</option><option value="admin">총괄</option></select></td>' +
      '<td><button type="button" class="rr-trk-btn" data-mem="add">추가</button></td></tr></tbody></table><div class="rr-trk-note" id="rr-mem-note"></div>';
  }
  function memberAction(b) {
    var note = document.getElementById('rr-mem-note');
    if (b.dataset.mem === 'add') {
      var email = document.getElementById('rr-mem-email').value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { note.textContent = '이메일 주소를 확인해 주세요.'; return; }
      var row = { email: email, name: document.getElementById('rr-mem-name').value.trim(), job: document.getElementById('rr-mem-role').value === 'admin' ? null : document.getElementById('rr-mem-job').value, role: document.getElementById('rr-mem-role').value };
      sb.from('members').upsert(row).then(function (r) {
        if (r.error) { note.textContent = '추가하지 못했습니다: ' + r.error.message; return; }
        return load().then(paintMembers);
      });
    } else if (b.dataset.mem === 'del') {
      if (!confirm(b.dataset.email + ' 을(를) 담당자에서 삭제할까요?')) return;
      sb.from('members').delete().eq('email', b.dataset.email).then(function (r) {
        if (r.error) { note.textContent = '삭제하지 못했습니다: ' + r.error.message; return; }
        return load().then(paintMembers);
      });
    }
  }

  function paintAll() {
    paintBadge();
    paintDash();
    decorate();
    var m = document.getElementById('law-modal');
    if (m && m.classList.contains('show') && window.__rrBriefRefresh) window.__rrBriefRefresh();
  }

  /* 탭을 열면 다시 그린다 */
  function hookTab() {
    if (typeof window.switchMainTab !== 'function' || window.switchMainTab.__trk) return;
    var orig = window.switchMainTab;
    window.switchMainTab = function (t) {
      var r = orig.apply(this, arguments);
      if (t === 'tracker') { if (!sb && hasStoredSession()) afterAuth(); paintDash(); }
      return r;
    };
    window.switchMainTab.__trk = true;
  }
  var hn = 0, ht = setInterval(function () { hookTab(); paintBadge(); if (++hn > 40) clearInterval(ht); }, 250);

  /* 로그인해 둔 적이 있거나 메일 링크로 돌아왔으면 바로 연결 */
  if (hasStoredSession()) afterAuth();
  else paintBadge();

  window.rrTracker = { popupSection: popupSection, status: statusOf, openLogin: openLogin };

  var st = document.createElement('style');
  st.textContent = [
    '.rr-st { display:inline-block; margin-left:6px; font-size:10.5px; font-weight:800; padding:0 7px; border-radius:6px; line-height:1.6; white-space:nowrap; vertical-align:middle; }',
    '.rr-st.none { color:#718096; background:rgba(160,174,192,.18); } .rr-st.rev { color:#2b6cb0; background:rgba(66,153,225,.14); }',
    '.rr-st.need { color:#c05621; background:rgba(221,107,32,.14); } .rr-st.done { color:#2f855a; background:rgba(72,187,120,.16); } .rr-st.na { color:#4a5568; background:rgba(113,128,150,.14); }',
    '@media (prefers-color-scheme: dark) { .rr-st.none{color:#cbd5e0} .rr-st.rev{color:#90cdf4} .rr-st.need{color:#fbd38d} .rr-st.done{color:#9ae6b4} .rr-st.na{color:#e2e8f0} }',
    '.rr-trk-login { font-size:14px; color:var(--text-secondary,#4a5568); display:flex; align-items:center; gap:10px; flex-wrap:wrap; }',
    '.rr-trk { display:flex; flex-direction:column; gap:8px; }',
    '.rr-trk-grid { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:8px; }',
    '.rr-trk label { display:flex; flex-direction:column; gap:3px; font-size:12px; font-weight:700; color:var(--text-muted,#718096); }',
    '.rr-trk select, .rr-trk input, .rr-trk textarea { font:inherit; font-size:13.5px; padding:6px 8px; border:1px solid var(--border,#e2e8f0); border-radius:8px; background:var(--bg-card,#fff); color:var(--text-primary,#1a202c); width:100%; box-sizing:border-box; }',
    '.rr-trk textarea { resize:vertical; min-height:52px; }',
    '.rr-trk-foot { display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:12.5px; color:var(--text-muted,#718096); }',
    '.rr-trk-ro { font-weight:700; }',
    '.rr-trk-btn { border:0; border-radius:8px; padding:7px 14px; font:inherit; font-size:13px; font-weight:800; cursor:pointer; color:#fff; background:linear-gradient(135deg,#48bb78,#2f855a); }',
    '.rr-trk-btn.ghost { color:var(--text-secondary,#4a5568); background:var(--bg-card,#fff); border:1px solid var(--border,#e2e8f0); }',
    '.rr-trk-btn.wide { width:100%; padding:10px; margin-top:8px; }',
    '.rr-trk-btn:disabled { opacity:.6; cursor:default; }',
    '.rr-trk-link { border:0; background:none; padding:0; font:inherit; font-size:12.5px; font-weight:700; color:var(--primary,#667eea); cursor:pointer; text-decoration:none; }',
    '.rr-trk-log { font-size:12.5px; color:var(--text-secondary,#4a5568); background:var(--bg-primary,#f7fafc); border-radius:8px; padding:8px 10px; display:flex; flex-direction:column; gap:3px; }',
    '.rr-trk-who { margin:.6rem .2rem 0; padding:.6rem .6rem; border-top:1px solid var(--border); display:flex; flex-wrap:wrap; align-items:center; gap:.3rem .5rem; font-size:.8rem; }',
    '.rr-trk-who .n { font-weight:800; color:var(--text-primary); } .rr-trk-who .j { color:var(--text-muted); }',
    '.rr-trk-who button { margin-left:auto; border:1px solid var(--border); background:var(--bg-card); color:var(--text-secondary); border-radius:8px; font:inherit; font-size:.76rem; font-weight:700; padding:.25rem .6rem; cursor:pointer; }',
    '.rr-trk-who button.in { margin-left:0; width:100%; padding:.45rem; color:#2f855a; border-color:rgba(72,187,120,.5); }',
    '.rr-trk-modal { position:fixed; inset:0; background:rgba(15,23,42,.45); display:none; align-items:center; justify-content:center; z-index:10050; }',
    '.rr-trk-modal.show { display:flex; }',
    '.rr-trk-dialog { background:var(--bg-card,#fff); color:var(--text-primary,#1a202c); border-radius:16px; padding:18px 20px; width:min(420px, 92vw); box-shadow:0 20px 50px rgba(0,0,0,.25); }',
    '.rr-trk-dh { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; } .rr-trk-dh button { border:0; background:none; font-size:22px; cursor:pointer; color:var(--text-muted,#718096); }',
    '.rr-trk-dialog p { font-size:13.5px; color:var(--text-secondary,#4a5568); line-height:1.6; }',
    '.rr-trk-dialog input { width:100%; box-sizing:border-box; font:inherit; padding:9px 11px; border:1px solid var(--border,#e2e8f0); border-radius:10px; background:var(--bg-card,#fff); color:inherit; }',
    '.rr-trk-note { margin-top:8px; font-size:12.5px; color:var(--text-secondary,#4a5568); }',
    '#rr-trk-dash { display:flex; flex-direction:column; gap:1.1rem; }',
    '.rr-trk-hero, .rr-trk-card, .rr-trk-head { background:var(--bg-glass); backdrop-filter:blur(20px); border:1px solid var(--glass-border, var(--border)); border-radius:16px; padding:1.2rem 1.4rem; box-shadow:var(--glass-shadow); }',
    '.rr-trk-hero h2, .rr-trk-head h2 { margin:0 0 .3rem; font-size:1.3rem; color:var(--text-primary); } .rr-trk-hero p, .rr-trk-head p { margin:.2rem 0 .8rem; color:var(--text-secondary); font-size:.9rem; } .rr-trk-hero .sm { font-size:.8rem; color:var(--text-muted); margin-top:.8rem; }',
    '.rr-trk-head { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; } .rr-trk-head p { margin:0; } .rr-trk-actions { display:flex; gap:.5rem; }',
    '.rr-trk-ct { font-weight:800; color:var(--text-primary); margin-bottom:.7rem; } .rr-trk-ct small { font-weight:500; color:var(--text-muted); margin-left:.4rem; }',
    '.rr-trk-tw { overflow-x:auto; }',
    '.rr-trk-t { width:100%; border-collapse:collapse; font-size:.84rem; font-variant-numeric:tabular-nums; }',
    '.rr-trk-t th, .rr-trk-t td { padding:.45rem .55rem; border-bottom:1px solid var(--border); text-align:right; color:var(--text-secondary); white-space:nowrap; }',
    '.rr-trk-t th:first-child, .rr-trk-t td:first-child { text-align:left; } .rr-trk-t th { color:var(--text-muted); font-weight:700; }',
    '.rr-trk-t tbody tr[data-tjob] { cursor:pointer; } .rr-trk-t tbody tr[data-tjob]:hover, .rr-trk-t tr.on { background:rgba(102,126,234,.08); }',
    '.rr-trk-t td i { display:inline-block; width:9px; height:9px; border-radius:3px; margin-right:6px; }',
    '.rr-trk-t td.warn { color:#c05621; font-weight:800; } .rr-trk-t td.bad { color:#c53030; font-weight:800; }',
    '.rr-trk-bar { display:inline-block; width:70px; height:7px; border-radius:4px; background:rgba(160,174,192,.25); margin-right:6px; vertical-align:middle; overflow:hidden; } .rr-trk-bar span { display:block; height:100%; background:#48bb78; }',
    '.rr-trk-t.mem td, .rr-trk-t.mem th { text-align:left; } .rr-trk-t.mem input, .rr-trk-t.mem select { font:inherit; font-size:.82rem; padding:.3rem .45rem; border:1px solid var(--border); border-radius:6px; background:var(--bg-card); color:var(--text-primary); width:100%; box-sizing:border-box; }',
    '.rr-trk-filters { display:flex; gap:.5rem; flex-wrap:wrap; align-items:center; margin-bottom:.7rem; }',
    '.rr-trk-filters select, .rr-trk-filters input { font:inherit; font-size:.84rem; padding:.45rem .6rem; border:1px solid var(--border); border-radius:8px; background:var(--bg-card); color:var(--text-primary); }',
    '.rr-trk-filters input { flex:1; min-width:180px; } .rr-trk-filters .cnt { font-size:.8rem; font-weight:800; color:var(--primary); }',
    '.rr-trk-list { display:flex; flex-direction:column; gap:.3rem; }',
    '.rr-trk-row { display:grid; grid-template-columns:44px 72px minmax(0,1.6fr) 90px 92px minmax(0,1.2fr); align-items:center; gap:.6rem; padding:.45rem .6rem; border:1px solid var(--border); border-radius:10px; background:var(--bg-card); font-size:.84rem; }',
    '.rr-trk-row .dt { color:var(--text-muted); font-variant-numeric:tabular-nums; } .rr-trk-row .dd { font-size:.74rem; font-weight:800; color:#6b46c1; } .rr-trk-row .dd.hot { color:#c53030; } .rr-trk-row .dd.past { color:var(--text-muted); }',
    '.rr-trk-row .ttl { border:0; background:none; padding:0; text-align:left; font:inherit; font-weight:700; color:var(--text-primary); cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .rr-trk-row .ttl small { color:#0f766e; font-weight:800; }',
    '.rr-trk-row .jb { font-size:.76rem; color:var(--text-muted); display:inline-flex; align-items:center; gap:4px; } .rr-trk-row .jb i { width:8px; height:8px; border-radius:2px; }',
    '.rr-trk-row .qs { font:inherit; font-size:.8rem; padding:.25rem .35rem; border:1px solid var(--border); border-radius:6px; background:var(--bg-card); color:var(--text-primary); }',
    '.rr-trk-row .ac { font-size:.78rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
    '.rr-trk-empty { padding:1.2rem; text-align:center; color:var(--text-muted); font-size:.85rem; }',
    '@media (max-width: 900px) { .rr-trk-grid { grid-template-columns:repeat(2, minmax(0,1fr)); } .rr-trk-row { grid-template-columns:44px 64px minmax(0,1fr) 92px; } .rr-trk-row .jb, .rr-trk-row .ac { display:none; } }'
  ].join('\n');
  document.head.appendChild(st);
})();
