/* RegRader Pro 브라우저판 — 서버 없이 이 페이지 안에서 판정한다 (RegRader 사이트 · GitHub Pages).
 *
 * Pro 화면(index.html)이 부르는 /api/... 를 여기서 받는다 (fetch 를 감싼다).
 *   회사 찾기 · 회사 정보   ← 맥에서 미리 만든 회사 색인 · 회사 정보 초안 (RR_PRO_DATA/companies/)
 *   판정 · 법령 추가        ← 판정 엔진(engine/*.py)을 Pyodide(브라우저 파이썬)로 그대로 돌린다. 법제처 조회는 lawpack 으로
 *   RegRader로 보내기       ← 전체 법률 수집 결과(RR_PRO_DATA/universe/)에서 회사 데이터를 골라(engine/rr_static.py)
 *                             이 브라우저(IndexedDB)에 두고, RegRader 화면을 ?company= 로 연다 (company-mode.js)
 * 맥의 서버판(server.py)과 같은 엔진 · 같은 응답 모양이다. 키 · 회사별 결과는 어디로도 보내지 않는다.
 */
(function () {
  'use strict';
  var PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';
  var DATA = window.RR_PRO_DATA || './data/';
  var PY = window.RR_PRO_PY || './py/';
  var ENGINE = ['__init__', 'lawapi', 'suggest', 'classify', 'universe', 'industry', 'rr_static'];
  var KB = ['catalog', 'facts', 'rules', 'universe', 'industry_laws', 'duties', 'admin_scope'];
  var SHARDS = 1024;
  var JOBS = ['인사노무', '공정거래', '정보보호', '지식재산권', '재무회계', '안전', '환경', '지배구조', '기타'];
  var realFetch = window.fetch.bind(window);

  function reply(data, status) {
    return new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
  function getJSON(url) {
    return realFetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('자료를 받지 못했습니다 (' + r.status + '): ' + url);
      return r.json();
    });
  }
  function getText(url) {
    return realFetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('자료를 받지 못했습니다 (' + r.status + '): ' + url);
      return r.text();
    });
  }
  var memo = {};
  function once(name, fn) { return memo[name] || (memo[name] = fn().catch(function (e) { delete memo[name]; throw e; })); }

  /* ---------- 판정 엔진 (Pyodide) ---------- */
  function loadScript(src) {
    return new Promise(function (ok, bad) {
      var s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = function () { bad(new Error('판정 엔진을 받지 못했습니다: ' + src)); };
      document.head.appendChild(s);
    });
  }
  var BOOT = [
    'import sys, json',
    "sys.path.insert(0, '/app')",
    'from engine import lawapi, suggest as S',
    "PACK = json.loads(open('/app/lawpack.json', encoding='utf-8').read())",
    "_law = {lawapi.compact(k): v for k, v in PACK['law'].items()}",
    "_fam = {lawapi.compact(k): v for k, v in PACK['family'].items()}",
    "_adm = {lawapi.compact(k): v for k, v in PACK['admrul'].items()}",
    'def _no_net(*a, **k):',
    "    raise RuntimeError('브라우저판은 법제처를 직접 조회하지 않습니다 (lawpack 에 없는 법령)')",
    'lawapi._get = _no_net',
    'lawapi.search_law = lambda name: _law.get(lawapi.compact(name))',
    "lawapi.family = lambda name: _fam.get(lawapi.compact(name)) or {'members': [], 'admin': []}",
    'lawapi.search_admrul = lambda name: _adm.get(lawapi.compact(name))',
    'def _find(q, limit=8):',
    '    k = lawapi.compact(q)',
    "    hits = [v for v in PACK['law'].values() if v and k in lawapi.compact(v['name'])]",
    "    hits.sort(key=lambda v: (lawapi.compact(v['name']) != k, len(v['name'])))",
    "    return [{'name': v['name'], 'kind': v['kind'], 'ministry': v['ministry']} for v in hits[:limit]]",
    'lawapi.find_laws = _find',
    'class _Serial:',
    '    def __init__(self, *a, **k): pass',
    '    def __enter__(self): return self',
    '    def __exit__(self, *a): return False',
    '    def map(self, fn, *it): return list(map(fn, *it))',
    'S.ThreadPoolExecutor = _Serial',
    'def api_suggest(profile_json):',
    '    return json.dumps(S.plain_categories(S.suggest(json.loads(profile_json))), ensure_ascii=False)',
    'def api_law(name, job, profile_json):',
    '    return json.dumps(S.add_law(name, job, json.loads(profile_json)), ensure_ascii=False)',
    'def api_laws(q):',
    '    return json.dumps(lawapi.find_laws(q), ensure_ascii=False)',
    'def api_regrader(families_json, company, universe_json):',
    '    from engine import rr_static',
    '    fams = json.loads(families_json)',
    '    names, ids = {}, set()',
    '    for f in fams:',
    "        for a in lawapi.family(f['root'])['admin']:",
    "            names.setdefault(a['name'], a['id'])",
    "            ids.add(a['id'])",
    '    return json.dumps(rr_static.build(fams, company, json.loads(universe_json), tree_names=names, tree_ids=ids), ensure_ascii=False)'
  ].join('\n');

  function engine() {
    return once('engine', function () {
      return loadScript(PYODIDE + 'pyodide.js').then(function () {
        return Promise.all([
          window.loadPyodide({ indexURL: PYODIDE }),
          Promise.all(ENGINE.map(function (n) { return getText(PY + 'engine/' + n + '.py'); })),
          Promise.all(KB.map(function (n) { return getText(PY + 'kb/' + n + '.json'); })),
          getText(DATA + 'lawpack.json')
        ]);
      }).then(function (r) {
        var py = r[0], fs = py.FS;
        fs.mkdirTree('/app/engine'); fs.mkdirTree('/app/kb');
        ENGINE.forEach(function (n, i) { fs.writeFile('/app/engine/' + n + '.py', r[1][i]); });
        KB.forEach(function (n, i) { fs.writeFile('/app/kb/' + n + '.json', r[2][i]); });
        fs.writeFile('/app/lawpack.json', r[3]);
        py.runPython(BOOT);
        return py;
      });
    });
  }
  function call(fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    return engine().then(function (py) {
      var f = py.globals.get(fn);
      try { return JSON.parse(f.apply(null, args)); } finally { f.destroy(); }
    });
  }

  /* ---------- 회사 찾기 (companydb.search 와 같은 순위 규칙) ---------- */
  var CORP = /\(주\)|㈜|주식회사|\(유\)|유한회사|유한책임회사|\(합\)|합자회사|합명회사|\(사\)|사단법인|\(재\)|재단법인|농업회사법인|영농조합법인|의료법인|학교법인|사회복지법인|\(株\)|co\.?,?\s*ltd\.?|inc\.?|corp\.?/ig;
  var NON_COMPANY = /어린이집|새마을금고|노동조합|노조|신용협동조합|신협|근로복지기금|공제회|상조회|협의회|장학회|동호회|직장보육/;
  var LETTERS = { a: '에이', b: '비', c: '씨', d: '디', e: '이', f: '에프', g: '지', h: '에이치', i: '아이', j: '제이', k: '케이', l: '엘', m: '엠', n: '엔',
    o: '오', p: '피', q: '큐', r: '알', s: '에스', t: '티', u: '유', v: '브이', w: '더블유', x: '엑스', y: '와이', z: '지' };
  var WORDS = { posco: '포스코', naver: '네이버', soil: '에쓰오일', kakao: '카카오', hyundai: '현대', samsung: '삼성' };
  function norm(s) {
    s = String(s || '').normalize('NFKC').replace(/([A-Za-z])\s*&\s*(?=[A-Za-z])/g, '$1앤');
    return s.replace(CORP, '').replace(/[^0-9A-Za-z가-힣]+/g, '').toLowerCase();
  }
  function hangul(n) {
    return /[a-z]/.test(n) ? n.replace(/[a-z]+/g, function (w) { return WORDS[w] || w.split('').map(function (c) { return LETTERS[c]; }).join(''); }) : n;
  }
  function index() { return once('index', function () { return getJSON(DATA + 'companies/index.json'); }); }

  function search(q, limit) {
    limit = limit || 12;
    return index().then(function (ix) {
      var n = norm(q);
      if (n.length < 2) return [];
      var keys = Array.from(new Set([hangul(n), n])).filter(function (k) { return k.length >= 2; });
      var short = Math.min.apply(null, keys.map(function (k) { return k.length; })) <= 2 && !/\(주\)|㈜|주식회사/.test(q);
      function nameScore(st) {
        if (keys.indexOf(st) >= 0) return short ? 3.5 : 5;
        if (keys.some(function (k) { return st.indexOf(k) === 0; })) return 3;
        if (keys.some(function (k) { return st.indexOf(k) >= 0; })) return 1.5;
        return 0;
      }
      function listedBonus(l) {
        if (!l) return 0;
        if (keys.some(function (k) { return k === norm(l[3]) || k === norm(l[4]) || k === hangul(norm(l[0])); })) return 6;
        if (/지주|홀딩스/.test(l[0])) return 2.5;
        return 0.5;
      }
      var hits = [];
      ix.rows.forEach(function (r) {
        var st = r[1], l = r[8] || null;
        var ln = l ? [norm(l[0]), hangul(norm(l[0])), norm(l[4] || '')] : [];
        var nameHit = keys.some(function (k) { return st.indexOf(k) >= 0; }) || ln.some(function (x) { return x && keys.some(function (k) { return x.indexOf(k) >= 0; }); });
        if (!nameHit || NON_COMPANY.test(r[2])) return;
        var size = r[3] || r[5] * 20;
        hits.push({ r: r, score: nameScore(st) + Math.log10(size + 1) * 2.5 + listedBonus(l) });
      });
      hits.sort(function (a, b) { return b.score - a.score || (a.r[2] < b.r[2] ? -1 : 1); });
      var out = [], per = {};
      hits.forEach(function (h) {
        var st = h.r[1];
        if (out.length >= limit || (per[st] || 0) >= (keys.indexOf(st) >= 0 ? 3 : 2)) return;
        per[st] = (per[st] || 0) + 1;
        var r = h.r, l = r[8];
        out.push({ key: r[0], stem: st, name: r[2], employees: r[3], workplaceCount: r[4], factoryCount: r[5],
          industry: { name: r[6] }, address: r[7], listedAs: l ? { name: l[0], code: l[1], market: l[2] } : null });
      });
      return out;
    });
  }

  function shardOf(key) {
    return crypto.subtle.digest('SHA-1', new TextEncoder().encode(key)).then(function (buf) {
      var b = new Uint8Array(buf);
      return ((b[0] << 8) | b[1]) % SHARDS;
    });
  }
  function draft(key) {
    return shardOf(key).then(function (sh) { return getJSON(DATA + 'companies/d/' + sh + '.json'); }).then(function (d) {
      if (!d[key]) throw new Error('회사 정보를 찾지 못했습니다. 다시 검색해 주세요.');
      return d[key];
    });
  }

  /* ---------- 보낸 회사 (이 브라우저의 IndexedDB) ---------- */
  function db() {
    return once('db', function () {
      return new Promise(function (ok, bad) {
        var req = indexedDB.open('regrader-pro', 1);
        req.onupgradeneeded = function () { req.result.createObjectStore('companies', { keyPath: 'slug' }); };
        req.onsuccess = function () { ok(req.result); };
        req.onerror = function () { bad(req.error); };
      });
    });
  }
  function store(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (ok, bad) {
        var tx = d.transaction('companies', mode), st = tx.objectStore('companies'), out = fn(st);
        tx.oncomplete = function () { ok(out && out.result !== undefined ? out.result : out); };
        tx.onerror = function () { bad(tx.error); };
      });
    });
  }
  window.rrProStore = { get: function (slug) { return store('readonly', function (st) { return st.get(slug); }); } };

  function slug(name) {
    var s = String(name || '').replace(/\((주|유|사|재)\)|[㈜㈔㈕]|주식회사|유한회사|유한책임회사|합자회사|합명회사|사단법인|재단법인|\s임직원$/g, '');
    return s.replace(/[^0-9A-Za-z가-힣]+/g, '') || 'company';
  }
  var UNIVERSE = ['base_laws_207', 'law_families', 'admrul_candidates', 'admrul_events', 'upcoming_next', 'meta'].concat([0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { return 'm' + i; }));
  function universe() {
    return once('universe', function () {
      return Promise.all(UNIVERSE.map(function (n) { return getJSON(DATA + 'universe/' + n + '.json'); })).then(function (all) {
        var u = {};
        UNIVERSE.forEach(function (n, i) { u[n + '.json'] = all[i]; });
        return JSON.stringify(u);
      });
    });
  }
  function status(rec) {
    if (!rec) return { state: 'none' };
    var m = rec.files['meta.json'], p = rec.files['pro_company.json'];
    return { company: rec.company, slug: rec.slug, url: rrUrl(rec.slug), state: 'done', step: '완료', progress: 100,
      startedAt: rec.savedAt, finishedAt: rec.savedAt, laws: p.laws, admin: p.admin, families: p.families, byJob: p.byJob, date: p.date,
      result: { asOf: m.asOf, totalCount: m.totalCount, lawEvents: m.lawEvents, admrulEvents: m.admrulEvents, baseLaws: m.baseLaws, admrulLaws: m.admrulLaws } };
  }
  function rrUrl(s) { return (window.RR_PRO_SITE || '../') + '?company=' + encodeURIComponent(s); }
  function exportCompany(body) {
    var s = slug(body.company);
    return Promise.all([universe(), engine()]).then(function (r) {
      return call('api_regrader', JSON.stringify(body.families || []), body.company, r[0]);
    }).then(function (files) {
      var rec = { slug: s, company: body.company, savedAt: new Date().toISOString(), files: files };
      return store('readwrite', function (st) { st.put(rec); }).then(function () { return status(rec); });
    });
  }

  /* ---------- /api/... ---------- */
  var routes = {
    'GET /api/status': function () {
      /* 화면 준비는 작은 meta.json 으로 (회사 색인 2MB 는 검색할 때 받는다). 없으면 색인으로 */
      return getJSON(DATA + 'companies/meta.json').catch(index).then(function (ix) {
        return { ai: false, jobs: JOBS, browser: true,
          company: { ready: true, nps: (ix.dataAsOf || {}).nps || (ix.generatedAt || '').slice(0, 7), count: ix.count } };
      });
    },
    'GET /api/catalog': function () { return getJSON(PY + 'kb/catalog.json'); },
    'GET /api/example': function () { return getJSON(PY + 'examples/manufacturer.json'); },
    'GET /api/company': function (u) { return search(u.searchParams.get('q') || '').then(function (r) { return { results: r }; }); },
    'POST /api/company/draft': function (u, b) { return draft(b.key); },
    'POST /api/suggest': function (u, b) { return call('api_suggest', JSON.stringify(b.profile || b)); },
    'GET /api/laws': function (u) {
      var q = (u.searchParams.get('q') || '').trim();
      return q.length < 2 ? { results: [] } : call('api_laws', q).then(function (r) { return { results: r }; });
    },
    'POST /api/law': function (u, b) {
      var name = (b.name || '').trim();
      if (!name) return Promise.reject({ status: 400, error: '법령명을 넣어 주세요.' });
      return call('api_law', name, JOBS.indexOf(b.job) >= 0 ? b.job : '기타', JSON.stringify(b.profile || {})).then(function (f) {
        if (!f.verified) throw { status: 404, error: '‘' + name + '’을(를) 현행 법령 목록에서 찾지 못했습니다.' };
        return f;
      });
    },
    'POST /api/research': function () { return Promise.reject({ status: 400, error: '브라우저판에서는 AI 웹 조사를 쓰지 않습니다.' }); },
    'POST /api/regrader': function (u, b) {
      if (!b.company || !(b.families || []).length) return Promise.reject({ status: 400, error: '회사 이름과 적용법규가 필요합니다.' });
      return exportCompany(b);
    },
    'GET /api/regrader': function (u) { return store('readonly', function (st) { return st.get(slug(u.searchParams.get('q'))); }).then(status); },
    'GET /api/regrader/list': function () {
      return store('readonly', function (st) { return st.getAll(); }).then(function (all) {
        all.sort(function (a, b) { return a.savedAt < b.savedAt ? 1 : -1; });
        return { companies: all.map(status) };
      });
    }
  };

  window.fetch = function (input, init) {
    var url = new URL(typeof input === 'string' ? input : input.url, location.href);
    var path = url.pathname.replace(/^.*?(\/api\/)/, '/api/');
    if (path.indexOf('/api/') !== 0) return realFetch(input, init);
    var method = ((init && init.method) || 'GET').toUpperCase();
    var fn = routes[method + ' ' + path];
    if (!fn) return Promise.resolve(reply({ error: '없는 주소입니다' }, 404));
    var body = {};
    try { body = init && init.body ? JSON.parse(init.body) : {}; } catch (e) { body = {}; }
    return Promise.resolve().then(function () { return fn(url, body); }).then(function (d) { return reply(d); }, function (e) {
      return reply({ error: (e && e.error) || ('처리하지 못했습니다: ' + ((e && e.message) || e)) }, (e && e.status) || 500);
    });
  };

  /* 화면을 여는 동안 판정 엔진을 미리 받아 둔다 (처음 한 번 10~20초) */
  if (!window.RR_PRO_NO_PRELOAD) setTimeout(function () { index().catch(function () {}); engine().catch(function () {}); }, 300);
})();
