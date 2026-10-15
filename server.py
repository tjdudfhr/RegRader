"""RegRader Pro 로컬 서버: 화면(web/) + API.

실행: .venv/bin/python server.py  → http://127.0.0.1:8787
AI 기능은 .env 의 ANTHROPIC_API_KEY 가 있을 때 켜진다.

API
- GET  /api/status          회사 찾기 자료 기준일, AI 사용 가능 여부
- GET  /api/catalog         입력 항목
- GET  /api/codes           국세청 업종코드 전부 (항목 추가의 '업종코드로 찾기')
- GET  /api/company?q=      회사명 → 후보 (공공데이터, 무료)
- POST /api/company/draft   {"key"} → 회사 정보 초안 + 근거
- POST /api/suggest         {"profile", "research", "ai"} → 적용법규 후보
- GET  /api/laws?q=         법령명 검색 (직접 추가용)
- POST /api/law             {"name", "job", "profile"} → 법령 하나를 체계도·고시까지 펼친 것
- POST /api/research        {"name", "hint"} → AI 웹 조사 (유료, .env 에 키가 있을 때만)
- POST /api/regrader        {"company", "families", "profile"} → RegRader 형식으로 내보내고 수집 시작 (engine/export_regrader.py)
- GET  /api/regrader?q=     내보내기 진행 상태 (q = 회사 이름 또는 /rr/ 주소의 이름)
- GET  /api/regrader/list   보낸 회사 전부 (RegRader 사이트의 '기업별 적용법규' 탭이 읽는다)
- GET  /rr/                 보낸 회사 목록 화면 (RegRader 사이트의 '기업별 적용법규' 탭이 이 화면으로 연결한다)
다른 사이트가 이 서버의 데이터를 읽거나 쓰지 못하게 CORS 는 열지 않고, 다른 Origin 의 POST 는 거절한다.
- GET  /rr/<회사>/          그 회사의 RegRader 화면 (분기별 · 직무별 · 적용법규 · 계열)
"""
import json
import mimetypes
import os
from urllib.parse import parse_qs, quote, unquote, urlparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load_env(path=ROOT / ".env"):
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env()

from engine import companydb, export_regrader, industry, lawapi  # noqa: E402
from engine.suggest import JOBS, add_law, apply_ai, fact_effects, load_catalog, plain_categories, suggest  # noqa: E402

try:
    from engine import ai  # noqa: E402
except ImportError:  # anthropic 패키지가 없을 때 (시스템 파이썬으로 실행)
    ai = None

PORT = int(os.environ.get("PORT", "8787"))


def ai_ready():
    return ai is not None and ai.available()


def ai_reason():
    if ai is None:
        return "anthropic 패키지가 없습니다. .venv/bin/python 으로 실행해 주세요."
    if not ai.available():
        return ".env 에 ANTHROPIC_API_KEY 가 없습니다."
    return None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / "web"), **kwargs)

    def _json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def _rr(self, path):
        """/rr/<회사>/<파일> → 회사 데이터 (없으면 RegRader 화면 사본)."""
        rest = unquote(path)[len("/rr/"):]
        name, sep, rel = rest.partition("/")
        if not name:   # /rr/ : 보낸 회사 목록
            p = ROOT / "web" / "companies.html"
            body = p.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        if not sep:
            self.send_response(301)
            self.send_header("Location", "/rr/" + quote(name) + "/")
            self.end_headers()
            return
        p = export_regrader.resolve_file(name, rel)
        if not p:
            return self._json(404, {"error": "없는 파일입니다"})
        body = p.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", (mimetypes.guess_type(p.name)[0] or "application/octet-stream")
                         + ("; charset=utf-8" if p.suffix in (".html", ".js", ".json", ".css", ".vtt") else ""))
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urlparse(self.path)
        q = (parse_qs(url.query).get("q") or [""])[0].strip()
        if url.path.startswith("/rr/"):
            return self._rr(url.path)
        try:
            if url.path == "/api/status":
                return self._json(200, {
                    "ai": ai_ready(), "model": ai.MODEL if ai else None, "reason": ai_reason(), "jobs": JOBS,
                    "company": dict(companydb.meta(), ready=True) if companydb.ready() else {"ready": False},
                })
            if url.path == "/api/catalog":
                return self._json(200, dict(load_catalog(), effects=fact_effects()))
            if url.path == "/api/codes":
                return self._json(200, industry.codes_doc())
            if url.path == "/api/example":
                return self._json(200, json.loads((ROOT / "examples" / "manufacturer.json").read_text(encoding="utf-8")))
            if url.path == "/api/company":
                if not companydb.ready():
                    return self._json(400, {"error": "회사 찾기 자료가 없습니다. README 의 ‘회사 찾기 자료 준비’를 따라 주세요."})
                return self._json(200, {"results": companydb.search(q)})
            if url.path == "/api/laws":
                return self._json(200, {"results": lawapi.find_laws(q) if len(q) >= 2 else []})
            if url.path == "/api/regrader":
                return self._json(200, export_regrader.status(q) or {"state": "none"})
            if url.path == "/api/regrader/list":
                return self._json(200, {"companies": export_regrader.listing()})
        except Exception as e:  # noqa: BLE001
            return self._json(500, {"error": f"처리하지 못했습니다: {e}"})
        return super().do_GET()

    def do_POST(self):
        # 쓰기 API 는 이 서버 화면에서만: 다른 사이트가 보낸 요청(Origin 이 이 서버가 아님)은 받지 않는다
        origin = self.headers.get("Origin")
        if origin and urlparse(origin).netloc != (self.headers.get("Host") or ""):
            return self._json(403, {"error": "이 서버 화면에서만 쓸 수 있습니다."})
        try:
            body = self._body()
            if self.path == "/api/company/draft":
                c = companydb.get(body.get("key", ""))
                if not c:
                    return self._json(404, {"error": "회사를 찾지 못했습니다. 다시 검색해 주세요."})
                return self._json(200, companydb.draft(c, load_catalog()))
            if self.path == "/api/law":
                name, job = (body.get("name") or "").strip(), body.get("job") or "기타"
                if not name:
                    return self._json(400, {"error": "법령명을 넣어 주세요."})
                f = add_law(name, job if job in JOBS else "기타", body.get("profile") or {})
                if not f["verified"]:
                    return self._json(404, {"error": f"‘{name}’을(를) 국가법령정보센터에서 찾지 못했습니다."})
                return self._json(200, f)
            if self.path == "/api/research":
                if not ai_ready():
                    return self._json(400, {"error": "AI 기능이 꺼져 있습니다. " + ai_reason()})
                return self._json(200, ai.research(body.get("name", ""), body.get("hint", "")))
            if self.path == "/api/regrader":
                name, fams = (body.get("company") or "").strip(), body.get("families") or []
                if not name or not fams:
                    return self._json(400, {"error": "회사 이름과 적용법규가 필요합니다."})
                return self._json(200, export_regrader.start(name, fams, body.get("profile")))
            if self.path == "/api/suggest":
                profile = body.get("profile") or body
                res = suggest(profile)
                if body.get("ai") and ai_ready():
                    try:
                        cls = ai.classify(profile, body.get("research"), res["families"])
                    except ai.AIError as e:  # AI 가 안 되면 규칙 결과라도 보여 준다
                        res = plain_categories(res)
                        res["aiError"] = str(e)
                        return self._json(200, res)
                    return self._json(200, apply_ai(res, cls, profile))
                return self._json(200, plain_categories(res))
            return self._json(404, {"error": "없는 주소입니다"})
        except Exception as e:  # noqa: BLE001
            msg = str(e) if ai and isinstance(e, ai.AIError) else f"처리하지 못했습니다: {e}"
            return self._json(500, {"error": msg})

    def log_message(self, fmt, *args):
        # API 요청만 남긴다 (첫 인자가 HTTPStatus 인 오류 로그도 있다)
        if "/api/" in (str(args[0]) if args else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    print(f"RegRader Pro · http://127.0.0.1:{PORT} · 회사 찾기 자료 {'있음' if companydb.ready() else '없음'}"
          f" · AI {'켜짐' if ai_ready() else '꺼짐'}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
