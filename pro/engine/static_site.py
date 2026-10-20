"""브라우저용 RegRader Pro 자료 — GitHub Pages(RegRader 기존 주소)에서 서버 없이 판정하려고 맥에서 미리 만드는 것.

    python3 -m engine.static_site pack        # 법제처 자료 묶음: 판정에 쓰는 법령 검색·법령체계도·고시 → out/static/lawpack.json
    python3 -m engine.static_site universe    # 현행 법률 전체로 RegRader 수집 → out/static/universe/ (회사별 화면은 여기서 골라 쓴다)
    python3 -m engine.static_site companies   # 회사 찾기 색인 + 회사 정보 초안 → out/static/companies/
    python3 -m engine.static_site web <폴더>   # 브라우저판 화면 · 엔진 코드 (RegRader 의 docs/pro/)
    python3 -m engine.static_site publish [--push]   # 자료 → RegRader 저장소 pro-data 브랜치 (기록 없이 덮어쓰기)
    python3 -m engine.static_site daily [--no-push]  # 매일: pack → universe → (30일마다 companies) → publish

브라우저에서는 판정 엔진(파이썬)을 Pyodide 로 그대로 돌리고, 법제처 조회는 lawpack 으로 대신한다.
"""
import gzip
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from engine import lawapi

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out" / "static"


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(body)
    tmp.replace(path)
    return len(body), len(gzip.compress(body))


def law_names():
    """판정에 나오는 모든 법령 이름 (정밀 규칙 + 현행 법률 분류표 + 업종 법규)."""
    from engine.suggest import load_rules
    rules = load_rules(universe=True)
    names = sorted({l["name"] for r in rules for l in r["laws"]})
    adm = sorted({n for r in rules for n in r.get("admNames", [])})
    return names, adm


def pack(workers=6, log=print):
    """법제처 자료 묶음: {law: 이름→현행 법령 정보, family: 이름→체계도(하위법령·연결 행정규칙), admrul: 이름→행정규칙}."""
    names, adm = law_names()
    log(f"법령 {len(names)}개 · 필수 고시 {len(adm)}개")
    t = time.time()
    with ThreadPoolExecutor(max_workers=workers) as ex:
        infos = list(ex.map(lawapi.search_law, names))
        fams = list(ex.map(lambda n: lawapi.family(n) if infos[names.index(n)] else {"members": [], "admin": []}, names))
        adms = list(ex.map(lawapi.search_admrul, adm))
    data = {"generatedAt": _now(), "law": dict(zip(names, infos)), "family": dict(zip(names, fams)), "admrul": dict(zip(adm, adms))}
    raw, gz = _write(OUT / "lawpack.json", data)
    log(f"lawpack: {raw / 1e6:.1f}MB (압축 {gz / 1e6:.1f}MB) · 법제처에서 못 찾은 이름 {sum(1 for i in infos if not i)}개 · {time.time() - t:.0f}초")
    return data


def universe_families(lawpack):
    """판정에 나오는 모든 법령을 '적용'으로 둔 계열 목록 (suggest.resolve 와 같은 하위법령 거르기)."""
    import re
    from engine import industry as IND
    from engine.suggest import MEMBER_NOISE
    jobs = IND._jobs()
    fams = []
    for name, info in lawpack["law"].items():
        if not info:
            continue
        fam = lawpack["family"].get(name) or {"members": [], "admin": []}
        members = [m for m in fam["members"] if not any(n in m["name"] for n in MEMBER_NOISE)
                   and not re.search(r"제\d+조(의\d+)?에 따른", m["name"])]
        members = members or [{"name": info["name"], "level": "법률", "kind": info["kind"], "parent": None}]
        fams.append({"root": name, "category": jobs.get(lawapi.compact(name), "기타"), "status": "적용", "verified": True,
                     "ministry": info.get("ministry"), "members": members, "admin": [], "adminMore": [], "bundles": []})
    return fams


def universe_extras(lawpack):
    """법령체계도에 연결돼 있지 않지만 규칙이 꼭 넣는 고시 → 후보에 덧붙일 것."""
    from engine import industry as IND
    from engine.suggest import load_rules
    from engine import export_regrader as X
    jobs = IND._jobs()
    tree_ids = {a["id"] for f in lawpack["family"].values() for a in f["admin"]}
    out = {}
    for r in load_rules(universe=True):
        for nm in r.get("admNames", []):
            a = lawpack["admrul"].get(nm)
            if not a or a["id"] in tree_ids or a["id"] in out:
                continue
            root = r["laws"][0]["name"]
            x = X._admrul_row(a["id"], a["name"])
            out[a["id"]] = {"id": a["id"], "name": a["name"], "kind": x.get("행정규칙종류") or a.get("kind") or "",
                            "seq": str(x.get("행정규칙일련번호") or ""), "issued": str(x.get("발령일자") or ""),
                            "effective": str(x.get("시행일자") or ""), "type": x.get("제개정구분명") or "",
                            "families": [root], "links": [f"{root} (RegRader Pro 필수 고시)"], "jobs": [jobs.get(lawapi.compact(root), "기타")]}
    return list(out.values())


UNIVERSE_FILES = ["base_laws_207.json", "law_families.json", "admrul_candidates.json", "admrul_events.json", "amend_details.json",
                  "amend_flags.json", "upcoming_next.json", "meta.json"] + [f"m{i}.json" for i in range(8)]


def universe(log=print, run=True):
    """현행 법률 전체를 적용법규로 둔 RegRader 수집 → out/static/universe/ (회사별 화면은 이 자료에서 골라 만든다)."""
    import shutil
    from engine import export_regrader as X
    lp = json.loads((OUT / "lawpack.json").read_text(encoding="utf-8"))
    ws = OUT / "universe_ws"
    head = X.build_site(log=log)
    (ws / "docs").mkdir(parents=True, exist_ok=True)
    (ws / "scripts").mkdir(exist_ok=True)
    for s in X.SCRIPTS:
        shutil.copy2(X.SITE / "scripts" / s, ws / "scripts" / s)
    fams = universe_families(lp)
    items, missing = X.base_items(fams)
    extra = universe_extras(lp)
    (ws / "scripts" / "admrul_scope.py").write_text(X.SCOPE_PY, encoding="utf-8")
    (ws / "scripts" / "company_scope.json").write_text(json.dumps({"company": "전체 법률", "all": True, "keep": [], "extra": extra},
                                                                  ensure_ascii=False, indent=1), encoding="utf-8")
    path = ws / "docs" / "base_laws_207.json"
    old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
    if not old or [x["title"] for x in old["items"]] != [x["title"] for x in items]:
        (ws / "docs" / "law_families.json").unlink(missing_ok=True)
    path.write_text(json.dumps({"generatedAt": _now(), "year": datetime.now().year, "description": f"현행 법률 전체 {len(items)}개",
                                "total_laws": len(items), "items": items, "updatedAt": _now()}, ensure_ascii=False), encoding="utf-8")
    log(f"전체 법률: 계열 {len(fams)} · 법령 {len(items)}개 · 필수 고시(체계도 밖) {len(extra)}개 · 법제처에서 못 찾은 이름 {len(missing)}개 (RegRader {head[:7]})")
    if not run:
        return ws
    st = X.run(ws, log=log)
    dest = OUT / "universe"
    dest.mkdir(parents=True, exist_ok=True)
    for f in UNIVERSE_FILES:
        if (ws / "docs" / f).exists():
            shutil.copy2(ws / "docs" / f, dest / f)
    log(f"universe: {st.get('result')}")
    return st


SHARDS = 1024


def shard_of(key):
    """회사 key → 회사 정보 묶음 번호 (브라우저 static-api.js 의 shardOf 와 같은 계산)."""
    import hashlib
    return int(hashlib.sha1(key.encode("utf-8")).hexdigest()[:4], 16) % SHARDS


def company_keys(min_members=30, log=print):
    """미리 만들 회사: 국민연금 가입자 min_members 명 이상 법인 + 상장사 전부 (개인사업자는 넣지 않는다)."""
    from engine import companydb as C
    keys, listed = {}, {}
    with C._connect() as con:
        stems = [r["stem"] for r in con.execute("SELECT stem FROM stems WHERE members >= ?", (min_members,))]
        lst = {}   # 줄기 → 상장사들 (한 줄기에 둘 이상일 수 있다: '녹십자' = (주)녹십자 · (주) 녹십자 홀딩스)
        for r in con.execute("SELECT * FROM listed WHERE nps_stem != ''"):
            lst.setdefault(r["nps_stem"], []).append(dict(r))
        todo = list(dict.fromkeys(stems + list(lst)))
        log(f"이름 줄기 {len(todo)}개 확인 (가입자 {min_members}명 이상 {len(stems)} + 상장 {len(lst)})")
        for i, st in enumerate(todo):
            nps = con.execute("SELECT * FROM nps WHERE stem = ?", (st,)).fetchall()
            fac = con.execute("SELECT * FROM factory WHERE stem = ?", (st,)).fetchall()
            groups = C._assemble(nps, fac)
            corps = [g for k, g in groups.items() if "|c" in k]
            for g in corps:
                if g["members"] >= min_members:
                    keys[g["key"]] = g["members"]
            if st in lst and corps:   # 상장사는 그 법인(사업자등록번호)에, 이름으로만 맞춘 상장사는 줄기에서 가장 큰 법인에
                best = max(corps, key=lambda g: g["members"])
                for g in corps:
                    row = C.entity_listing(lst[st], g["key"], g is best)
                    if row:
                        keys[g["key"]] = g["members"]
                        listed[g["key"]] = row
    log(f"회사 {len(keys)}곳 (상장 {len(listed)})")
    return keys, listed


def _draft_one(args):
    import re
    key, use_dart = args
    from unittest import mock
    from engine import companydb as C, opendart
    from engine.suggest import load_catalog
    c = C.get(key)
    if not c:
        return key, None, None
    for attempt in range(4):
        with mock.patch.object(opendart, "enabled", return_value=use_dart and opendart.enabled()), \
                mock.patch.object(C, "dart_for", return_value=None):   # DART 웹 목록 조회는 하지 않는다 (회사 수가 많다)
            try:
                d = C.draft(c, load_catalog())
            except Exception as e:  # noqa: BLE001
                return key, None, str(e)
        err = str(((d.get("research") or {}).get("opendart") or {}).get("error") or "")
        if not use_dart or not re.search(r"reset|timed out|Connection|429|503|Remote end", err):
            break
        time.sleep(5 * (attempt + 1))   # OpenDART 가 연결을 끊으면 쉬었다가 다시 (동시에 많이 부르면 막힌다)
    view = {k: c[k] for k in ("key", "stem", "name", "employees", "workplaceCount", "factoryCount", "address")}
    view["industry"] = (c.get("industry") or {}).get("name") or ""
    return key, {"view": view, "draft": d}, None


def _index_row(key, res, listed):
    v = res["view"]
    lst = listed.get(key)
    return [key, v["stem"], v["name"], v["employees"], v["workplaceCount"], v["factoryCount"], v["industry"], v["address"],
            [lst["name"], lst["code"], lst["market"], lst["stem"], lst["alias"]] if lst else 0]


def _store(results, listed, min_members, merge, log=print):
    """회사 정보 → companies/index.json + companies/d/<묶음>.json. merge 면 만들어 둔 것에 덮어쓴다."""
    from engine import companydb as CM
    dest = OUT / "companies"
    rows = [_index_row(k, r, listed) for k, r in results.items()]
    shards = {}
    for k, r in results.items():
        shards.setdefault(shard_of(k), {})[k] = r["draft"]
    built = time.time()
    if merge and (dest / "index.json").exists():
        new = {r[0]: r for r in rows}
        old_ix = json.loads((dest / "index.json").read_text(encoding="utf-8"))
        rows = [(lambda n: n[:8] + [n[8] or r[8]])(new.pop(r[0])) if r[0] in new else r for r in old_ix["rows"]] + list(new.values())
        for sh in list(shards):
            p = dest / "d" / f"{sh}.json"
            if p.exists():
                shards[sh] = {**json.loads(p.read_text(encoding="utf-8")), **shards[sh]}
        min_members = old_ix.get("minMembers", min_members)
        built = old_ix.get("builtAt") or (dest / "index.json").stat().st_mtime   # 전체를 다시 만든 때 (30일마다)
    elif (dest / "d").exists():
        for p in (dest / "d").glob("*.json"):
            p.unlink()
    rows.sort(key=lambda r: -r[3])
    size = _write(dest / "index.json", {"generatedAt": _now(), "builtAt": built, "count": len(rows), "minMembers": min_members, "dataAsOf": CM.meta(),
                                       "fields": ["key", "stem", "name", "employees", "workplaces", "factories", "industry", "address", "listed"],
                                       "rows": rows})
    _write(dest / "meta.json", {"generatedAt": _now(), "count": len(rows), "minMembers": min_members, "dataAsOf": CM.meta()})   # 화면 준비용 (작다)
    total = sum(_write(dest / "d" / f"{sh}.json", d)[1] for sh, d in shards.items())
    log(f"companies: {len(rows)}곳 · 색인 {size[0] / 1e6:.1f}MB (압축 {size[1] / 1e6:.1f}MB) · 고친 묶음 {len(shards)}개 (압축 {total / 1e6:.1f}MB)")


def _listed_rows(keys):
    from engine import companydb as C
    out = {}
    with C._connect() as con:
        for k in keys:
            st = k.split("|")[0]
            rows = [dict(r) for r in con.execute("SELECT * FROM listed WHERE nps_stem = ?", (st,))]
            if not rows:
                continue
            groups = C._assemble(con.execute("SELECT * FROM nps WHERE stem = ?", (st,)).fetchall(),
                                 con.execute("SELECT * FROM factory WHERE stem = ?", (st,)).fetchall())
            row = C.entity_listing(rows, k, C._best_corp(groups) == k)
            if row:
                out[k] = row
    return out


def companies(min_members=30, only=None, workers=8, log=print):
    """회사 찾기 색인(companies/index.json) + 회사 정보 초안(companies/d/<묶음>.json).
    여럿이 동시에 만들 때는 DART 를 부르지 않는다 (동시에 부르면 OpenDART 가 막는다) → 상장사 DART 는 dart_pass 가 따로 채운다."""
    from multiprocessing import Pool
    if only:
        keys, listed = {k: 0 for k in only}, _listed_rows(only)
    else:
        keys, listed = company_keys(min_members, log=log)
    results, failed = {}, []
    t = time.time()
    with Pool(workers) as pool:
        for n, (key, res, err) in enumerate(pool.imap_unordered(_draft_one, [(k, False) for k in keys], chunksize=16), 1):
            if err or not res:
                failed.append((key, err))
            else:
                results[key] = res
            if n % 5000 == 0:
                log(f"  {n}/{len(keys)} · {time.time() - t:.0f}초")
    log(f"회사 정보 {len(results)}곳 · 실패 {len(failed)} · {time.time() - t:.0f}초")
    _store(results, listed, min_members, merge=bool(only), log=log)
    if not only:
        dart_pass(log=log)


def _dart_ok(draft):
    od = (draft.get("research") or {}).get("opendart")
    return bool(od) and not od.get("error")


def dart_pass(max_fail=10, limit=None, redo=False, log=print):
    """상장사 중 DART 근거가 없는 회사를 한 곳씩 DART 로 다시 만든다. 연속 max_fail 번 실패하면 멈춘다 (다음 날 이어서).
    redo 면 상장사 전부를 다시 만든다 (회사 정보 판독 규칙을 고친 뒤)."""
    dest = OUT / "companies"
    ix = json.loads((dest / "index.json").read_text(encoding="utf-8"))
    todo = []
    for r in ix["rows"]:
        if not r[8]:
            continue
        d = json.loads((dest / "d" / f"{shard_of(r[0])}.json").read_text(encoding="utf-8")).get(r[0]) or {}
        if redo or not _dart_ok(d):
            todo.append(r[0])
    todo = todo[:limit] if limit else todo
    if not todo:
        log("dart: 상장사 DART 근거 모두 있음")
        return 0
    results, fails, saved = {}, 0, 0
    for key in todo:
        _, res, err = _draft_one((key, True))
        if res and _dart_ok(res["draft"]):
            results[key], fails = res, 0
            if len(results) >= 300:   # 중간에 끊겨도 만든 것은 남게 300곳마다 저장
                _store(results, _listed_rows(list(results)), ix.get("minMembers", 30), merge=True, log=log)
                saved += len(results)
                results = {}
        else:
            fails += 1
            if fails >= max_fail:
                log(f"dart: 연속 {fails}번 실패 — 멈춤 (OpenDART 가 막았을 수 있다. 다음 갱신 때 이어서)")
                break
    if results:
        _store(results, _listed_rows(list(results)), ix.get("minMembers", 30), merge=True, log=log)
    saved += len(results)
    log(f"dart: 상장사 {len(todo)}곳 중 {saved}곳 DART 반영")
    return saved


ENGINE_FILES = ["__init__", "lawapi", "suggest", "classify", "universe", "industry"]
KB_FILES = ["catalog", "facts", "rules", "universe", "industry_laws", "duties", "admin_scope"]
DATA_URL = "https://raw.githubusercontent.com/tjdudfhr/RegRader/pro-data/"


def web(dest, data_url=DATA_URL, log=print):
    """브라우저판 Pro → dest (RegRader 의 docs/pro/). 큰 자료는 data_url 에서 받는다.

    dest/index.html · companies.html   Pro 화면 (static-api.js 가 /api/... 를 브라우저 안에서 처리)
    dest/py/                            판정 엔진 코드 · kb (Pyodide 가 읽는다)
    dest/site/                          회사 RegRader 화면: 커밋된 RegRader 화면 사본(직무 '기타' 추가) + company-mode.js
    """
    import hashlib
    import re
    import shutil
    from engine import export_regrader as X
    dest = Path(dest)
    for sub in ("py/engine", "py/kb", "py/examples"):
        (dest / sub).mkdir(parents=True, exist_ok=True)
    pre = f'<script>window.RR_PRO_DATA = {json.dumps(data_url)}; window.RR_PRO_PY = "./py/"; window.RR_PRO_SITE = "./site/";</script>\n'
    for name, fixes in (("index.html", [('href="/rr/"', 'href="./companies.html"')]),
                        ("companies.html", [('href="/"', 'href="./index.html"')])):
        rs_v = hashlib.sha1((ROOT / "web" / "rr-static.js").read_bytes()).hexdigest()[:8]
        api_v = hashlib.sha1((ROOT / "web" / "static-api.js").read_bytes()).hexdigest()[:8]
        t = (ROOT / "web" / name).read_text(encoding="utf-8").replace(
            "</head>", pre + f'<script src="./rr-static.js?v={rs_v}"></script>\n<script src="./static-api.js?v={api_v}"></script>\n</head>', 1)
        gate = Path(X.REPO) / "docs" / "gate.js"
        gate_v = hashlib.sha1(gate.read_bytes()).hexdigest()[:8] if gate.exists() else "0"
        t = re.sub(r"(<head[^>]*>)", lambda m: m.group(1) + f'\n<script src="../gate.js?v={gate_v}"></script>', t, count=1)   # RegRader 화면 잠금 · 최신 화면 확인
        cloud_v = hashlib.sha1((ROOT / "web" / "review-cloud.js").read_bytes()).hexdigest()[:8]
        t = t.replace('<script src="review-cloud.js"></script>', f'<script src="./review-cloud.js?v={cloud_v}"></script>')   # 검토 결과 클라우드 저장
        for a, b in fixes:
            t = t.replace(a, b)
        (dest / name).write_text(t, encoding="utf-8")
    for name in ("static-api.js", "company-mode.js", "rr-static.js", "review-cloud.js"):
        shutil.copy2(ROOT / "web" / name, dest / name)
    shutil.copy2(ROOT / "scripts" / "supabase_pro_reviews.sql", dest / "supabase_pro_reviews.sql")   # '처음 설정' 창이 보여 준다
    for n in ENGINE_FILES:
        shutil.copy2(ROOT / "engine" / f"{n}.py", dest / "py" / "engine" / f"{n}.py")
    for n in KB_FILES:
        shutil.copy2(ROOT / "kb" / f"{n}.json", dest / "py" / "kb" / f"{n}.json")
    shutil.copy2(ROOT / "examples" / "manufacturer.json", dest / "py" / "examples" / "manufacturer.json")
    from engine.suggest import fact_effects
    _write(dest / "py" / "kb" / "effects.json", fact_effects())   # 항목 추가 화면의 '관련 법령 N' (서버판은 /api/catalog 가 붙인다)
    from engine import industry
    _write(dest / "py" / "kb" / "ntscodes.json", industry.codes_doc())   # 항목 추가의 '업종코드로 찾기' (서버판은 /api/codes)

    # 회사 RegRader 화면: 커밋된 RegRader 화면(_site, 직무 '기타' 추가 · 대응 현황 끔) + 회사 보기 스크립트
    head = X.build_site(log=log)
    site = dest / "site"
    shutil.rmtree(site, ignore_errors=True)
    shutil.copytree(X.SITE / "docs", site, ignore=shutil.ignore_patterns("intro", "pro-company.js"))
    import hashlib
    mode_v = hashlib.sha1((ROOT / "web" / "company-mode.js").read_bytes()).hexdigest()[:8]   # 바뀌면 브라우저가 새로 받게
    rs_v = hashlib.sha1((ROOT / "web" / "rr-static.js").read_bytes()).hexdigest()[:8]
    tag = (f'<script>window.RR_PRO_DATA = {json.dumps(data_url)}; window.RR_PRO_HOME = "../../#pro";</script>'
           f'<script src="../rr-static.js?v={rs_v}"></script><script src="../company-mode.js?v={mode_v}"></script>')
    for name in ("index.html", "watch.html", "history.html"):
        p = site / name
        if not p.exists():
            continue
        t = re.sub(r"(<head[^>]*>)", lambda m: m.group(1) + "\n" + tag, p.read_text(encoding="utf-8"), count=1)
        t = t.replace('    <script src="./pro-company.js"></script>\n', "").replace('"./intro/', '"../../intro/')
        t = t.replace("<b>RegRader Pro 에서 보낼 때 수집</b>", "<b>매일 07:00 자동 수집</b>")   # 브라우저판 자료는 매일 갱신된다
        t = t.replace('data-src="/?embed=1"', 'data-src="../?embed=1"')   # 기업별 적용법규 검색 탭: 이 사이트의 브라우저판 (_site 는 서버판 주소로 바꿔 둔 것)
        p.write_text(t, encoding="utf-8")
    log(f"브라우저판 → {dest} (RegRader {head[:7]} 화면 사본 · 자료 {data_url})")


PUBLISH_FILES = ["lawpack.json"] + [f"universe/{f}" for f in UNIVERSE_FILES]
REPO_URL = "https://github.com/tjdudfhr/RegRader.git"
BRANCH = "pro-data"


def _git(d, *args, check=True):
    import subprocess
    return subprocess.run(["git", "-C", str(d), *args], capture_output=True, text=True, check=check)


def publish(push=False, log=print):
    """자료를 RegRader 저장소의 pro-data 브랜치로: 기록을 남기지 않는 브랜치에 매번 덮어쓴다 (저장소가 불어나지 않게).
    브라우저는 raw.githubusercontent.com/tjdudfhr/RegRader/pro-data/ 에서 받는다."""
    import shutil
    d = OUT / "publish"
    if not (d / ".git").exists():
        d.mkdir(parents=True, exist_ok=True)
        _git(d, "init", "-q")
        _git(d, "remote", "add", "origin", REPO_URL)
        _git(d, "fetch", "-q", "origin", BRANCH, check=False)
    for p in list(d.iterdir()):
        if p.name != ".git":
            shutil.rmtree(p) if p.is_dir() else p.unlink()
    for f in PUBLISH_FILES:
        src = OUT / f
        if src.exists():
            (d / f).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, d / f)
    if (OUT / "companies").exists():
        shutil.copytree(OUT / "companies", d / "companies")
    meta = json.loads((OUT / "universe" / "meta.json").read_text(encoding="utf-8")) if (OUT / "universe" / "meta.json").exists() else {}
    (d / "README.md").write_text("# RegRader Pro 브라우저판 자료\n\n맥에서 만들어 매일 덮어쓰는 자료 (기록을 남기지 않는 브랜치).\n"
                                 "만드는 곳: pro/engine/static_site.py · 읽는 곳: docs/pro/static-api.js, docs/pro/company-mode.js\n", encoding="utf-8")
    _git(d, "checkout", "-q", "--orphan", "next")
    _git(d, "add", "-A")
    msg = f"data: RegRader Pro 자료 {meta.get('asOf') or _now()[:10]} (개정 {meta.get('totalCount', '?')}건)"
    _git(d, "-c", "user.name=RegRader", "-c", "user.email=regrader@users.noreply.github.com", "commit", "-q", "-m", msg)
    _git(d, "branch", "-D", BRANCH, check=False)
    _git(d, "branch", "-m", BRANCH)
    size = sum(p.stat().st_size for p in d.rglob("*") if p.is_file() and ".git" not in p.parts)
    log(f"publish: {msg} · {size / 1e6:.0f}MB")
    if push:
        r = _git(d, "push", "-f", "origin", f"{BRANCH}:{BRANCH}", check=False)
        if r.returncode:
            raise RuntimeError("pro-data 올리기 실패: " + (r.stderr or r.stdout).strip()[-400:])
        _git(d, "fetch", "-q", "origin", BRANCH, check=False)
        log("publish: pro-data 브랜치에 올림")
    return d


def daily(push=True, log=print):
    """매일 (RegRader auto_update.sh 끝에서): 법제처 자료 묶음 → 전체 법률 수집 → 올리기. 회사 자료는 30일마다."""
    pack(log=log)
    universe(log=log)
    idx = OUT / "companies" / "index.json"
    built = (json.loads(idx.read_text(encoding="utf-8")).get("builtAt") or idx.stat().st_mtime) if idx.exists() else 0
    if time.time() - built > 30 * 86400:
        companies(log=log)
    else:
        dart_pass(log=log)   # 지난번에 막혀 못 채운 상장사 DART 를 이어서
    publish(push=push, log=log)


def _js_same(families, company, universe, keep, tree_ids, py_out):
    """브라우저용 web/rr-static.js 가 같은 입력에 파이썬판과 같은 결과를 내는지 (node 가 없으면 None)."""
    import shutil
    import subprocess
    node = shutil.which("node")
    if not node:
        return None
    run = ("const R=require(process.argv[1]);let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s);"
           "process.stdout.write(JSON.stringify(R.build(a.families,a.company,a.universe,a.opt)))})")
    payload = json.dumps({"families": families, "company": company, "universe": universe,
                          "opt": {"keep": keep, "treeIds": sorted(tree_ids)}}, ensure_ascii=False)
    js = json.loads(subprocess.run([node, "-e", run, str(ROOT / "web" / "rr-static.js")], input=payload, capture_output=True,
                                   text=True, check=True).stdout)

    def strip(x):
        if isinstance(x, dict):
            return {k: strip(v) for k, v in x.items() if k not in ("generatedAt", "updatedAt", "date")}
        if isinstance(x, list):
            return [strip(v) for v in x]
        return x
    return strip(js) == strip(json.loads(json.dumps(py_out, ensure_ascii=False)))


def check(names, log=print):
    """골라 만든 회사 데이터(rr_static) ↔ 회사 작업 폴더에서 실제 수집한 데이터(export_regrader) 비교.
    입력은 그 작업 폴더가 쓴 것 그대로 (적용법규 목록 · company_scope.json) — 판정 결과가 아니라 '고르는 규칙'만 본다."""
    from engine import export_regrader as X, rr_static
    u = {f: json.loads((OUT / "universe" / f).read_text(encoding="utf-8")) for f in UNIVERSE_FILES if (OUT / "universe" / f).exists()}
    ok = True
    for name in names:
        ws = X.workspace(name)
        if not (ws / "docs" / "meta.json").exists():
            log(f"{name}: 실제 수집 결과가 없어 건너뜀 ({ws})")
            continue
        real = {f: json.loads((ws / "docs" / f).read_text(encoding="utf-8"))
                for f in ["base_laws_207.json", "admrul_index.json", "meta.json", "law_families.json"] + [f"m{i}.json" for i in range(8)]}
        scope = json.loads((ws / "scripts" / "company_scope.json").read_text(encoding="utf-8"))
        fams = {}
        for x in real["base_laws_207.json"]["items"]:
            m = x["meta"]
            f = fams.setdefault(m["proFamily"], {"root": m["proFamily"], "category": x["categories"][0], "status": m.get("proStatus"),
                                                 "verified": True, "members": []})
            f["members"].append({"name": x["title"], "level": x["lawType"]})
        extra = {e["id"]: (e["families"][0], e["jobs"][0]) for e in scope.get("extra", [])}
        keep = {i: extra.get(i, ("", "")) for i in scope["keep"]}
        got = rr_static.build(list(fams.values()), scope.get("company") or name, u, keep=keep, tree_ids=set(scope["keep"]) - set(extra))
        row = lambda r: tuple(r.get(k, "") for k in ("t", "d", "a", "s", "m", "c", "u", "k", "i", "f"))
        g_rows = {row(r) for i in range(8) for r in got[f"m{i}.json"]}
        r_rows = {row(r) for i in range(8) for r in real[f"m{i}.json"]}
        g_base = {(x["title"], x["categories"][0]) for x in got["base_laws_207.json"]["items"]}
        r_base = {(x["title"], x["categories"][0]) for x in real["base_laws_207.json"]["items"]}
        g_idx = {x["i"] for x in got["admrul_index.json"]["items"]}
        r_idx = {x["i"] for x in real["admrul_index.json"]["items"]}
        fam = lambda d: {(f["root"], m["title"]) for f in d["families"] for m in f["members"] if m["inBase"]}
        res = {"적용법규": (len(g_base), len(r_base), len(g_base ^ r_base)), "행정규칙": (len(g_idx), len(r_idx), len(g_idx ^ r_idx)),
               "개정 줄": (len(g_rows), len(r_rows), len(g_rows ^ r_rows)),
               "계열 배치": (len(fam(got["law_families.json"])), len(fam(real["law_families.json"])), len(fam(got["law_families.json"]) ^ fam(real["law_families.json"])))}
        log(f"{name}: " + " · ".join(f"{k} 골라냄 {a} / 실제 {b} / 다름 {c}" for k, (a, b, c) in res.items()))
        js_ok = _js_same(list(fams.values()), scope.get("company") or name, u, keep, set(scope["keep"]) - set(extra), got)
        if js_ok is not None:
            log(f"   자바스크립트판(web/rr-static.js): {'파이썬판과 같음' if js_ok else '파이썬판과 다름!'}")
            ok = ok and js_ok
        for r in sorted(g_rows - r_rows)[:6]:
            log(f"   골라냄에만: {r}")
        for r in sorted(r_rows - g_rows)[:6]:
            log(f"   실제에만:   {r}")
        ok = ok and all(c == 0 for _, _, c in res.values())
    return ok


def main(argv):
    cmd = argv[0] if argv else ""
    if cmd == "pack":
        pack()
        return 0
    if cmd == "check":
        return 0 if check(argv[1:] or ["에코프로비엠", "카카오", "현대건설", "엘앤에프", "에코프로"]) else 1
    if cmd == "publish":
        publish(push="--push" in argv)
        return 0
    if cmd == "daily":
        daily(push="--no-push" not in argv)
        return 0
    if cmd == "web":
        web(argv[1] if len(argv) > 1 else OUT / "web")
        return 0
    if cmd == "companies":
        only = [a for a in argv[1:] if "|" in a]
        if "--dart-all" in argv:   # 판독 규칙을 고친 뒤: 상장사 전부를 DART 로 다시
            dart_pass(redo=True, max_fail=30)
            return 0
        if "--dart" in argv:   # 상장사 중 DART 근거가 없는 곳만 한 곳씩 다시
            dart_pass()
            return 0
        companies(only=only or None)
        return 0
    if cmd == "universe":
        universe(run="--no-run" not in argv)
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
