#!/usr/bin/env python3
"""적용법규를 '계열'(법률 → 시행령 → 시행규칙)로 묶는다 -> docs/law_families.json

국가법령정보센터 법령체계도(target=lsStmd)의 공식 상하위 관계를 쓴다.
이름 규칙('OO법 시행령')만으로는 '산업안전보건기준에 관한 규칙'처럼 이름이 다른 하위법령을 놓치기 때문이다.

- 적용법규 목록이 바뀌었거나, 파일이 없거나, 30일이 지났을 때만 다시 만든다 (refresh_laws.py 가 매번 부른다).
- 실패하면 기존 파일을 그대로 둔다. 화면은 파일이 없으면 이름 규칙으로 묶는다.
- 단독 실행: python3 scripts/law_families.py [--force]
"""
import hashlib
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
OUT = DOCS / "law_families.json"
OC = "knowhow1"
SEARCH = "https://www.law.go.kr/DRF/lawSearch.do"
SERVICE = "https://www.law.go.kr/DRF/lawService.do"
UA = "Mozilla/5.0 (RegRader law families)"
MAX_AGE = timedelta(days=30)
SKIP_KEYS = {"기본정보", "행정규칙", "자치법규", "관련법령"}
LEVEL_ORDER = {"법률": 0, "시행령": 1, "시행규칙": 2}
# 적용법규가 아닌 하위법령 중 회사 준수 의무와 무관한 것 (법원·헌법재판소 등의 규칙, 정부 조직 직제)은 싣지 않는다
NOISE_KINDS = {"대법원규칙", "헌법재판소규칙", "선거관리위원회규칙", "중앙선거관리위원회규칙", "국회규칙", "감사원규칙"}


def is_noise(name, kind):
    return kind in NOISE_KINDS or "직제" in (name or "")


def compact(name):
    return re.sub(r"[\s·ㆍ・.]", "", (name or "").strip())


def base_key(items):
    return hashlib.sha1("\n".join(sorted(compact(x["title"]) for x in items)).encode("utf-8")).hexdigest()


def get_json(url, params, tries=3):
    for i in range(tries):
        try:
            r = requests.get(url, params=params, headers={"User-Agent": UA}, timeout=40)
            r.raise_for_status()
            return r.json()
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(2)


def find_mst(name):
    """법령명으로 현행 법령일련번호(MST)를 찾는다. 이름이 정확히 같은 것만."""
    j = get_json(SEARCH, {"OC": OC, "target": "lsStmd", "type": "JSON", "query": name, "display": "100"})
    laws = (j.get("LsStmdSearch") or {}).get("law") or []
    if isinstance(laws, dict):
        laws = [laws]
    hits = [x for x in laws if compact(x.get("법령명")) == compact(name)]
    hits.sort(key=lambda x: 0 if x.get("법령구분명") == "법률" else 1)
    return hits[0]["법령일련번호"] if hits else None


def tree(mst):
    """체계도를 펼쳐 ([{name, level, kind, parent, mst}] (법률이 맨 앞), [연결된 행정규칙]) 을 돌려준다."""
    j = get_json(SERVICE, {"OC": OC, "target": "lsStmd", "type": "JSON", "MST": mst})
    top = ((j.get("법령체계도") or {}).get("상하위법")) or {}
    out, seen, adm = [], set(), []

    def walk(node, level, parent):
        if not isinstance(node, dict):
            return
        info = node.get("기본정보") or {}
        name = (info.get("법령명") or "").strip()
        if name and compact(name) not in seen:
            seen.add(compact(name))
            out.append({"name": name, "level": level, "kind": (info.get("법종구분") or {}).get("content") or "",
                        "parent": parent, "mst": info.get("법령일련번호") or ""})
        # 이 법령(법률·시행령·시행규칙)에 연결된 행정규칙: 고시·훈령·예규·공고 …
        rules = node.get("행정규칙") or {}
        for kind, lst in (rules.items() if isinstance(rules, dict) else []):
            for x in (lst if isinstance(lst, list) else [lst]):
                b = (x or {}).get("기본정보") or {}
                rid = str(b.get("행정규칙ID") or "")
                if rid:
                    t = b.get("제개정구분")
                    adm.append({"id": rid, "name": (b.get("행정규칙명") or "").strip(),
                                "kind": (b.get("법종구분") or {}).get("content") or kind,
                                "seq": str(b.get("행정규칙일련번호") or ""), "issued": b.get("발령일자") or "",
                                "effective": b.get("시행일자") or "", "type": t.get("content") if isinstance(t, dict) else (t or ""),
                                "link": f"{name or parent} ({level})"})
        # 하위는 시행령 -> 시행규칙 순서로 (응답의 키 순서는 법령마다 다르다)
        kids = sorted((k for k in node if k not in SKIP_KEYS), key=lambda k: LEVEL_ORDER.get(k, 9))
        for k in kids:
            v = node[k]
            for child in (v if isinstance(v, list) else [v]):
                walk(child, k, name or parent)

    for k, v in top.items():
        for node in (v if isinstance(v, list) else [v]):
            walk(node, k, None)
    return out, adm


def level_by_name(title):
    t = (title or "").strip()
    return "시행령" if t.endswith("시행령") else "시행규칙" if t.endswith("시행규칙") else "법률"


ADMRUL_OUT = DOCS / "admrul_candidates.json"


def write_admrul_candidates(families, adm_by_top, log=print):
    """계열마다 체계도에 연결된 행정규칙 -> docs/admrul_candidates.json (scripts/admin_rules.py 가 개정을 붙인다)"""
    from admin_rules import reference_tag
    jobs = {f["root"]: sorted({m.get("category") for m in f["members"] if m.get("inBase") and m.get("category")}) for f in families}
    cands, weight = {}, {}
    for top, lst in adm_by_top.items():
        if top not in jobs:
            continue
        for a in lst:
            c = cands.setdefault(a["id"], {k: a[k] for k in ("id", "name", "kind", "seq", "issued", "effective", "type")} | {"families": [], "links": [], "jobs": []})
            if top not in c["families"]:
                c["families"].append(top)
            if a["link"] not in c["links"]:
                c["links"].append(a["link"])
                # 여러 계열에 걸친 행정규칙은 더 많이(특히 법률에) 연결된 계열을 대표로 삼는다
                w = weight.setdefault(a["id"], {})
                w[top] = w.get(top, 0) + (2 if a["link"].endswith("(법률)") else 1)
    for rid, c in cands.items():
        w = weight.get(rid, {})
        c["families"].sort(key=lambda f: -w.get(f, 0))
        for f in c["families"]:
            for j in jobs[f]:
                if j not in c["jobs"]:
                    c["jobs"].append(j)
    items = sorted(cands.values(), key=lambda c: (c["jobs"][:1], c["name"]))
    for c in items:
        c["tag"] = reference_tag(c["name"], c["kind"])
    ADMRUL_OUT.write_text(json.dumps({"generatedAt": datetime.now(timezone.utc).isoformat(),
                                      "source": "국가법령정보센터 법령체계도 (lsStmd) 연결 행정규칙",
                                      "count": len(items), "items": items}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    log(f"admrul_candidates: 행정규칙 {len(items)}개 (주요 {sum(1 for c in items if not c['tag'])} · 참고 {sum(1 for c in items if c['tag'])})")


def guess_root(item):
    t = item["title"].strip()
    m = re.match(r"^(.*\S)\s*(시행령|시행규칙)$", t)
    if m:
        return m.group(1)
    return t


def build(items, force=False, log=print):
    old = {}
    if OUT.exists():
        try:
            old = json.loads(OUT.read_text(encoding="utf-8"))
        except ValueError:
            old = {}
    key = base_key(items)
    if not force and old.get("baseKey") == key and ADMRUL_OUT.exists():
        try:
            age = datetime.now(timezone.utc) - datetime.fromisoformat(old["generatedAt"])
            if age < MAX_AGE:
                return False
        except (KeyError, ValueError):
            pass

    base = {compact(x["title"]): x for x in items}
    placed = {}          # compact(base title) -> root name
    families = {}        # root name -> members

    def adopt(root_name, members, claim=None):
        """members 를 root_name 계열로 넣는다.
        적용법규는 이름 규칙상 이 계열인 것(또는 claim 으로 지정한 것)만 넣는다.
        여러 법률에 걸친 규칙(예: 특허법·실용신안법·의장법·상표법의 시행에 관한 규칙)이 계열마다 중복되지 않게."""
        fam = families.setdefault(root_name, [])
        have = {compact(m["title"]) for m in fam}
        for m in members:
            c = compact(m["name"])
            if c in have:
                continue
            b = base.get(c)
            if b and c != claim and compact(guess_root(b)) != compact(root_name):
                continue
            if not b and is_noise(m["name"], m["kind"]):
                continue
            have.add(c)
            row = {"title": b["title"] if b else m["name"], "level": m["level"], "kind": m["kind"], "inBase": bool(b)}
            if b and b.get("categories"):
                row["category"] = b["categories"][0]
            if m.get("parent"):
                pb = base.get(compact(m["parent"]))
                row["parent"] = pb["title"] if pb else m["parent"]
            if not b and m.get("mst"):
                row["lsiSeq"] = m["mst"]
            if m.get("stale"):
                row["notFound"] = True
            fam.append(row)
            if b:
                placed[c] = root_name

    # 1) 이름으로 짐작한 법률마다 체계도를 받아 온다 (응답이 느려 4개씩 동시에)
    roots = sorted({guess_root(x) for x in items})

    def fetch(name):
        mst = find_mst(name)
        return name, (tree(mst) if mst else ([], []))

    with ThreadPoolExecutor(max_workers=4) as ex:
        results = list(ex.map(fetch, roots))
    adm_by_top = {}   # 계열 맨 위 법률 -> 연결된 행정규칙
    for i, (root, (members, adm)) in enumerate(results, 1):
        if members:
            adm_by_top.setdefault(members[0]["name"], []).extend(adm)
        if not members:
            log(f"  [{i}/{len(roots)}] {root}: 체계도 없음")
            continue
        adopt(members[0]["name"], members)
        log(f"  [{i}/{len(roots)}] {members[0]['name']}: {len(members)}개")

    # 2) 아직 자리를 못 찾은 적용법규는 자기 체계도의 맨 위 법률 밑으로.
    #    그래도 없으면(법령명이 바뀌었거나 폐지) 이름 규칙으로만 묶는다.
    left = [(c, b) for c, b in base.items() if c not in placed]
    with ThreadPoolExecutor(max_workers=4) as ex:
        results = list(ex.map(lambda cb: (cb, fetch(cb[1]["title"])[1]), left))
    for (c, b), (members, adm) in results:
        if members and any(compact(m["name"]) == c for m in members):
            adopt(members[0]["name"], members, claim=c)
            adm_by_top.setdefault(members[0]["name"], []).extend(adm)
            log(f"  + {b['title']} -> {members[0]['name']}")
        else:
            adopt(guess_root(b), [{"name": b["title"], "level": level_by_name(b["title"]), "kind": b.get("lawType") or "",
                                   "parent": None, "stale": True}], claim=c)
            log(f"  + {b['title']}: 국가법령정보센터에서 찾지 못함 (법령명 변경·폐지 확인 필요)")

    # 적용법규가 하나도 없는 계열은 버린다 (다른 법률 체계도에 딸려 온 경우). 순서는 체계도 순서(법률 -> 시행령 -> 그 시행규칙) 그대로.
    out = [{"root": r, "members": ms} for r, ms in families.items() if any(m["inBase"] for m in ms)]
    out.sort(key=lambda f: f["root"])

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "국가법령정보센터 법령체계도 (lsStmd)",
        "baseKey": key,
        "baseCount": len(items),
        "familyCount": len(out),
        "families": out,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    write_admrul_candidates(out, adm_by_top, log)
    missing = sum(1 for f in out for m in f["members"] if not m["inBase"])
    stale = [m["title"] for f in out for m in f["members"] if m.get("notFound")]
    log(f"law_families: 계열 {len(out)}개, 적용법규 {len(placed)}/{len(items)}개 배치, 적용법규에 없는 하위법령 {missing}개"
        + (f", 법령정보센터에서 못 찾은 적용법규 {len(stale)}개: {', '.join(stale)}" if stale else ""))
    return True


if __name__ == "__main__":
    items = json.loads((DOCS / "base_laws_207.json").read_text(encoding="utf-8"))["items"]
    build(items, force="--force" in sys.argv)
