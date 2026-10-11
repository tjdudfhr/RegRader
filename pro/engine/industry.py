"""업종(국세청 업종코드) → 업종 법규. kb/industry_laws.json 을 읽는다.

    python3 -m engine.industry 552101      # 업종 하나의 태그·법규
    python3 -m engine.industry status      # 업종 표가 국세청 업종코드 전부를 덮는지

국세청 업종코드는 국민연금 가입 사업장 업종코드와 같은 체계다 (기준경비율 고시, 1,542개).
- groups: 앞 4자리 묶음의 기본 태그·법규
- codes: 6자리 세부 업종 — 묶음에 덧붙이고, only 면 묶음 법규 대신 이것만, drop 은 묶음 태그에서 뺄 것
판정에서는 회사가 가진 업종을 사실 'nts:묶음'·'nts:세부' 로 두고, 업종 법규마다 규칙을 만든다.
"""
import json
import sys
from functools import lru_cache
from pathlib import Path

from engine import lawapi

ROOT = Path(__file__).resolve().parents[1]
KBFILE = ROOT / "kb" / "industry_laws.json"
UNKNOWN = {"999999", "000000"}


@lru_cache(maxsize=1)
def load():
    return json.loads(KBFILE.read_text(encoding="utf-8")) if KBFILE.exists() else {"groups": {}, "codes": {}}


def resolve(code):
    """업종코드 6자리 → {code, group, name, tags, laws, facts} 또는 None (모르는 코드)."""
    code = (code or "").strip()
    if len(code) < 4 or code in UNKNOWN:
        return None
    doc = load()
    g = doc["groups"].get(code[:4])
    c = doc["codes"].get(code)
    if not g and not c:
        return None
    tags = [t for t in dict.fromkeys((g or {}).get("tags", []) + (c or {}).get("tags", [])) if t not in (c or {}).get("drop", [])]
    laws = list((c or {}).get("laws", [])) if (c or {}).get("only") else list(dict.fromkeys((g or {}).get("laws", []) + (c or {}).get("laws", [])))
    facts = [f"nts:{code[:4]}"] + ([f"nts:{code}"] if c else [])
    name = doc.get("names", {}).get(code) or (c or {}).get("name") or (g or {}).get("name", "")
    return {"code": code, "group": code[:4], "name": name, "tags": tags, "laws": laws, "facts": facts}


def labels():
    doc = load()
    out = {"nts:known": "업종코드가 확인된 회사 (업종 법규는 업종 표로 판정)"}
    out.update({f"nts:{k}": f"업종 {k} {v['name']}" for k, v in doc["groups"].items()})
    out.update({f"nts:{k}": f"업종 {k} {v['name']}" for k, v in doc["codes"].items()})
    return out


@lru_cache(maxsize=1)
def _jobs():
    """법령 → 직무 (정밀 규칙이 정한 직무가 먼저, 없으면 분류표)."""
    out = {}
    for r in json.loads((ROOT / "kb" / "rules.json").read_text(encoding="utf-8"))["rules"]:
        for l in r["laws"]:
            out.setdefault(lawapi.compact(l["name"]), l["job"])
    for name, e in json.loads((ROOT / "kb" / "universe.json").read_text(encoding="utf-8"))["laws"].items():
        if e.get("job"):
            out.setdefault(lawapi.compact(name), e["job"])
    return out


def rules():
    """업종 법규 → 판정 규칙. 세부 업종이 only 면 그 묶음 규칙은 그 세부 업종에 적용되지 않는다."""
    return _rules(KBFILE.stat().st_mtime if KBFILE.exists() else 0)


@lru_cache(maxsize=2)
def _rules(_mtime):
    doc = load()
    jobs = _jobs()
    only = {}
    for k, v in doc["codes"].items():
        if v.get("only"):
            only.setdefault(k[:4], []).append(f"nts:{k}")
    out = []

    def law(n):
        return {"name": n, "job": jobs.get(lawapi.compact(n), "기타")}

    for k, v in doc["groups"].items():
        if v["laws"]:
            when = {"any": [f"nts:{k}"]}
            if only.get(k):
                when["none"] = only[k]
            out.append({"id": f"nts:{k}", "scope": "industry", "when": when, "tier": "필수",
                        "why": f"업종 {k} {v['name']} — 이 업종의 인허가·규제 법령", "laws": [law(n) for n in v["laws"]]})
    for k, v in doc["codes"].items():
        if v["laws"]:
            out.append({"id": f"nts:{k}", "scope": "industry", "when": {"any": [f"nts:{k}"]}, "tier": "필수",
                        "why": f"업종 {k} {v['name']} — 이 업종의 인허가·규제 법령", "laws": [law(n) for n in v["laws"]]})
    return tuple(out)


def parse_nts(hwpx):
    """국세청 경비율 고시(hwpx)의 업종코드 표 → data/raw/ntscode/ntscode_2025.json [{code, biz, name}]."""
    import html
    import re
    import zipfile
    t = zipfile.ZipFile(hwpx).read("Contents/section0.xml").decode("utf-8")
    codes = []
    for tr in re.findall(r"<hp:tr[^>]*>(.*?)</hp:tr>", t, re.S):
        cells = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", " ".join(re.findall(r"<hp:t[^>]*>(.*?)</hp:t>", tc, re.S))))).strip()
                 for tc in re.findall(r"<hp:tc[^>]*>(.*?)</hp:tc>", tr, re.S)]
        if cells and re.fullmatch(r"\d{6}", cells[0]):
            biz, _, name = cells[1].partition(" / ")
            codes.append({"code": cells[0], "biz": biz.strip(), "name": name.strip() or biz.strip()})
    out = ROOT / "data" / "raw" / "ntscode" / "ntscode_2025.json"
    out.write_text(json.dumps(codes, ensure_ascii=False), encoding="utf-8")
    return codes


def status():
    """업종 표가 국세청 업종코드 전부를 덮는지. 원문 표가 없으면 업종 표에 담아 둔 업종 이름 목록으로 본다."""
    raw = ROOT / "data" / "raw" / "ntscode" / "ntscode_2025.json"
    doc = load()
    codes = (json.loads(raw.read_text(encoding="utf-8")) if raw.exists()
             else [{"code": k} for k in doc.get("names", {})])
    groups = {c["code"][:4] for c in codes}
    return {"codes": len(codes), "groups": len(groups), "mapped_groups": len(groups & set(doc["groups"])),
            "missing": sorted(groups - set(doc["groups"])), "stray": sorted(k for k in doc["codes"] if k not in {c["code"] for c in codes})}


def main(argv):
    if argv[:1] == ["status"]:
        s = status()
        print(f"국세청 업종코드 {s['codes']}개 · 묶음 {s['groups']}개 중 {s['mapped_groups']}개 매칭 · 빠진 묶음 {len(s['missing'])} · 표에 없는 세부 코드 {len(s['stray'])}")
        for x in s["missing"] + s["stray"]:
            print("  ", x)
        return 0 if not s["missing"] and not s["stray"] else 1
    for code in argv:
        r = resolve(code)
        print(code, json.dumps(r, ensure_ascii=False, indent=1) if r else "모르는 업종코드")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
