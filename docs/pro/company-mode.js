/* RegRader 회사 보기 (?company=<회사>) — RegRader Pro 브라우저판이 이 브라우저에 만들어 둔 회사 데이터로 RegRader 화면을 그린다.
 *
 * RegRader 화면(index.html · watch.html · history.html)의 <head> 맨 앞에서 불린다. 주소에 ?company= 가 없으면 아무것도 하지 않는다.
 *   - base_laws_207 · law_families · admrul_index · m0~m7 · meta · upcoming_next · changelog · quarterly_details
 *       → Pro 화면에서 'RegRader로 보내기' 할 때 IndexedDB(regrader-pro)에 저장한 것
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

  var rec = new Promise(function (ok) {
    var req = indexedDB.open('regrader-pro', 1);
    req.onupgradeneeded = function () { req.result.createObjectStore('companies', { keyPath: 'slug' }); };
    req.onerror = function () { ok(null); };
    req.onsuccess = function () {
      try {
        var g = req.result.transaction('companies', 'readonly').objectStore('companies').get(slug);
        g.onsuccess = function () { ok(g.result || null); };
        g.onerror = function () { ok(null); };
      } catch (e) { ok(null); }
    };
  });
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
