#!/usr/bin/env python3
"""Weekly refresh: law.go.kr OpenAPI -> match 207 base laws -> docs/index.json."""
from __future__ import annotations

import json
import os
import re
import time
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1] if Path(__file__).name == "refresh_laws.py" else Path.cwd()
if not (ROOT / "docs").exists():
    ROOT = Path.cwd()
DOCS = ROOT / "docs"
OC = os.environ.get("LAW_OC") or "knowhow1"
OPENAPI = "https://www.law.go.kr/DRF/lawSearch.do"
UA = "RegRader-refresh/1.1"


def normalize_name(name: str) -> str:
    """Display-level normalize: collapse spaces, unify middle dots."""
    name = re.sub(r"\s+", " ", (name or "").strip())
    return name.replace("·", ".").replace("ㆍ", ".").replace("・", ".")


def compact_name(name: str) -> str:
    """Identity key: same statute if only spaces / middle-dots differ."""
    return re.sub(r"[\s·ㆍ・.]", "", (name or "").strip())


def ymd_to_iso(s):
    m = re.search(r"(\d{4})(\d{2})(\d{2})", str(s or ""))
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None


def fetch_target(target: str, start: str, end: str):
    items = []
    page, total = 1, None
    while page <= 55:
        params = {
            "OC": OC, "target": target, "type": "JSON",
            "display": "100", "page": str(page),
            "efYd": f"{start}~{end}", "sort": "efasc",
        }
        r = requests.get(OPENAPI, params=params, headers={"User-Agent": UA}, timeout=25)
        r.raise_for_status()
        ls = r.json().get("LawSearch") or {}
        if total is None:
            total = int(ls.get("totalCnt") or 0)
            print(f"{target} totalCnt={total}", flush=True)
        laws = ls.get("law")
        if not laws:
            break
        if isinstance(laws, dict):
            laws = [laws]
        items.extend(laws)
        print(f"  {target} p{page} acc={len(items)}", flush=True)
        if len(laws) < 100 or (total and len(items) >= total):
            break
        page += 1
        time.sleep(0.08)
    return items


def main():
    as_of = date.today()
    year = as_of.year
    start, end = f"{year}0101", f"{year}1231"
    current = fetch_target("law", start, end)
    future = fetch_target("eflaw", start, end)

    raw = []
    for src, bucket in (("law", current), ("eflaw", future)):
        for it in bucket:
            raw.append({
                "법령일련번호": it.get("법령일련번호") or "",
                "법령ID": it.get("법령ID") or "",
                "법령명": (it.get("법령명한글") or "").strip(),
                "시행일자": ymd_to_iso(it.get("시행일자")),
                "공포일자": ymd_to_iso(it.get("공포일자")),
                "소관부처": (it.get("소관부처명") or "").strip(),
                "법령종류": (it.get("법령구분명") or "").strip(),
                "제개정구분": (it.get("제개정구분명") or "").strip(),
            })

    base = json.loads((DOCS / "base_laws_207.json").read_text(encoding="utf-8"))["items"]
    base_norm = defaultdict(list)
    for b in base:
        base_norm[compact_name(b["title"])].append(b)

    events = []
    seen = set()
    for row in raw:
        if not row["시행일자"] or not row["법령명"]:
            continue
        n = compact_name(row["법령명"])
        if n not in base_norm:
            continue
        for company in base_norm[n]:
            key = (company["title"], row["시행일자"], row["제개정구분"])
            if key in seen:
                continue
            seen.add(key)
            ed = date.fromisoformat(row["시행일자"])
            in_force = ed <= as_of
            lsi = row["법령일련번호"]
            events.append({
                "id": f"matched_{year}_{lsi}_{company['id']}_{row['시행일자']}_{row['제개정구분']}",
                "title": company["title"],
                "summary": f"{company['title']}의 {year}년 {row['제개정구분'] or '개정'}사항",
                "effectiveDate": row["시행일자"],
                "announcedDate": row["공포일자"],
                "lawType": row["법령종류"] or company.get("lawType"),
                "amendmentType": row["제개정구분"] or "",
                "status": "현행" if in_force else "시행예정",
                "inForce": in_force,
                "daysUntil": (ed - as_of).days,
                "ministry": row["소관부처"] or company.get("meta", {}).get("ministry"),
                "categories": company.get("categories") or ["기타"],
                "amendments": [{"date": row["시행일자"], "reason": None, "mainContents": None, "amendmentType": row["제개정구분"] or ""}],
                "meta": {"lsId": row["법령ID"], "lsiSeq": lsi, "matchType": "100%완전일치", "companyLawId": company["id"]},
                "source": {"name": "국가법령정보(OpenAPI)", "url": f"https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq={lsi}" if lsi else ""},
                "originalTitle": row["법령명"],
            })

    by = defaultdict(list)
    for e in events:
        by[e["title"]].append(e)
    for title, group in by.items():
        group.sort(key=lambda x: (x["effectiveDate"], x["amendmentType"]))
        timeline = [{"effectiveDate": g["effectiveDate"], "amendmentType": g["amendmentType"], "status": g["status"], "id": g["id"]} for g in group]
        past = sum(1 for g in group if g["inForce"])
        fut = len(group) - past
        for idx, g in enumerate(group, 1):
            g["eventIndex"] = idx
            g["eventCount"] = len(group)
            g["sameTitlePastCount"] = past
            g["sameTitleUpcomingCount"] = fut
            g["timeline"] = timeline

    events.sort(key=lambda x: (x["effectiveDate"], x["title"], x["amendmentType"]))
    q, cats, types, status_c = Counter(), Counter(), Counter(), Counter()
    for m in events:
        d = m["effectiveDate"]
        if f"{year}-01-01" <= d <= f"{year}-03-31":
            q["Q1"] += 1
        elif d <= f"{year}-06-30":
            q["Q2"] += 1
        elif d <= f"{year}-09-30":
            q["Q3"] += 1
        elif d <= f"{year}-12-31":
            q["Q4"] += 1
        for c in m["categories"]:
            cats[c] += 1
        types[m["amendmentType"] or "(없음)"] += 1
        status_c[m["status"]] += 1

    prev_path = DOCS / "index.json"
    if prev_path.exists():
        (DOCS / "previous_index.json").write_text(prev_path.read_text(encoding="utf-8"), encoding="utf-8")

    payload = {
        "year": year,
        "totalCount": len(events),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "asOf": as_of.isoformat(),
        "stats": {
            "quarter": dict(q), "categories": dict(cats),
            "amendmentType": dict(types), "status": dict(status_c),
            "distinctBaseHit": len(by), "baseLaws": len(base),
        },
        "integrity": {
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "asOf": as_of.isoformat(),
            "rule": "unique key = title+effectiveDate+amendmentType; match = compact(name)",
            "uniqueEvents": len(events),
            "uniqueTitles": len(by),
            "titlesWithMultipleEvents": sum(1 for g in by.values() if len(g) > 1),
            "titlesWithBothInForceAndUpcoming": sum(1 for g in by.values() if any(x["inForce"] for x in g) and any(not x["inForce"] for x in g)),
            "duplicateKeys": 0,
            "statusConsistentWithDate": True,
        },
        "universe": {"openapiCurrent": len(current), "openapiFuture": len(future)},
        "items": events,
    }
    DOCS.mkdir(exist_ok=True)
    (DOCS / "index.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    amap = {"일부개정": "일", "타법개정": "타"}
    mini = []
    for e in events:
        mini.append({
            "t": e["title"], "d": e["effectiveDate"],
            "a": amap.get(e["amendmentType"], (e["amendmentType"] or "")[:1]),
            "s": 0 if e["inForce"] else 1,
            "m": e.get("ministry") or "",
            "c": (e.get("categories") or [""])[0],
            "u": str((e.get("meta") or {}).get("lsiSeq") or ""),
        })
    shard = (len(mini) + 7) // 8 or 1
    for i in range(8):
        chunk = mini[i * shard:(i + 1) * shard]
        (DOCS / f"m{i}.json").write_text(json.dumps(chunk, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(json.dumps({"totalCount": payload["totalCount"], "integrity": payload["integrity"], "stats": payload["stats"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
