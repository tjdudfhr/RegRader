#!/usr/bin/env python3
"""RegRader 화면 점검: 크롬(헤드리스)으로 사이트를 열어 데이터를 다 불러오고 멈추지 않는지 본다.

  python3 scripts/site_check.py --dir docs          # 이 폴더를 잠깐 띄워서 (맥의 매일 갱신: 올리기 전에)
  python3 scripts/site_check.py --url https://…/   # 공개 사이트 (GitHub 의 매일 점검)

비밀번호 잠금 화면 뒤에서도 화면 스크립트는 그대로 돌므로(데이터를 불러오면 body 에 rr-ready),
잠금을 풀지 않고 점검한다. 2026-10-17 처럼 데이터 한 건 때문에 화면이 멈추면 크롬이 끝나지 않아 시간 초과로 잡힌다.
통과하면 0, 아니면 1 로 끝나고 마지막 줄에 이유를 쓴다.
"""
import argparse
import functools
import http.server
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import threading

CHROMES = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']
TIMEOUT = 90          # 실제 시간(초): 이 안에 끝나지 않으면 '멈춤'
BUDGET_MS = 25000     # 페이지 안 시간(가상): 데이터 받기 · 시작 화면 걷기까지 넉넉히


def chrome():
    for c in CHROMES:
        p = c if os.path.isabs(c) else shutil.which(c)
        if p and os.path.exists(p):
            return p
    return None


def serve(folder):
    """폴더를 127.0.0.1 의 빈 포트로 띄운다 (점검이 끝나면 프로그램과 함께 끝난다)."""
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        port = s.getsockname()[1]
    class Quiet(http.server.SimpleHTTPRequestHandler):   # 요청 기록 · 끊긴 연결 오류는 찍지 않는다
        def log_message(self, *a):
            pass

    class Server(http.server.ThreadingHTTPServer):
        def handle_error(self, request, client_address):
            pass

    httpd = Server(('127.0.0.1', port), functools.partial(Quiet, directory=folder))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return f'http://127.0.0.1:{port}/'


def check(url):
    exe = chrome()
    if not exe:
        return None, '크롬을 찾지 못해 화면 점검을 하지 못했습니다'
    prof = tempfile.mkdtemp(prefix='rr-check-')
    cmd = [exe, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
           f'--user-data-dir={prof}', '--window-size=1440,900', f'--virtual-time-budget={BUDGET_MS}', '--dump-dom', url]
    if sys.platform.startswith('linux'):   # GitHub 서버(우분투)는 크롬 샌드박스를 쓸 수 없다
        cmd.insert(1, '--no-sandbox')
    try:
        p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, start_new_session=True)
        try:
            dom, _ = p.communicate(timeout=TIMEOUT)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid, signal.SIGKILL)
            p.communicate()
            return False, f'화면이 {TIMEOUT}초 안에 끝나지 않았습니다 (화면 멈춤 — 스크립트가 끝없이 돌고 있을 수 있음)'
    finally:
        shutil.rmtree(prof, ignore_errors=True)
    body = re.search(r'<body[^>]*class="([^"]*)"', dom or '')
    if not dom:
        return False, '화면을 열지 못했습니다 (빈 응답)'
    if not body or 'rr-ready' not in body.group(1).split():
        return False, '데이터를 다 불러오지 못했습니다 (시작 화면이 걷히지 않음)'
    return True, '화면 정상 (데이터를 불러오고 멈추지 않음)'


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--dir')
    g.add_argument('--url')
    a = ap.parse_args()
    url = serve(os.path.abspath(a.dir)) if a.dir else a.url
    ok, why = check(url)
    print(why)
    sys.exit(0 if ok else (2 if ok is None else 1))   # 2: 점검 못 함 (크롬 없음) — 갱신은 막지 않는다


if __name__ == '__main__':
    main()
