"""RegRader 내보내기 (engine/export_regrader.py) — 네트워크 없이 도는 부분.

실행: python3 -m unittest discover -s tests
"""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from engine import export_regrader as X


class SlugTest(unittest.TestCase):
    def test_legal_form_dropped(self):
        self.assertEqual(X.slug("(주)에코프로비엠"), "에코프로비엠")
        self.assertEqual(X.slug("주식회사 카카오"), "카카오")
        self.assertEqual(X.slug("㈜LG화학"), "LG화학")
        self.assertEqual(X.slug("현대건설(주) 임직원"), "현대건설")
        self.assertEqual(X.slug("../.."), "company")


class EtcJobTest(unittest.TestCase):
    def test_arrays_get_etc(self):
        js = "var CATS = ['인사노무','공정거래','정보보호','지식재산권','재무회계','안전','환경','지배구조'];"
        self.assertIn("'지배구조', '기타']", X.add_etc_job(js))

    def test_other_arrays_untouched(self):
        js = "var Q = ['일','이','삼','사','오','육','칠','팔'];"
        self.assertEqual(X.add_etc_job(js), js)

    def test_counter_object(self):
        js = '{ "환경": 0,\n "지식재산권": 0,\n                "지배구조": 0\n            }'
        self.assertIn('"지배구조": 0, "기타": 0', X.add_etc_job(js))

    def test_job_tab(self):
        html = ('  <div class="job-function-item" data-job="지식재산권" onclick="x">\n    <span>지식재산</span>\n  </div>\n'
                '<div class="filter-tab" data-filter="지배구조">🏛️ 지배구조 (<span id="count-지배구조">–</span>)</div>')
        out = X.add_etc_job(html)
        self.assertIn('data-job="기타"', out)
        self.assertIn('data-filter="기타"', out)


FAMS = [
    {"root": "산업안전보건법", "category": "안전", "status": "적용", "verified": True, "ministry": "고용노동부", "reasons": ["근로자 1명 이상"],
     "members": [{"name": "산업안전보건법", "level": "법률"}, {"name": "산업안전보건법 시행령", "level": "시행령"},
                 {"name": "산업안전보건기준에 관한 규칙", "level": "시행규칙"}],
     "admin": [{"id": "1", "name": "A 고시", "kind": "고시"}], "adminMore": [{"id": "2", "name": "B 고시", "kind": "고시"}],
     "bundles": [{"id": "bundle:화재안전기준", "name": "화재안전기준", "bundle": ["C 기준"]}]},
    {"root": "중대재해 처벌 등에 관한 법률", "category": "안전", "status": "추정", "verified": True,
     "members": [{"name": "중대재해 처벌 등에 관한 법률", "level": "법률"}, {"name": "산업안전보건법 시행령", "level": "시행령"}],
     "admin": [{"id": "9", "name": "필수 고시", "kind": "고시"}], "adminMore": [], "bundles": []},
    {"root": "없는 법", "category": "기타", "status": "적용", "verified": False, "members": [], "admin": [], "adminMore": [], "bundles": []},
]


def fake_search(name):
    return {"name": name, "kind": "법률", "ministry": "고용노동부", "id": "001", "effective": "20260101"}


def fake_family(name):
    return {"members": [], "admin": [{"id": "1", "name": "A 고시"}, {"id": "2", "name": "B 고시"}, {"id": "3", "name": "C 기준"}]
            if name == "산업안전보건법" else []}


class BaseItemsTest(unittest.TestCase):
    def test_members_once_with_job_and_level(self):
        with mock.patch.object(X.lawapi, "search_law", side_effect=fake_search):
            items, missing = X.base_items(FAMS)
        titles = [x["title"] for x in items]
        self.assertEqual(titles, ["산업안전보건법", "산업안전보건법 시행령", "산업안전보건기준에 관한 규칙", "중대재해 처벌 등에 관한 법률"])
        self.assertEqual([x["lawType"] for x in items], ["법률", "시행령", "시행규칙", "법률"])
        self.assertTrue(all(x["categories"] == ["안전"] for x in items))
        self.assertEqual(items[0]["effectiveDate"], "2026-01-01")
        self.assertEqual(items[3]["meta"]["proStatus"], "추정")
        self.assertEqual(missing, [])

    def test_admin_selection_includes_related_and_bundle(self):
        with mock.patch.object(X.lawapi, "family", side_effect=fake_family), \
                mock.patch.object(X, "_admrul_row", return_value={"행정규칙일련번호": "77"}):
            keep, extra = X.admin_selection(FAMS)
        self.assertEqual(keep, ["1", "2", "3", "9"])
        self.assertEqual([x["id"] for x in extra], ["9"])          # 체계도에 없는 필수 고시만 덧붙인다
        self.assertEqual(extra[0]["jobs"], ["안전"])


class ScopeModuleTest(unittest.TestCase):
    def load(self, d, cfg):
        (d / "company_scope.json").write_text(json.dumps(cfg), encoding="utf-8")
        (d / "admrul_scope.py").write_text(X.SCOPE_PY, encoding="utf-8")
        spec = importlib.util.spec_from_file_location("admrul_scope_test", d / "admrul_scope.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    def test_scope_and_extra(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            (root / "scripts").mkdir()
            (root / "docs").mkdir()
            extra = {"id": "9", "name": "필수 고시", "kind": "고시", "seq": "77", "issued": "", "effective": "", "type": "",
                     "families": ["중대재해 처벌 등에 관한 법률"], "links": [], "jobs": ["안전"]}
            mod = self.load(root / "scripts", {"keep": ["1", "9"], "extra": [extra]})
            self.assertEqual(mod.scope({"id": "1"}), "")
            self.assertEqual(mod.scope({"id": "2"}), "pro")
            self.assertIn("1", mod.PROMOTE)
            items = [{"id": i, "name": n, "kind": "고시", "seq": "", "effective": "", "families": ["산업안전보건법"], "jobs": ["안전"], "tag": "", "out": ""}
                     for i, n in (("1", "A 고시"), ("2", "B 고시"))]
            items[1]["out"] = mod.scope(items[1])
            (root / "docs" / "admrul_candidates.json").write_text(json.dumps({"items": items}), encoding="utf-8")
            mod.write_index(root / "docs", items)
            cands = json.loads((root / "docs" / "admrul_candidates.json").read_text(encoding="utf-8"))["items"]
            index = json.loads((root / "docs" / "admrul_index.json").read_text(encoding="utf-8"))["items"]
            self.assertEqual([c["id"] for c in cands], ["1", "2", "9"])
            self.assertEqual([x["i"] for x in index], ["1", "9"])


class ResolveFileTest(unittest.TestCase):
    def test_stays_inside(self):
        with tempfile.TemporaryDirectory() as t, mock.patch.object(X, "OUT", Path(t)), mock.patch.object(X, "SITE", Path(t) / "_site"):
            (Path(t) / "회사" / "docs").mkdir(parents=True)
            (Path(t) / "_site" / "docs").mkdir(parents=True)
            (Path(t) / "회사" / "docs" / "meta.json").write_text("{}")
            (Path(t) / "_site" / "docs" / "index.html").write_text("<html>")
            self.assertEqual(X.resolve_file("회사", "meta.json").name, "meta.json")
            self.assertEqual(X.resolve_file("회사", "").name, "index.html")
            self.assertIsNone(X.resolve_file("회사", "../../etc/passwd"))
            self.assertIsNone(X.resolve_file("회사", "../회사/export.json"))


class ProgressTest(unittest.TestCase):
    def test_stages_in_order(self):
        p = X.Progress(roots=200)
        seen = []
        for line in ["law totalCnt=2700", "  law p10 acc=1000", "eflaw totalCnt=5400", "  eflaw p54 acc=5400",
                     "[pro] tree 100", "admrul_candidates: 행정규칙 3000개", "[pro] admrul 1 40", "[pro] admrul 40 40",
                     "amend_details: 분석할 개정 900건 (법령 버전 800개)", "[pro] body 400", "amend_details: 행정규칙 350건 제개정이유"]:
            p.feed(line)
            seen.append((p.stage, p.pct()))
        self.assertEqual([s for s, _ in seen], ["list", "list", "list", "list", "tree", "admrul", "admrul", "admrul", "amend", "amend", "end"])
        pcts = [x for _, x in seen]
        self.assertEqual(pcts, sorted(pcts))          # 진행률은 뒤로 가지 않는다
        self.assertEqual(seen[4][1], 32)              # 계열 100/200 → 10 + 45 × 0.5

    def test_progress_lines_kept_out_of_text(self):
        p = X.Progress(roots=10)
        self.assertTrue(p.feed("[pro] tree 3"))
        self.assertEqual(p.text, "계열 묶기 · 법령체계도 3/10")


if __name__ == "__main__":
    unittest.main()
