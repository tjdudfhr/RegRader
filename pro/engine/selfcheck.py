"""판정 체계 자체 점검. 규칙·사실·의무를 고친 뒤, 그리고 정기적으로 돌린다.

    python3 -m engine.selfcheck                     # 오프라인 점검 (구조 + 유형별 정답 + 판정 불변식)
    python3 -m engine.selfcheck --online            # + 법제처 현행 법령명·조문 대조 (verify_kb)
    python3 -m engine.selfcheck --search            # + 회사 찾기 검증 (상장사 전수·대형 회사·짧은 검색어, 3분 안쪽)
    python3 -m engine.selfcheck --online --reference <law_families.json> [--admin <admrul_index.json>] 회사명 ...
                                                    # + 실제 관리 목록과 포함률 비교 (benchmark)

점검 항목
1. 구조: 법령마다 직무가 하나, 규칙·의무·사실 표가 쓰는 사실이 입력 항목에 있음, 의무의 법령이 규칙에 있음
   1-1. 현행 법률 전부(국가법령정보센터)가 kb/universe.json 에 분류돼 있고 모두 판정됨 (--online 이면 현행 목록을 새로 받아 대조)
2. 판정 불변식: 모든 법령이 판정됨, 미적용엔 이유·추정엔 추정한 사실이 있음, 직무가 8개+기타 안,
   근로자 수·지역을 아는 회사는 사람에게 묻지 않음 (모든 사실을 엔진이 정함)
3. 유형별 정답 (kb/archetypes.json): 회사 유형마다 반드시 적용·미적용·확인일 법령, 질문에 답하면 판정이 바뀜
"""
import json
import sys

from engine import lawapi
from engine.classify import classify
from engine.suggest import JOBS, KB, load_catalog, load_duties, load_rules

GROUP_WORDS = set(json.loads((KB / "facts.json").read_text(encoding="utf-8"))["groups"])


def _facts_in(cond):
    out = set(cond.get("any") or []) | set(cond.get("all") or []) | set(cond.get("none") or [])
    if cond.get("flag"):
        out.add(cond["flag"])
    return {f for f in out if f not in GROUP_WORDS and not f.startswith("nts:")}


def check_structure():
    errs = []
    rules = load_rules()
    cat = load_catalog()
    known = {o["id"] for s in cat["sections"] for o in s["options"]} | {f["id"] for f in cat["flags"]}
    jobs = {}
    for r in rules:
        for f in _facts_in(r.get("when") or {}):
            if f not in known:
                errs.append(f"규칙 {r['id']}: 입력 항목에 없는 사실 {f}")
        for law in r["laws"]:
            if law["job"] not in JOBS:
                errs.append(f"규칙 {r['id']}: 직무 목록에 없는 직무 {law['job']}")
            jobs.setdefault(law["name"], set()).add(law["job"])
    for name, js in jobs.items():
        if len(js) > 1:
            errs.append(f"법령 {name}: 직무가 여럿 {sorted(js)}")
    facts = json.loads((KB / "facts.json").read_text(encoding="utf-8"))["facts"]
    for f, prior in facts.items():
        if f not in known:
            errs.append(f"사실 표: 입력 항목에 없는 사실 {f}")
        if "plausible" in prior:
            errs.append(f"사실 표 {f}: plausible 은 더 쓰지 않는다 (likely 또는 review)")
        for c in prior.get("likely", []) + prior.get("review", []):
            for g in _facts_in(c):
                if g not in known:
                    errs.append(f"사실 표 {f}: 입력 항목에 없는 사실 {g}")
    laws = {lawapi.compact(n) for n in jobs}
    for law in load_duties():
        if law not in laws:
            errs.append(f"의무 표: 규칙에 없는 법령 {law}")
    used = set().union(*(_facts_in(r.get("when") or {}) for r in rules))
    for f in sorted(used - set(facts) - {o for o in known if o.startswith("ind:")}):
        errs.append(f"사전 판단이 없는 사실 {f} (모르면 '아니오(추정)'으로 처리됨 — 의도라면 facts.json 에 빈 항목으로 둔다)")
    return errs


def check_invariants(profile, rules=None):
    errs = []
    rules = rules or load_rules()
    registry = {lawapi.compact(l["name"]) for r in rules for l in r["laws"]}
    cls = classify(profile, rules)
    if set(cls) != registry:
        errs.append(f"판정 안 된 법령 {sorted(registry - set(cls))}")
    for c in cls.values():
        if c["status"] == "미적용" and not c["notReasons"]:
            errs.append(f"{c['root']}: 미적용인데 이유가 없음")
        if c["status"] == "확인" and not c["questions"]:
            errs.append(f"{c['root']}: 확인 필요인데 질문이 없음")
        if c["status"] == "추정" and not c["presumed"]:
            errs.append(f"{c['root']}: 추정인데 추정한 사실이 없음")
        if c["job"] not in JOBS:
            errs.append(f"{c['root']}: 직무 {c['job']}")
    nums = profile.get("numbers") or {}
    if nums.get("employees") and (profile.get("regions") or {}).get("provinces"):
        asked = sorted({q for c in cls.values() for q in c["questions"]})
        if asked:
            errs.append(f"근로자 수·지역을 아는데 사람에게 물음: {asked}")
    return errs


def check_universe(refresh=False):
    """kb/universe.json 이 현행 법률 전부를 빠짐없이 분류하는지 (refresh: 법제처에서 현행 목록을 새로 받는다)."""
    from engine import universe
    if refresh:
        universe.fetch()
    if not universe.RAW.exists():
        return {"msg": "현행 목록 없음 — python3 -m engine.universe fetch (또는 --online)", "errors": []}
    rule_laws = {lawapi.compact(l["name"]) for r in load_rules(universe=False) for l in r["laws"]}
    st = universe.status(rule_laws)
    errs = [f"분류 안 된 현행 법률: {n}" for n in st["missing"]] + [f"현행에 없는 법률(폐지·개명): {n}" for n in st["stale"]] + st["bad"]
    judged = {lawapi.compact(l["name"]) for r in load_rules() for l in r["laws"]}
    errs += [f"판정 규칙이 없는 법률: {x['name']}" for x in universe.laws_only() if lawapi.compact(x["name"]) not in judged]
    return {"msg": f"현행 법률 {st['laws']}건 중 {st['classified']}건 분류" + ("" if not errs else f" — 문제 {len(errs)}건"), "errors": errs}


def _apply_answer(profile, ans):
    p = json.loads(json.dumps(profile))
    p.setdefault("tags", [])
    p.setdefault("denied", [])
    for f in ans.get("yes", []):
        p["tags"].append(f)
        p["denied"] = [x for x in p["denied"] if x != f]
    for f in ans.get("no", []):
        p["denied"].append(f)
        p["tags"] = [x for x in p["tags"] if x != f]
    for k in ("employees", "assets"):
        if k in ans:
            p.setdefault("numbers", {})[k] = ans[k]
    return p


def check_archetypes():
    data = json.loads((KB / "archetypes.json").read_text(encoding="utf-8"))
    rules = load_rules()
    errs, n = [], 0
    cases = {c["id"]: c for c in data["cases"]}
    from engine.suggest import normalize
    for case in data["cases"]:
        case = dict(case, profile=normalize(case["profile"]))   # 업종코드(industryCodes)로 업종 사실을 붙인다 (판정 화면과 같이)
        cls = classify(case["profile"], rules)
        get = lambda name: cls.get(lawapi.compact(name))  # noqa: E731
        errs += [f"[{case['id']}] {e}" for e in check_invariants(case["profile"], rules)]
        for key, ok in (("적용", {"적용"}), ("applied", {"적용", "추정"}), ("확인", {"확인"}), ("미적용", {"미적용"})):
            for name in case.get(key, []):
                n += 1
                c = get(name)
                if c is None:
                    errs.append(f"[{case['id']}] 등록되지 않은 법령 {name}")
                elif c["status"] not in ok:
                    hint = c["notReasons"] or c["questions"] or c["presumed"] or c["reasons"]
                    errs.append(f"[{case['id']}] {name}: 기대 {key}, 결과 {c['status']} ({'; '.join(map(str, hint[:2]))})")
        qs = set().union(*(set(c["questions"]) for c in cls.values()))
        for q in case.get("questions", []):
            n += 1
            if q not in qs:
                errs.append(f"[{case['id']}] 질문 {q} 이 나오지 않음")
    for fl in data.get("flips", []):
        n += 1
        base = cases[fl["case"]]["profile"]
        before = classify(normalize(base), rules)[lawapi.compact(fl["law"])]["status"]
        after = classify(normalize(_apply_answer(base, fl["answer"])), rules)[lawapi.compact(fl["law"])]["status"]
        if (before, after) != (fl["from"], fl["to"]):
            errs.append(f"[{fl['case']}] {fl['law']} 답 {fl['answer']}: 기대 {fl['from']}→{fl['to']}, 결과 {before}→{after}")
    return errs, n


def main(argv):
    ok = True
    s = check_structure()
    print(f"1. 구조: {'통과' if not s else f'문제 {len(s)}건'}")
    for e in s:
        print("   " + e)
    ok &= not [e for e in s if not e.startswith("사전 판단이 없는")]
    u = check_universe(refresh="--online" in argv)
    print(f"1-1. 현행 법률 전부 판정: {u['msg']}")
    for e in u["errors"][:30]:
        print("   " + e)
    ok &= not u["errors"]
    from engine import industry as IND
    st = IND.status()
    bad = st["missing"] + st["stray"]
    print(f"1-2. 업종 표: 국세청 업종코드 {st['codes']}개 · 묶음 {st['groups']}개 중 {st['mapped_groups']}개 매칭" + ("" if not bad else f" — 문제 {len(bad)}건"))
    for e in bad:
        print("   " + e)
    ok &= not bad
    a, n = check_archetypes()
    print(f"2·3. 판정 불변식·유형별 정답: 기대 {n}건 중 {n - len(a)}건 맞음" + ("" if not a else f" — 틀림 {len(a)}건"))
    for e in a:
        print("   " + e)
    ok &= not a
    if "--online" in argv:
        from engine import verify_kb
        print("4. 법제처 현행 법령 대조:")
        ok &= verify_kb.main() == 0
    if "--search" in argv:
        from engine import searchcheck
        print("회사 찾기 검증:")
        ok &= searchcheck.main([]) == 0
    if "--reference" in argv:
        from engine import benchmark
        i = argv.index("--reference")
        print("5. 실제 관리 목록과 비교:")
        benchmark.main(argv[i + 1:])
    print("결과:", "통과" if ok else "실패")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
