#!/usr/bin/env python3
"""Daily refresh: law.go.kr OpenAPI -> match base laws (docs/base_laws_207.json) -> docs/m0~m7.json, index.json, meta.json.

연도 전환: 해가 바뀐 뒤 첫 실행에서 직전 연도 데이터를 docs/archive/<연도>/ 에 보관하고,
업데이트 내역에는 '연도 전환' 한 건만 남긴다. 12월에는 다음 해 1~2월 시행분을 docs/upcoming_next.json 에
따로 모아 D-30 알림이 연말에도 끊기지 않게 한다. 테스트용으로 RR_TODAY=YYYY-MM-DD 로 기준일을 바꿀 수 있다.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import time
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
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


LOOKAHEAD_DAYS = 60  # 연말에 다음 해 시행분을 미리 볼 기간
ARCHIVE_FILES = ["index.json", "meta.json"] + [f"m{i}.json" for i in range(8)]


def archive_year(prev_year: int):
    """직전 연도 데이터 보관: docs/archive/<연도>/ (이미 있으면 덮어쓰지 않는다)."""
    dest = DOCS / "archive" / str(prev_year)
    if dest.exists():
        return dest
    dest.mkdir(parents=True)
    for name in ARCHIVE_FILES:
        if (DOCS / name).exists():
            shutil.copy2(DOCS / name, dest / name)
    print(f"archive: {prev_year}년 데이터를 {dest.relative_to(ROOT)} 에 보관", flush=True)
    return dest


def to_raw(it):
    return {
        "법령일련번호": it.get("법령일련번호") or "",
        "법령ID": it.get("법령ID") or "",
        "법령명": (it.get("법령명한글") or "").strip(),
        "시행일자": ymd_to_iso(it.get("시행일자")),
        "공포일자": ymd_to_iso(it.get("공포일자")),
        "소관부처": (it.get("소관부처명") or "").strip(),
        "법령종류": (it.get("법령구분명") or "").strip(),
        "제개정구분": (it.get("제개정구분명") or "").strip(),
    }


def match_rows(raw, base_norm):
    """법령정보센터 행 중 적용법규와 이름이 일치하는 것 -> [(적용법규, 행)] (법규+시행일+개정구분 기준 중복 제거)."""
    out, seen = [], set()
    for row in raw:
        if not row["시행일자"] or not row["법령명"]:
            continue
        for company in base_norm.get(compact_name(row["법령명"]), []):
            key = (company["title"], row["시행일자"], row["제개정구분"])
            if key in seen:
                continue
            seen.add(key)
            out.append((company, row))
    return out


AMEND_MINI = {"일부개정": "일", "타법개정": "타"}


def mini_row(title, eff, amend, in_force, ministry, category, lsi):
    return {"t": title, "d": eff, "a": AMEND_MINI.get(amend, (amend or "")[:1]), "s": 0 if in_force else 1,
            "m": ministry or "", "c": category or "", "u": str(lsi or "")}


AMEND_FULL = {"일": "일부개정", "타": "타법개정", "전": "전부개정", "제": "제정", "폐": "폐지"}


def read_json(path: Path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default if default is not None else {}


def load_prev_rows():
    """현재 docs/m0~m7.json (직전 갱신 결과)."""
    rows = []
    for i in range(8):
        chunk = read_json(DOCS / f"m{i}.json", [])
        if isinstance(chunk, list):
            rows.extend(r for r in chunk if isinstance(r, dict) and r.get("t"))
    return rows


def row_key(r):
    return (r.get("t"), r.get("d"), r.get("a"))


def change_item(r):
    return {
        "title": r.get("t"),
        "effectiveDate": r.get("d"),
        "amendmentType": AMEND_FULL.get(r.get("a"), r.get("a") or ""),
        "ministry": r.get("m") or "",
        "category": r.get("c") or "",
        "lsiSeq": r.get("u") or "",
    }


def diff_rows(prev_rows, new_rows):
    prev = {row_key(r): r for r in prev_rows}
    new = {row_key(r): r for r in new_rows}
    order = lambda r: (r.get("d") or "", r.get("t") or "")
    added = sorted((r for k, r in new.items() if k not in prev), key=order)
    removed = sorted((r for k, r in prev.items() if k not in new), key=order)
    now_in_force = sorted((r for k, r in new.items() if k in prev and prev[k].get("s") == 1 and r.get("s") == 0), key=order)
    return [change_item(r) for r in added], [change_item(r) for r in removed], [change_item(r) for r in now_in_force]


def record_changes(prev_rows, new_rows, prev_meta, meta):
    """직전 갱신과 달라진 점을 docs/changelog.json 맨 앞에 추가한다. 달라진 게 없으면 기록하지 않는다."""
    path = DOCS / "changelog.json"
    prev_year = (prev_meta or {}).get("year")
    if prev_year and prev_year != meta["year"]:
        # 연도 전환: 작년 개정 전체가 '빠짐', 올해 개정 전체가 '신규'로 찍히지 않도록 한 건으로 기록한다
        log = read_json(path, {"entries": []})
        log.setdefault("entries", [])
        log["entries"].insert(0, {
            "type": "yearRollover",
            "checkedAt": meta["generatedAt"],
            "asOf": meta["asOf"],
            "previousCheckedAt": (prev_meta or {}).get("generatedAt"),
            "fromYear": prev_year,
            "toYear": meta["year"],
            "totalBefore": len({row_key(r) for r in prev_rows}),
            "totalAfter": meta["totalCount"],
            "universeBefore": (prev_meta or {}).get("universe"),
            "universeAfter": meta.get("universe"),
            "archive": f"archive/{prev_year}/",
            "added": [], "removed": [], "nowInForce": [],
        })
        log["updatedAt"] = meta["generatedAt"]
        path.write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"changelog: 연도 전환 {prev_year} -> {meta['year']}", flush=True)
        return
    added, removed, now_in_force = diff_rows(prev_rows, new_rows)
    # 적용법규를 새로 추가한 경우(process_law_requests.py): 그 법규의 개정은 '신규 개정'이 아니라 '적용법규 추가'로 분리한다
    try:
        base_added = json.loads(os.environ.get("RR_BASE_ADDED") or "[]")
    except ValueError:
        base_added = []
    # 적용법규의 법령명 변경(법령정보센터에서 이름이 바뀐 법)·삭제(폐지된 법)도 같은 방식으로 따로 기록한다
    def env_list(name):
        try:
            v = json.loads(os.environ.get(name) or "[]")
            return v if isinstance(v, list) else []
        except ValueError:
            return []
    base_renamed = env_list("RR_BASE_RENAMED")    # [{from, to, category, ministry}]
    base_removed = env_list("RR_BASE_REMOVED")    # [{title, category, reason}]
    new_titles = {b.get("title") for b in base_added} | {b.get("to") for b in base_renamed}
    by_base = [x for x in added if x["title"] in new_titles]
    added = [x for x in added if x["title"] not in new_titles]
    old_titles = {b.get("title") for b in base_removed} | {b.get("from") for b in base_renamed}
    removed_by_base = [x for x in removed if x["title"] in old_titles]
    removed = [x for x in removed if x["title"] not in old_titles]
    u_before = (prev_meta or {}).get("universe") or {}
    u_after = meta.get("universe") or {}
    if not (added or removed or now_in_force or base_added or base_renamed or base_removed or (u_before and u_before != u_after)):
        print("changelog: 변경 없음", flush=True)
        return
    log = read_json(path, {"entries": []})
    log.setdefault("entries", [])
    log["entries"].insert(0, {
        "checkedAt": meta["generatedAt"],
        "asOf": meta["asOf"],
        "previousCheckedAt": (prev_meta or {}).get("generatedAt"),
        "totalBefore": len({row_key(r) for r in prev_rows}),
        "totalAfter": meta["totalCount"],
        "universeBefore": u_before or None,
        "universeAfter": u_after,
        "added": added,
        "removed": removed,
        "nowInForce": now_in_force,
        "baseLawsAdded": base_added,
        "addedByBase": by_base,
        "baseLawsRenamed": base_renamed,
        "baseLawsRemoved": base_removed,
        "removedByBase": removed_by_base,
        "baseLawsBefore": (prev_meta or {}).get("baseLaws"),
        "baseLawsAfter": meta.get("baseLaws"),
    })
    log["updatedAt"] = meta["generatedAt"]
    path.write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"changelog: 신규 {len(added)} / 삭제 {len(removed)} / 시행 {len(now_in_force)} / 적용법규 추가 {len(base_added)}"
          f" / 법령명 변경 {len(base_renamed)} / 적용법규 삭제 {len(base_removed)}", flush=True)


def main():
    as_of = date.fromisoformat(os.environ["RR_TODAY"]) if os.environ.get("RR_TODAY") else date.today()
    year = as_of.year
    start, end = f"{year}0101", f"{year}1231"
    current = fetch_target("law", start, end)
    future = fetch_target("eflaw", start, end)
    raw = [to_raw(it) for it in current + future]

    base = json.loads((DOCS / "base_laws_207.json").read_text(encoding="utf-8"))["items"]
    # 법령 계열(법률·시행령·시행규칙) 묶음: 적용법규가 바뀌었거나 30일이 지났을 때만 다시 만든다. 실패해도 갱신은 계속한다.
    try:
        import law_families
        law_families.build(base, log=lambda m: print(m, flush=True))
    except Exception as e:  # noqa: BLE001
        print(f"law_families 건너뜀: {e}", flush=True)
    base_norm = defaultdict(list)
    for b in base:
        base_norm[compact_name(b["title"])].append(b)

    # 해가 바뀐 뒤 첫 실행이면 덮어쓰기 전에 작년 데이터를 보관한다
    prev_meta_top = read_json(DOCS / "meta.json")
    if prev_meta_top.get("year") and prev_meta_top["year"] != year:
        archive_year(prev_meta_top["year"])

    # 연말: 다음 해 시행분(오늘부터 LOOKAHEAD_DAYS 이내)을 따로 모은다 -> watch.html·30일 내 시행 칸에서 사용
    ahead_end = as_of + timedelta(days=LOOKAHEAD_DAYS)
    upcoming_next = []
    if ahead_end.year > year:
        nxt = fetch_target("eflaw", f"{year + 1}0101", ahead_end.strftime("%Y%m%d"))
        for company, row in match_rows([to_raw(it) for it in nxt], base_norm):
            if row["시행일자"] <= ahead_end.isoformat():
                upcoming_next.append(mini_row(company["title"], row["시행일자"], row["제개정구분"], False,
                                              row["소관부처"] or company.get("meta", {}).get("ministry"),
                                              (company.get("categories") or [""])[0], row["법령일련번호"]))
    (DOCS / "upcoming_next.json").write_text(json.dumps(upcoming_next, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    events = []
    for company, row in match_rows(raw, base_norm):
        if not row["시행일자"].startswith(str(year)):
            continue
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
        # openapiCurrent: 올해 시행돼 지금 효력 있는 현행 법령 / openapiFuture: 올해 시행일이 있는 모든 버전(연혁 포함)
        # openapiUpcoming: 그중 시행일이 아직 오지 않은 것 (화면의 '시행예정')
        "universe": {"openapiCurrent": len(current), "openapiFuture": len(future),
                     "openapiUpcoming": sum(1 for it in future if (ymd_to_iso(it.get("시행일자")) or "") > as_of.isoformat())},
        "items": events,
    }
    DOCS.mkdir(exist_ok=True)
    (DOCS / "index.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    mini = [mini_row(e["title"], e["effectiveDate"], e["amendmentType"], e["inForce"], e.get("ministry"),
                     (e.get("categories") or [""])[0], (e.get("meta") or {}).get("lsiSeq")) for e in events]
    # 덮어쓰기 전에 직전 데이터를 읽어 둔다 (업데이트 내역 비교용)
    prev_rows = load_prev_rows()
    prev_meta = read_json(DOCS / "meta.json")

    shard = (len(mini) + 7) // 8 or 1
    for i in range(8):
        chunk = mini[i * shard:(i + 1) * shard]
        (DOCS / f"m{i}.json").write_text(json.dumps(chunk, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # 화면 상단(최종 업데이트 시각, 전체 현행/시행예정 수)용 작은 파일
    meta = {
        "generatedAt": payload["generatedAt"],
        "asOf": payload["asOf"],
        "year": year,
        "totalCount": payload["totalCount"],
        "universe": payload["universe"],
        # 화면에 '전일 대비'를 보여주려고 직전 날짜의 수치를 같이 둔다 (같은 날 여러 번 돌면 그 전날 값 유지)
        "universePrev": (prev_meta.get("universePrev") if prev_meta.get("asOf") == payload["asOf"]
                         else ({**(prev_meta.get("universe") or {}), "asOf": prev_meta.get("asOf")} if prev_meta.get("universe") else None)),
        "baseLaws": len(base),
        "upcomingNext": len(upcoming_next),
        "archives": sorted(p.name for p in (DOCS / "archive").iterdir() if p.is_dir()) if (DOCS / "archive").exists() else [],
    }
    (DOCS / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    if prev_rows:
        record_changes(prev_rows, mini, prev_meta, meta)

    print(json.dumps({"totalCount": payload["totalCount"], "integrity": payload["integrity"], "stats": payload["stats"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
