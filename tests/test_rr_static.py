"""회사 RegRader 데이터 골라내기 (engine/rr_static.py) — 네트워크 없이.

실행: python3 -m unittest discover -s tests
"""
import unittest

from engine import rr_static as R


def universe():
    base = [{"title": t, "categories": ["기타"], "lawType": lv, "effectiveDate": "2026-01-01", "meta": {"ministry": "부", "lsId": "1"}}
            for t, lv in (("가법", "법률"), ("가법 시행령", "시행령"), ("나법", "법률"))]
    rows = [
        {"t": "가법", "d": "2026-01-01", "a": "일", "s": 0, "m": "부", "c": "기타", "u": "11"},
        {"t": "가법 시행령", "d": "2026-03-01", "a": "타", "s": 0, "m": "부", "c": "기타", "u": "12"},
        {"t": "나법", "d": "2026-02-01", "a": "일", "s": 0, "m": "부", "c": "기타", "u": "13"},
        {"t": "가 고시", "d": "2026-04-01", "a": "일", "s": 0, "m": "부", "c": "기타", "u": "91", "k": "고시", "i": "A1", "f": "가법"},
    ]
    return {
        "base_laws_207.json": {"items": base},
        "law_families.json": {"families": [
            {"root": "가법", "members": [{"title": "가법", "level": "법률", "kind": "법률", "inBase": True, "category": "기타"},
                                        {"title": "가법 시행령", "level": "시행령", "kind": "대통령령", "inBase": True, "category": "기타", "parent": "가법"},
                                        {"title": "가법 시행규칙", "level": "시행규칙", "kind": "총리령", "inBase": False, "lsiSeq": "77", "parent": "가법"}]},
            {"root": "나법", "members": [{"title": "나법", "level": "법률", "kind": "법률", "inBase": True, "category": "기타"}]}]},
        "admrul_candidates.json": {"items": [
            {"id": "A1", "name": "가 고시", "kind": "고시", "seq": "91", "effective": "20260401", "families": ["가법"], "jobs": ["기타"], "tag": "", "out": ""},
            {"id": "A2", "name": "가 훈령", "kind": "훈령", "seq": "92", "effective": "20260501", "families": ["가법"], "jobs": ["기타"], "tag": "", "out": ""}]},
        "admrul_events.json": {"items": [
            {"id": "A1", "t": "가 고시", "k": "고시", "d": "2026-04-01", "p": "2026-03-20", "a": "일부개정", "m": "부", "q": "91", "s": 0, "g": ""},
            {"id": "A2", "t": "가 훈령", "k": "훈령", "d": "2026-05-01", "p": "2026-04-20", "a": "일부개정", "m": "부", "q": "92", "s": 0, "g": ""}]},
        "upcoming_next.json": [],
        "meta.json": {"asOf": "2026-10-12", "year": 2026, "universe": {"openapiCurrent": 1}},
        **{f"m{i}.json": (rows if i == 0 else []) for i in range(8)},
    }


FAMS = [{"root": "가법", "category": "안전", "status": "적용", "verified": True,
         "members": [{"name": "가법", "level": "법률"}, {"name": "가법 시행령", "level": "시행령"}],
         "admin": [{"id": "A1", "name": "가 고시"}], "adminMore": [], "bundles": []}]


class BuildTest(unittest.TestCase):
    def setUp(self):
        self.out = R.build(FAMS, "가회사", universe())

    def rows(self):
        return [r for i in range(8) for r in self.out[f"m{i}.json"]]

    def test_only_company_laws_with_company_job(self):
        laws = [r for r in self.rows() if not r.get("k")]
        self.assertEqual([r["t"] for r in laws], ["가법", "가법 시행령"])   # 나법은 회사 적용법규가 아니다
        self.assertTrue(all(r["c"] == "안전" for r in laws))                # 직무는 회사 기준

    def test_only_picked_admin_rules(self):
        adm = [r for r in self.rows() if r.get("k")]
        self.assertEqual([(r["i"], r["c"], r["f"]) for r in adm], [("A1", "안전", "가법")])
        self.assertEqual([x["i"] for x in self.out["admrul_index.json"]["items"]], ["A1"])

    def test_families_mark_company_base(self):
        fam = self.out["law_families.json"]["families"]
        self.assertEqual([f["root"] for f in fam], ["가법"])
        m = {x["title"]: x for x in fam[0]["members"]}
        self.assertTrue(m["가법 시행령"]["inBase"])
        self.assertEqual(m["가법"]["category"], "안전")
        self.assertFalse(m["가법 시행규칙"]["inBase"])
        self.assertEqual(m["가법 시행규칙"]["lsiSeq"], "77")

    def test_meta_counts(self):
        meta = self.out["meta.json"]
        self.assertEqual((meta["totalCount"], meta["lawEvents"], meta["admrulEvents"], meta["baseLaws"], meta["admrulLaws"]), (3, 2, 1, 2, 1))

    def test_admin_row_same_as_law_row_is_dropped(self):
        u = universe()
        u["admrul_events.json"]["items"][0]["t"] = "가법"   # 법령 개정과 이름 · 시행일 · 구분이 같으면 행정규칙 줄은 뺀다
        u["admrul_events.json"]["items"][0]["d"] = "2026-01-01"
        out = R.build(FAMS, "가회사", u)
        self.assertEqual([r for i in range(8) for r in out[f"m{i}.json"] if r.get("k")], [])

    def test_filter_amend_renumbers_reasons(self):
        doc = {"reasons": ["r0", "r1", "r2"], "items": {"가법|2026-01-01|일": {"r": 2}, "나법|2026-02-01|일": {"r": 1}}}
        out = R.filter_amend(doc, R.amend_keys(self.out))
        self.assertEqual(out["items"], {"가법|2026-01-01|일": {"r": 0}})
        self.assertEqual(out["reasons"], ["r2"])


if __name__ == "__main__":
    unittest.main()
