/* 회사 RegRader 데이터 골라내기 — engine/rr_static.py 와 같은 규칙의 자바스크립트판.
 *
 * 전체 법률 RegRader 수집 결과(매일 갱신)에서 회사 적용법규(법령 이름)와 Pro 가 고른 행정규칙(ID)의 줄만 남기고
 * 직무 · 계열 표시를 회사 기준으로 다시 붙인다. 브라우저에서 즉시 돈다 (파이썬 엔진 없이).
 *   - 'RegRader로 보내기' (static-api.js)
 *   - 회사 화면을 열 때마다 최신 전체 수집으로 다시 만들기 (company-mode.js) → 화면 · 엑셀 · PPT 가 매일 최신
 * 파이썬판과 같은 결과인지는 tests/test_rr_static.py 가 node 로 확인한다.
 *
 *   rrStatic.build(families, company, universe, { keep, treeNames, treeIds }) → { 파일 이름: 내용 }
 *   rrStatic.keepIds(families, treeNames) → { 행정규칙ID: [계열, 직무] }
 */
(function (root) {
  'use strict';
  var AMEND_MINI = { '일부개정': '일', '타법개정': '타' };
  var LEVELS = ['법률', '시행령', '시행규칙'];

  function compact(name) { return String(name || '').trim().replace(/[\s·ㆍ・.]/g, ''); }
  function job(f) { return f.category || f.job || '기타'; }
  function level(m) {
    if (LEVELS.indexOf(m.level) >= 0) return m.level;
    var t = String(m.name || '').trim();
    return /시행령$/.test(t) ? '시행령' : /시행규칙$/.test(t) ? '시행규칙' : '법률';
  }
  function now() { return new Date().toISOString().replace(/\.\d+Z$/, '+00:00'); }
  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  /* 32비트 FNV-1a (UTF-8) — 파이썬판 _fnv 와 같은 값. 계열 목록의 baseKey 용 */
  function fnv(text) {
    var bytes = new TextEncoder().encode(text), h = 0x811c9dc5;
    for (var i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  function baseItems(families, ubase) {
    var rows = [], seen = {};
    families.forEach(function (f) {
      if ('verified' in f && !f.verified) return;   // 파이썬: not f.get("verified", True)
      (f.members && f.members.length ? f.members : [{ name: f.root, level: '법률' }]).forEach(function (m) {
        var k = compact(m.name);
        if (seen[k]) return;
        seen[k] = 1;
        rows.push([m, f]);
      });
    });
    var items = [], missing = [];
    rows.forEach(function (mf) {
      var m = mf[0], f = mf[1], u = ubase[compact(m.name)];
      if (!u) missing.push(m.name);
      var um = (u && u.meta) || {};
      var meta = { ministry: um.ministry || f.ministry || '', lsId: um.lsId || '', proFamily: f.root, proStatus: f.status || '적용' };
      if (f.reasons && f.reasons.length) meta.proWhy = f.reasons.join(' / ');
      if (f.presumed && f.presumed.length) meta.proPresumed = f.presumed;
      var n = items.length + 1;
      items.push({ id: 'law_' + (n < 10 ? '00' : n < 100 ? '0' : '') + n, title: (u && u.title) || m.name, categories: [job(f)],
        lawType: level(m), effectiveDate: (u && u.effectiveDate) || '', status: '현행', meta: meta });
    });
    return [items, missing];
  }

  function keepIds(families, treeNames) {
    var keep = {};
    families.forEach(function (f) {
      var chosen = (f.admin || []).concat(f.adminMore || []);
      (f.bundles || []).forEach(function (b) {
        (b.bundle || []).forEach(function (n) {
          var rid = (treeNames || {})[n];
          if (rid) chosen.push({ id: rid, name: n });
        });
      });
      chosen.forEach(function (a) {
        var rid = String(a.id || '');
        if (rid && rid.indexOf('bundle:') !== 0 && !(rid in keep)) keep[rid] = [f.root, job(f)];
      });
    });
    return keep;
  }

  function quarterly(lawRows, items, year) {
    var kind = {};
    items.forEach(function (x) { kind[x.title] = x.lawType; });
    var qs = {};
    [1, 2, 3, 4].forEach(function (i) { qs['Q' + i] = { period: year + '년 ' + (3 * i - 2) + '~' + (3 * i) + '월', count: 0, laws: [] }; });
    var cats = {}, matrix = {}, all = [];
    lawRows.forEach(function (r, i) {
      var q = 'Q' + (Math.floor((parseInt(r.d.slice(5, 7), 10) - 1) / 3) + 1);
      var law = { id: 'pro_' + (i + 1), title: r.t, effectiveDate: r.d, effective_date: r.d, lawType: kind[r.t] == null ? null : kind[r.t],
        law_type: kind[r.t] == null ? null : kind[r.t], status: r.s === 0 ? '현행' : '시행예정', ministry: r.m,
        categories: [r.c || '기타'], detail_url: r.u ? 'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=' + r.u : '' };
      qs[q].laws.push(law);
      qs[q].count += 1;
      all.push(law);
      var c = law.categories[0];
      cats[c] = (cats[c] || 0) + 1;
      if (!matrix[c]) matrix[c] = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
      matrix[c][q] += 1;
    });
    return { generatedAt: now(), year: year, description: year + '년 적용법규 개정 (RegRader Pro)', total_laws: all.length,
      quarters: qs, items: all, categoryBreakdown: cats, categoryQuarterMatrix: matrix };
  }

  function build(families, company, universe, opt) {
    opt = opt || {};
    var ubase = {};
    universe['base_laws_207.json'].items.forEach(function (x) { ubase[compact(x.title)] = x; });
    var bi = baseItems(families, ubase), items = bi[0], missing = bi[1];
    var titles = new Map();
    items.forEach(function (x) { titles.set(x.title, x.categories[0]); });
    var keep = opt.keep || keepIds(families, opt.treeNames);
    var treeIds = opt.treeIds ? new Set(opt.treeIds) : null;

    var fams = [];
    universe['law_families.json'].families.forEach(function (f) {
      if (!f.members.some(function (m) { return titles.has(m.title); })) return;
      fams.push({ root: f.root, members: f.members.map(function (m) {
        var row = { title: m.title, level: m.level, kind: m.kind, inBase: titles.has(m.title) };
        if (row.inBase) row.category = titles.get(m.title);
        if (m.parent) row.parent = m.parent;
        if (!row.inBase && m.lsiSeq) row.lsiSeq = m.lsiSeq;
        if (m.notFound) row.notFound = true;
        return row;
      }) });
    });
    var famJobs = {};
    fams.forEach(function (f) {
      var s = {};
      f.members.forEach(function (m) { if (m.inBase && m.category) s[m.category] = 1; });
      famJobs[f.root] = Object.keys(s).sort(cmp);
    });

    var cands = [];
    universe['admrul_candidates.json'].items.forEach(function (c) {
      var cf = (c.families || []).filter(function (f) { return f in famJobs; });
      var inKeep = c.id in keep;
      var extra = inKeep && (!treeIds || !treeIds.has(c.id));
      if (!cf.length && !extra) return;
      var jobs = [];
      cf.forEach(function (f) { famJobs[f].forEach(function (j) { if (jobs.indexOf(j) < 0) jobs.push(j); }); });
      if (!cf.length) { cf = [keep[c.id][0]]; jobs = [keep[c.id][1]]; }
      cands.push(Object.assign({}, c, { families: cf, jobs: jobs, tag: inKeep ? '' : (c.tag || ''), out: inKeep ? '' : 'pro' }));
    });
    var main = {}, mainN = 0;
    cands.forEach(function (c) { if (!c.out && !c.tag) { if (!(c.id in main)) mainN += 1; main[c.id] = c; } });
    var index = cands.filter(function (c) { return !c.out; }).map(function (c) {
      return { i: c.id, n: c.name, k: c.kind, q: c.seq, f: c.families[0] || '', c: c.jobs[0] || '', g: c.tag, e: c.effective };
    });

    var rows = [];
    for (var i = 0; i < 8; i++) rows = rows.concat(universe['m' + i + '.json'] || []);
    var lawRows = rows.filter(function (r) { return !r.k && titles.has(r.t); }).map(function (r) { return Object.assign({}, r, { c: titles.get(r.t) }); });
    var have = new Set(lawRows.map(function (r) { return r.t + '\u0000' + r.d + '\u0000' + r.a; }));
    var adm = [];
    universe['admrul_events.json'].items.slice().sort(function (a, b) { return cmp(b.p || '', a.p || ''); }).forEach(function (x) {
      var c = main[x.id];
      if (!c || x.g) return;
      var row = { t: x.t, d: x.d, a: x.a in AMEND_MINI ? AMEND_MINI[x.a] : (x.a || ''), s: x.s, m: x.m,
        c: c.jobs[0] || '', u: x.q, k: x.k, i: x.id, f: c.families[0] || '' };
      var key = row.t + '\u0000' + row.d + '\u0000' + row.a;
      if (have.has(key)) return;
      have.add(key);
      adm.push(row);
    });
    adm.sort(function (a, b) { return cmp(a.d, b.d) || cmp(a.t, b.t); });
    var mini = lawRows.concat(adm);

    var umeta = universe['meta.json'];
    var upcoming = (universe['upcoming_next.json'] || []).filter(function (r) { return titles.has(r.t); })
      .map(function (r) { return Object.assign({}, r, { c: titles.get(r.t) }); });
    var stamp = now();
    var keys = Array.from(titles.keys()).map(compact).sort(cmp);
    var out = {
      'base_laws_207.json': { generatedAt: stamp, year: umeta.year, description: company + ' 적용 법규 ' + items.length + '개 (RegRader Pro 판정)',
        total_laws: items.length, items: items, updatedAt: stamp },
      'law_families.json': { generatedAt: stamp, source: '국가법령정보센터 법령체계도 (lsStmd) — RegRader Pro 전체 법률 수집에서 고름',
        baseKey: fnv(keys.join('\n')), baseCount: items.length, familyCount: fams.length, families: fams },
      'admrul_index.json': { generatedAt: stamp, items: index },
      'upcoming_next.json': upcoming,
      'changelog.json': { entries: [], updatedAt: stamp }
    };
    var shard = Math.floor((mini.length + 7) / 8) || 1;
    for (var s = 0; s < 8; s++) out['m' + s + '.json'] = mini.slice(s * shard, (s + 1) * shard);
    out['meta.json'] = { generatedAt: umeta.generatedAt, asOf: umeta.asOf, year: umeta.year, totalCount: mini.length,
      lawEvents: lawRows.length, admrulEvents: adm.length, universe: umeta.universe, universePrev: null, baseLaws: items.length,
      admrulLaws: mainN, upcomingNext: upcoming.length, archives: [] };
    out['quarterly_details.json'] = quarterly(lawRows, items, umeta.year);
    var jobs = {};
    items.forEach(function (x) { jobs[x.categories[0]] = (jobs[x.categories[0]] || 0) + 1; });
    out['pro_company.json'] = { company: company, generatedAt: stamp, date: stamp.slice(0, 10), families: families.length, laws: items.length,
      admin: mainN, byJob: jobs, notFound: missing, asOf: umeta.asOf };
    return out;
  }

  var api = { build: build, keepIds: keepIds, compact: compact };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.rrStatic = api;
})(this);
