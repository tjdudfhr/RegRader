"""업종 항목 · 업종코드 (engine/industry.py) — 네트워크 없이.

실행: python3 -m unittest discover -s tests
"""
import unittest

from engine import industry as I
from engine.suggest import fact_effects


class TagRulesTest(unittest.TestCase):
    """업종 항목을 직접 골랐을 때 법령이 하나도 붙지 않는 일이 없게 (예: 인력공급 → 파견법 · 직업안정법)."""

    def rule(self, tag):
        return next((r for r in I.tag_rules() if r["id"] == f"tag:{tag}"), None)

    def test_staffing_gets_common_laws(self):
        r = self.rule("ind:staffing")
        self.assertIsNotNone(r)
        self.assertEqual({l["name"] for l in r["laws"]}, {"직업안정법", "파견근로자 보호 등에 관한 법률"})
        self.assertIn("nts:7491", r["when"]["none"])   # 업종코드가 확인되면 업종 표가 정한다

    def test_covered_tags_are_left_alone(self):
        covered = I._covered()
        self.assertFalse([r["id"] for r in I.tag_rules() if r["id"][4:] in covered])

    def test_item_detail_lists_the_laws(self):
        names = {l["name"] for l in fact_effects().get("ind:staffing", [])}
        self.assertTrue({"직업안정법", "파견근로자 보호 등에 관한 법률"} <= names)


class CodeListTest(unittest.TestCase):
    def test_every_code_with_facts(self):
        codes = I.code_list()
        self.assertEqual(len(codes), 1542)
        x = next(c for c in codes if c["c"] == "749101")
        self.assertIn("nts:7491", x["f"])
        self.assertIn("직업안정법", x["l"])
        self.assertFalse([c["c"] for c in codes if "site:factory" in c["t"]])   # 업종만으로 공장이 있다고 보지 않는다

    def test_doc_has_job_for_every_law(self):
        d = I.codes_doc()
        self.assertFalse({n for c in d["codes"] for n in c["l"]} - set(d["jobs"]))


if __name__ == "__main__":
    unittest.main()
