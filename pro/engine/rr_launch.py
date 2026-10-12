"""RegRader 수집(scripts/refresh_laws.py)을 회사 작업 폴더에서 돌린다 — engine/export_regrader.py 가 부른다.

    python3 engine/rr_launch.py <작업 폴더> <법제처 응답 저장 폴더>

RegRader 스크립트는 고치지 않는다. requests.get 만 감싸서
  - 법제처(law.go.kr/DRF) 응답을 Pro 와 같은 저장소(.cache/lawapi, 같은 키)에 두고 같이 쓴다.
    Pro 가 판정하며 받아 둔 법령체계도를 RegRader 계열 단계가 그대로 쓰고, 회사끼리도 같이 쓴다.
      · 날짜 범위로 받는 목록(올해 개정 목록 efYd · 행정규칙 개정 목록 prmlYd)은 하루에도 바뀌어 3시간만 쓴다
      · 나머지(법령체계도 · 이름 검색)는 Pro 와 같이 7일. 법령·행정규칙 원문은 RegRader 가 따로 저장하므로 두지 않는다
  - 진행 상황을 '[pro] …' 줄로 알린다 (export_regrader.run 이 읽어 화면에 보인다)
이 파일은 Pro 엔진을 가져오지 않는다 (RegRader 수집용 파이썬에는 requests 만 있으면 된다).
"""
import atexit
import hashlib
import json
import os
import runpy
import sys
import threading
import time
import urllib.parse
from pathlib import Path

WS = Path(sys.argv[1]).resolve()
CACHE = Path(sys.argv[2]).resolve()
VOLATILE = ("efYd", "prmlYd")
SHORT, LONG = 3 * 3600, 7 * 24 * 3600

# 이 폴더(engine/)의 모듈 이름이 RegRader 스크립트의 import 와 겹치지 않게 sys.path 를 수집 스크립트 폴더로 바꾼다
sys.path[0] = str(WS / "scripts")

import requests  # noqa: E402

_get = requests.get
_lock = threading.Lock()
_count = {"hit": 0, "net": 0, "tree": 0, "admrul": 0, "body": 0}
_admrul_pages = [0]


def key(url, params):
    """engine/lawapi._get 과 같은 키 (같은 요청이면 같은 파일)."""
    return hashlib.sha1((url + "?" + urllib.parse.urlencode(sorted(params.items()))).encode()).hexdigest()


def _cached(url, body):
    r = requests.models.Response()
    r.status_code = 200
    r._content = body
    r.encoding = "utf-8"
    r.url = url
    r.headers["Content-Type"] = "application/json; charset=utf-8"
    return r


def _say(kind, p, r):
    """진행 줄: 법령체계도 · 행정규칙 개정 목록 쪽 · 개정문 원문."""
    with _lock:
        if p.get("target") == "lsStmd" and "MST" in p:
            _count["tree"] += 1
            print(f"[pro] tree {_count['tree']}", flush=True)
        elif p.get("target") == "admrul" and "prmlYd" in p:
            if p.get("page") == "1":
                try:
                    _admrul_pages[0] = (int((r.json().get("AdmRulSearch") or {}).get("totalCnt") or 0) + 99) // 100
                except ValueError:
                    pass
            _count["admrul"] += 1
            print(f"[pro] admrul {_count['admrul']} {_admrul_pages[0]}", flush=True)
        elif p.get("target") in ("law", "admrul") and ("MST" in p or "ID" in p) and "lawService" in kind:
            _count["body"] += 1
            print(f"[pro] body {_count['body']}", flush=True)


def get(url, params=None, **kw):
    if "law.go.kr/DRF" not in str(url) or not params:
        return _get(url, params=params, **kw)
    p = {k: str(v) for k, v in params.items()}
    path = CACHE / f"{key(url, p)}.json"
    ttl = SHORT if any(k in p for k in VOLATILE) else LONG
    try:
        fresh = time.time() - path.stat().st_mtime < ttl
    except OSError:
        fresh = False
    r = None
    if fresh:
        try:
            body = path.read_bytes()
            json.loads(body)
            r = _cached(url, body)
            _count["hit"] += 1
        except (OSError, ValueError):
            r = None
    if r is None:
        # 법제처가 느릴 때가 있다: 시간 초과 · 연결 끊김은 쉬었다가 몇 번 더 (한 법령 때문에 계열 단계 전체가 건너뛰어지지 않게)
        kw["timeout"] = max(kw.get("timeout") or 0, 150)   # 체계도가 큰 법령은 40초를 넘기기도 한다
        for attempt in range(4):
            try:
                r = _get(url, params=params, **kw)
                break
            except (requests.Timeout, requests.ConnectionError):
                if attempt == 3:
                    print(f"[pro] 법제처 응답 없음: {p.get('target')} {p.get('query') or p.get('MST') or p.get('ID') or ''}", flush=True)
                    raise
                time.sleep(3 * (attempt + 1))
        _count["net"] += 1
        # 법령·행정규칙 원문(개정문 분석)은 RegRader 가 이미 따로 저장한다 → 여기 두지 않는다
        if r.status_code == 200 and not ("lawService" in str(url) and p.get("target") in ("law", "admrul")):
            try:
                r.json()
                CACHE.mkdir(parents=True, exist_ok=True)
                tmp = path.with_suffix(f".{os.getpid()}.{threading.get_ident()}.tmp")
                tmp.write_bytes(r.content)
                os.replace(tmp, path)
            except (ValueError, OSError):
                pass
    _say(url, p, r)
    return r


requests.get = get


@atexit.register
def _summary():
    print(f"[pro] 법제처 응답: 저장분 사용 {_count['hit']} · 새로 받음 {_count['net']}", flush=True)


os.chdir(WS)
sys.argv = [str(WS / "scripts" / "refresh_laws.py")]
runpy.run_path(sys.argv[0], run_name="__main__")
