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
 *   .snapshot()           로그인했을 때 { resp, members, me } — 보고서 PPT 의 '대응 현황'용 (아니면 null)
 *   .keyOf(item) .jobOf(item)  엑셀(excel-fix.js)이 기록을 법령에 맞출 때 쓴다
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
  function icon(n) { return window.rrIcon ? window.rrIcon(n) : ''; }
  function canAnyJob() { return !!me && (me.role === 'admin' || !!me.job); }
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
      return { body: '<div class="rr-trk-login"><span>로그인하면 이 개정의 검토 · 조치를 기록할 수 있습니다</span>' +
        '<button type="button" class="rr-trk-btn" data-trk="login">' + icon('login') + '로그인</button></div>', extra: '' };
    }
    if (!me || me.role === 'guest') {
      return { body: '<div class="rr-trk-login"><span>' + esc(session.user.email) + ' 은(는) 등록된 담당자가 아닙니다. 총괄에게 등록을 요청하세요.</span>' +
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
      m.innerHTML = '<div class="rr-dlg" style="--dlg-w:440px" role="dialog" aria-label="담당자 로그인">' +
        '<div class="rr-dlg-h"><span class="rr-dlg-ic">' + icon('login') + '</span><div class="rr-dlg-t"><h2>담당자 로그인</h2><p>등록된 이메일로 로그인 링크를 보내 드립니다</p></div>' +
        '<button type="button" class="rr-dlg-x" data-x="1" aria-label="닫기">' + icon('x') + '</button></div>' +
        '<div class="rr-dlg-b"><section class="rr-box" style="display:flex;flex-direction:column;gap:10px">' +
        '<label class="rr-f"><span>이메일</span><input type="email" id="rr-trk-email" placeholder="name@company.com" autocomplete="email"></label>' +
        '<button type="button" class="rr-btn pri wide" id="rr-trk-send">' + icon('send') + '로그인 링크 받기</button>' +
        '<div class="rr-hint" id="rr-trk-note">메일의 링크를 누르면 이 사이트로 돌아와 로그인됩니다</div></section></div></div>';
      document.body.appendChild(m);
      m.addEventListener('click', function (e) { if (e.target === m || (e.target.closest && e.target.closest('[data-x]'))) m.classList.remove('show'); });
      m.querySelector('#rr-trk-send').addEventListener('click', function () {
        var email = m.querySelector('#rr-trk-email').value.trim().toLowerCase();
        var note = m.querySelector('#rr-trk-note');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { note.textContent = '이메일 주소를 확인해 주세요.'; return; }
        var btn = this; btn.disabled = true; note.textContent = '보내는 중…';
        client().then(function (c) {
          return c.auth.signInWithOtp({ email: email, options: { emailRedirectTo: /github\.io/.test(location.host) ? SITE : location.origin + location.pathname } });
        }).then(function (r) {
          if (r.error) throw r.error;
          note.innerHTML = '<b>' + esc(email) + '</b> 으로 로그인 링크를 보냈습니다. 메일함(스팸함 포함)을 확인하세요.';
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
    var nav = document.querySelector('.main-tab-navigation .rr-side-foot') || document.querySelector('.main-tab-navigation .main-tab-container') || document.querySelector('.main-tab-navigation');
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
      el.innerHTML = '<span class="av" aria-hidden="true">' + esc(nm.slice(0, 1)) + '</span><span class="who"><span class="n">' + esc(nm) + '</span>' + (nm === rl ? '' : '<span class="j">' + esc(rl) + '</span>') + '</span>' +
        '<button type="button" data-trk="logout" title="로그아웃" aria-label="로그아웃">' + icon('logout') + '</button>';
    } else if (session) {
      el.innerHTML = '<span class="av" aria-hidden="true">?</span><span class="who"><span class="n">미등록 계정</span></span><button type="button" data-trk="logout" title="로그아웃" aria-label="로그아웃">' + icon('logout') + '</button>';
    } else {
      el.innerHTML = '<button type="button" class="in" data-trk="login">' + icon('login') + '담당자 로그인</button>';
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
  /* 화면 조건: 직무 탭 · 보기(시행 전 대응 / 시행 후 미완료 / 올해 전체) · 상태 · 검색.
     보기 탭 숫자는 직무만 반영한다 (올해 전체 = 그 직무의 올해 개정 전부). 상태·검색은 그 안에서 거른다. */
  var F = { job: '', view: 'pre', status: '', q: '', who: '' };
  var VIEWS = [['pre', '시행 전 대응'], ['late', '시행 후 미완료'], ['all', '올해 전체']];
  function defJob() { return me && me.role !== 'admin' && me.job ? me.job : ''; }
  function resetF() { F.job = defJob(); F.view = 'pre'; F.status = ''; F.q = ''; }
  /* 누른 뒤 목록이 화면 밖이면 목록으로 내려간다 (예전 담당자 관리처럼 '눌러도 변화 없음'이 되지 않게) */
  function toList() {
    var el = document.querySelector('#rr-trk-dash .rr-trk-lc');
    if (!el) return;
    var t = el.getBoundingClientRect().top;
    if (t < 60 || t > window.innerHeight * 0.55) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function toGroup(g) {
    var el = document.getElementById('rr-trk-g-' + g) || document.querySelector('#rr-trk-dash .rr-trk-lc');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function toTop() {
    var el = document.getElementById('rr-trk-dash');
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function todayISO() { var k = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })); return k.getFullYear() + '-' + String(k.getMonth() + 1).padStart(2, '0') + '-' + String(k.getDate()).padStart(2, '0'); }
  /* 로그인 전 첫 화면: 무엇을 하는 곳인지 + 로그인 */
  function intro(action) {
    var steps = STATUSES.map(function (st) { return '<span class="rr-trk-chip ' + ST_CLS[st] + '"><i></i>' + st + '</span>'; }).join('<span class="rr-trk-arrow">' + icon('chevron') + '</span>');
    var jobs = JOBS.map(function (j) {
      var n = items().filter(function (it) { return jobOf(it) === j; }).length;
      return '<div class="rr-trk-pj"><i style="background:' + (window.rrCatColor ? window.rrCatColor(j) : '#999') + '"></i><span>' + j + '</span><b>' + n + '</b></div>';
    }).join('');
    return '<section class="rr-trk-intro rr-night">' +
        '<div class="rr-trk-eyebrow">' + icon('check') + '대응 현황 관리</div>' +
        '<h2>개정마다 검토 · 조치 · 완료를 기록하고<br>직무별 진행률을 한눈에 봅니다</h2>' +
        '<p>직무별 담당자는 자기 직무의 개정을, 총괄은 전체를 기록합니다. 누가 언제 무엇을 바꿨는지 이력이 자동으로 남습니다.</p>' +
        '<div class="rr-trk-act">' + action + '</div>' +
        '<div class="rr-trk-flow">' + steps + '</div>' +
      '</section>' +
      '<div class="rr-trk-feats">' +
        '<div class="rr-trk-feat"><span class="ri-solo">' + icon('chart') + '</span><b>직무별 진행률</b><p>8개 직무의 검토 완료율, 30일 안에 시행되는데 아직 끝나지 않은 건, 시행 후에도 남은 건을 바로 봅니다.</p></div>' +
        '<div class="rr-trk-feat"><span class="ri-solo">' + icon('clock') + '</span><b>기한 · 조치 관리</b><p>개정마다 영향도, 조치 내용, 조치 기한, 완료일, 증빙 링크를 남기고 기한이 지난 건을 챙깁니다.</p></div>' +
        '<div class="rr-trk-feat"><span class="ri-solo">' + icon('history') + '</span><b>변경 이력 · 보고</b><p>상태를 바꾸면 이력이 자동으로 쌓이고, 보고서 PPT의 ‘대응 현황’ 장에 그대로 들어갑니다.</p></div>' +
      '</div>' +
      '<div class="rr-trk-card rr-trk-preview"><div class="rr-trk-ct">올해 대응 대상</div><div class="rr-trk-pjs">' + jobs + '</div></div>';
  }
  function paintDash() {
    var host = document.getElementById('rr-trk-dash');
    if (!host) return;
    if (!session || !loaded) {
      host.innerHTML = intro('<button type="button" class="rr-trk-btn" data-trk="login">' + icon('login') + '담당자 로그인</button>' +
        '<span class="rr-trk-note2">등록된 이메일로만 로그인할 수 있습니다 · 등록은 총괄이 합니다</span>');
      return;
    }
    if (!me || me.role === 'guest') {
      host.innerHTML = intro('<button type="button" class="rr-trk-btn ghost" data-trk="logout">' + icon('logout') + '로그아웃</button>' +
        '<span class="rr-trk-note2">' + esc(session.user.email) + ' 은(는) 등록된 담당자가 아닙니다. 총괄에게 등록을 요청하세요.</span>');
      return;
    }
    if (F.who !== me.email) { F.who = me.email; resetF(); }
    var today = todayISO();
    var rows = items().map(function (it) { var r = RESP[keyOf(it)]; return { it: it, st: r ? r.status : '미검토', r: r || null }; });
    var done = function (x) { return x.st === '조치완료' || x.st === '해당없음'; };
    var isPre = function (x) { return x.it.daysUntil >= 0; };
    var isSoon = function (x) { return x.it.daysUntil >= 0 && x.it.daysUntil <= 30; };
    var isLater = function (x) { return x.it.daysUntil > 30; };
    var isLate = function (x) { return !done(x) && x.it.effectiveDate < today; };
    var SC = { '미검토': '#a3abba', '검토중': '#4a6ee0', '조치필요': '#e8762c', '조치완료': '#1f9d55', '해당없음': '#cfd5de' };
    var count = function (list) { var c = {}; STATUSES.forEach(function (s) { c[s] = 0; }); list.forEach(function (x) { c[x.st]++; }); return c; };
    var bar = function (c, n) { return '<div class="rr-trk-sbar">' + STATUSES.map(function (s) { return c[s] ? '<i style="flex:' + c[s] + ';background:' + SC[s] + '" title="' + s + ' ' + c[s] + '"></i>' : ''; }).join('') + (n ? '' : '<i style="flex:1;background:rgba(255,255,255,.12)"></i>') + '</div>'; };
    var owner = function (j) { var m = MEMBERS.filter(function (x) { return x.job === j && x.role !== 'admin'; })[0]; return m ? (m.name || m.email.split('@')[0]) : ''; };
    var ofJob = function (j) { return j ? rows.filter(function (x) { return jobOf(x.it) === j; }) : rows; };
    var nOpen = function (l) { return l.filter(function (x) { return !done(x); }).length; };
    var num = function (n) { return n.toLocaleString('ko-KR'); };
    var color = function (j) { return window.rrCatColor ? window.rrCatColor(j) : '#999'; };
    var view = ofJob(F.job);
    var pre = view.filter(isPre), soon = pre.filter(isSoon), later = pre.filter(isLater), late = view.filter(isLate);
    var pc = count(pre);
    var yearDone = view.length - nOpen(view), yearPct = view.length ? Math.round(yearDone / view.length * 100) : 0;

    /* 1) 직무 탭 — 탭 숫자는 그 직무의 시행 전 미완료 */
    var badge = function (j) { var n = nOpen(ofJob(j).filter(isPre)); return n ? '<em>' + num(n) + '</em>' : ''; };
    var role = me.role === 'admin' ? '' : (me.job || '') + ' 담당' + (canAnyJob() ? '' : ' · 보기 전용');
    var tabs = '<div class="rr-trk-toolbar"><nav class="rr-trk-tabs">' + [''].concat(JOBS).map(function (j) {
        return '<button type="button" data-tjob="' + j + '" class="' + (F.job === j ? 'on' : '') + '">' + (j ? '<i style="background:' + color(j) + '"></i>' + j : '전체') + badge(j) + '</button>';
      }).join('') + '</nav>' +
      '<div class="act">' + (role ? '<span class="who">' + esc(role) + '</span>' : '') +
        '<button type="button" class="rr-btn" id="rr-trk-xls">' + icon('sheet') + '엑셀</button>' +
        (me.role === 'admin' ? '<button type="button" class="rr-btn" id="rr-trk-mem">' + icon('users') + '담당자 관리</button>' : '') + '</div></div>';

    /* 2) 시행 전 대응 — 이 화면의 중심. 단계 숫자를 누르면 그 건들만 */
    var pipe = '<div class="rr-trk-pipe">' + STATUSES.map(function (s, i) {
        return (i >= 1 && i <= 3 ? '<span class="arr">' + icon('chevron') + '</span>' : i === 4 ? '<span class="sep"></span>' : '') +
          '<button type="button" data-tst="' + s + '" class="' + (F.view === 'pre' && F.status === s ? 'on' : '') + '"><i style="background:' + SC[s] + '"></i>' + s + '<b>' + num(pc[s]) + '</b></button>';
      }).join('') + '</div>';
    var who = F.job ? F.job + (owner(F.job) ? ' · ' + owner(F.job) : '') : '전체 직무';
    var focus = '<section class="rr-trk-focus rr-night">' +
      '<div class="l"><div class="rr-trk-eyebrow">' + icon('clock') + '시행 전 대응 · ' + esc(who) + '</div>' +
        '<div class="big"><b>' + num(nOpen(pre)) + '</b><span>건 미완료<br><em>시행 예정 ' + num(pre.length) + '건 중</em></span></div>' +
        '<div class="split">' +
          '<button type="button" data-tgrp="soon"><span>30일 내 시행</span><b>' + num(nOpen(soon)) + '<small> / ' + num(soon.length) + '</small></b></button>' +
          '<button type="button" data-tgrp="later"><span>31일 이후 시행</span><b>' + num(nOpen(later)) + '<small> / ' + num(later.length) + '</small></b></button>' +
        '</div></div>' +
      '<div class="r">' + pipe + bar(pc, pre.length) + '</div></section>';
    var side = '<section class="rr-trk-side">' +
      '<button type="button" data-tgo="late" class="' + (F.view === 'late' && !F.status ? 'on' : '') + '"><span class="k">시행 후 미완료</span><span class="v' + (late.length ? ' bad' : '') + '">' + num(late.length) + '<small>건</small></span></button>' +
      '<div><span class="k">올해 검토 완료</span><span class="v">' + yearPct + '<small>%</small></span><span class="pbar"><i style="width:' + yearPct + '%"></i></span><span class="s">' + num(yearDone) + ' / ' + num(view.length) + '건</span></div>' +
      '</section>';

    /* 3) 전체 탭에서만: 직무별 현황 표 (행을 누르면 그 직무 탭) */
    var table = '';
    if (!F.job) {
      var cell = function (op, all, cls) { return all ? '<b class="' + (op ? cls : 'zero') + '">' + num(op) + '</b><span class="of"> / ' + num(all) + '</span>' : '<span class="na">–</span>'; };
      table = '<section class="rr-trk-card rr-trk-tbl"><div class="rr-trk-th">직무별 현황</div><div class="sc"><table>' +
        '<thead><tr><th>직무</th><th>담당자</th><th>30일 내 시행<small>미완료 / 전체</small></th><th>31일 이후 시행<small>미완료 / 전체</small></th><th>시행 후 미완료</th><th>올해 검토 완료</th></tr></thead><tbody>' +
        JOBS.map(function (j) {
          var l = ofJob(j), a = l.filter(isSoon), b = l.filter(isLater), lt = l.filter(isLate).length;
          var pp = l.length ? Math.round((l.length - nOpen(l)) / l.length * 100) : 0;
          return '<tr data-tjob="' + j + '"><td><i style="background:' + color(j) + '"></i>' + j + '</td>' +
            '<td>' + (owner(j) ? esc(owner(j)) : '<span class="na">미지정</span>') + '</td>' +
            '<td>' + cell(nOpen(a), a.length, 'warn') + '</td><td>' + cell(nOpen(b), b.length, 'hi') + '</td>' +
            '<td>' + (lt ? '<b class="bad">' + num(lt) + '</b>' : '<span class="na">0</span>') + '</td>' +
            '<td><span class="pc"><span class="pbar"><i style="width:' + pp + '%"></i></span>' + pp + '%</span></td></tr>';
        }).join('') + '</tbody></table></div></section>';
    }

    /* 4) 목록 — 시행 시기별로 묶는다 */
    var matchF = function (x) {
      if (F.status && x.st !== F.status) return false;
      if (F.q && (x.it.title + ' ' + ((x.r && x.r.action) || '')).toLowerCase().indexOf(F.q) < 0) return false;
      return true;
    };
    var asc = function (a, b) { return String(a.it.effectiveDate).localeCompare(String(b.it.effectiveDate)); };
    var desc = function (a, b) { return asc(b, a); };
    var groups = F.view === 'pre' ? [['soon', '30일 내 시행', soon, asc], ['later', '31일 이후 시행', later, asc]]
      : F.view === 'late' ? [['late', '시행 후 미완료 · 최근 시행 순', late, desc]]
      : [['soon', '30일 내 시행', soon, asc], ['later', '31일 이후 시행', later, asc], ['past', '시행 완료 · 최근 시행 순', view.filter(function (x) { return x.it.daysUntil < 0; }), desc]];
    var rowHtml = function (x) {
      var it = x.it, d = it.daysUntil, r = x.r || {};
      var dd = d < 0 ? '<span class="dd past">+' + (-d) + '일</span>' : d === 0 ? '<span class="dd hot">D-DAY</span>' : '<span class="dd ' + (d <= 30 ? 'hot' : '') + '">D-' + d + '</span>';
      var due = r.due_date ? '<span class="due' + (!done(x) && r.due_date < today ? ' over' : '') + '">' + icon('clock') + esc(String(r.due_date).slice(5).replace('-', '.')) + '</span>' : '<span class="due none"></span>';
      return '<div class="rr-trk-row' + (done(x) ? ' done' : '') + '" data-tk="' + esc(keyOf(it)) + '">' +
        '<span class="dt">' + esc(String(it.effectiveDate).slice(5).replace('-', '.')) + '</span>' + dd +
        '<button type="button" class="ttl" data-eid="' + esc(it.id) + '">' + esc(it.title) + (it.kind ? ' <small>' + esc(it.kind) + '</small>' : '') + '</button>' +
        '<span class="jb"><i style="background:' + color(jobOf(it)) + '"></i>' + esc(jobOf(it)) + '</span>' + due +
        (canEdit(it) ? '<select class="qs st-' + ST_CLS[x.st] + '" data-quick="1">' + STATUSES.map(function (s) { return '<option' + (s === x.st ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>'
          : '<span class="rr-st ' + ST_CLS[x.st] + '">' + esc(x.st) + '</span>') +
        '<span class="ac" title="' + esc(r.action || '') + '">' + esc(r.action || '') + '</span></div>';
    };
    var shown = 0;
    var body = groups.map(function (g) {
      var l = g[2].filter(matchF).sort(g[3]);
      shown += l.length;
      if (!l.length) return '';
      var op = nOpen(l);
      return '<div class="rr-trk-gh' + (g[0] === 'soon' ? ' hot' : '') + '" id="rr-trk-g-' + g[0] + '"><b>' + g[1] + '</b><span>' + num(l.length) + '건' + (g[0] !== 'late' && op ? ' · 미완료 ' + num(op) : '') + '</span></div>' +
        l.slice(0, 400).map(rowHtml).join('') + (l.length > 400 ? '<div class="rr-trk-empty">앞의 400건만 보입니다. 검색으로 좁혀 보세요.</div>' : '');
    }).join('');
    var vcount = { pre: pre.length, late: late.length, all: view.length };
    var filtered = !!(F.status || F.q);
    var plain = F.job === defJob() && F.view === 'pre' && !filtered;
    var reset = plain ? '' : '<button type="button" class="rr-btn mini" data-treset="1">' + icon('refresh') + '초기화</button>';
    var listHtml = '<section class="rr-trk-card rr-trk-lc' + (F.job ? ' onejob' : '') + '">' +
      '<div class="rr-trk-lh"><span class="rr-seg">' + VIEWS.map(function (v) {
          return '<button type="button" data-tview="' + v[0] + '" class="' + (F.view === v[0] ? 'on' : '') + '">' + v[1] + '<em>' + num(vcount[v[0]]) + '</em></button>';
        }).join('') + '</span>' +
        '<select id="rr-trk-fst"><option value="">모든 상태</option>' + STATUSES.map(function (s) { return '<option' + (F.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
        '<input type="search" id="rr-trk-fq" placeholder="법규명 · 조치 내용 검색" value="' + esc(F.q) + '">' +
        (filtered ? '<span class="rr-trk-shown">' + num(shown) + '건 표시</span>' : '') + reset + '</div>' +
      '<div class="rr-trk-list">' + (body || '<div class="rr-trk-empty">조건에 맞는 개정이 없습니다.' + (reset ? ' ' + reset : '') + '</div>') + '</div></section>';
    host.innerHTML = tabs + '<div class="rr-trk-head2">' + focus + side + '</div>' + table + listHtml;
  }
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'rr-trk-fst') { F.status = t.value; paintDash(); }
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
    if (!e.target.closest) return;
    /* 직무 탭 · 직무별 현황 표의 행 */
    var tr = e.target.closest('[data-tjob]');
    if (tr) { var inTbl = !!tr.closest('.rr-trk-tbl'); F.job = tr.dataset.tjob || ''; paintDash(); if (inTbl) toTop(); return; }
    /* 시행 전 대응의 단계(미검토 → … → 조치완료): 시행 전 건 중 그 상태만. 다시 누르면 해제 */
    var ts = e.target.closest('[data-tst]');
    if (ts) { var st = ts.dataset.tst; if (F.view === 'pre' && F.status === st) F.status = ''; else { F.view = 'pre'; F.status = st; } paintDash(); toList(); return; }
    /* 30일 내 시행 · 31일 이후 시행: 목록의 그 묶음으로 */
    var tg = e.target.closest('[data-tgrp]');
    if (tg) { F.view = 'pre'; F.status = ''; paintDash(); toGroup(tg.dataset.tgrp); return; }
    /* 시행 후 미완료 */
    var go = e.target.closest('[data-tgo]');
    if (go) { F.view = go.dataset.tgo; F.status = ''; paintDash(); toList(); return; }
    var tv = e.target.closest('[data-tview]');
    if (tv) { F.view = tv.dataset.tview; paintDash(); return; }
    if (e.target.closest('[data-treset]')) { resetF(); paintDash(); return; }
    var bt = e.target.closest && e.target.closest('#rr-trk-xls, #rr-trk-mem');
    if (bt && bt.id === 'rr-trk-xls') exportXlsx();
    if (bt && bt.id === 'rr-trk-mem') paintMembers();
    var mb = e.target.closest && e.target.closest('[data-mem]');
    if (mb) memberAction(mb);
  });

  /* 분기별 엑셀과 같은 양식 (excel-fix.js) — 앞쪽에 개정 내용, 뒤쪽에 여기 기록한 대응 칸 */
  function exportXlsx() {
    if (!window.rrExcel) { alert('엑셀 모듈을 불러오는 중입니다. 잠시 뒤 다시 눌러 주세요.'); return; }
    var job = F.job || '', y = window.RR_YEAR || '';
    rrExcel.build({
      items: items().filter(function (it) { return !job || jobOf(it) === job; }),
      sheet: y + '년 ' + (job || '전체'), title: y + '년 ' + (job || '전체 직무'),
      file: y + '_대응현황_' + (job || '전체') + '_{date}.xlsx'
    });
  }


  /* 총괄: 담당자 관리 — 버튼을 누르면 바로 앞에 창으로 뜬다 (예전에는 긴 목록 맨 아래에 붙어서 눌러도 안 보였다) */
  function paintMembers() {
    var m = document.getElementById('rr-trk-mem-modal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'rr-trk-mem-modal';
      m.className = 'rr-trk-modal';
      document.body.appendChild(m);
      m.addEventListener('click', function (e) { if (e.target === m || (e.target.closest && e.target.closest('[data-x]'))) m.classList.remove('show'); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') m.classList.remove('show'); });
    }
    var keep = { email: '', name: '', job: JOBS[0], role: 'member' };
    ['email', 'name', 'job', 'role'].forEach(function (f) { var el = document.getElementById('rr-mem-' + f); if (el) keep[f] = el.value; });
    var dot = function (j) { return window.rrCatColor ? window.rrCatColor(j) : '#999'; };
    var person = function (x) {
      return '<div class="rr-mem-p"><span class="av">' + esc((x.name || x.email).slice(0, 1)) + '</span><span class="who"><b>' + esc(x.name || x.email.split('@')[0]) + '</b><small>' + esc(x.email) + '</small></span>' +
        (x.email === me.email ? '<span class="rr-mem-me">나</span>' : '<button type="button" class="rr-btn mini" data-mem="del" data-email="' + esc(x.email) + '">삭제</button>') + '</div>';
    };
    var rows = JOBS.map(function (j) {
      var ps = MEMBERS.filter(function (x) { return x.job === j && x.role !== 'admin'; });
      return '<div class="rr-mem-row"><span class="rr-mem-job"><i style="background:' + dot(j) + '"></i>' + j + '</span><div class="rr-mem-ps">' +
        (ps.length ? ps.map(person).join('') : '<span class="rr-mem-none">담당자 없음</span><button type="button" class="rr-btn mini" data-mem="pick" data-job="' + j + '">' + icon('plus') + '지정</button>') + '</div></div>';
    }).join('');
    var admins = MEMBERS.filter(function (x) { return x.role === 'admin'; });
    m.innerHTML = '<div class="rr-dlg" style="--dlg-w:640px" role="dialog" aria-label="담당자 관리">' +
      '<div class="rr-dlg-h"><span class="rr-dlg-ic">' + icon('users') + '</span><div class="rr-dlg-t"><h2>담당자 관리</h2></div>' +
      '<button type="button" class="rr-dlg-x" data-x="1" aria-label="닫기">' + icon('x') + '</button></div>' +
      '<div class="rr-dlg-b">' +
        '<section class="rr-box" id="rr-mem-add"><div class="rr-box-h">담당자 등록</div>' +
          '<div class="rr-grid2">' +
            '<label class="rr-f"><span>이메일</span><input id="rr-mem-email" type="email" placeholder="name@company.com" value="' + esc(keep.email) + '"></label>' +
            '<label class="rr-f"><span>이름</span><input id="rr-mem-name" type="text" placeholder="홍길동" value="' + esc(keep.name) + '"></label>' +
            '<label class="rr-f"><span>역할</span><select id="rr-mem-role"><option value="member"' + (keep.role === 'member' ? ' selected' : '') + '>직무 담당</option><option value="admin"' + (keep.role === 'admin' ? ' selected' : '') + '>총괄</option></select></label>' +
            '<label class="rr-f"><span>직무</span><select id="rr-mem-job"' + (keep.role === 'admin' ? ' disabled' : '') + '>' + JOBS.map(function (j) { return '<option' + (j === keep.job ? ' selected' : '') + '>' + j + '</option>'; }).join('') + '</select></label>' +
          '</div>' +
          '<div style="display:flex;justify-content:flex-end;margin-top:12px"><button type="button" class="rr-btn pri" data-mem="add">' + icon('plus') + '등록</button></div>' +
          '<div class="rr-msg" id="rr-mem-note"></div>' +
        '</section>' +
        '<section class="rr-box"><div class="rr-box-h">직무별 담당자<small>' + MEMBERS.filter(function (x) { return x.role !== 'admin'; }).length + '명</small></div>' + rows + '</section>' +
        '<section class="rr-box"><div class="rr-box-h">총괄<small>전체 직무를 고칠 수 있습니다</small></div>' + (admins.length ? admins.map(person).join('') : '<span class="rr-mem-none">없음</span>') + '</section>' +
      '</div>' +
      '<div class="rr-dlg-f"><button type="button" class="rr-btn" data-x="1">닫기</button></div></div>';
    var role = m.querySelector('#rr-mem-role');
    role.onchange = function () { m.querySelector('#rr-mem-job').disabled = role.value === 'admin'; };
    m.classList.add('show');
  }
  function memberAction(b) {
    var note = document.getElementById('rr-mem-note');
    var say = function (kind, t) { if (note) { note.className = 'rr-msg ' + kind; note.textContent = t; } };
    if (b.dataset.mem === 'pick') {
      var js = document.getElementById('rr-mem-job'), rs = document.getElementById('rr-mem-role');
      if (rs) rs.value = 'member';
      if (js) { js.disabled = false; js.value = b.dataset.job; }
      var em = document.getElementById('rr-mem-email');
      if (em) { em.scrollIntoView({ block: 'center', behavior: 'smooth' }); em.focus(); }
      return;
    }
    if (b.dataset.mem === 'add') {
      var email = document.getElementById('rr-mem-email').value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('err', '이메일 주소를 확인해 주세요.'); return; }
      var isAdmin = document.getElementById('rr-mem-role').value === 'admin';
      var row = { email: email, name: document.getElementById('rr-mem-name').value.trim(), job: isAdmin ? null : document.getElementById('rr-mem-job').value, role: isAdmin ? 'admin' : 'member' };
      b.disabled = true;
      sb.from('members').upsert(row).then(function (r) {
        b.disabled = false;
        if (r.error) { say('err', '추가하지 못했습니다: ' + r.error.message); return; }
        ['rr-mem-email', 'rr-mem-name'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
        return load().then(function () { paintMembers(); if (window.rrToast) window.rrToast((row.name || email) + ' 님을 ' + (isAdmin ? '총괄로' : row.job + ' 담당으로') + ' 등록했습니다'); });
      });
    } else if (b.dataset.mem === 'del') {
      if (!confirm(b.dataset.email + ' 을(를) 담당자에서 삭제할까요?')) return;
      sb.from('members').delete().eq('email', b.dataset.email).then(function (r) {
        if (r.error) { say('err', '삭제하지 못했습니다: ' + r.error.message); return; }
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

  /* 보고서(report-ppt.js)용: 로그인한 담당자·총괄에게만 기록 전체를 건넨다 */
  function snapshot() {
    if (!loaded || !me || me.role === 'guest') return null;
    return { resp: RESP, members: MEMBERS.slice(), me: me };
  }
  window.rrTracker = { popupSection: popupSection, status: statusOf, openLogin: openLogin, snapshot: snapshot, keyOf: keyOf, jobOf: jobOf };

  var st = document.createElement('style');
  st.textContent = [
    '.rr-st { display:inline-block; margin-left:6px; font-size:10.5px; font-weight:800; padding:0 7px; border-radius:6px; line-height:1.6; white-space:nowrap; vertical-align:middle; }',
    '.rr-st.none { color:#718096; background:rgba(160,174,192,.18); } .rr-st.rev { color:#2b6cb0; background:rgba(66,153,225,.14); }',
    '.rr-st.need { color:#c05621; background:rgba(221,107,32,.14); } .rr-st.done { color:#2f855a; background:rgba(72,187,120,.16); } .rr-st.na { color:#4a5568; background:rgba(113,128,150,.14); }',
    '.rr-trk-login { font-size:14px; color:var(--text-secondary,#4a5568); display:flex; align-items:center; gap:10px; flex-wrap:wrap; }',
    '.rr-trk { display:flex; flex-direction:column; gap:8px; }',
    '.rr-trk-grid { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:8px; }',
    '.rr-trk label { display:flex; flex-direction:column; gap:3px; font-size:12px; font-weight:700; color:var(--text-muted,#718096); }',
    '.rr-trk select, .rr-trk input, .rr-trk textarea { font:inherit; font-size:13.5px; padding:6px 8px; border:1px solid var(--border,#e2e8f0); border-radius:8px; background:var(--bg-card,#fff); color:var(--text-primary,#1a202c); width:100%; box-sizing:border-box; }',
    '.rr-trk textarea { resize:vertical; min-height:52px; }',
    '.rr-trk-foot { display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:12.5px; color:var(--text-muted,#718096); }',
    '.rr-trk-ro { font-weight:700; }',
    '.rr-trk-btn { border:1px solid var(--brand); border-radius:8px; padding:7px 14px; font:inherit; font-size:13px; font-weight:700; cursor:pointer; color:#fff; background:var(--brand); box-shadow:0 1px 2px rgba(17,24,39,.12), inset 0 1px 0 rgba(255,255,255,.14); } .rr-trk-btn:hover { background:var(--brand-hover); }',
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
    '.rr-trk-bar { display:inline-block; width:70px; height:6px; border-radius:4px; background:var(--surface-3); margin-right:6px; vertical-align:middle; overflow:hidden; } .rr-trk-bar span { display:block; height:100%; background:var(--brand); border-radius:4px; }',
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
