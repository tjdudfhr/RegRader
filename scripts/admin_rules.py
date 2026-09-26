#!/usr/bin/env python3
"""행정규칙(고시·훈령·예규·공고 등) 모니터링 -> docs/admrul_events.json

대상: 적용법규 계열(법률·시행령·시행규칙)에 국가법령정보센터 법령체계도로 공식 연결된 행정규칙
      (docs/admrul_candidates.json — scripts/law_families.py 가 계열을 만들 때 같이 만든다)
개정: 행정규칙 검색(target=admrul, 연혁 포함)에서 발령일이 작년 7월 이후인 것을 모두 받아
      '올해 시행되는' 버전 중 대상 행정규칙만 남긴다. 매일 갱신 때 refresh_laws.py 가 부른다.

모든 대상을 모니터링하되, 회사 준수사항과 거리가 먼 것은 '참고'로 표시해 화면에서 기본으로 접어 둔다
(정부 내부 사무, 기관별 개인정보 지침, 위원회 운영, 특정 지역·시설 대상, 시험·자격 운영, 지난 연도 고시).
이름으로만 판단하므로 빼 버리지 않고 표시만 한다.
단독 실행: python3 scripts/admin_rules.py
"""
from __future__ import annotations

import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
CANDIDATES = DOCS / "admrul_candidates.json"
EVENTS = DOCS / "admrul_events.json"
OC = "knowhow1"
SEARCH = "https://www.law.go.kr/DRF/lawSearch.do"
UA = "Mozilla/5.0 (RegRader admin rules)"

# ---------- '참고' 표시 규칙 (이름 기준) ----------
AGENCY = r"(?:부|처|청|위원회|원|실|국|본부|공단|공사|센터|재단|진흥원|연구원|협회|거래소|감독원)"
PLACE = r"(?:특별시|광역시|특별자치시|특별자치도|[가-힣]시|[가-힣]군|[가-힣]구|정수장|처리장|처리시설|산업단지|산단|농공단지|댐|[가-힣]항|사업|지구|유역환경청|지방환경청|환경청)"
REFERENCE_RULES = [
    ("기관 내부 개인정보 지침", re.compile(r"^(?!표준)[가-힣·ㆍ\s]+" + AGENCY + r"(?:\s*및\s*[가-힣·ㆍ\s]+" + AGENCY + r")?\s+.*개인정보\s*보호\s*(?:세부\s*)?(?:지침|규정)$|개인정보\s*보호\s*훈령$")),
    ("정부 내부 사무", re.compile(r"직제|정원|공무원|근로감독관|감독관\s*집무|포상금|포상\s*(등|업무)|보안업무|청사|소속기관|자체감사|감사\s*규정|위임전결|전결\s*규정|복무|인사\s*규정|사무분장|문서\s*관리|민원\s*사무|기록물|국제개발협력|업무보고|행정규칙\s*관리")),
    ("위원회 운영", re.compile(r"(심의|심사|사고조사|전문|기술심의|관리|징계|인사|보호|분쟁조정|조정|시험)위원회\s*(의\s*)?(구성|운영|설치)|심사관\s*및")),
    ("특정 지역·시설 대상", re.compile(r"\([^)]*" + PLACE + r"[^)]*\)|^\([^)]*" + AGENCY + r"\)\s*.*(기본계획|통합\s*고시)")),
    ("시험·자격 운영", re.compile(r"자격\s*시험|시험\s*(시행|관리|운영)|교육\s*과정\s*운영|강사\s*(선정|관리)")),
    ("등기 사무", re.compile(r"등기")),
]


def reference_tag(name: str, kind: str = "", year: int | None = None) -> str:
    """'참고'로 접어 둘 이유. 주요 대상이면 ''."""
    year = year or date.today().year
    if kind == "등기예규":
        return "등기 사무"
    m = re.match(r"^(\d{4})년\s*(도)?\s", name or "")
    if m and int(m.group(1)) < year - 1:
        return "지난 연도 고시"
    for label, rx in REFERENCE_RULES:
        if rx.search(name or ""):
            return label
    return ""


# ---------- 개정 이벤트 ----------

def fetch_page(params, page):
    for i in range(3):
        try:
            p = dict(params, OC=OC, target="admrul", type="JSON", display="100", page=str(page))
            r = requests.get(SEARCH, params=p, headers={"User-Agent": UA}, timeout=60)
            r.raise_for_status()
            s = r.json().get("AdmRulSearch") or {}
            items = s.get("admrul") or []
            return int(s.get("totalCnt") or 0), (items if isinstance(items, list) else [items])
        except Exception:  # noqa: BLE001
            time.sleep(2 + i * 3)
    raise RuntimeError(f"행정규칙 검색 실패 (page {page})")


def fetch_versions(year: int):
    """발령일이 작년 7월 1일 ~ 올해 말인 행정규칙 버전 전체 (현행 + 연혁)."""
    params = {"prmlYd": f"{year - 1}0701~{year}1231", "nw": "2"}
    total, first = fetch_page(params, 1)
    pages = (total + 99) // 100
    with ThreadPoolExecutor(max_workers=4) as ex:
        rest = list(ex.map(lambda p: fetch_page(params, p)[1], range(2, pages + 1)))
    rows = first + [x for items in rest for x in items]
    if total and len(rows) < total * 0.98:
        raise RuntimeError(f"행정규칙 목록이 덜 받아짐 ({len(rows)}/{total})")
    return rows


def iso(ymd):
    s = str(ymd or "")
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}" if len(s) == 8 else ""


def build(log=print, today: date | None = None):
    if not CANDIDATES.exists():
        log("admin_rules: 대상 목록(admrul_candidates.json)이 아직 없어 건너뜀")
        return None
    today = today or (date.fromisoformat(os.environ["RR_TODAY"]) if os.environ.get("RR_TODAY") else date.today())
    year = today.year
    cand = {c["id"]: c for c in json.loads(CANDIDATES.read_text(encoding="utf-8"))["items"]}
    prev = {}
    if EVENTS.exists():
        try:
            pj = json.loads(EVENTS.read_text(encoding="utf-8"))
            if pj.get("year") == year:
                prev = {(x["id"], x["d"], x["q"]): x for x in pj.get("items") or []}
        except ValueError:
            prev = {}
    rows = fetch_versions(year)
    seen, items = set(), []
    for r in rows:
        rid = str(r.get("행정규칙ID") or "")
        ef = iso(r.get("시행일자"))
        if rid not in cand or not ef.startswith(str(year)):
            continue
        key = (rid, ef, r.get("행정규칙일련번호"))
        if key in seen:
            continue
        seen.add(key)
        c = cand[rid]
        name = (r.get("행정규칙명") or c["name"]).strip()
        items.append({
            "id": rid,
            "t": name,
            "k": r.get("행정규칙종류") or c.get("kind") or "",
            "d": ef,
            "p": iso(r.get("발령일자")),
            "a": r.get("제개정구분명") or "",
            "m": (r.get("소관부처명") or "").strip(),
            "q": str(r.get("행정규칙일련번호") or ""),
            "c": c.get("jobs") or [],
            "f": c.get("families") or [],
            "g": reference_tag(name, r.get("행정규칙종류") or c.get("kind") or "", year),
            "s": 0 if ef < today.isoformat() else 1,   # 0 = 시행완료 (오늘 시행분은 '예정'쪽: 법령과 같은 기준)
        })
    items.sort(key=lambda x: (x["d"], x["t"]))
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "asOf": today.isoformat(),
        "year": year,
        "candidates": len(cand),
        "candidatesMain": sum(1 for c in cand.values() if not c.get("tag")),
        "items": items,
    }
    EVENTS.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    # 업데이트 내역용: 직전 실행 이후 새로 잡힌 개정 (처음 실행이면 기준선만 만든다)
    payload["added"] = [x for x in items if prev and (x["id"], x["d"], x["q"]) not in prev]
    main = sum(1 for x in items if not x["g"])
    log(f"admin_rules: 대상 {len(cand)}개 중 올해 개정 {len({x['id'] for x in items})}개 · 개정 {len(items)}건 (주요 {main} · 참고 {len(items) - main})")
    return payload


if __name__ == "__main__":
    build()
