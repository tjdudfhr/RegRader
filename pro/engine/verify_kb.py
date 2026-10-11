"""kb 의 법령명·필수 고시·핵심 의무 조문이 법제처 현행 법령과 맞는지 확인한다.

- rules.json 의 모든 법령명, admNames 의 고시 이름이 실제로 있는지
- duties.json 의 법령이 rules.json 에 있는지, 조문 번호가 있고 조문 제목이 같은지

실행: python3 -m engine.verify_kb
"""
import json
import sys
from concurrent.futures import ThreadPoolExecutor

from engine import lawapi
from engine.suggest import KB, load_rules


def main():
    rules = load_rules(universe=False)  # 분류표의 법률 이름은 engine.universe status 가 현행 목록과 맞춰 본다
    laws = sorted({law["name"] for r in rules for law in r["laws"]})
    adms = sorted({n for r in rules for n in r.get("admNames") or []})
    duties = {k: v for k, v in json.loads((KB / "duties.json").read_text(encoding="utf-8")).items() if not k.startswith("_")}
    with ThreadPoolExecutor(max_workers=4) as pool:
        law_ok = dict(zip(laws, pool.map(lawapi.search_law, laws)))
        adm_ok = dict(zip(adms, pool.map(lawapi.search_admrul, adms)))
        arts = dict(zip(duties, pool.map(lawapi.articles, duties)))
    bad = [f"법령을 찾지 못함: {n}" for n, v in law_ok.items() if not v]
    bad += [f"고시를 찾지 못함: {n}" for n, v in adm_ok.items() if not v]
    in_rules = {lawapi.compact(n) for n in laws}
    n_duty = 0
    for law, items in duties.items():
        if lawapi.compact(law) not in in_rules:
            bad.append(f"의무 목록의 법령이 규칙에 없음: {law}")
        if any(d.get("art") for d in items) and not arts[law]:
            bad.append(f"조문을 받지 못함: {law}")
            continue
        for d in items:
            n_duty += 1
            if not d.get("art"):  # 조문 번호가 없는 단일 조항 법률
                continue
            title = arts[law].get(d["art"])
            if title is None:
                bad.append(f"없는 조문: {law} {d['art']}")
            elif lawapi.compact(title) != lawapi.compact(d["title"]):
                bad.append(f"조문 제목이 다름: {law} {d['art']} (현행: {title} / 적은 것: {d['title']})")
    print(f"법령 {len(laws)}개 · 필수 고시 {len(adms)}개 · 핵심 의무 {n_duty}개 확인")
    for b in bad:
        print("  " + b)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
