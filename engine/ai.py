"""Claude 로 하는 일 두 가지.

1. research(name, hint): 회사명으로 웹을 검색해 업종·사업장·근로자 수·인허가 등을 찾고,
   입력 항목(kb/catalog.json)에 맞춰 회사 정보 초안을 만든다. 근거 URL 을 함께 남긴다.
2. classify(profile, families): 적용법규 후보를 직무(안전·환경·…·기타)로 나누고,
   회사 기준 적용 판단·이유를 붙이고, 규칙에 없는 법령을 더 제안한다.

둘 다 유료(Claude API)라 .env 에 키가 있을 때만 쓴다. 기본 회사 찾기는 engine/companydb.py (무료 공공데이터).

- 모델: 환경변수 REGRADER_MODEL (기본 claude-opus-5-5), 노력도: REGRADER_EFFORT (기본 medium)
- 인증: ANTHROPIC_API_KEY (server.py 가 .env 를 읽는다)
- 결과는 .cache/ai/ 에 보관한다 (같은 입력이면 다시 부르지 않는다)
"""
import hashlib
import json
import os
from pathlib import Path

import anthropic

from engine.suggest import JOBS, load_catalog

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "ai"
MODEL = os.environ.get("REGRADER_MODEL", "claude-opus-5-5")
EFFORT = os.environ.get("REGRADER_EFFORT", "medium")
# 안전 분류기가 요청을 거절하면 서버가 알맞은 다른 모델로 다시 돌린다
BETAS = ["server-side-fallback-2026-07-01"]
WEB_TOOLS = [
    {"type": "web_search_20260209", "name": "web_search", "max_uses": 12,
     "user_location": {"type": "approximate", "country": "KR", "timezone": "Asia/Seoul"}},
    {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": 8},
]
MAX_CONTINUE = 6


class AIError(RuntimeError):
    pass


def available():
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


def _client():
    return anthropic.Anthropic(timeout=600.0)


def _cache(kind, payload):
    key = hashlib.sha1(json.dumps([kind, MODEL, EFFORT, payload], ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    return CACHE / f"{kind}-{key}.json"


def _call(**kw):
    """스트리밍으로 부르고 최종 메시지를 돌려준다. 서버 도구가 멈추면(pause_turn) 이어서 부른다."""
    client = _client()
    messages = list(kw.pop("messages"))
    for _ in range(MAX_CONTINUE):
        try:
            with client.beta.messages.stream(
                model=MODEL, betas=BETAS, fallbacks="default", messages=messages, **kw
            ) as stream:
                msg = stream.get_final_message()
        except anthropic.AuthenticationError as e:
            raise AIError("Anthropic API 키가 올바르지 않습니다. .env 의 ANTHROPIC_API_KEY 를 확인해 주세요.") from e
        except anthropic.RateLimitError as e:
            raise AIError("API 사용 한도에 걸렸습니다. 잠시 뒤 다시 시도해 주세요.") from e
        except anthropic.APIStatusError as e:
            raise AIError(f"Claude API 오류 ({e.status_code}): {e.message}") from e
        except anthropic.APIConnectionError as e:
            raise AIError("Claude API 에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.") from e
        if msg.stop_reason == "refusal":
            raise AIError("AI 가 이 요청을 처리하지 않았습니다. 입력을 바꿔 다시 시도해 주세요.")
        if msg.stop_reason == "pause_turn":
            messages = messages + [{"role": "assistant", "content": msg.content}]
            continue
        return msg
    raise AIError("AI 조사가 너무 길어져 멈췄습니다. 다시 시도해 주세요.")


def _text(msg):
    return "".join(b.text for b in msg.content if b.type == "text").strip()


def _json(msg):
    """구조화 출력(JSON) 응답을 읽는다."""
    if msg.stop_reason == "max_tokens":
        raise AIError("AI 응답이 길어 중간에 잘렸습니다. 다시 시도해 주세요.")
    try:
        return json.loads(_text(msg))
    except json.JSONDecodeError as e:
        raise AIError("AI 응답을 읽지 못했습니다. 다시 시도해 주세요.") from e


def _sources(msg):
    """웹 검색 결과에 나온 URL 과 제목."""
    out, seen = [], set()
    for b in msg.content:
        if b.type == "web_search_tool_result" and isinstance(b.content, list):
            for r in b.content:
                url = getattr(r, "url", None)
                if url and url not in seen:
                    seen.add(url)
                    out.append({"url": url, "title": getattr(r, "title", "") or url})
    return out


RESEARCH_SYSTEM = """당신은 한국 기업의 컴플라이언스 실사를 돕는 리서처입니다. 웹 검색으로 회사의 사실관계를 조사해, 어떤 법규가 적용되는지 판단할 수 있는 자료를 만듭니다.

찾을 것:
- 정식 법인명, 사업 개요, 주요 제품과 생산 공정, 업종
- 사업장(본사·공장·연구소·물류센터)의 이름과 주소
- 상시근로자 수(기준 시점과 출처), 상장 여부, 자산총액
- 인허가·신고: 대기·폐수 배출시설, 유해화학물질 영업허가, 위험물 제조소, 고압가스, 방사선 사용, 공장 등록, 통합허가 등
- 공정에서 쓰는 주요 설비(보일러, 크레인, 압력용기, 국소배기장치 등)와 취급 물질
- 수출입, 해외법인, 하도급·대리점 거래, 연구소, 국가핵심기술·첨단전략기술 보유, 온실가스 할당 대상 여부

원칙:
- DART 공시, 회사 홈페이지, 정부·공공기관 공개자료, 신뢰할 만한 기사를 우선합니다.
- 항목마다 근거 URL 을 붙이고, 확인된 사실과 업종·공정에서 미루어 본 추정을 구분해 적습니다.
- 같은 이름의 회사가 여럿이면 가장 그럴듯한 회사를 고르고, 다른 후보도 적습니다.
- 찾지 못한 것은 찾지 못했다고 적습니다. 지어내지 않습니다."""


def _research_schema(catalog):
    tag_ids = [o["id"] for s in catalog["sections"] for o in s["options"]]
    provinces = catalog["regions"]["provinces"]
    nullable_num = {"anyOf": [{"type": "number"}, {"type": "null"}]}
    return {
        "type": "object",
        "properties": {
            "officialName": {"type": "string"},
            "summary": {"type": "string"},
            "alternatives": {"type": "array", "items": {"type": "string"}},
            "employees": nullable_num,
            "employeesNote": {"type": "string"},
            "assetsEok": nullable_num,
            "assetsNote": {"type": "string"},
            "listed": {"type": "boolean"},
            "provinces": {"type": "array", "items": {"type": "string", "enum": provinces}},
            "cities": {"type": "array", "items": {"type": "string"}},
            "sites": {"type": "array", "items": {
                "type": "object",
                "properties": {"name": {"type": "string"}, "address": {"type": "string"}, "kind": {"type": "string"}},
                "required": ["name", "address", "kind"], "additionalProperties": False}},
            "tags": {"type": "array", "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "enum": tag_ids},
                    "basis": {"type": "string", "enum": ["확인", "추정"]},
                    "evidence": {"type": "string"},
                    "source": {"type": "string"},
                },
                "required": ["id", "basis", "evidence", "source"], "additionalProperties": False}},
            "facts": {"type": "array", "items": {
                "type": "object",
                "properties": {"text": {"type": "string"}, "source": {"type": "string"}},
                "required": ["text", "source"], "additionalProperties": False}},
            "unknowns": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["officialName", "summary", "alternatives", "employees", "employeesNote", "assetsEok", "assetsNote",
                     "listed", "provinces", "cities", "sites", "tags", "facts", "unknowns"],
        "additionalProperties": False,
    }


def research(name, hint=""):
    """회사명 → {profile, research}. profile 은 화면·규칙 엔진이 쓰는 형식."""
    name = (name or "").strip()
    if not name:
        raise AIError("회사명을 입력해 주세요.")
    path = _cache("research", {"name": name, "hint": hint})
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    catalog = load_catalog()

    # 1) 웹 조사: 근거 URL 이 달린 자유 서술 보고서
    ask = f"회사명: {name}" + (f"\n추가 정보: {hint}" if hint else "") + "\n\n이 회사를 조사해 주세요."
    msg = _call(
        max_tokens=16000, system=RESEARCH_SYSTEM, tools=WEB_TOOLS,
        output_config={"effort": EFFORT},
        messages=[{"role": "user", "content": ask}],
    )
    report, sources = _text(msg), _sources(msg)
    if not report:
        raise AIError("AI 가 회사 정보를 찾지 못했습니다. 정식 회사명이나 홈페이지 주소를 함께 넣어 보세요.")

    # 2) 정리: 보고서를 입력 항목 형식으로 (항목 id 는 목록 안에서만 고른다)
    options = "\n".join(f"- {o['id']}: {s['label']} · {o['label']}" for s in catalog["sections"] for o in s["options"])
    shape = (
        "아래 조사 보고서를 회사 정보 양식으로 옮겨 주세요.\n"
        "- tags 에는 보고서에 근거가 있는 항목만 넣고, 확인된 사실이면 basis '확인', 업종·공정에서 미루어 본 것이면 '추정'으로 적습니다.\n"
        "- source 에는 보고서에 적힌 근거 URL 을 그대로 씁니다. 없으면 빈 문자열입니다.\n"
        "- 숫자를 찾지 못했으면 null 입니다. assetsEok 의 단위는 억원입니다.\n"
        "- provinces 는 사업장 소재 시·도, cities 는 시·군 이름(예: 포항, 광양)입니다.\n\n"
        f"[고를 수 있는 항목]\n{options}\n\n[조사 보고서]\n{report}"
    )
    msg2 = _call(
        max_tokens=16000, output_config={"effort": "low", "format": {"type": "json_schema", "schema": _research_schema(catalog)}},
        messages=[{"role": "user", "content": shape}],
    )
    data = _json(msg2)
    tags = list(dict.fromkeys(t["id"] for t in data["tags"]))
    profile = {
        "name": data["officialName"] or name,
        "numbers": {"employees": data["employees"] or 0, "assets": data["assetsEok"] or 0},
        "flags": ["listed"] if data["listed"] else [],
        "tags": tags,
        "regions": {"provinces": data["provinces"], "cities": data["cities"]},
    }
    out = {
        "profile": profile,
        "research": {
            "query": name,
            "officialName": data["officialName"],
            "summary": data["summary"],
            "alternatives": data["alternatives"],
            "employeesNote": data["employeesNote"],
            "assetsNote": data["assetsNote"],
            "sites": data["sites"],
            "tagEvidence": {t["id"]: {k: t[k] for k in ("basis", "evidence", "source")} for t in data["tags"]},
            "facts": data["facts"],
            "unknowns": data["unknowns"],
            "sources": sources,
            "model": msg.model,
        },
    }
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    return out


CLASSIFY_SYSTEM = """당신은 한국 기업 법무·컴플라이언스 담당자를 돕는 전문가입니다. 회사 정보와 적용법규 후보를 보고, 담당 직무를 정하고 적용 여부를 판단합니다.

- 직무는 다음 중 하나입니다: """ + ", ".join(JOBS) + """. 어느 직무에도 맞지 않으면 기타입니다.
- 후보마다 이 회사 기준 판단(적용 / 검토 필요 / 해당 가능성 낮음)과 한두 문장의 이유를 씁니다. 회사의 실제 사업·사업장을 들어 설명합니다.
- 후보에 없지만 이 회사에 적용될 가능성이 높은 법령이 있으면 국가법령정보센터에 등록된 정식 법령명으로 제안합니다. 확신이 없으면 제안하지 않습니다."""


def _classify_schema():
    job = {"type": "string", "enum": JOBS}
    return {
        "type": "object",
        "properties": {
            "laws": {"type": "array", "items": {
                "type": "object",
                "properties": {
                    "root": {"type": "string"},
                    "category": job,
                    "verdict": {"type": "string", "enum": ["적용", "검토 필요", "해당 가능성 낮음"]},
                    "reason": {"type": "string"},
                },
                "required": ["root", "category", "verdict", "reason"], "additionalProperties": False}},
            "additional": {"type": "array", "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "category": job,
                    "reason": {"type": "string"},
                    "keywords": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["name", "category", "reason", "keywords"], "additionalProperties": False}},
        },
        "required": ["laws", "additional"],
        "additionalProperties": False,
    }


def classify(profile, research_info, families):
    """후보 법령들을 AI 가 분야로 나누고 판단한다 (네트워크·비용 발생)."""
    cands = [{"root": f["root"], "reasons": f["reasons"], "tier": f["tier"]} for f in families]
    payload = {"profile": profile, "research": research_info or {}, "candidates": cands}
    path = _cache("classify", payload)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    about = {
        "회사": (research_info or {}).get("officialName") or profile.get("name"),
        "개요": (research_info or {}).get("summary", ""),
        "사업장": (research_info or {}).get("sites", []),
        "참고 사실": [f["text"] for f in (research_info or {}).get("facts", [])],
        "선택 항목": profile.get("tags", []),
        "상시근로자": (profile.get("numbers") or {}).get("employees"),
        "상장": "listed" in (profile.get("flags") or []),
    }
    ask = ("[회사]\n" + json.dumps(about, ensure_ascii=False, indent=1) +
           "\n\n[적용법규 후보 (규칙이 고른 것, root 는 그대로 써 주세요)]\n" + json.dumps(cands, ensure_ascii=False, indent=1))
    msg = _call(
        max_tokens=16000, system=CLASSIFY_SYSTEM,
        output_config={"effort": EFFORT, "format": {"type": "json_schema", "schema": _classify_schema()}},
        messages=[{"role": "user", "content": ask}],
    )
    data = _json(msg)
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data
