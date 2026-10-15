"""네트워크 없이 도는 테스트: 규칙 판정, 후보 합치기, 행정규칙 고르기.

실행: python3 -m unittest discover -s tests
"""
import json
import unittest
from pathlib import Path

from engine import lawapi
from engine.suggest import JOBS, candidates, duties_for, is_regional, load_catalog, load_duties, load_rules, matches, pick_admin

ROOT = Path(__file__).resolve().parents[1]


class MatchTest(unittest.TestCase):
    def test_always(self):
        self.assertTrue(matches({"always": True}, {}))

    def test_any_tag(self):
        p = {"tags": ["eq:crane"]}
        self.assertTrue(matches({"any": ["eq:crane", "eq:lift"]}, p))
        self.assertFalse(matches({"any": ["eq:boiler"]}, p))

    def test_threshold(self):
        self.assertTrue(matches({"gte": {"employees": 50}}, {"numbers": {"employees": 50}}))
        self.assertFalse(matches({"gte": {"employees": 50}}, {"numbers": {"employees": 49}}))
        self.assertFalse(matches({"gte": {"employees": 50}}, {}))

    def test_flag_and_threshold_together(self):
        when = {"flag": "listed", "gte": {"assets": 5000}}
        self.assertTrue(matches(when, {"flags": ["listed"], "numbers": {"assets": 6000}}))
        self.assertFalse(matches(when, {"flags": [], "numbers": {"assets": 6000}}))
        self.assertFalse(matches(when, {"flags": ["listed"], "numbers": {"assets": 100}}))

    def test_less_than(self):
        when = {"gte": {"employees": 20}, "lt": {"employees": 50}}
        self.assertTrue(matches(when, {"numbers": {"employees": 30}}))
        self.assertFalse(matches(when, {"numbers": {"employees": 50}}))
        self.assertFalse(matches({"lt": {"employees": 50}}, {}))  # 모르는 값은 미만으로 보지 않는다

    def test_empty_condition_never_matches(self):
        self.assertFalse(matches({}, {"tags": ["x"]}))


class CandidateTest(unittest.TestCase):
    def test_small_office_gets_only_basics(self):
        names = {c["root"] for c in candidates({"tags": ["site:office"], "numbers": {"employees": 3}})}
        self.assertIn("근로기준법", names)
        self.assertIn("산업안전보건법", names)
        self.assertNotIn("중대재해 처벌 등에 관한 법률", names)
        self.assertNotIn("대기환경보전법", names)

    def test_same_law_from_many_rules_is_merged(self):
        cs = candidates({"tags": ["eq:crane", "eq:boiler", "sub:hazchem"], "numbers": {"employees": 100}})
        osh = [c for c in cs if c["root"] == "산업안전보건법"]
        self.assertEqual(len(osh), 1)
        self.assertGreaterEqual(len(osh[0]["reasons"]), 3)
        self.assertIn("안전검사 고시", osh[0]["admNames"])
        self.assertEqual(osh[0]["tier"], "필수")

    def test_listed_large_company(self):
        names = {c["root"] for c in candidates({"flags": ["listed"], "numbers": {"assets": 6000}})}
        self.assertIn("자본시장과 금융투자업에 관한 법률", names)
        self.assertIn("주식회사 등의 외부감사에 관한 법률", names)


class AdminPickTest(unittest.TestCase):
    KW = {"배출시설": 2.0, "자가측정": 1.0}

    def adm(self, name, kind="고시"):
        return {"id": name, "name": name, "kind": kind}

    def test_regional_kept_only_for_matching_region(self):
        a = [self.adm("수질오염물질 배출허용기준 중 별도배출허용기준 지정·고시(구례 용방)")]
        picked, more, _, _ = pick_admin(a, {"배출허용기준": 2.0}, ["경남", "창원"])
        self.assertEqual(picked + more, [])
        picked, _, _, _ = pick_admin(a, {"배출허용기준": 2.0}, ["구례"])
        self.assertEqual(len(picked), 1)
        self.assertIn("사업장 지역", picked[0]["matched"])

    def test_noise_excluded(self):
        a = [self.adm("생활폐기물 선별시설의 설치·운영에 관한 지침"), self.adm("배출시설 검사기관 지정 요령", "예규"),
             self.adm("배출시설 측정 위반행위 신고포상금 지급 기준"), self.adm("화학물질관리위원회 운영규정")]
        picked, more, _, _ = pick_admin(a, {"배출시설": 2.0, "폐기물": 1.0}, [])
        self.assertEqual(picked + more, [])

    def test_business_guidance_kept(self):
        a = [self.adm("수입통관 사무처리에 관한 고시"), self.adm("유해화학물질의 영업 및 관리 등에 관한 업무처리 규정", "예규"),
             self.adm("적립금운용위원회 구성에 관한 고시")]
        picked, more, _, _ = pick_admin(a, {}, [])
        self.assertEqual(len(picked + more), 3)

    def test_related_rules_kept_without_keywords(self):
        # 낱말이 맞지 않아도 걸러지지 않은 것은 모두 '적용' (낱말이 맞는 것이 앞)
        a = [self.adm("대기오염물질 배출시설 설치허가 세부기준"), self.adm("배출시설 자가측정 고시")]
        picked, more, _, _ = pick_admin(a, {"자가측정": 2.0}, [])
        self.assertEqual([x["name"] for x in picked], ["배출시설 자가측정 고시", "대기오염물질 배출시설 설치허가 세부기준"])
        self.assertEqual(more, [])

    def test_support_programs(self):
        # 사업주 일반 지원제도는 적용, 회사가 그 대상일 때만 해당하는 것(중소기업 지원 · 고용위기지역 · 체불)은 검토 필요
        a = [self.adm("사업주 직업능력개발훈련 지원규정"), self.adm("공동근로복지기금 지원사업 운영규정"), self.adm("안전보건교육규정"),
             self.adm("중소기업 직업능력개발 지원사업 실시규정"), self.adm("고용위기지역 지정 고시"), self.adm("임금등 체불 근로자 생계비 융자사업 고시"),
             self.adm("상습체불사업주 결정을 위한 월보수액 산정방법 고시")]
        picked, more, _, _ = pick_admin(a, {}, [])
        self.assertEqual(sorted(x["name"] for x in picked), ["공동근로복지기금 지원사업 운영규정", "사업주 직업능력개발훈련 지원규정", "상습체불사업주 결정을 위한 월보수액 산정방법 고시", "안전보건교육규정"])
        self.assertEqual(sorted(x["name"] for x in more), ["고용위기지역 지정 고시", "임금등 체불 근로자 생계비 융자사업 고시", "중소기업 직업능력개발 지원사업 실시규정"])

    def test_word_fragments_are_not_sectors_or_places(self):
        # '퇴직연금제도로'의 '도로', '통보양식'의 '양식', '예산 편성'의 '예산(군)'은 업종 · 지명이 아니다
        a = [self.adm("개인형퇴직연금제도로의 이전 예외사유 해당금액 고시"), self.adm("확정급여형퇴직연금제도의 재정검증결과 통보양식 고시"),
             self.adm("원료 및 제조물로 인한 중대시민재해 예방에 필요한 인력 및 예산 편성 지침")]
        picked, _, _, _ = pick_admin(a, {}, ["경북"])
        self.assertEqual(len(picked), 3)

    def test_named_complex_is_regional(self):
        a = [self.adm("수질오염물질 배출허용기준 중 별도배출허용기준 지정(마산진북산업단지)"), self.adm("산업단지 관리지침"),
             self.adm("국가산업단지 관리기본계획(포항블루밸리)"), self.adm("제5차 시설물의 안전 및 유지관리 기본계획(2023∼2027)")]
        picked, _, _, _ = pick_admin(a, {}, ["경북", "포항"])
        self.assertEqual(sorted(x["name"] for x in picked), ["국가산업단지 관리기본계획(포항블루밸리)", "산업단지 관리지침"])

    def test_place_inside_word_is_not_near(self):
        a = [self.adm("목포항 1종 항만배후단지 관리규정"), self.adm("포항항 1종 항만배후단지관리규정")]
        picked, _, _, _ = pick_admin(a, {}, ["경북", "포항"])
        self.assertEqual([x["name"] for x in picked], ["포항항 1종 항만배후단지관리규정"])

    def test_old_year_notices_dropped(self):
        a = [self.adm("2019년도 산업·발전부문 온실가스 목표관리업체 변경"), self.adm("2026년도 사업종류별 산재보험료율")]
        picked, _, _, _ = pick_admin(a, {}, [])
        self.assertEqual([x["name"] for x in picked], ["2026년도 사업종류별 산재보험료율"])

    def test_family_scope_only(self):
        a = [self.adm("예방접종의 실시기준 및 방법"), self.adm("감염병 유급휴가 비용 지원 기준")]
        picked, more, _, _ = pick_admin(a, {}, [], root="감염병의 예방 및 관리에 관한 법률")
        self.assertEqual([x["name"] for x in picked + more], ["감염병 유급휴가 비용 지원 기준"])

    def test_watershed_jurisdiction(self):
        a = [self.adm("(대구지방환경청) 수질오염물질의 배출허용기준 중 별도배출허용기준")]
        picked, _, _, _ = pick_admin(a, {}, ["경북", "포항"])
        self.assertEqual(len(picked), 1)
        picked, more, _, _ = pick_admin(a, {}, ["전남"])
        self.assertEqual(picked + more, [])

    def test_ranked_not_capped(self):
        # 개수로 자르지 않는다 (예전에는 8개까지만 '추천'이라 핵심 고시가 '관련'으로 밀렸다)
        a = [self.adm(f"배출시설 자가측정 고시 {i}") for i in range(12)] + [self.adm("배출시설 관련 규정")]
        picked, more, _, other = pick_admin(a, self.KW, [])
        self.assertEqual((len(picked), len(more)), (13, 0))
        self.assertTrue(all("자가측정" in x["matched"] for x in picked[:12]))

    def test_industry_specific_needs_matching_industry(self):
        a = [self.adm("반도체·디스플레이 제조업종 유해화학물질 취급시설 설치 및 관리에 관한 고시")]
        picked, _, _, _ = pick_admin(a, {"유해화학물질": 2.0}, [], {"ind:metal"})
        self.assertEqual(picked, [])
        picked, _, _, _ = pick_admin(a, {"유해화학물질": 2.0}, [], {"ind:electronics"})
        self.assertEqual(len(picked), 1)

    def test_construction_only_rules_need_construction(self):
        adm = [{"id": "1", "name": "건설업 산업안전보건관리비 계상 및 사용기준", "kind": "고시"}]
        picked, more, _, _ = pick_admin(adm, {"안전보건관리": 2.0}, [], {"ind:metal"})
        self.assertEqual(picked + more, [])
        picked, more, _, _ = pick_admin(adm, {"안전보건관리": 2.0}, [], {"site:construction"})
        self.assertEqual(len(picked), 1)

    def test_nfpc_bundled(self):
        a = [self.adm(f"설비{i}의 화재안전성능기준(NFPC {i})") for i in range(5)] + [self.adm("설비의 화재안전기술기준(NFTC 1)", "공고")]
        picked, more, bundles, _ = pick_admin(a, {"화재안전성능기준": 2.0}, [])
        self.assertEqual(picked + more, [])
        self.assertEqual(sorted(len(b["bundle"]) for b in bundles), [1, 5])  # NFPC 5종, NFTC 1종


class HelperTest(unittest.TestCase):
    def test_compact_ignores_middle_dots_and_spaces(self):
        self.assertEqual(lawapi.compact("남녀고용평등과 일ㆍ가정 양립"), lawapi.compact("남녀고용평등과 일·가정양립"))

    def test_regional_name(self):
        self.assertTrue(is_regional("국가산업단지 관리기본계획(구미)"))
        self.assertTrue(is_regional("…지정·고시(영암 특화)"))
        self.assertFalse(is_regional("대기오염측정망 설치·운영지침(2021)"))
        self.assertFalse(is_regional("사업장 위험성평가에 관한 지침"))
        self.assertFalse(is_regional("근로자 건강진단 실시기준"))   # '강진'이 아니다
        self.assertFalse(is_regional("조경기준"))                  # '경기'가 아니다
        self.assertFalse(is_regional("자율준수프로그램 운영 및 유인 부여 등에 관한 규정"))


class KnowledgeBaseTest(unittest.TestCase):
    def test_every_rule_tag_exists_in_catalog(self):
        cat = load_catalog()
        tags = {o["id"] for s in cat["sections"] for o in s["options"]}
        flags = {f["id"] for f in cat["flags"]}
        nums = {n["id"] for n in cat["numbers"]}
        groups = json.loads((ROOT / "kb" / "facts.json").read_text(encoding="utf-8"))["groups"]
        for r in load_rules():
            w = r["when"]
            for t in w.get("any", []) + w.get("all", []):
                if t in groups or t.startswith("nts:"):  # 업종 사실 (kb/industry_laws.json)
                    continue
                self.assertTrue(t in tags or t in flags, f"{r['id']}: 없는 항목 {t}")
            if "flag" in w:
                self.assertIn(w["flag"], flags)
            for k in w.get("gte", {}):
                self.assertIn(k, nums | {"factory_employees"})   # 공장 근무 인원은 엔진이 계산 (suggest.with_scale)

    def test_rule_ids_unique_and_complete(self):
        rules = load_rules()
        ids = [r["id"] for r in rules]
        self.assertEqual(len(ids), len(set(ids)))
        for r in rules:
            if "never" in r["when"]:  # 기업에 적용되지 않는 법률: 이유가 있어야 한다
                self.assertTrue(r["laws"] and r["when"]["never"], r["id"])
            else:
                self.assertTrue(r["laws"] and r["why"] and r["tier"] in ("필수", "확인"), r["id"])
            for law in r["laws"]:
                self.assertIn(law["job"], JOBS, r["id"])

    def test_universe_covers_every_current_law(self):
        from engine import universe
        if not universe.RAW.exists():
            self.skipTest("data/universe_raw.json 없음 (python3 -m engine.universe fetch)")
        rule_laws = {lawapi.compact(l["name"]) for r in load_rules(universe=False) for l in r["laws"]}
        st = universe.status(rule_laws)
        self.assertEqual((st["missing"], st["stale"], st["bad"]), ([], [], []))
        judged = {lawapi.compact(l["name"]) for r in load_rules() for l in r["laws"]}
        self.assertEqual({lawapi.compact(x["name"]) for x in universe.laws_only()} - judged, set())

    def test_example_profile_is_valid(self):
        p = json.loads((ROOT / "examples" / "manufacturer.json").read_text(encoding="utf-8"))
        self.assertTrue(candidates(p))



class DutyTest(unittest.TestCase):
    def test_size_based_duties(self):
        small = [d["art"] for d in duties_for("근로기준법", {"numbers": {"employees": 3}})]
        mid = [d["art"] for d in duties_for("근로기준법", {"numbers": {"employees": 12}})]
        self.assertIn("제17조", small)          # 근로조건 명시는 1명부터
        self.assertNotIn("제60조", small)       # 연차는 5명 이상
        self.assertNotIn("제93조", small)       # 취업규칙은 10명 이상
        self.assertIn("제60조", mid)
        self.assertIn("제93조", mid)

    def test_permit_based_duties(self):
        none = duties_for("대기환경보전법", {"tags": []})
        air = [d["art"] for d in duties_for("대기환경보전법", {"tags": ["permit:air"]})]
        dust = [d["art"] for d in duties_for("대기환경보전법", {"tags": ["permit:dust"]})]
        self.assertEqual(none, [])
        self.assertIn("제23조", air)
        self.assertEqual(dust, ["제43조"])

    def test_duties_cover_rule_laws(self):
        laws = {lawapi.compact(law["name"]) for r in load_rules() for law in r["laws"]}
        self.assertEqual(set(load_duties()) - laws, set())

    def test_every_hr_baseline_present(self):
        base = next(r for r in load_rules() if r["id"] == "base-labor")
        names = {law["name"] for law in base["laws"]}
        for n in ("근로기준법", "최저임금법", "근로자퇴직급여 보장법", "국민연금법", "국민건강보험법", "고용보험법",
                  "산업재해보상보험법", "고용보험 및 산업재해보상보험의 보험료징수 등에 관한 법률",
                  "장애인고용촉진 및 직업재활법", "노동절 제정에 관한 법률"):
            self.assertIn(n, names)

    def test_industry_codes_do_not_switch_off_confirmed_industry(self):
        # 게임 회사(엔씨): 국민연금 업종코드(응용 소프트웨어)로 업종 사실을 다시 붙여도 게임산업진흥법이 꺼지지 않는다
        from engine.suggest import normalize
        from engine.classify import classify
        p = normalize({"numbers": {"employees": 3000}, "tags": ["ind:it", "ind:game"], "industryCodes": ["722000"], "regions": {"provinces": ["경기"]}})
        self.assertNotIn("nts:known", p["tags"])
        self.assertEqual(classify(p, load_rules())[lawapi.compact("게임산업진흥에 관한 법률")]["status"], "적용")

    def test_factory_of_non_manufacturer_is_small(self):
        # IT 회사(2,000명)의 등록공장 하나로 회사 전체를 제조 공장처럼 보지 않는다
        from engine.suggest import normalize
        it = normalize({"numbers": {"employees": 2000}, "tags": ["ind:it", "site:factory"]})
        mfg = normalize({"numbers": {"employees": 2000}, "tags": ["ind:chem", "site:factory"]})
        self.assertEqual(it["numbers"]["factory_employees"], 30)
        self.assertEqual(mfg["numbers"]["factory_employees"], 2000)
        from engine.classify import classify
        cls = classify(dict(it, denied=["site:owned"]), load_rules())   # 공장 때문에 붙는 설비 사실만 본다 (큰 사옥 소유는 따로)
        for n in ("위험물안전관리법", "토양환경보전법", "에너지이용 합리화법"):
            self.assertEqual(cls[lawapi.compact(n)]["status"], "미적용", n)

    def test_only_laws_that_make_the_company_act(self):
        # 적용법규 = 회사를 직접 구속하고 그 법 때문에 회사가 행위를 해야 하는 법.
        # 다른 보험료와 함께 걷히는 부담금 · 징수 · 처벌 절차 · 권리법 · 일반 기본법은 적용하지 않는다 (미적용 이유로 보인다)
        from engine.classify import classify
        p = {"numbers": {"employees": 3000}, "flags": ["listed", "audited"], "tags": ["site:factory", "act:brand"], "regions": {"provinces": ["경기"]}}
        cls = classify(p, load_rules())
        for n in ("임금채권보장법", "노인장기요양보험법", "석면피해구제법", "국세징수법", "지방세징수법", "지방세기본법", "조세범 처벌법",
                  "지방세특례제한법", "상표법", "통신비밀보호법", "민법", "상업등기법", "공직선거법", "공휴일에 관한 법률"):
            self.assertEqual(cls[lawapi.compact(n)]["status"], "미적용", n)
        for n in ("근로기준법", "국세기본법", "부가가치세법", "소득세법", "법인세법", "지방세법", "예비군법", "병역법", "민방위기본법"):
            self.assertIn(cls[lawapi.compact(n)]["status"], ("적용", "추정"), n)


class DartNameTest(unittest.TestCase):
    def test_latin_reading_back(self):
        from engine import dart
        self.assertEqual(dart.latin("에스케이에너지"), "sk에너지")
        self.assertEqual(dart.latin("엘지화학"), "lg화학")
        self.assertEqual(dart.latin("포스코홀딩스"), "posco홀딩스")
        self.assertEqual(dart.latin("삼성전자"), "삼성전자")
        self.assertEqual(dart.latin("에스원"), "에스원")  # 한 글자만 바뀌면 그대로

    def test_group_duties(self):
        arts = [d["art"] for d in duties_for("독점규제 및 공정거래에 관한 법률", {"flags": ["group"]})]
        self.assertIn("제26조", arts)
        self.assertIn("제47조", arts)
        self.assertNotIn("제26조", [d["art"] for d in duties_for("독점규제 및 공정거래에 관한 법률", {"flags": []})])

if __name__ == "__main__":
    unittest.main()
