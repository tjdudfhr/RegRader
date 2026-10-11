"""회사 찾기에 쓰는 공공데이터 내려받기 (모두 무료, 이용허락 제한 없음).

    python3 -m engine.datasets list
    python3 -m engine.datasets download air meal ...     # 이름을 안 주면 전부 (국민연금·공장 포함)
    python3 -m engine.companydb build                    # 받은 뒤 색인 다시 만들기

- 공공데이터포털 파일: 국민연금 가입 사업장, 전국등록공장
- 행정안전부 지방행정 인허가 파일 (file.localdata.go.kr): 매일 갱신, 지자체 인허가 대장
- 공공데이터포털 표준데이터: 지자체가 올린 것만 모인다 (전국을 다 덮지는 않는다)
- 한국거래소 KIND 상장법인목록, 금융감독원 DART 재무정보 일괄다운로드 (키·로그인 없이)
"""
import re
import http.cookiejar
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
LOCALDATA = "https://file.localdata.go.kr"
KIND = "https://kind.krx.co.kr/corpgeneral/corpList.do"
DART = "https://opendart.fss.or.kr"
DATAGO = "https://www.data.go.kr"

# tag: 이 자료에 이름이 있으면 '확인'으로 고르는 입력 항목
SOURCES = {
    "nps": {"kind": "datago", "pk": "15083277", "uddi": "uddi:8e0d590f-768e-4cbd-9560-c7168c8d13b6",
            "title": "국민연금 가입 사업장 내역", "org": "국민연금공단"},
    "ntscode": {"kind": "nts", "url": "https://www.nts.go.kr/comm/nttFileDownload.do?fileKey=ce920659eb08656e98313d3d095b5bd6",
                "referer": "https://www.nts.go.kr/nts/na/ntt/selectNttInfo.do?mi=2205&nttSn=1350024", "file": "ntscode_2025.hwpx",
                "title": "국세청 2025년 귀속 경비율 고시 (업종코드 1,542개)", "org": "국세청"},
    "factory": {"kind": "datago", "pk": "15105482", "uddi": "uddi:608a48b9-22d2-40fc-b68e-a83ab17c4497",
                "title": "전국등록공장현황", "org": "한국산업단지공단"},
    "air": {"kind": "localdata", "slug": "air_pollution_facility_installation", "tag": "permit:air",
            "title": "대기오염물질배출시설설치사업장", "org": "행정안전부·지방자치단체"},
    "gas": {"kind": "localdata", "slug": "high_pressure_gas", "tag": "permit:gas",
            "title": "고압가스업", "org": "행정안전부·지방자치단체"},
    "sgas": {"kind": "localdata", "slug": "specific_high_pressure_gas", "tag": "permit:gas",
             "title": "특정고압가스업 (사용신고)", "org": "행정안전부·지방자치단체"},
    "meal": {"kind": "localdata", "slug": "group_meal_facilities", "tag": "site:cafeteria",
             "title": "집단급식소", "org": "행정안전부·지방자치단체"},
    "food": {"kind": "localdata", "slug": "food_manufacturing_processors", "tag": "ind:food",
             "title": "식품제조가공업", "org": "행정안전부·지방자치단체"},
    "warehouse": {"kind": "localdata", "slug": "logistics_warehouses", "tag": "site:warehouse",
                  "title": "물류창고업", "org": "행정안전부·지방자치단체"},
    "dust": {"kind": "localdata", "slug": "dust_emission_business_info", "tag": "permit:dust",
             "title": "비산먼지 발생사업 신고", "org": "행정안전부·지방자치단체"},
    "ecommerce": {"kind": "localdata", "slug": "ecommerce_businesses", "tag": "act:consumer_online",
                  "title": "통신판매업", "org": "행정안전부·지방자치단체"},
    "listed": {"kind": "krx", "title": "상장법인목록 (유가증권·코스닥·코넥스)", "org": "한국거래소 KIND"},
    "fin": {"kind": "dart", "title": "사업보고서 재무상태표 일괄 (자산총계)", "org": "금융감독원 DART"},
    "water": {"kind": "standard", "pk": "15139223", "tag": "permit:water",
              "title": "폐수배출사업장 (표준데이터)", "org": "지방자치단체"},
    "noise": {"kind": "standard", "pk": "15139233", "tag": "permit:noise",
              "title": "소음·진동 배출시설 (표준데이터)", "org": "지방자치단체"},
    "waste": {"kind": "standard", "pk": "15155656", "tag": "permit:waste",
              "title": "폐기물 배출업체 (표준데이터)", "org": "지방자치단체"},
}


def page_url(name):
    s = SOURCES[name]
    if s["kind"] == "localdata":
        return f"{LOCALDATA}/file/{s['slug']}/info"
    if s["kind"] == "krx":
        return "https://kind.krx.co.kr/corpgeneral/corpList.do?method=loadInitPage"
    if s["kind"] == "dart":
        return f"{DART}/disclosureinfo/fnltt/dwld/main.do"
    if s["kind"] == "nts":
        return s["referer"]
    return f"{DATAGO}/data/{s['pk']}/{'standard' if s['kind'] == 'standard' else 'fileData'}.do"


def _opener():
    jar = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    op.addheaders = [("User-Agent", UA)]
    return op


def _save(resp, dest, label):
    total = int(resp.headers.get("Content-Length") or 0)
    tmp = dest.with_suffix(dest.suffix + ".part")
    done, t0 = 0, time.time()
    with open(tmp, "wb") as f:
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
            done += len(chunk)
            if time.time() - t0 > 5:
                print(f"  {label}: {done >> 20}MB" + (f" / {total >> 20}MB" if total else ""), flush=True)
                t0 = time.time()
    tmp.replace(dest)
    return done


def _localdata(name, dest_dir):
    s = SOURCES[name]
    op = _opener()
    info = page_url(name)
    op.open(urllib.request.Request(info, headers={"Referer": f"{DATAGO}/"}), timeout=60).read()
    op.open(urllib.request.Request(f"{LOCALDATA}/file/validate/download-count", headers={"Referer": info}), timeout=60).read()
    resp = op.open(urllib.request.Request(f"{LOCALDATA}/file/download/{s['slug']}/info", headers={"Referer": info}), timeout=600)
    if "attachment" not in (resp.headers.get("Content-Disposition") or ""):
        raise RuntimeError("파일 대신 다른 응답을 받았습니다 (잠시 뒤 다시 시도)")
    return _save(resp, dest_dir / f"{s['slug']}.csv", name)


def _nts(name, dest_dir):
    """국세청 고시 첨부(hwpx)를 받아 업종코드 표(JSON)로 푼다. engine/industry.py 의 업종 이름·전수 점검에 쓴다."""
    s = SOURCES[name]
    op = _opener()
    resp = op.open(urllib.request.Request(s["url"], headers={"Referer": s["referer"]}), timeout=120)
    path = _save(resp, dest_dir / s["file"], name)
    from engine import industry
    industry.parse_nts(dest_dir / s["file"])
    return path


def _datago(name, dest_dir):
    s = SOURCES[name]
    op = _opener()
    q = urllib.parse.urlencode({"publicDataPk": s["pk"], "publicDataDetailPk": s["uddi"], "fileDetailSn": "1",
                                "publicDataTyCode": "PR0051"})
    meta = json.loads(op.open(f"{DATAGO}/tcs/dss/selectFileDataDownload.do?{q}", timeout=60).read().decode("utf-8"))
    if not meta.get("status"):
        raise RuntimeError("파일 정보를 받지 못했습니다")
    resp = op.open(f"{DATAGO}/cmm/cmm/fileDownload.do?atchFileId={meta['atchFileId']}&fileDetailSn={meta['fileDetailSn']}", timeout=600)
    cd = resp.headers.get("Content-Disposition") or ""
    ext = ".zip" if ".zip" in cd else ".csv"
    return _save(resp, dest_dir / f"{name}{ext}", name)


def _standard(name, dest_dir):
    """표준데이터는 1만 건씩 JSON 으로 받아 CSV(UTF-8)로 저장한다."""
    import csv
    s = SOURCES[name]
    op = _opener()
    head = json.loads(op.open(f"{DATAGO}/download/columList.json?pk={s['pk']}&ext=CSV", timeout=60).read().decode("utf-8"))
    t = head["tableVO"]
    cols = [c["columCode"] for c in head["columList"]]
    names = [c["columNm"] for c in head["columList"]]
    total, per = int(head["totalCount"]), 10000
    rows = []
    for page in range(1, (total + per - 1) // per + 1):
        params = [("colNmList", c) for c in t["colNmList"]] + [
            ("totalCount", total), ("svcTableNm", t["svcTableNm"]), ("perPage", per), ("page", page)]
        req = urllib.request.Request(f"{DATAGO}/download/standard.json?" + urllib.parse.urlencode(params),
                                     headers={"X-Requested-With": "XMLHttpRequest", "Referer": page_url(name)})
        rows += json.loads(op.open(req, timeout=120).read().decode("utf-8"))
    dest = dest_dir / f"{name}.csv"
    with open(dest, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(names)
        for r in rows:
            w.writerow(["" if r.get(c) is None else r.get(c) for c in cols])
    return dest.stat().st_size


def _krx(name, dest_dir):
    """시장별 상장법인목록 (HTML 표 형식의 .xls, EUC-KR)."""
    op = _opener()
    total = 0
    for market in ("stockMkt", "kosdaqMkt", "konexMkt"):
        url = f"{KIND}?method=download&searchType=13&marketType={market}"
        total += _save(op.open(url, timeout=120), dest_dir / f"{market}.html", f"{name}:{market}")
    return total


def _dart(name, dest_dir):
    """가장 최근 사업보고서(FY)의 재무상태표(BS) 일괄 파일."""
    op = _opener()
    page = page_url(name)
    op.addheaders = [("User-Agent", UA), ("Accept", "text/html,application/xhtml+xml,*/*")]
    op.open(page, timeout=60).read()
    req = urllib.request.Request(f"{DART}/disclosureinfo/fnltt/dwld/list.do", data=b"",
                                 headers={"X-Requested-With": "XMLHttpRequest", "Referer": page})
    listing = op.open(req, timeout=60).read().decode("utf-8", "ignore")
    files = re.findall(r"download_ext002\('(\d{4})',\s*'FY',\s*'BS',\s*'([^']+\.zip)'\)", listing)
    if not files:
        raise RuntimeError("사업보고서 재무상태표 파일 목록을 찾지 못했습니다")
    year, fname = max(files)
    resp = op.open(urllib.request.Request(f"{DART}/cmm/downloadFnlttZip.do?fl_nm={fname}", headers={"Referer": page}), timeout=600)
    if "attachment" not in (resp.headers.get("Content-Disposition") or ""):
        raise RuntimeError("파일 대신 다른 응답을 받았습니다 (잠시 뒤 다시 시도)")
    for old in dest_dir.glob("*.zip"):
        old.unlink()
    return _save(resp, dest_dir / fname, name)


def download(name):
    s = SOURCES[name]
    dest_dir = RAW / name
    dest_dir.mkdir(parents=True, exist_ok=True)
    fn = {"localdata": _localdata, "datago": _datago, "standard": _standard, "krx": _krx, "dart": _dart, "nts": _nts}[s["kind"]]
    size = fn(name, dest_dir)
    print(f"{name}: {s['title']} {size / 1e6:.1f}MB", flush=True)


def main(argv):
    if argv[:1] == ["list"]:
        for k, s in SOURCES.items():
            print(f"{k:10} {s['title']} ({s['org']}) {page_url(k)}")
        return 0
    if argv[:1] == ["download"]:
        names = argv[1:] or list(SOURCES)
        bad = 0
        for n in names:
            try:
                download(n)
            except Exception as e:  # noqa: BLE001 - 하나가 실패해도 나머지는 받는다
                bad += 1
                print(f"{n}: 실패 - {e}", flush=True)
            time.sleep(2)
        return 1 if bad else 0
    print(__doc__)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
