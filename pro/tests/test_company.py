"""공공데이터 회사 찾기 테스트 (원본 파일·색인 없이 돈다).

실행: python3 -m unittest discover -s tests
"""
import unittest
from unittest import mock

from engine import companydb as cdb
from engine.suggest import load_catalog


def wp(name, bizno, members, sido="울산", city="", ind_cd="241101", ind_nm="석유화학계 기초 화학물질 제조업", addr=""):
    return {"name": name, "norm": cdb.norm(name), "stem": cdb.stem(name), "bizno": bizno, "corp": 1, "addr": addr or f"{sido} 어딘가",
            "sido": sido, "city": city, "ind_cd": ind_cd, "ind_nm": ind_nm, "members": members, "since": ""}


def fac(name, sido, city="", products="합성수지", complex_=""):
    return {"name": name, "norm": cdb.norm(name), "stem": cdb.stem(name), "complex": complex_, "products": products,
            "addr": f"{sido} {city}", "sido": sido, "city": city}


class NameTest(unittest.TestCase):
    def test_norm_drops_corp_marks(self):
        self.assertEqual(cdb.norm("(주)가나화학"), "가나화학")
        self.assertEqual(cdb.norm("가나화학 주식회사"), "가나화학")
        self.assertEqual(cdb.norm("가나화학（주）"), "가나화학")  # 전각 괄호

    def test_stem_strips_site_names(self):
        self.assertEqual(cdb.stem("가나화학(주) 여수공장"), "가나화학")
        self.assertEqual(cdb.stem("가나화학주식회사-(의왕)"), "가나화학")
        self.assertEqual(cdb.stem("(주)가나화학(3공장)"), "가나화학")
        self.assertEqual(cdb.stem("가나화학（주）밀양공장(제2공장)"), "가나화학")
        self.assertEqual(cdb.stem("가나 광양제철소"), "가나")

    def test_stem_keeps_other_bodies_apart(self):
        self.assertNotEqual(cdb.stem("가나화학(주)새마을금고"), "가나화학")
        self.assertNotEqual(cdb.stem("가나화학(주) 노동조합"), "가나화학")

    def test_hangul_reading_of_latin_prefix(self):
        self.assertEqual(cdb.hangul("sk하이닉스"), "에스케이하이닉스")
        self.assertEqual(cdb.hangul("lg화학"), "엘지화학")
        self.assertEqual(cdb.hangul("posco홀딩스"), "포스코홀딩스")
        self.assertEqual(cdb.hangul("고려아연"), "고려아연")

    def test_place(self):
        self.assertEqual(cdb.place("경상남도 창원시 성산구 어딘가로 1"), ("경남", "창원"))
        self.assertEqual(cdb.place("울산광역시 남구 어딘가로"), ("울산", ""))
        self.assertEqual(cdb.place("전남광주통합특별시 광산구 하남산단로"), ("광주", ""))
        self.assertEqual(cdb.place("전남광주통합특별시 여수시 여수산단로"), ("전남", "여수"))
        self.assertEqual(cdb.place(""), ("", ""))

    def test_business_number_kind(self):
        self.assertEqual(cdb._kind("118811"), "c")  # 법인 본점
        self.assertEqual(cdb._kind("417850"), "b")  # 법인 지점
        self.assertEqual(cdb._kind("515076"), "p")  # 개인


class AssembleTest(unittest.TestCase):
    def test_branches_join_head_office(self):
        rows = [wp("가나화학(주)", "202811", 500, "서울"), wp("가나화학(주) 여수", "417850", 900, "전남", "여수"),
                wp("가나화학(주)진천사업장", "797850", 1500, "충북", "진천")]
        g = cdb._assemble(rows, [fac("가나화학(주)", "전남", "여수")])
        self.assertEqual(list(g), ["가나화학|c202811"])
        self.assertEqual(g["가나화학|c202811"]["members"], 2900)
        self.assertEqual(len(g["가나화학|c202811"]["factories"]), 1)

    def test_same_name_different_owners_stay_apart(self):
        rows = [wp("다라산업", "515076", 30, "경북", "경산"), wp("다라산업", "482500", 19, "충남", "서산"),
                wp("(주)다라산업", "426880", 19, "대구")]
        facs = [fac("다라산업", "경북", "경산"), fac("다라산업", "전북", "익산")]
        g = cdb._assemble(rows, facs)
        self.assertEqual(len([k for k in g if "|@" not in k]), 3)
        self.assertEqual(len(g["다라산업|p515076"]["factories"]), 1)  # 같은 시·군 공장만
        self.assertIn("다라산업|@전북익산", g)  # 맞는 사업장이 없는 공장은 따로

    def test_factory_only_company(self):
        g = cdb._assemble([], [fac("마바테크", "경기", "화성"), fac("마바테크", "충남", "아산")])
        self.assertEqual(list(g), ["마바테크|@"])
        self.assertEqual(len(g["마바테크|@"]["factories"]), 2)


class PermitTest(unittest.TestCase):
    def test_area_keeps_district_for_metro(self):
        self.assertEqual(cdb.area("서울특별시 구로구 경인로 1"), ("서울", "구로구"))
        self.assertEqual(cdb.area("경상북도 경산시 진량읍"), ("경북", "경산시"))

    def test_active_rules(self):
        self.assertTrue(cdb._active("air", {"영업상태명": "영업/정상"}, "2026-10-11"))
        self.assertFalse(cdb._active("air", {"영업상태명": "폐업"}, "2026-10-11"))
        self.assertTrue(cdb._active("dust", {"설치(공사)종료일": "2027-01-01"}, "2026-10-11"))
        self.assertFalse(cdb._active("dust", {"설치(공사)종료일": "2020-01-01"}, "2026-10-11"))
        self.assertFalse(cdb._active("dust", {"설치(공사)시작일": "2010-01-01"}, "2026-10-11"))

    def test_permit_tags_are_catalog_options(self):
        ids = {o["id"] for s in load_catalog()["sections"] for o in s["options"]}
        used = {t for cfg in cdb.PERMITS.values() for t in cfg["tags"]} | {"permit:designated_waste"}
        self.assertEqual(used - ids, set())


class DraftTest(unittest.TestCase):
    def setUp(self):
        for name, value in (("meta", {"nps": "2026-08", "factory": "2025-12-31"}), ("permits_for", []),
                            ("listing_for", (None, None)), ("dart_for", None)):
            p = mock.patch.object(cdb, name, return_value=value)
            p.start()
            self.addCleanup(p.stop)
        self.catalog = load_catalog()

    def view(self, rows, facs):
        g = cdb._assemble(rows, facs)
        return cdb._view(next(iter(g.values())))

    def test_factory_company(self):
        c = self.view([wp("가나화학(주)", "202811", 500, "경남", "창원", ind_cd="241101")],
                      [fac("가나화학(주)", "경남", "창원", products="양극재,합성수지", complex_="창원국가산업단지")])
        d = cdb.draft(c, self.catalog)
        p, r = d["profile"], d["research"]
        self.assertEqual(p["numbers"]["employees"], 500)
        self.assertEqual(p["regions"], {"provinces": ["경남"], "cities": ["창원"]})
        for t in ("ind:chem", "ind:electronics", "site:factory", "permit:factory", "site:complex"):
            self.assertIn(t, p["tags"])
            self.assertEqual(r["tagEvidence"][t]["basis"], "확인")
        sugg = [s["id"] for s in r["suggestions"]]
        self.assertIn("permit:hazchem", sugg)  # 업종에서 흔한 항목은 권하기만 한다
        self.assertNotIn("permit:hazchem", p["tags"])
        self.assertFalse(set(sugg) & set(p["tags"]))

    def test_pharma_name_overrides_chem_prefix(self):
        c = self.view([wp("사아제약(주)", "202811", 80, ind_cd="242403", ind_nm="화장품 제조업")], [])
        tags = cdb.draft(c, self.catalog)["profile"]["tags"]
        self.assertIn("ind:cosmetics", tags)  # 화장품은 의약품과 따로 (화장품법만, 약사법은 아님)
        self.assertNotIn("ind:pharma", tags)
        self.assertNotIn("ind:chem", tags)
        c = self.view([wp("사아제약(주)", "202811", 80, ind_cd="242301", ind_nm="완제 의약품 제조업")], [])
        self.assertIn("ind:pharma", cdb.draft(c, self.catalog)["profile"]["tags"])

    def test_manufacturer_without_factory_record(self):
        c = self.view([wp("자차금속(주)", "202811", 40, ind_cd="281101", ind_nm="금속 문 제조업")], [])
        d = cdb.draft(c, self.catalog)
        self.assertIn("ind:metal", d["profile"]["tags"])
        self.assertNotIn("site:factory", d["profile"]["tags"])
        self.assertIn("site:factory", [s["id"] for s in d["research"]["suggestions"]])

    def test_permit_record_becomes_confirmed_tag(self):
        c = self.view([wp("가나화학(주)", "202811", 500, "울산", ind_cd="241101")], [])
        rec = {"src": "air", "name": "가나화학(주) 울산공장", "addr": "울산광역시 남구", "sido": "울산", "city": "",
               "date": "2019-05-02", "detail": "2종"}
        with mock.patch.object(cdb, "permits_for", return_value=[rec]):
            d = cdb.draft(c, self.catalog)
        self.assertIn("permit:air", d["profile"]["tags"])
        ev = d["research"]["tagEvidence"]["permit:air"]
        self.assertEqual(ev["basis"], "확인")
        self.assertIn("2종", ev["evidence"])
        self.assertTrue(any("localdata" in s["url"] for s in d["research"]["sources"]))

    def test_listing_and_assets(self):
        c = self.view([wp("가나화학(주)", "202811", 500, "울산", ind_cd="241101")], [])
        listing = {"market": "유가증권시장", "code": "012345", "since": "1990-01-01", "products": "합성수지, 양극재", "industry": "화학"}
        fin = {"assets_eok": 23456.0, "fy_end": "2025-12-31", "basis": "별도"}
        with mock.patch.object(cdb, "listing_for", return_value=(listing, fin)):
            d = cdb.draft(c, self.catalog)
        self.assertEqual(d["profile"]["flags"], ["listed"])
        self.assertEqual(d["profile"]["numbers"]["assets"], 23456)
        self.assertIn("012345", d["research"]["listedNote"])
        self.assertIn("별도", d["research"]["assetsNote"])
        self.assertIn("ind:electronics", d["profile"]["tags"])  # 주요제품 '양극재'

    def test_dart_filings_set_flags(self):
        c = self.view([wp("가나화학(주)", "202811", 500, "울산", ind_cd="241101")], [])
        dl = {"audit": {"report": "감사보고서 (2025.12)", "filer": "가나회계법인", "date": "2026.03.10", "url": "u1"},
              "group": {"report": "대규모기업집단현황공시", "filer": "가나화학", "date": "2026.08.31", "url": "u2"}, "annual": None}
        with mock.patch.object(cdb, "dart_for", return_value=dl):
            d = cdb.draft(c, self.catalog)
        self.assertEqual(set(d["profile"]["flags"]), {"audited", "group"})
        self.assertIn("감사보고서", d["research"]["flagNotes"]["audited"])
        self.assertIn("u2", [s["url"] for s in d["research"]["sources"]])

    def test_every_mapped_tag_exists(self):
        ids = {o["id"] for s in self.catalog["sections"] for o in s["options"]}
        m = cdb.load_map()
        used = set(m["npsPrefix"].values()) | {r["tag"] for r in m["npsName"] + m["products"]}
        used |= {t for v in m["typical"].values() for t in v}
        self.assertEqual(used - ids, set())


if __name__ == "__main__":
    unittest.main()
