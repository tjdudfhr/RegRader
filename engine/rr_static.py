"""회사 RegRader 데이터를 '전체 법률 수집 결과'(engine/static_site.py universe)에서 골라 만든다 — 수집 없이 즉시.

전체 법률을 적용법규로 둔 RegRader 수집 결과에는 모든 법령 · 행정규칙의 올해 개정이 같은 형식으로 들어 있다.
회사 데이터는 그중 회사 적용법규(법령 이름)와 Pro 가 고른 행정규칙(ID)의 행만 남기고, 직무 · 계열 표시만 회사 기준으로 다시 붙인다.
(scripts/refresh_laws.py · law_families.py · admin_rules.py 가 회사 작업 폴더에서 만드는 것과 같은 규칙)

같은 규칙의 자바스크립트판이 web/rr-static.js 다 (브라우저에서 즉시 · tests/test_rr_static.py 가 결과가 같은지 본다).
    build(families, company, universe) → {파일 이름: 내용}
      families  판정 결과의 계열 (RegRader로 보내기 화면이 보내는 것과 같은 모양)
      universe  {파일 이름: 내용} — base_laws_207 · law_families · admrul_candidates · admrul_events · upcoming_next · meta · m0~m7
"""
import re
from datetime import datetime, timezone

AMEND_MINI = {"일부개정": "일", "타법개정": "타"}
LEVELS = ("법률", "시행령", "시행규칙")


def compact(name):
    return re.sub(r"[\s·ㆍ・.]", "", (name or "").strip())


def _job(f):
    return f.get("category") or f.get("job") or "기타"


def _level(m):
    lv = m.get("level")
    if lv in LEVELS:
        return lv
    t = (m.get("name") or "").strip()
    return "시행령" if t.endswith("시행령") else "시행규칙" if t.endswith("시행규칙") else "법률"


def _fnv(text):
    """32비트 FNV-1a (UTF-8) — 자바스크립트판(web/rr-static.js)과 같은 값. 계열 목록의 baseKey 용."""
    h = 0x811C9DC5
    for b in text.encode("utf-8"):
        h = ((h ^ b) * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def base_items(families, ubase):
    """계열의 법령마다 적용법규 한 줄 (export_regrader.base_items 와 같은 모양 — 이름 · 시행일은 전체 수집의 것)."""
    rows, seen = [], set()
    for f in families:
        if not f.get("verified", True):
            continue
        for m in f.get("members") or [{"name": f["root"], "level": "법률"}]:
            k = compact(m["name"])
            if k in seen:
                continue
            seen.add(k)
            rows.append((m, f))
    items, missing = [], []
    for m, f in rows:
        u = ubase.get(compact(m["name"]))
        if not u:
            missing.append(m["name"])
        um = (u or {}).get("meta") or {}
        meta = {"ministry": um.get("ministry") or f.get("ministry") or "", "lsId": um.get("lsId") or "",
                "proFamily": f["root"], "proStatus": f.get("status") or "적용"}
        if f.get("reasons"):
            meta["proWhy"] = " / ".join(f["reasons"])
        if f.get("presumed"):
            meta["proPresumed"] = f["presumed"]
        items.append({"id": f"law_{len(items) + 1:03d}", "title": (u or {}).get("title") or m["name"], "categories": [_job(f)],
                      "lawType": _level(m), "effectiveDate": (u or {}).get("effectiveDate") or "", "status": "현행", "meta": meta})
    return items, missing


def keep_ids(families, tree_names=None):
    """Pro 가 고른 행정규칙 (추천 · 관련 · 묶음) → {ID: (계열, 직무)}. 묶음은 이름으로 ID 를 찾는다 (tree_names: 이름 → ID)."""
    keep = {}
    for f in families:
        chosen = list(f.get("admin") or []) + list(f.get("adminMore") or [])
        for b in f.get("bundles") or []:
            for n in b.get("bundle") or []:
                rid = (tree_names or {}).get(n)
                if rid:
                    chosen.append({"id": rid, "name": n})
        for a in chosen:
            rid = str(a.get("id") or "")
            if rid and not rid.startswith("bundle:"):
                keep.setdefault(rid, (f["root"], _job(f)))
    return keep


def build(families, company, universe, keep=None, tree_names=None, tree_ids=None):
    """tree_ids: 회사 계열 법령체계도에 연결된 행정규칙 ID — 이 밖의 것만 '필수 고시'로 회사 계열 밖에서도 넣는다
    (회사 작업 폴더의 company_scope.extra 와 같은 기준). 없으면 Pro 가 고른 것은 모두 넣는다."""
    ubase = {compact(x["title"]): x for x in universe["base_laws_207.json"]["items"]}
    items, missing = base_items(families, ubase)
    titles = {x["title"]: x["categories"][0] for x in items}
    keep = keep if keep is not None else keep_ids(families, tree_names)

    # 계열: 전체 수집의 계열 중 회사 적용법규가 든 것 (직무는 회사 기준)
    fams = []
    for f in universe["law_families.json"]["families"]:
        if not any(m["title"] in titles for m in f["members"]):
            continue
        members = []
        for m in f["members"]:
            row = {"title": m["title"], "level": m["level"], "kind": m["kind"], "inBase": m["title"] in titles}
            if row["inBase"]:
                row["category"] = titles[m["title"]]
            if m.get("parent"):
                row["parent"] = m["parent"]
            if not row["inBase"] and m.get("lsiSeq"):
                row["lsiSeq"] = m["lsiSeq"]
            if m.get("notFound"):
                row["notFound"] = True
            members.append(row)
        fams.append({"root": f["root"], "members": members})
    fam_jobs = {f["root"]: sorted({m["category"] for m in f["members"] if m["inBase"] and m.get("category")}) for f in fams}

    # 행정규칙 후보: 회사 계열에 연결된 것. Pro 가 고른 것만 적용 (나머지는 '이 회사 사업과 무관')
    cands = []
    for c in universe["admrul_candidates.json"]["items"]:
        cf = [f for f in c.get("families") or [] if f in fam_jobs]
        extra = c["id"] in keep and (tree_ids is None or c["id"] not in tree_ids)   # 회사 계열 밖 필수 고시: Pro 가 붙인 계열 · 직무로
        if not cf and not extra:
            continue
        jobs = []
        for f in cf:
            for j in fam_jobs[f]:
                if j not in jobs:
                    jobs.append(j)
        if not cf:
            cf, jobs = [keep[c["id"]][0]], [keep[c["id"]][1]]
        cands.append(dict(c, families=cf, jobs=jobs, tag="" if c["id"] in keep else c.get("tag", ""),
                          out="" if c["id"] in keep else "pro"))
    main = {c["id"]: c for c in cands if not c["out"] and not c["tag"]}
    index = [{"i": c["id"], "n": c["name"], "k": c["kind"], "q": c["seq"], "f": (c["families"] or [""])[0], "c": (c["jobs"] or [""])[0],
              "g": c["tag"], "e": c["effective"]} for c in cands if not c["out"]]

    # 개정: 법령 줄은 이름으로, 행정규칙 줄은 ID 로 고른다 (refresh_laws.py 와 같은 순서 · 중복 규칙)
    rows = [r for i in range(8) for r in universe[f"m{i}.json"]]
    law_rows = [dict(r, c=titles[r["t"]]) for r in rows if not r.get("k") and r["t"] in titles]
    have = {(r["t"], r["d"], r["a"]) for r in law_rows}
    adm_rows = []
    for x in sorted(universe["admrul_events.json"]["items"], key=lambda x: x.get("p") or "", reverse=True):
        c = main.get(x["id"])
        if not c or x.get("g"):
            continue
        row = {"t": x["t"], "d": x["d"], "a": AMEND_MINI.get(x["a"], x["a"] or ""), "s": x["s"], "m": x["m"],
               "c": (c["jobs"] or [""])[0], "u": x["q"], "k": x["k"], "i": x["id"], "f": (c["families"] or [""])[0]}
        key = (row["t"], row["d"], row["a"])
        if key in have:
            continue
        have.add(key)
        adm_rows.append(row)
    mini = law_rows + sorted(adm_rows, key=lambda r: (r["d"], r["t"]))

    umeta = universe["meta.json"]
    upcoming = [dict(r, c=titles[r["t"]]) for r in universe.get("upcoming_next.json") or [] if r["t"] in titles]
    now = _now()
    out = {
        "base_laws_207.json": {"generatedAt": now, "year": umeta.get("year"), "description": f"{company} 적용 법규 {len(items)}개 (RegRader Pro 판정)",
                               "total_laws": len(items), "items": items, "updatedAt": now},
        "law_families.json": {"generatedAt": now, "source": "국가법령정보센터 법령체계도 (lsStmd) — RegRader Pro 전체 법률 수집에서 고름",
                              "baseKey": _fnv("\n".join(sorted(compact(t) for t in titles))),
                              "baseCount": len(items), "familyCount": len(fams), "families": fams},
        "admrul_index.json": {"generatedAt": now, "items": index},
        "upcoming_next.json": upcoming,
        "changelog.json": {"entries": [], "updatedAt": now},
    }
    shard = (len(mini) + 7) // 8 or 1
    for i in range(8):
        out[f"m{i}.json"] = mini[i * shard:(i + 1) * shard]
    out["meta.json"] = {"generatedAt": umeta.get("generatedAt"), "asOf": umeta.get("asOf"), "year": umeta.get("year"),
                        "totalCount": len(mini), "lawEvents": len(law_rows), "admrulEvents": len(adm_rows),
                        "universe": umeta.get("universe"), "universePrev": None, "baseLaws": len(items),
                        "admrulLaws": len(main), "upcomingNext": len(upcoming), "archives": []}
    out["quarterly_details.json"] = quarterly(law_rows, items, umeta.get("year"))
    jobs = {}
    for x in items:
        jobs[x["categories"][0]] = jobs.get(x["categories"][0], 0) + 1
    out["pro_company.json"] = {"company": company, "generatedAt": now, "date": now[:10], "families": len(families), "laws": len(items),
                               "admin": len(main), "byJob": jobs, "notFound": missing, "asOf": umeta.get("asOf")}
    return out


def quarterly(law_rows, items, year):
    """예전 화면 일부가 읽는 quarterly_details.json (법령 개정만)."""
    kind = {x["title"]: x["lawType"] for x in items}
    qs = {f"Q{i}": {"period": f"{year}년 {3 * i - 2}~{3 * i}월", "count": 0, "laws": []} for i in range(1, 5)}
    cats, matrix, all_ = {}, {}, []
    for n, r in enumerate(law_rows, 1):
        q = f"Q{(int(r['d'][5:7]) - 1) // 3 + 1}"
        url = f"https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq={r['u']}" if r.get("u") else ""
        law = {"id": f"pro_{n}", "title": r["t"], "effectiveDate": r["d"], "effective_date": r["d"], "lawType": kind.get(r["t"]),
               "law_type": kind.get(r["t"]), "status": "현행" if r["s"] == 0 else "시행예정", "ministry": r["m"],
               "categories": [r["c"] or "기타"], "detail_url": url}
        qs[q]["laws"].append(law)
        qs[q]["count"] += 1
        all_.append(law)
        c = law["categories"][0]
        cats[c] = cats.get(c, 0) + 1
        matrix.setdefault(c, {k: 0 for k in qs})[q] += 1
    return {"generatedAt": _now(), "year": year, "description": f"{year}년 적용법규 개정 (RegRader Pro)", "total_laws": len(all_),
            "quarters": qs, "items": all_, "categoryBreakdown": cats, "categoryQuarterMatrix": matrix}


def filter_amend(doc, keys):
    """amend_flags.json / amend_details.json 에서 회사 개정(법령명|시행일|구분)만 남긴다. 개정 취지 번호도 다시 매긴다."""
    items = {k: v for k, v in (doc.get("items") or {}).items() if k in keys}
    out = dict(doc, items=items)
    if "reasons" in doc:
        old, new, at = doc["reasons"], [], {}
        for v in items.values():
            r = v.get("r")
            if isinstance(r, int) and r < len(old):
                if r not in at:
                    at[r] = len(new)
                    new.append(old[r])
                v["r"] = at[r]
        out["reasons"] = new
    return out


def amend_keys(files):
    """회사 개정 줄 → amend_* 의 키 (법령명|시행일|개정구분 약자)."""
    return {f"{r['t']}|{r['d']}|{r['a']}" for i in range(8) for r in files[f"m{i}.json"]}
