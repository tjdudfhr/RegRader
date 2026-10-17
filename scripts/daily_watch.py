#!/usr/bin/env python3
"""RegRader 매일 아침 점검 (GitHub Actions 'daily-check' 가 08:20 에 부른다).

  1. 오늘 자동 갱신이 돌았는지 · 성공했는지 — 맥이 남긴 docs/health.json (날짜 · 성공 여부 · 이유)
  2. 공개 사이트가 데이터를 불러오고 멈추지 않는지 — scripts/site_check.py (잠금 화면 뒤 스크립트까지)

문제가 있으면 이 실행을 '실패'로 끝낸다 → GitHub 이 저장소 주인에게 알림 메일을 보낸다 (설정 없이).
저장소 비밀값 RR_MAIL_USER · RR_MAIL_PASS(Gmail 앱 비밀번호) · RR_MAIL_TO 가 있으면 한국어 알림 메일도 직접 보낸다.
  python3 scripts/daily_watch.py            # 점검
  python3 scripts/daily_watch.py --test     # 알림 메일이 오는지 시험 (일부러 실패)
"""
import json
import os
import smtplib
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.utils import formataddr

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import site_check  # noqa: E402

SITE = os.environ.get('RR_SITE', 'https://tjdudfhr.github.io/RegRader/')
KST = timezone(timedelta(hours=9))


def get_json(name):
    url = f'{SITE}{name}?cb={int(time.time())}'
    with urllib.request.urlopen(urllib.request.Request(url, headers={'Cache-Control': 'no-cache'}), timeout=30) as r:
        return json.load(r)


def problems(today):
    out, notes = [], []
    try:
        h = get_json('health.json')
    except Exception as e:  # noqa: BLE001
        h = None
        out.append(f'자동 갱신 상태 파일(health.json)을 읽지 못했습니다: {e}')
    if h is not None:
        when = f"{h.get('date', '?')} {h.get('time', '')}".strip()
        if h.get('date') != today:
            out.append(f'오늘({today}) 자동 갱신이 실행되지 않았습니다. 마지막 실행: {when}. '
                       '맥이 꺼져 있었거나 잠자기 상태였을 수 있습니다 — 맥을 켜 두면 다음 7시에 다시 돕니다.')
        elif not h.get('ok'):
            out.append(f"오늘 자동 갱신이 '{h.get('stage', '?')}' 단계에서 멈췄습니다: {h.get('reason', '')} "
                       '(공개 사이트는 마지막으로 정상이던 데이터를 그대로 보여 줍니다)')
        else:
            notes.append(f"오늘 자동 갱신 정상 ({when}, 개정 {h.get('count', '?')}건)")
        if h.get('date') == today and h.get('pro') is False:
            out.append(f"기업별 적용법규 검색(RegRader Pro) 자료 갱신이 실패했습니다: {h.get('proReason', '')}")
    ok, why = site_check.check(SITE + f'?cb={int(time.time())}')
    (notes if ok else out).append(('공개 사이트: ' if ok else '공개 사이트 화면 문제: ') + why)
    return out, notes


def send_mail(subject, body):
    user, pw, to = os.environ.get('RR_MAIL_USER'), os.environ.get('RR_MAIL_PASS'), os.environ.get('RR_MAIL_TO')
    if not (user and pw and to):
        return '한국어 알림 메일은 설정 전 (GitHub 기본 알림 메일만 갑니다)'
    msg = MIMEText(body, 'plain', 'utf-8')
    msg['Subject'] = subject
    msg['From'] = formataddr(('RegRader 알림', user))
    msg['To'] = to
    with smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=30) as s:
        s.login(user, pw)
        s.sendmail(user, [x.strip() for x in to.split(',') if x.strip()], msg.as_string())
    return '한국어 알림 메일을 보냈습니다'


def main():
    test = '--test' in sys.argv
    now = datetime.now(KST)
    today = now.strftime('%Y-%m-%d')
    out, notes = ([], ['시험 알림입니다 — 실제 문제는 없습니다']) if test else problems(today)
    if test:
        out = ['(시험) 알림 메일이 제대로 오는지 확인하는 메일입니다. 실제 문제는 없습니다.']
    lines = [f'RegRader 매일 점검 · {now:%Y-%m-%d %H:%M} (한국 시각)', '']
    if out:
        lines += ['문제'] + [f'  ⚠ {x}' for x in out] + ['']
    if notes:
        lines += ['정상'] + [f'  ✓ {x}' for x in notes] + ['']
    run = os.environ.get('GITHUB_SERVER_URL', '') and f"{os.environ['GITHUB_SERVER_URL']}/{os.environ.get('GITHUB_REPOSITORY')}/actions/runs/{os.environ.get('GITHUB_RUN_ID')}"
    lines += [f'사이트: {SITE}'] + ([f'점검 기록: {run}'] if run else []) + ['맥의 갱신 기록: ~/Library/Logs/RegRader-update.log']
    report = '\n'.join(lines)
    print(report)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as f:
            f.write('## RegRader 매일 점검\n\n' + '\n'.join(('- ⚠️ ' + x) for x in out) + ('\n' if out else '') +
                    '\n'.join(('- ✅ ' + x) for x in notes) + '\n')
    if not out:
        return 0
    for x in out:
        print(f'::error title=RegRader 점검::{x}')
    try:
        print(send_mail(f"[RegRader] ⚠ {'시험 알림' if test else '확인이 필요합니다'} — {out[0][:60]}", report))
    except Exception as e:  # noqa: BLE001
        print(f'::warning title=알림 메일::한국어 알림 메일을 보내지 못했습니다: {e}')
    return 1


if __name__ == '__main__':
    sys.exit(main())
