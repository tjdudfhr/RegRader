"""기준 목록(실제 회사가 관리하는 적용법규)과 엔진 결과를 비교한다.

기준 목록은 이 저장소에 넣지 않는다. 파일 경로를 인자로 준다 (RegRader law_families.json 형식).

    python3 -m engine.benchmark <law_families.json> [--admin <admrul_index.json>] 회사명 [회사명 ...]

회사 정보는 공공데이터만으로 만든 초안을 그대로 쓴다 (사람이 고치지 않은 상태의 성능).
"""
import json
import sys

from engine import companydb, lawapi
from engine.suggest import load_catalog, suggest


def load_reference(path):
    fams = json.loads(open(path, encoding="utf-8").read())["families"]
    out = []
    for f in fams:
        cat = next((m.get("category") for m in f["members"] if m.get("category")), "")
        names = {lawapi.compact(m["title"]) for m in f["members"]} | {lawapi.compact(f["root"])}
        laws = [m["title"] for m in f["members"] if m.get("inBase", True)]
        out.append({"root": f["root"], "category": cat, "names": names, "laws": laws})
    return out


def run(ref, company, ref_admin=None):
    hits = companydb.search(company)
    if not hits:
        return None
    draft = companydb.draft(companydb.get(hits[0]["key"]), load_catalog())
    res = suggest(draft["profile"])
    ours_fam = {}
    ours_law = set()
    for f in res["families"]:
        keys = {lawapi.compact(f["root"])} | {lawapi.compact(m["name"]) for m in f["members"]}
        for k in keys:
            ours_fam[k] = f
        ours_law |= keys
    found, missing = [], []
    law_total = law_hit = 0
    by_status = {"적용": 0, "추정": 0, "확인": 0}
    for r in ref:
        f = next((ours_fam[k] for k in r["names"] if k in ours_fam), None)
        (found if f else missing).append(r)
        if f:
            by_status[f.get("status", "적용")] = by_status.get(f.get("status", "적용"), 0) + 1
        law_total += len(r["laws"])
        law_hit += sum(1 for n in r["laws"] if lawapi.compact(n) in ours_law)
    apply = {lawapi.compact(a["name"]) for f in res["families"] for a in f["admin"]}
    apply |= {lawapi.compact(n) for f in res["families"] for b in f["bundles"] for n in b["bundle"]}
    review = {lawapi.compact(a["name"]) for f in res["families"] for a in f["adminMore"]} - apply
    adm = None
    if ref_admin:
        hit, rhit = apply & ref_admin, review & ref_admin
        adm = {"recall": len(hit) / len(ref_admin), "ours": len(apply), "ref": len(ref_admin), "hit": len(hit),
               "review": len(review), "reviewHit": len(rhit), "missing": sorted(ref_admin - apply - review)}
    return {"company": hits[0]["name"], "profile": draft["profile"], "families": len(res["families"]),
            "laws": res["summary"]["laws"], "admin": res["summary"]["admin"], "adminTotal": res["summary"]["adminTotal"], "adm": adm,
            "familyRecall": len(found) / len(ref), "lawRecall": law_hit / max(law_total, 1), "missing": missing,
            "foundBy": by_status, "summary": res["summary"]}


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 1
    ref = load_reference(argv[0])
    args = argv[1:]
    ref_admin = None
    if args[:1] == ["--admin"]:
        items = json.loads(open(args[1], encoding="utf-8").read())["items"]
        ref_admin = {lawapi.compact(a.get("n") or a.get("name")) for a in items if not a.get("g")}   # RegRader 가 따로 표시한 것(g)은 빼고
        args = args[2:]
    for company in args:
        r = run(ref, company, ref_admin)
        if not r:
            print(f"{company}: 찾지 못함")
            continue
        print(f"== {r['company']}  계열 {r['families']} · 법령 {r['laws']} · 적용 행정규칙 {r['summary']['adminApply']}"
              f" · 합계 {r['laws'] + r['summary']['adminApply']} (검토 필요 행정규칙 {r['summary']['adminReview']} 별도)")
        print(f"   기준 계열 {r['familyRecall']:.0%} · 기준 법령(시행령·규칙 포함) {r['lawRecall']:.0%} 포함"
              f" — 기준 계열의 판정: 적용 {r['foundBy']['적용']} · 추정 {r['foundBy']['추정']} · 확인 필요 {r['foundBy']['확인']}")
        bs = r["summary"].get("byStatus") or {}
        if bs:
            print(f"   등록 법령 {r['summary']['registry']}개 판정: " + " · ".join(f"{k} {v}" for k, v in bs.items()))
        if r["adm"]:
            a = r["adm"]
            print(f"   기준 행정규칙 {a['ref']}개 중 적용 {a['hit']} ({a['recall']:.0%}) · 검토 필요 {a['reviewHit']} · 없음 {len(a['missing'])}"
                  f" — 적용 {a['ours']}개 중 기준에 없는 것 {a['ours'] - a['hit']} · 검토 필요 {a['review']}개")
        for m in r["missing"]:
            print(f"   빠짐 [{m['category']}] {m['root']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
