"""대한민국 현행 법령 전체 목록 (국가법령정보센터) — 판정 대상 법률의 모집단.

    python3 -m engine.universe fetch     # 현행 법령 전부 받아 data/universe_raw.json 에 저장
    python3 -m engine.universe status    # kb/universe.json 분류가 현행 법률 전부를 덮는지 확인

kb/universe.json 은 현행 '법률' 하나하나를 기업 적용 범위로 분류한 표다 (scope):
- rules: kb/rules.json 의 규칙으로 판정 (조건·의무까지 정밀하게 다룸)
- all: 모든 회사에 적용되는 일반법 (예: 민법) — 별도 규칙 없이 '적용'
- industry:<태그들>: 그 업종이면 적용 (예: 은행법 → ind:bank)
- fact:<태그들>: 그 사실(시설·활동)이 있으면 적용
- public: 국가·지방자치단체·공공기관의 조직·운영 법률 → 기업에는 미적용
- person: 개인·가족·신분·병역·형사절차 등 개인 대상 → 기업에는 미적용
- region: 특정 지역·사업 개발 특별법 → 해당 사업 시행자가 아니면 미적용
- event: 특정 사건 피해 구제·진상규명 등 → 미적용
"""
import json
import sys
from functools import lru_cache
from pathlib import Path

from engine import lawapi

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "universe_raw.json"
KBFILE = ROOT / "kb" / "universe.json"


def fetch():
    items, page = [], 1
    while True:
        j = lawapi._get(lawapi.SEARCH, {"target": "law", "display": "100", "page": str(page)})
        ls = j.get("LawSearch") or {}
        batch = lawapi._as_list(ls.get("law"))
        if not batch:
            break
        for x in batch:
            items.append({"name": x.get("법령명한글"), "kind": x.get("법령구분명"), "ministry": x.get("소관부처명"),
                          "id": x.get("법령ID"), "mst": x.get("법령일련번호"), "effective": x.get("시행일자")})
        total = int(ls.get("totalCnt") or 0)
        if page * 100 >= total:
            break
        page += 1
    RAW.parent.mkdir(parents=True, exist_ok=True)
    RAW.write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    return items


def laws_only(items=None):
    items = items if items is not None else json.loads(RAW.read_text(encoding="utf-8"))
    seen, out = set(), []
    for x in items:
        if x["kind"] == "법률" and lawapi.compact(x["name"]) not in seen:
            seen.add(lawapi.compact(x["name"]))
            out.append(x)
    return out


def load():
    return json.loads(KBFILE.read_text(encoding="utf-8")) if KBFILE.exists() else {"laws": {}, "scopes": {}}


OUT_OF_SCOPE = ("public", "org", "person", "event", "region", "support", "procedure", "deal", "business", "general", "incidental")


def reason(entry, scopes):
    """범위 밖 법률이 기업에 적용되지 않는 이유 (한 줄)."""
    base = scopes.get(entry["scope"], {}).get("reason", "")
    note = entry.get("note", "")
    if not note:
        return base
    if entry["scope"] == "business":
        return f"{note} 대상 (그 사업을 하지 않으면 미적용)"
    if entry["scope"] == "deal":
        return f"{note}에만 적용"
    if entry["scope"] == "general":
        return f"일반 기본법 — {note}"
    if entry["scope"] == "incidental":
        return f"부수 부담 — {note} (회사가 따로 할 행위 없음)"
    if entry["scope"] == "procedure":
        return f"절차 · 처벌법 — {note}"
    if entry["scope"] == "support":
        return f"{note}만 관련 (회사 의무 아님)"
    return note


def _split_industry(conds):
    """업종 태그(ind:)로만 거는 조건은 업종코드가 확인되지 않은 회사에만 쓴다 (확인되면 kb/industry_laws.json 의 업종 법규가 정한다).
    업종 태그와 시설·활동 사실이 섞인 조건은 둘로 나눈다."""
    out = []
    for c in conds:
        anys = c.get("any") or []
        ind = [t for t in anys if t.startswith("ind:")]
        rest = [t for t in anys if not t.startswith("ind:")]
        if not ind:
            out.append(c)
            continue
        out.append(dict(c, any=ind, none=list(dict.fromkeys((c.get("none") or []) + ["nts:known"]))))
        if rest:
            out.append(dict(c, any=rest))
    return out


def rules():
    """kb/universe.json → 판정 규칙. rules 범위는 kb/rules.json 이 맡으므로 만들지 않는다."""
    return _rules(KBFILE.stat().st_mtime if KBFILE.exists() else 0)


@lru_cache(maxsize=2)
def _rules(_mtime):
    doc = load()
    scopes = doc.get("scopes", {})
    out = []
    for name, e in doc["laws"].items():
        sc = e["scope"]
        if sc == "rules":
            continue
        rid = "u:" + lawapi.compact(name)
        law = [{"name": name, "job": e["job"]}]
        if sc == "all":
            out.append({"id": rid, "scope": sc, "when": {"always": True}, "tier": e.get("tier", "확인"), "why": e["why"], "laws": law,
                        "adm": e.get("adm", []), "admStrict": True})
        elif sc == "when":
            for i, cond in enumerate(_split_industry(e["when"])):
                cond = dict(cond)
                skip = cond.pop("skipUnknown", None)
                r = {"id": f"{rid}:{i}", "scope": sc, "when": cond, "tier": e.get("tier", "확인"), "why": e["why"], "laws": law,
                     "adm": e.get("adm", []), "admStrict": True}
                if skip:
                    r["skipUnknown"] = skip
                out.append(r)
        else:
            out.append({"id": rid, "scope": sc, "when": {"never": reason(e, scopes), "est": bool(scopes.get(sc, {}).get("estimated"))},
                        "tier": "", "why": "", "laws": law})
    return tuple(out)


def status(rule_laws=None):
    """현행 법률 목록(data/universe_raw.json)과 분류표를 맞춰 본다. rule_laws: kb/rules.json 의 법령명 (압축)."""
    laws = laws_only()
    kb = load()["laws"]
    have = {lawapi.compact(k) for k in kb}
    current = {lawapi.compact(x["name"]) for x in laws}
    missing = [x["name"] for x in laws if lawapi.compact(x["name"]) not in have]
    stale = [k for k in kb if lawapi.compact(k) not in current]
    bad = []
    if rule_laws is not None:
        ruled = {lawapi.compact(k) for k, e in kb.items() if e["scope"] == "rules"}
        bad += [f"규칙에 있는데 분류표에서 rules 가 아님: {n}" for n in sorted(rule_laws - ruled)]
        bad += [f"분류표는 rules 인데 규칙에 없음: {n}" for n in sorted(ruled - rule_laws)]
    return {"laws": len(laws), "classified": len(laws) - len(missing), "missing": missing, "stale": stale, "bad": bad,
            "asOf": RAW.stat().st_mtime if RAW.exists() else None}


def main(argv):
    if argv[:1] == ["fetch"]:
        items = fetch()
        print(f"현행 법령 {len(items)}건 · 법률 {len(laws_only(items))}건")
        return 0
    if argv[:1] == ["status"]:
        from engine.suggest import KB
        rl = {lawapi.compact(l["name"]) for r in json.loads((KB / "rules.json").read_text(encoding="utf-8"))["rules"] for l in r["laws"]}
        s = status(rl)
        for b in s["bad"]:
            print("  ", b)
        print(f"현행 법률 {s['laws']}건 중 분류 {s['classified']}건 · 미분류 {len(s['missing'])}건 · 폐지·개명 {len(s['stale'])}건")
        for n in s["missing"][:30]:
            print("  미분류:", n)
        for n in s["stale"][:30]:
            print("  현행에 없음:", n)
        return 0 if not s["missing"] and not s["stale"] and not s["bad"] else 1
    print(__doc__)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
