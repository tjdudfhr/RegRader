#!/bin/bash
# RegRader Pro 브라우저판 자료 갱신 — auto_update.sh 가 RegRader 갱신을 마친 뒤 부른다 (실패해도 RegRader 갱신은 그대로).
#   법제처 자료 묶음(lawpack) → 전체 법률 RegRader 수집(universe) → (30일마다) 회사 찾기 자료 → pro-data 브랜치에 덮어쓰기
# 브라우저판(docs/pro/)은 raw.githubusercontent.com/tjdudfhr/RegRader/pro-data/ 에서 이 자료를 받는다.
# Pro 원본 위치: PRO_DIR (기본 ~/regrader-pro — 회사 찾기 자료 · OpenDART 키가 있는 곳). 없으면 이 저장소의 pro/
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PRO="${PRO_DIR:-$HOME/regrader-pro}"
[ -d "$PRO/engine" ] || PRO="$REPO/pro"
export REGRADER_REPO="$REPO"
echo "=== $(date '+%Y-%m-%d %H:%M:%S') Pro 자료 갱신 ($PRO) ==="
cd "$PRO" && /usr/bin/python3 -m engine.static_site daily
