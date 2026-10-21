#!/usr/bin/env python3
"""처음 화면 레이더 자료 -> docs/radar.json (몇 KB)

처음 화면(docs/landing.js)의 레이더 점은 올해 개정 하나하나다. 대시보드 자료(m0~m7.json · amend_flags.json)는
화면 스크립트를 다 받은 뒤에야 불러와서, 그동안 빈 레이더만 돌다가 점이 한꺼번에 나타났다 (2026-10-21).
그래서 레이더에 필요한 것만 작은 파일로 따로 만들어 처음 화면이 바로 받게 한다.

  dots: 개정 1건 = 연중 날짜(0 = 1월 1일) * 16 + 고리 * 2 + 벌칙 · 과태료 · 과징금 · 처분 · 의무 변경 여부
        고리 = 직무 (0 지식재산권 · 지배구조 · 공정거래 · 정보보호 · 인사노무 · 안전 · 재무회계 · 7 환경)

refresh_laws.py 가 매일 마지막에 부른다. 단독 실행: python3 scripts/radar_data.py
"""
import json
from datetime import date
from pathlib import Path

DOCS = Path(__file__).resolve().parents[1] / "docs"
RINGS = ["지식재산권", "지배구조", "공정거래", "정보보호", "인사노무", "안전", "재무회계", "환경"]   # 안쪽 -> 바깥
RISK = {"벌칙", "과태료", "과징금", "처분", "의무"}   # docs/amend-ui.js 의 RISK 와 같다


def build(docs: Path = DOCS, log=print):
    meta = json.loads((docs / "meta.json").read_text(encoding="utf-8"))
    year = int(meta["year"])
    try:
        flags = json.loads((docs / "amend_flags.json").read_text(encoding="utf-8")).get("items") or {}
    except (OSError, ValueError):
        flags = {}
    start = date(year, 1, 1)
    dots = []
    for i in range(8):
        p = docs / f"m{i}.json"
        if not p.exists():
            continue
        for r in json.loads(p.read_text(encoding="utf-8")):
            try:
                doy = (date.fromisoformat(r["d"]) - start).days
            except (KeyError, ValueError):
                continue
            if not 0 <= doy < 366:
                continue
            ring = RINGS.index(r["c"]) if r.get("c") in RINGS else len(RINGS) - 1
            risk = bool(RISK & set(flags.get(f"{r.get('t')}|{r['d']}|{r.get('a')}", [])))
            dots.append(doy * 16 + ring * 2 + int(risk))
    dots.sort()
    (docs / "radar.json").write_text(json.dumps({"year": year, "asOf": meta.get("asOf"), "n": len(dots), "dots": dots},
                                                separators=(",", ":")), encoding="utf-8")
    log(f"radar: 레이더 점 {len(dots)}개 (벌칙 · 과태료 · 의무 변경 {sum(d & 1 for d in dots)})")
    return len(dots)


if __name__ == "__main__":
    build()
