/* RegRader 회사 보기 (?company=<회사>) — RegRader Pro 브라우저판이 이 브라우저에 만들어 둔 회사 데이터로 RegRader 화면을 그린다.
 *
 * RegRader 화면(index.html · watch.html · history.html)의 <head> 맨 앞에서 불린다. 주소에 ?company= 가 없으면 아무것도 하지 않는다.
 *   - base_laws_207 · law_families · admrul_index · m0~m7 · meta · upcoming_next · changelog · quarterly_details
 *       → 'RegRader로 보내기' 때 IndexedDB(regrader-pro)에 저장한 회사 판정(계열 · 고른 행정규칙)으로
 *         열 때마다 최신 전체 수집(매일 갱신)에서 다시 골라 만든다 (rr-static.js). 전체 수집 기준일이 같으면 저장해 둔 것을 쓴다.
 *         → 화면 · 엑셀 · 보고서 PPT 가 매일 최신. 다시 만들지 못하면 저장해 둔 것으로 보여 준다
 *   - 내려받는 파일 이름 · 제목의 '당사' 자리에 회사 이름 (window.RR_WHO)
 *   - amend_details · amend_flags (개정문 분석) → 전체 법률 수집 결과에서 이 회사 개정만 골라 쓴다
 * 서버로 보내는 것은 없다.
 */
(function () {
  'use strict';
  var slug = new URLSearchParams(location.search).get('company');
  var HOME = window.RR_PRO_HOME || './pro/';
  if (!slug) {
    if (window.RR_PRO_HOME && !/[?&]embed=1/.test(location.search)) location.replace(HOME);   /* 회사 화면 사본: 회사를 안 고르면 Pro 로 */
    return;
  }
  var DATA = window.RR_PRO_DATA || 'https://raw.githubusercontent.com/tjdudfhr/RegRader/pro-data/';
  var FILES = ['base_laws_207.json', 'law_families.json', 'admrul_index.json', 'upcoming_next.json', 'changelog.json', 'meta.json',
    'quarterly_details.json', 'pro_company.json'].concat([0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { return 'm' + i + '.json'; }));
  var realFetch = window.fetch.bind(window);
  window.RR_PRO_COMPANY = slug;
  window.RR_WHO = slug;   /* 내려받는 파일 이름 · 보고서 제목의 '당사' 자리 (download-ui · report-ppt · excel-fix · stats-ui) */
  var UNIVERSE = ['base_laws_207', 'law_families', 'admrul_candidates', 'admrul_events', 'upcoming_next', 'meta']
    .concat([0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { return 'm' + i; }));

  function db() {
    return new Promise(function (ok) {
      var req = indexedDB.open('regrader-pro', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('companies', { keyPath: 'slug' }); };
      req.onerror = function () { ok(null); };
      req.onsuccess = function () { ok(req.result); };
    });
  }
  function load() {
    return db().then(function (d) {
      if (!d) return null;
      return new Promise(function (ok) {
        try {
          var g = d.transaction('companies', 'readonly').objectStore('companies').get(slug);
          g.onsuccess = function () { ok(g.result || null); };
          g.onerror = function () { ok(null); };
        } catch (e) { ok(null); }
      });
    });
  }
  function save(r) {
    return db().then(function (d) {
      if (!d) return;
      try { d.transaction('companies', 'readwrite').objectStore('companies').put(r); } catch (e) { /* 저장 못 해도 화면은 그린다 */ }
    });
  }
  function getJSON(url) { return realFetch(url, { cache: 'no-cache' }).then(function (res) { if (!res.ok) throw new Error(url); return res.json(); }); }

  /* 최신 전체 수집으로 다시 만들기: 기준일(meta.asOf · generatedAt)이 바뀌었을 때만 */
  function refresh(r) {
    if (!r || !r.families || !window.rrStatic) return Promise.resolve(r);   // 예전 방식으로 저장한 회사는 그대로 (다시 보내면 자동 갱신)
    return getJSON(DATA + 'universe/meta.json').then(function (um) {
      var old = (r.files && r.files['meta.json']) || {};
      if (old.asOf === um.asOf && old.generatedAt === um.generatedAt) return r;
      return Promise.all(UNIVERSE.map(function (n) { return getJSON(DATA + 'universe/' + n + '.json'); })).then(function (all) {
        var u = {};
        UNIVERSE.forEach(function (n, i) { u[n + '.json'] = all[i]; });
        r.files = window.rrStatic.build(r.families, r.company, u, { keep: r.keep, treeIds: r.treeIds });
        r.refreshedAt = new Date().toISOString();
        save(r);
        return r;
      });
    }).catch(function () { return r; });
  }

  var rec = load().then(refresh);
  function reply(data) { return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }); }
  function keys(r) {
    var out = {};
    for (var i = 0; i < 8; i++) (r.files['m' + i + '.json'] || []).forEach(function (x) { out[x.t + '|' + x.d + '|' + x.a] = 1; });
    return out;
  }
  function amend(name, r) {
    return realFetch(DATA + 'universe/' + name, { cache: 'no-cache' }).then(function (res) { return res.json(); }).then(function (doc) {
      var ks = keys(r), items = {}, at = {}, reasons = [];
      Object.keys(doc.items || {}).forEach(function (k) {
        if (!ks[k]) return;
        var v = doc.items[k];
        if (doc.reasons && typeof v.r === 'number') {
          if (!(v.r in at)) { at[v.r] = reasons.length; reasons.push(doc.reasons[v.r]); }
          v = Object.assign({}, v, { r: at[v.r] });
        }
        items[k] = v;
      });
      var out = Object.assign({}, doc, { items: items });
      if (doc.reasons) out.reasons = reasons;
      return out;
    });
  }

  window.fetch = function (input, init) {
    var url = new URL(typeof input === 'string' ? input : input.url, location.href);
    var name = url.pathname.split('/').pop();
    if (url.origin !== location.origin) return realFetch(input, init);
    if (FILES.indexOf(name) >= 0 || name === 'amend_details.json' || name === 'amend_flags.json' || name === 'previous_index.json') {
      return rec.then(function (r) {
        if (!r) return realFetch(input, init);
        if (name === 'previous_index.json') return reply({ items: [] });
        if (name === 'amend_details.json' || name === 'amend_flags.json') return amend(name, r).then(reply, function () { return reply({ items: {} }); });
        return reply(r.files[name]);
      });
    }
    return realFetch(input, init);
  };

  function ui() {
    /* 시행 임박 · 업데이트 내역 탭(iframe)도 같은 회사로 */
    document.querySelectorAll('iframe.rr-embed[data-src]').forEach(function (f) {
      if (f.dataset.src.indexOf('company=') < 0) f.dataset.src += (f.dataset.src.indexOf('?') < 0 ? '?' : '&') + 'company=' + encodeURIComponent(slug);
    });
    if (/[?&]embed=1/.test(location.search)) return;
    rec.then(function (r) {
      /* 회사 이름: 화면 맨 위(앱 바) · 사이드바 · 탭 제목 (company-chip.js) */
      var home = window.RR_PRO_HOME ? HOME : location.pathname;
      var label = window.RR_PRO_HOME ? '다른 회사 검색' : '원래 화면';
      if (!window.rrCompanyChip) return;
      if (r) {
        var p = r.files['pro_company.json'] || {};
        window.rrCompanyChip({ company: r.company, laws: p.laws, admin: p.admin, date: p.date, home: home, homeLabel: label });
      } else {
        window.rrCompanyChip({ company: slug, missing: true, home: HOME, homeLabel: 'RegRader Pro 에서 판정하기' });
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ui);
  else ui();
})();
