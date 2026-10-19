"""자치법규(조례 · 규칙): 사업장 소재 지자체(포항 · 광양 · 세종) 조례 가운데
근거 법령이 당사 적용법규이고 회사에 의무 · 과태료 · 부담금을 지우는 것만 모니터링한다.

대상 목록: scripts/ordin_scope.json (2026-10-20 후보 판정 → 담당자 확정). 고치려면 그 파일을 고친다.
매일(refresh_laws.py 안에서) 각 조례의 현행 버전을 자치법규ID 로 확인해
  docs/ordin_index.json   적용 자치법규 목록 + 올해 시행된 개정(본 것은 계속 보관 — API 는 현행만 준다)
  개정 행                  m*.json 에 행정규칙처럼 섞는다: k = 조례/규칙, o = 지자체, i = 'O' + 자치법규ID, u = 자치법규일련번호
"""
import json
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
SCOPE = Path(__file__).resolve().parent / "ordin_scope.json"
OUT = DOCS / "ordin_index.json"
CACHE = Path.home() / "Library" / "Caches" / "RegRader" / "ordin"   # 자치법규일련번호(버전)별 본문 — 버전마다 바뀌지 않는다
OC = "knowhow1"
SERVICE = "https://www.law.go.kr/DRF/lawService.do"
UA = "Mozilla/5.0 (RegRader ordinances)"
AMEND_MINI = {"일부개정": "일", "타법개정": "타"}


def iso(s):
    s = str(s or "")
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}" if len(s) >= 8 and s[:8].isdigit() else ""


def fetch_current(oid: str) -> dict:
    """자치법규ID 로 현행 본문을 받는다 (본문은 자치법규일련번호별로 캐시)"""
    last = None
    for i in range(3):
        try:
            r = requests.get(SERVICE, params={"OC": OC, "target": "ordin", "ID": oid, "type": "JSON"},
                             headers={"User-Agent": UA}, timeout=60)
            r.raise_for_status()
            d = r.json()
            info = ((d.get("LawService") or {}).get("자치법규기본정보")) or {}
            if not info.get("자치법규일련번호"):
                raise ValueError("자치법규 정보 없음")
            CACHE.mkdir(parents=True, exist_ok=True)
            f = CACHE / f"{info['자치법규일련번호']}.json"
            if not f.exists():
                f.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
            return d
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 + i * 3)
    raise RuntimeError(f"{oid}: {last}")


def body(mst: str):
    """amend_details 등에서 쓰는 버전별 본문 (캐시 → 없으면 받기)"""
    f = CACHE / f"{mst}.json"
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            f.unlink()
    r = requests.get(SERVICE, params={"OC": OC, "target": "ordin", "MST": mst, "type": "JSON"}, headers={"User-Agent": UA}, timeout=60)
    r.raise_for_status()
    d = r.json()
    CACHE.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    return d


def read_json(p: Path, default=None):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def build(log=print, today: date = None, year: int = None):
    today = today or date.today()
    year = year or today.year
    scope = (read_json(SCOPE, {}) or {}).get("items") or []
    old = read_json(OUT, {}) or {}
    old_ids = {x.get("id") for x in old.get("items") or []}
    events = {}
    if old.get("year") == year:   # 앞서 본 올해 개정은 보관 (그 뒤 다시 개정돼 현행이 바뀌어도 남는다)
        for e in old.get("events") or []:
            events[(e["id"], e["d"])] = e

    def get(s):
        try:
            return s, fetch_current(s["id"])
        except Exception as e:  # noqa: BLE001
            return s, e

    items, failed = [], []
    with ThreadPoolExecutor(max_workers=4) as ex:
        got = list(ex.map(get, scope))
    prev = {x.get("id"): x for x in old.get("items") or []}
    for s, d in got:
        if isinstance(d, Exception):
            failed.append(s["id"])
            log(f"  자치법규 {s['name']} 받기 실패: {d}")
            if s["id"] in prev:   # 못 받으면 어제 것으로
                items.append(prev[s["id"]])
            continue
        info = d["LawService"]["자치법규기본정보"]
        it = {
            "id": s["id"], "mst": str(info.get("자치법규일련번호") or ""), "name": info.get("자치법규명") or s["name"],
            "org": s["org"], "agency": info.get("지자체기관명") or s.get("agency") or "", "kind": s.get("kind") or "조례",
            "basis": s.get("basis") or [], "job": s.get("job") or "", "why": s.get("why") or "",
            "ef": iso(info.get("시행일자")), "prom": iso(info.get("공포일자")), "amend": info.get("제개정정보") or "",
            "dept": info.get("담당부서명") or "",
        }
        items.append(it)
        if it["ef"][:4] == str(year):
            events[(it["id"], it["ef"])] = {"id": it["id"], "d": it["ef"], "name": it["name"], "mst": it["mst"], "amend": it["amend"],
                                           "prom": it["prom"], "org": it["org"], "agency": it["agency"], "kind": it["kind"], "job": it["job"]}
    in_scope = {s["id"] for s in scope}
    evs = sorted((e for e in events.values() if e["id"] in in_scope), key=lambda e: (e["d"], e["name"]))
    OUT.write_text(json.dumps({
        "generatedAt": datetime.now(timezone.utc).isoformat(), "year": year,
        "description": "적용 자치법규 (scripts/ordin_scope.json) — 사업장 소재 지자체 조례 중 회사에 의무 · 부담금을 지우는 것",
        "items": sorted(items, key=lambda x: (x["org"], x["name"])), "events": evs,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    rows = []
    for e in evs:
        amend = e.get("amend") or ""
        rows.append({"t": e["name"], "d": e["d"], "a": AMEND_MINI.get(amend, amend[:1]), "s": 0 if e["d"] <= today.isoformat() else 1,
                     "m": e["agency"], "c": e["job"], "u": e["mst"], "k": e["kind"], "i": "O" + e["id"], "o": e["org"]})
    new_scope = sorted(in_scope - old_ids) if old_ids else sorted(in_scope)
    log(f"ordinances: 적용 자치법규 {len(items)}개 · 올해 시행 개정 {len(rows)}건" + (f" · 실패 {len(failed)}" if failed else ""))
    return {"items": items, "rows": rows, "newScope": new_scope, "failed": failed}


if __name__ == "__main__":
    r = build()
    for x in r["rows"]:
        print(x)
