/* 기업별 검토 결과 클라우드 저장 — RegRader 의 Supabase(대응 현황 관리와 같은 프로젝트 · 같은 로그인 · 같은 구성원)에
 * 회사별 검토(맞음/아님 답 · 법령/행정규칙 체크)를 저장하고, 어느 컴퓨터에서든 회사를 검색하면 불러온다.
 * 표 · 권한: scripts/supabase_pro_reviews.sql. 여기 키는 브라우저용 공개 키(anon)이고, 자료는 로그인 + 구성원 권한으로 보호된다.
 * 같은 사이트(github.io) 안이라 RegRader 에서 로그인하면 이 화면도 로그인된 상태다.
 *
 *   rrCloud.status()          → Promise<{ on, email, member, error }>   on: 저장 · 불러오기 가능
 *   rrCloud.load(key)         → Promise<{ data, updated_by, updated_at } | null>
 *   rrCloud.save(key, company, data) → Promise
 *   rrCloud.remove(key)       → Promise
 *   rrCloud.signIn(email, password?) → Promise   비밀번호가 없으면 로그인 링크를 메일로
 *   rrCloud.signOut()
 */
(function () {
  'use strict';
  var URL_ = 'https://gzlyjwvounwdubdvwjen.supabase.co';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6bHlqd3ZvdW53ZHViZHZ3amVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNTg1NTcsImV4cCI6MjEwNTkzNDU1N30.zpEcAFk2xg87xYAEminrsGNJM79NWDeuzKhgL707ShM';
  var LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
  var SITE = 'https://tjdudfhr.github.io/RegRader/';
  var sb = null, libP = null, stP = null;

  function lib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return libP || (libP = new Promise(function (ok, bad) {
      var s = document.createElement('script');
      s.src = LIB; s.onload = ok; s.onerror = function () { libP = null; bad(new Error('클라우드 저장 라이브러리를 받지 못했습니다')); };
      document.head.appendChild(s);
    }));
  }
  function client() {
    return lib().then(function () {
      if (!sb) sb = window.supabase.createClient(URL_, ANON, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } });
      return sb;
    });
  }
  function msg(e) {
    var m = String((e && (e.message || e.error_description)) || e || '');
    if (/pro_reviews/.test(m) && /schema cache|does not exist/.test(m)) return '클라우드 저장 표가 아직 없습니다 (scripts/supabase_pro_reviews.sql 실행 필요)';
    if (/Invalid login credentials/.test(m)) return '이메일 또는 비밀번호가 맞지 않습니다';
    if (/rate limit/i.test(m)) return '잠시 뒤에 다시 시도해 주세요 (메일 발송 한도)';
    return m || '클라우드 저장에 연결하지 못했습니다';
  }
  function status(fresh) {
    if (stP && !fresh) return stP;
    stP = client().then(function (c) { return c.auth.getSession(); }).then(function (r) {
      var s = r && r.data && r.data.session;
      if (!s) return { on: false };
      var email = s.user && s.user.email;
      return sb.rpc('is_member').then(function (m) {
        if (m.error) return { on: false, email: email, error: msg(m.error) };
        if (!m.data) return { on: false, email: email, member: false, error: '구성원 목록에 없는 이메일입니다 (대응 현황 관리의 구성원으로 등록해야 합니다)' };
        return sb.from('pro_reviews').select('key').limit(1).then(function (q) {
          return q.error ? { on: false, email: email, member: true, error: msg(q.error) } : { on: true, email: email, member: true };
        });
      });
    }).catch(function (e) { return { on: false, error: msg(e) }; });
    return stP;
  }
  function load(key) {
    return status().then(function (st) {
      if (!st.on) return null;
      return sb.from('pro_reviews').select('data, updated_by, updated_at').eq('key', key).maybeSingle().then(function (r) { return r.error ? null : r.data; });
    }).catch(function () { return null; });
  }
  function save(key, company, data) {
    return status().then(function (st) {
      if (!st.on) return { ok: false };
      return sb.from('pro_reviews').upsert({ key: key, company: company || '', data: data }).select('updated_by, updated_at').maybeSingle()
        .then(function (r) { return r.error ? { ok: false, error: msg(r.error) } : { ok: true, row: r.data }; });
    });
  }
  function remove(key) {
    return status().then(function (st) { return st.on ? sb.from('pro_reviews').delete().eq('key', key) : null; });
  }
  function signIn(email, password) {
    return client().then(function (c) {
      return password ? c.auth.signInWithPassword({ email: email, password: password })
        : c.auth.signInWithOtp({ email: email, options: { emailRedirectTo: /github\.io/.test(location.host) ? SITE : location.origin + location.pathname } });
    }).then(function (r) {
      if (r.error) throw new Error(msg(r.error));
      stP = null;
      return { sent: !password };
    });
  }
  function signOut() { return client().then(function (c) { stP = null; return c.auth.signOut(); }); }

  window.rrCloud = { status: status, load: load, save: save, remove: remove, signIn: signIn, signOut: signOut };
})();
