"""AI 결과를 합치는 부분 테스트 (API 를 부르지 않는다).

실행: .venv/bin/python -m unittest discover -s tests
"""
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace as NS
from unittest import mock

from engine import suggest
from engine.suggest import apply_ai, plain_categories

try:
    from engine import ai
except ImportError:  # anthropic 패키지가 없는 파이썬
    ai = None


def fam(root, job, tier="필수", **kw):
    return dict(root=root, job=job, tier=tier, reasons=[f"{root} 규칙"], verified=True, members=[{"name": root}],
                admin=[], adminMore=[], bundles=[], **kw)


def result(*fams):
    return {"summary": {"families": len(fams), "laws": len(fams), "admin": 0, "byJob": {}, "notFound": []},
            "families": list(fams)}


class ApplyAITest(unittest.TestCase):
    def test_ai_job_and_verdict(self):
        res = result(fam("산업안전보건법", "안전"), fam("화학물질관리법", "환경"), fam("대외무역법", "재무회계"))
        cls = {
            "laws": [
                {"root": "산업안전보건법", "category": "안전", "verdict": "검토 필요", "reason": "확인"},
                {"root": "화학물질 관리법", "category": "안전", "verdict": "적용", "reason": "유해화학물질 취급"},
                {"root": "대외무역법", "category": "기타", "verdict": "적용", "reason": "수출"},
            ],
            "additional": [],
        }
        out = apply_ai(res, cls, {"tags": []})
        self.assertTrue(out["ai"])
        # 직무 순서대로, 기타는 맨 뒤
        self.assertEqual([c["name"] for c in out["categories"]], ["안전", "기타"])
        by = {f["root"]: f for f in out["families"]}
        # 띄어쓰기가 달라도 같은 법령으로 맞춘다
        self.assertEqual(by["화학물질관리법"]["category"], "안전")
        # 같은 직무 안에서는 '적용'이 '검토 필요'보다 앞
        self.assertEqual([f["root"] for f in out["families"]], ["화학물질관리법", "산업안전보건법", "대외무역법"])
        self.assertEqual(out["summary"]["byCategory"], {"안전": 2, "기타": 1})

    def test_unclassified_law_keeps_rule_job(self):
        res = result(fam("부가가치세법", "재무회계"))
        out = apply_ai(res, {"laws": [], "additional": []}, {})
        self.assertEqual(out["families"][0]["category"], "재무회계")
        self.assertEqual(out["categories"][0]["name"], "재무회계")
        self.assertNotIn("verdict", out["families"][0])

    def test_additional_law_only_if_found(self):
        res = result(fam("근로기준법", "인사노무"))
        cls = {"laws": [], "additional": [
            {"name": "대외무역법", "category": "재무회계", "reason": "수출 비중이 큼", "keywords": ["수출입"]},
            {"name": "없는법률", "category": "기타", "reason": "-", "keywords": []},
            {"name": "근로 기준법", "category": "인사노무", "reason": "중복", "keywords": []},
        ]}

        def fake_resolve(c, regions=(), tags=()):
            return dict(c, verified=c["root"] == "대외무역법", members=[], admin=[], adminMore=[], bundles=[])

        with mock.patch.object(suggest, "resolve", side_effect=fake_resolve) as r:
            out = apply_ai(res, cls, {"tags": []})
        self.assertEqual(r.call_count, 2)  # 이미 있는 법령은 다시 찾지 않는다
        roots = [f["root"] for f in out["families"]]
        self.assertIn("대외무역법", roots)
        self.assertNotIn("없는법률", roots)
        added = next(f for f in out["families"] if f["root"] == "대외무역법")
        self.assertTrue(added["aiAdded"])
        self.assertEqual(added["tier"], "AI 제안")
        self.assertEqual(out["summary"]["aiAdded"], ["대외무역법"])

    def test_low_verdict_listed(self):
        res = result(fam("하도급거래 공정화에 관한 법률", "공정거래", tier="확인"))
        cls = {"additional": [], "laws": [
            {"root": "하도급거래 공정화에 관한 법률", "category": "공정거래", "verdict": "해당 가능성 낮음", "reason": "위탁 거래 없음"}]}
        out = apply_ai(res, cls, {})
        self.assertEqual(out["summary"]["aiLow"], ["하도급거래 공정화에 관한 법률"])

    def test_plain_categories(self):
        out = plain_categories(result(fam("화물자동차 운수사업법", "기타"), fam("근로기준법", "인사노무"), fam("대기환경보전법", "환경")))
        self.assertFalse(out["ai"])
        self.assertEqual([c["name"] for c in out["categories"]], ["환경", "인사노무", "기타"])
        self.assertTrue(all(f["category"] == f["job"] for f in out["families"]))


@unittest.skipIf(ai is None, "anthropic 패키지 없음")
class ResearchTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        p = mock.patch.object(ai, "CACHE", Path(self.tmp.name))
        p.start()
        self.addCleanup(p.stop)

    def test_research_maps_to_profile(self):
        report = NS(
            stop_reason="end_turn", model="claude-opus-5-5",
            content=[
                NS(type="web_search_tool_result", content=[NS(url="https://dart.example/1", title="사업보고서"),
                                                           NS(url="https://dart.example/1", title="중복")]),
                NS(type="text", text="○○케미칼은 울산에 공장이 있는 석유화학 회사입니다."),
            ])
        data = {
            "officialName": "○○케미칼 주식회사", "summary": "석유화학 제조", "alternatives": [],
            "employees": 640, "employeesNote": "2025년 사업보고서", "assetsEok": None, "assetsNote": "",
            "listed": True, "provinces": ["울산"], "cities": ["울산"],
            "sites": [{"name": "울산공장", "address": "울산 남구", "kind": "공장"}],
            "tags": [
                {"id": "ind:chem", "basis": "확인", "evidence": "사업보고서", "source": "https://dart.example/1"},
                {"id": "ind:chem", "basis": "확인", "evidence": "중복", "source": ""},
            ],
            "facts": [], "unknowns": ["유해화학물질 영업허가 여부"],
        }
        shaped = NS(stop_reason="end_turn", model="claude-opus-5-5", content=[NS(type="text", text=json.dumps(data, ensure_ascii=False))])
        with mock.patch.object(ai, "_call", side_effect=[report, shaped]) as call:
            out = ai.research("○○케미칼")
            again = ai.research("○○케미칼")  # 두 번째는 캐시
        self.assertEqual(call.call_count, 2)
        self.assertEqual(out, again)
        p = out["profile"]
        self.assertEqual(p["name"], "○○케미칼 주식회사")
        self.assertEqual(p["numbers"], {"employees": 640, "assets": 0})
        self.assertEqual(p["flags"], ["listed"])
        self.assertEqual(p["tags"], ["ind:chem"])
        self.assertEqual(p["regions"], {"provinces": ["울산"], "cities": ["울산"]})
        self.assertEqual(out["research"]["sources"], [{"url": "https://dart.example/1", "title": "사업보고서"}])
        self.assertEqual(out["research"]["tagEvidence"]["ind:chem"]["basis"], "확인")

    def test_truncated_json_is_an_error(self):
        msg = NS(stop_reason="max_tokens", content=[NS(type="text", text='{"a":')])
        with self.assertRaises(ai.AIError):
            ai._json(msg)

    def test_empty_name(self):
        with self.assertRaises(ai.AIError):
            ai.research("  ")


if __name__ == "__main__":
    unittest.main()
