# RegRader 운영 매뉴얼 (연도별 반복 사용 가이드)

## 1. 시스템 개요

### RegRader란?
RegRader는 한국 법규 개정사항을 실시간으로 모니터링하고 분석하는 GitHub Pages 기반 웹 대시보드입니다. 회사 내 주요 적용법규의 개정 현황을 한눈에 파악할 수 있도록 설계되었습니다.

### 주요 기능
- **134개 법령 추적**: 한국 정부의 주요 법령 모니터링
- **분기별 현황**: 월별, 분기별 개정 통계 및 추이
- **직무별 분류**: 카테고리별 법규 분류 (재무회계, 환경, 안전 등)
- **팝업 상세 분석**: 각 법령의 개정이유, 주요내용, 조항 변경사항 상세 분석

### 파일 구조 및 역할
```
RegRader/
├── docs/
│   ├── index.html          (메인 웹페이지 - UI 및 파싱 로직)
│   ├── index.json          (법령 데이터 - 134개 항목)
│   └── quarterly_details.json  (분기별 상세 데이터)
├── .gitignore
└── README.md
```

- **index.html**: 메인 웹페이지, 모든 UI 컴포넌트, 파싱 및 렌더링 로직 포함
- **index.json**: 각 법령의 제목, 시행일자, 개정이유, 주요내용 등 메타데이터
- **quarterly_details.json**: 분기별 법령 개정 현황 (통계용)

### 배포 환경
- **GitHub Repository**: `tjdudfhr/RegRader`
- **서비스 URL**: `https://tjdudfhr.github.io/RegRader`
- **배포 경로**: `/docs` 폴더에서 GitHub Pages 서비스

---

## 2. 데이터 수집 방법 (국가법령정보센터)

### 국가법령정보센터 Open API

RegRader의 모든 법령 데이터는 **국가법령정보센터** (https://www.law.go.kr)의 공개 API를 통해 수집됩니다.

### API 엔드포인트
```
https://www.law.go.kr/DRF/lawSearch.do
```

### 주요 API 파라미터

| 파라미터 | 설명 | 예시 |
|---------|------|------|
| OC | 인증키 (Open API 신청 후 발급) | ABC123XYZ789 |
| target | 검색 법령명 | 근로기준법 |
| type | 반환 형식 (XML 또는 JSON) | JSON |
| sort | 정렬 기준 (date: 시행일자 기준) | date |
| pIndex | 페이지 인덱스 (1부터 시작) | 1 |
| pSize | 페이지당 결과 수 | 100 |

### 연도별 개정법률 검색 방법

연도별로 새로운 법률을 수집할 때는 **시행일자 범위를 필터링**합니다.

**2027년 예시**:
```
https://www.law.go.kr/DRF/lawSearch.do?OC={KEY}&target=&type=JSON&sort=date
```

국가법령정보센터의 고급검색(웹사이트)에서:
- **시행일자**: 2027-01-01 ~ 2027-12-31
- **법령구분**: 법률, 대통령령, 총리령, 부령

### 수집 대상 법령 유형

RegRader는 다음 4가지 법령 유형을 수집합니다:

1. **법률** (국회 입법, 대통령 공포)
2. **대통령령** (대통령이 제정하는 법규)
3. **총리령** (국무총리가 제정하는 법규)
4. **부령** (각 부처 장관이 제정하는 시행규칙 등)

### 수집 데이터 항목

각 법령에서 필수적으로 수집해야 할 항목:

| 항목 | 설명 | JSON 필드명 |
|------|------|------------|
| 법령명 | 법령의 공식 명칭 | title |
| 시행일자 | 법령이 실제 시행되는 날짜 | effectiveDate |
| 개정이유 | 개정 사유 및 주요 내용 | amendments[].reason |
| 주요내용 | 구체적 개정 사항 | (reason 내 ◇ 이후) |
| 개정문 | 법제처 제공 개정 전후 조항 | (reason 내 【개정문】 이후) |
| 법령유형 | 법률/령/규칙 구분 | lawType |
| 소관부처 | 해당 법령을 관장하는 정부부처 | ministry |

### 데이터 수집 팁
- **중복 확인**: 같은 법령이 여러 번 시행될 수 있으므로 시행일자 기준으로 정렬
- **비공식 정보 배제**: 안내문, 통지 등 법령이 아닌 자료는 제외
- **약칭 확인**: 많이 사용되는 약칭과 정식명칭을 모두 기록

---

## 3. 회사 적용법규와 매칭 방법

### 회사 적용법규 목록

회사가 적용해야 하는 기본 207개 법규는 **index.html** 내 `lawregistry-content` 탭에 정의되어 있습니다.

```html
<!-- index.html 내 회사 적용법규 목록 예시 -->
<div id="lawregistry-content" class="tab-pane fade">
  <table>
    <tr>
      <td>law_001</td>
      <td>근로기준법</td>
      <td>인사노무</td>
    </tr>
    <tr>
      <td>law_002</td>
      <td>근로자보건안전보건규칙</td>
      <td>안전</td>
    </tr>
    <!-- 더 많은 항목... -->
  </table>
</div>
```

**업데이트 필요 시기**:
- 신규 법규 발견 시
- 법규명 변경 시
- 회사 업무 범위 변경 시

### 매칭 로직

수집한 법령을 회사 적용법규 목록과 매칭하는 단계적 프로세스:

#### 단계 1: 완전일치 (100% Match)
```javascript
// 법령명이 정확히 일치하는 경우
if (collectedLaw.title === companyLaw.name) {
  matchType = "100%완전일치";
}
```

**예**: 수집된 "근로기준법" = 회사 법규 "근로기준법"

#### 단계 2: 약칭 매칭
```javascript
// 약칭으로 일치하는 경우 (예: 근기법 = 근로기준법)
const aliases = {
  "근기법": "근로기준법",
  "산안법": "산업안전보건법",
  "개인정보보호법": "개인정보 보호법"
};

if (aliases[collectedLaw.title] === companyLaw.name) {
  matchType = "약칭일치";
}
```

#### 단계 3: 부분일치 (시행령/시행규칙 포함)
```javascript
// 법령명 포함 관계로 매칭 (예: 근로기준법 시행령 → 근로기준법)
if (companyLaw.name.includes(collectedLaw.title) ||
    collectedLaw.title.includes(companyLaw.name)) {
  matchType = "부분일치";
}
```

### 매칭 결과 기록

매칭 결과는 `index.json`의 각 항목의 `meta` 필드에 기록됩니다:

```json
{
  "id": "2027-001",
  "title": "근로기준법",
  "effectiveDate": "2027-03-15",
  "meta": {
    "lsId": "000160",
    "matchType": "100%완전일치",
    "companyLawId": "law_001"
  }
}
```

| 필드 | 설명 |
|------|------|
| lsId | 국가법령정보센터의 법령 고유 ID (15자 숫자) |
| matchType | 매칭 유형 (100%완전일치, 약칭일치, 부분일치, 미매칭) |
| companyLawId | 회사 적용법규 ID (예: law_001, law_105) |

### 카테고리 분류

모든 법령은 다음 7가지 카테고리 중 하나 이상으로 분류됩니다:

| 카테고리 | 설명 | 예시 법령 |
|---------|------|---------|
| **재무회계** | 재무보고, 세무, 회계 관련 | 주식회사등의외부감사에관한법률 |
| **환경** | 환경보호, 오염 방지 관련 | 환경영향평가법 |
| **안전** | 산업안전, 보건 관련 | 산업안전보건법 |
| **인사노무** | 고용, 근로, 복리후생 관련 | 근로기준법 |
| **정보보호** | 개인정보, 정보보안 관련 | 개인정보보호법 |
| **지배구조** | 기업지배, 공시, 규제 관련 | 공시규정 |
| **기타** | 위 6개에 해당하지 않는 법규 | 기타 |

**카테고리 매핑 예시**:
```javascript
const categoryMap = {
  "근로기준법": ["인사노무"],
  "산업안전보건법": ["안전", "인사노무"],
  "환경영향평가법": ["환경"],
  "개인정보보호법": ["정보보호"]
};
```

---

## 4. index.json 데이터 구조

### 전체 JSON 구조

```json
{
  "year": 2027,
  "generatedAt": "2027-03-08T15:30:45",
  "total": 134,
  "items": [
    {
      "id": "202701001",
      "title": "근로기준법",
      "summary": "근로자의 기본적 생활을 보장하기 위한 법률로 임금, 근로시간, 안전 등을 규정",
      "effectiveDate": "2027-03-15",
      "lawType": "법률",
      "status": "시행",
      "ministry": "고용노동부",
      "categories": ["인사노무"],
      "amendments": [
        {
          "date": "2027-03-15",
          "reason": "[일부개정] ◇ 개정이유 ◇ 최저임금 산정 방식 개선으로 근로자 보호 강화 ◇ 주요내용 ◇ 가. 최저임금 기준 개정 나. 근로시간 관련 규정 개선 【개정문】 제15조를 다음과 같이 개정한다. 1항을 삭제하고 2항을 1항으로 한다."
        }
      ],
      "meta": {
        "lsId": "000160",
        "matchType": "100%완전일치",
        "companyLawId": "law_001"
      },
      "source": "국가법령정보센터",
      "originalTitle": "근로기준법"
    }
  ]
}
```

### 각 필드 상세 설명

#### 최상위 레벨 필드

| 필드 | 타입 | 설명 | 예시 |
|------|------|------|------|
| year | number | 데이터 수집 연도 | 2027 |
| generatedAt | string | 데이터 생성 일시 (ISO 8601) | "2027-03-08T15:30:45" |
| total | number | 포함된 총 법령 수 | 134 |
| items | array | 법령 객체 배열 | [...] |

#### items 배열 내 항목 필드

| 필드 | 타입 | 설명 | 값 예시 |
|------|------|------|--------|
| id | string | 항목 고유 ID (15자) | "202701001" |
| title | string | 법령의 공식 명칭 | "근로기준법" |
| summary | string | 법령의 목적/설명 (150~200자) | "근로자의 기본적 생활을..." |
| effectiveDate | string | 시행일자 (YYYY-MM-DD) | "2027-03-15" |
| lawType | string | 법령 유형 | "법률", "대통령령", "총리령", "부령" |
| status | string | 법령 상태 | "시행", "예정", "폐지" |
| ministry | string | 소관 정부부처 | "고용노동부" |
| categories | array | 카테고리 배열 | ["인사노무"] |
| amendments | array | 개정 사항 배열 | [{ date, reason }] |
| meta | object | 메타정보 | { lsId, matchType, companyLawId } |
| source | string | 데이터 출처 | "국가법령정보센터" |
| originalTitle | string | 국가법령정보센터에서의 원본 법령명 | "근로기준법" |

#### amendments 배열 필드

```json
{
  "amendments": [
    {
      "date": "2027-03-15",
      "reason": "[일부개정] ◇ 개정이유 및 주요내용 ◇ ... 【개정문】 ..."
    }
  ]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| date | string | 개정(시행)일자 (YYYY-MM-DD) |
| reason | string | 개정이유 및 주요내용 원본 텍스트 |

**reason 필드의 형식**:
- 접두사: `[일부개정]`, `[전부개정]`, `[제정]` 등
- 섹션 구분자: `◇` 또는 `◆`
- 변경 사항: `【개정문】` 이후의 텍스트

#### meta 객체 필드

| 필드 | 타입 | 설명 | 예시 |
|------|------|------|------|
| lsId | string | 국가법령정보센터 고유 ID (15자) | "000160" |
| matchType | string | 회사법규와의 매칭 유형 | "100%완전일치", "약칭일치", "부분일치", "미매칭" |
| companyLawId | string | 회사 적용법규 ID (매칭된 경우만) | "law_001" |

### JSON 생성 시 주의사항

1. **인코딩**: UTF-8 (BOM 없음)
2. **날짜 형식**: ISO 8601 (YYYY-MM-DD 또는 YYYY-MM-DDTHH:MM:SS)
3. **이스케이프**: 큰따옴표, 백슬래시, 제어문자는 이스케이프 처리
4. **정렬**: 항목을 시행일자 기준 최신순으로 정렬
5. **총 개수**: `total` 필드는 `items.length`와 일치해야 함

### JSON 유효성 검사
```bash
# 명령줄에서 JSON 검증
python3 -m json.tool index.json > /dev/null && echo "Valid JSON"
```

---

## 5. 팝업(모달) 내용 출력 방법

### 팝업 표시 플로우

```
사용자 클릭 (법령 항목)
    ↓
showLawDetail(item) 함수 호출
    ↓
generateAISummary(item) 함수 실행
    ↓
parseAmendmentText() 함수로 amendments[0].reason 파싱
    ↓
modal 내용 렌더링
```

### 주요 함수 흐름

#### 1. showLawDetail(item) 함수
```javascript
function showLawDetail(item) {
  // 1. 기본 정보 설정
  document.getElementById('modal-law-title').textContent = item.title;
  document.getElementById('modal-law-type').textContent = item.lawType;
  document.getElementById('modal-effective-date').textContent = item.effectiveDate;
  document.getElementById('modal-ministry').textContent = item.ministry;
  
  // 2. 요약 생성
  const summary = generateAISummary(item);
  
  // 3. 모달 표시
  showModal('#lawDetailModal');
}
```

#### 2. generateAISummary(item) 함수
```javascript
function generateAISummary(item) {
  // item.amendments[0].reason에서 개정이유/주요내용 추출
  if (!item.amendments || item.amendments.length === 0) {
    return "개정 정보가 없습니다.";
  }
  
  const rawText = item.amendments[0].reason;
  const parsed = parseAmendmentText(rawText, item);
  
  return {
    type: parsed.type,           // [일부개정], [전부개정] 등
    reason: parsed.reason,       // 개정요지
    contents: parsed.contents,   // 주요개정사항
    changeTable: parsed.changeTable,  // 개정 전/후 비교표
    articles: parsed.articles    // 관련조항
  };
}
```

#### 3. parseAmendmentText(rawText, item) 함수
이 함수가 핵심 파싱 로직을 담당합니다. (상세 설명은 섹션 6 참조)

### 팝업 구성 요소

#### 탭 1: 개정 요약
- **개정유형**: [일부개정], [전부개정], [제정] 등
- **개정이유**: 법령 개정의 목적 ("~하려는 것임." 형식)
- **주요내용**: 개정된 주요 사항 (가.나.다. 항목 또는 절 단위)

#### 탭 2: 변경 사항
- **개정문 전/후 비교표**: 조항별 "A"를 "B"로 한다 형식의 변경사항
- **신설/삭제 조항**: 새로 추가되거나 삭제된 조항 목록

#### 탭 3: 관련 조항
- **현행 조항 텍스트**: 개정과 관련된 법령의 조항 원문

### 팝업 렌더링 예시

```html
<!-- 모달 구조 -->
<div class="modal" id="lawDetailModal">
  <div class="modal-content">
    <h3 id="modal-law-title"></h3>
    
    <div class="tabs">
      <!-- 탭 1: 개정 요약 -->
      <div class="tab-content active">
        <p><strong>개정유형:</strong> <span id="modal-type"></span></p>
        <p><strong>개정이유:</strong> <span id="modal-reason"></span></p>
        <div><strong>주요내용:</strong>
          <ul id="modal-contents"></ul>
        </div>
      </div>
      
      <!-- 탭 2: 변경 사항 -->
      <div class="tab-content">
        <table id="modal-change-table"></table>
      </div>
      
      <!-- 탭 3: 관련 조항 -->
      <div class="tab-content">
        <div id="modal-articles"></div>
      </div>
    </div>
  </div>
</div>
```

---

## 6. 핵심 파싱 함수 설명

이 섹션은 `index.html` 내 가장 복잡한 파싱 로직을 설명합니다. **연도별 업데이트 시 이 함수들은 수정하지 않아야 합니다.**

### 6.1 parseAmendmentText(rawText, item) 함수

**목적**: 국가법령정보센터에서 제공하는 개정이유/주요내용 텍스트를 구조화된 객체로 변환

#### 입력 형식 예시

```
[일부개정] ◇ 개정이유 및 주요내용 ◇ 최저임금 산정 방식 개선으로 근로자 보호 강화 ◇ 주요내용 ◇ 
가. 최저임금 기준을 다음과 같이 개정
나. 근로시간 관련 규정 신설
【개정문】
제15조를 다음과 같이 개정한다.
1항을 삭제하고 2항을 1항으로 한다.
```

#### 함수 로직

```javascript
function parseAmendmentText(rawText, item) {
  if (!rawText) {
    return {
      type: "정보없음",
      reason: "",
      contents: [],
      changeTable: [],
      articles: ""
    };
  }

  // Step 1: 개정유형 추출
  const typeMatch = rawText.match(/\[(일부개정|전부개정|제정|폐지|시행규칙|편집)\]/);
  const type = typeMatch ? typeMatch[1] : "기타";

  // Step 2: ◇/◆ 구분자로 섹션 분리
  // 패턴: ◆...◆ 또는 ◇...◇ 정규화
  let normalized = rawText.replace(/◆(.+?)◆/g, '◇$1◇');
  
  // Step 3: 개정이유 추출
  const reasonMatch = normalized.match(/개정이유(?:\s*및\s*주요내용)?[\s]*◇([^◇]+)/);
  let reason = reasonMatch ? reasonMatch[1].trim() : "";
  
  // "제정이유" 형식도 인식
  if (!reason) {
    const crMatch = normalized.match(/제정이유[\s]*◇([^◇]+)/);
    reason = crMatch ? crMatch[1].trim() : "";
  }

  // Step 4: 주요내용 추출
  let contents = [];
  const contentMatch = normalized.match(/주요내용[\s]*◇([^◇【]+)/);
  if (contentMatch) {
    contents = formatContentItems(contentMatch[1]);
  }

  // Step 5: 개정문 추출
  let changeTable = [];
  let articles = "";
  const amendmentMatch = rawText.match(/【개정문】([\s\S]+?)(?:【|$)/);
  if (amendmentMatch) {
    const amendmentText = amendmentMatch[1];
    changeTable = buildChangeTable(amendmentText);
    articles = amendmentText.slice(0, 500);  // 처음 500자만
  }

  // Step 6: <법제처 제공> 태그 제거
  reason = reason.replace(/<법제처\s*제공>/g, '').trim();

  return {
    type: type,
    reason: reason,
    contents: contents,
    changeTable: changeTable,
    articles: articles
  };
}
```

#### 처리하는 텍스트 패턴

| 패턴 | 예시 | 처리 방법 |
|------|------|---------|
| `[일부개정]` | [일부개정] 규정 개선 | type = "일부개정" |
| `[전부개정]` | [전부개정] 전면 개정 | type = "전부개정" |
| `[제정]` | [제정] 신규 법령 | type = "제정" |
| `◇개정이유 및 주요내용◇` | 섹션 분리 | 정규화 후 추출 |
| `◆...◆` | 장식 패턴 | `◇...◇`로 변환 |
| `【개정문】` | 조항 변경 | buildChangeTable 함수로 처리 |

### 6.2 formatContentItems(contentText) 함수

**목적**: 주요내용 텍스트를 가.나.다... 항목 또는 절 단위로 분리하여 배열 반환

#### 우선순위

1. **가.나.다.라.마... 항목 패턴** (최우선)
2. **절 단위 분리**: ~하도록 하고, ~하며, ~하는 한편 (2차)
3. **extractCoreSentence** (최종 폴백)

#### 함수 로직

```javascript
function formatContentItems(text) {
  if (!text) return [];

  const items = [];
  
  // Step 1: 가.나.다.라... 패턴 우선 분리 (한글 리스트 마커)
  const koreanListPattern = /([가-나-다-라-마-바-사-아-자-차-카-타-파-하]\.\s*[^\n]*(?:\n(?![가-하]\.).*)*)/g;
  const koreanMatches = text.match(koreanListPattern);
  
  if (koreanMatches && koreanMatches.length > 0) {
    // 가.나.다 패턴이 있는 경우
    koreanMatches.forEach(item => {
      let cleaned = item.replace(/^[가-하]\.\s*/, '')  // 마커 제거
                        .trim()
                        .slice(0, 150);  // 최대 150자
      if (cleaned) items.push(cleaned);
    });
  } else {
    // Step 2: 절 단위 분리 패턴
    const clausePatterns = [
      /([^。.!?]+(?:하도록\s+하고|하며|하는\s+한편)[^。.!?]*[。.!?])/g,
      /([^。.!?]+[。.!?])/g  // 폴백: 마침표 기준
    ];
    
    let matched = false;
    for (const pattern of clausePatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        matches.slice(0, 7).forEach(item => {  // 최대 7개 항목
          let cleaned = item.trim().slice(0, 150);
          if (cleaned.length > 20) {  // 최소 길이 20자
            items.push(cleaned);
            matched = true;
          }
        });
        if (matched) break;
      }
    }
  }
  
  // Step 3: 최종 폴백 - extractCoreSentence 사용
  if (items.length === 0) {
    const coreSentence = extractCoreSentence(text);
    if (coreSentence) {
      items.push(coreSentence.slice(0, 200));
    }
  }

  return items.slice(0, 7);  // 최대 7개 항목 반환
}
```

#### 처리 예시

**입력**:
```
가. 최저임금 기준을 다음과 같이 개정한다.
나. 근로시간 관련 규정을 신설한다.
다. 퇴직금 계산 방식을 개선한다.
```

**출력**:
```javascript
[
  "최저임금 기준을 다음과 같이 개정한다.",
  "근로시간 관련 규정을 신설한다.",
  "퇴직금 계산 방식을 개선한다."
]
```

### 6.3 buildChangeTable(amendmentText) 함수

**목적**: 【개정문】 이후의 텍스트에서 조항별 변경사항을 추출하여 비교표 생성

#### 처리하는 변경 패턴

| 패턴 | 예시 | 처리 |
|------|------|------|
| `"A"를 "B"로 한다` | "최저임금"을 "기본급"으로 한다 | 용어 변경 |
| `제X조를 신설한다` | 제15조의2를 신설한다 | 신설 조항 |
| `제X조를 삭제한다` | 제16조를 삭제한다 | 삭제 조항 |
| `X항을 Y항으로 한다` | 1항을 2항으로 한다 | 항목 변경 |
| `가.나.다. 항목 내 변경` | 가. 가목을 신설한다 | 항목 변경 |

#### 함수 로직

```javascript
function buildChangeTable(amendmentText) {
  if (!amendmentText) return [];

  const table = [];
  
  // Pattern 1: "A"를 "B"로 한다 (용어 변경)
  const termPattern = /"([^"]+)"\s*를?\s*"([^"]+)"\s*(?:로|으로)\s*한다/g;
  let match;
  while ((match = termPattern.exec(amendmentText)) !== null) {
    table.push({
      type: "용어변경",
      before: match[1],
      after: match[2]
    });
  }
  
  // Pattern 2: 제X조 신설/삭제
  const articlePattern = /제(\d+(?:조의\d+)?)\s*(?:를)?(?:신설|삭제|폐지)한다/g;
  while ((match = articlePattern.exec(amendmentText)) !== null) {
    table.push({
      type: match[2] || "변경",
      article: "제" + match[1]
    });
  }
  
  // Pattern 3: X항을 Y항으로 한다
  const itemPattern = /(\d+)항\s*을?\s*(\d+)항\s*(?:으)?로\s*한다/g;
  while ((match = itemPattern.exec(amendmentText)) !== null) {
    table.push({
      type: "항목변경",
      before: match[1] + "항",
      after: match[2] + "항"
    });
  }

  return table.slice(0, 10);  // 최대 10개 항목
}
```

#### 처리 예시

**입력**:
```
제15조를 다음과 같이 개정한다.
"최저임금"을 "기본급"으로 한다.
1항을 삭제하고 2항을 1항으로 한다.
제15조의2를 신설한다.
```

**출력**:
```javascript
[
  {
    type: "용어변경",
    before: "최저임금",
    after: "기본급"
  },
  {
    type: "항목변경",
    before: "1항",
    after: "삭제"
  },
  {
    type: "신설",
    article: "제15조의2"
  }
]
```

### 6.4 extractCoreSentence(text) 함수

**목적**: 주요내용이 명확한 마커 없을 때, "~하려는 것임." 패턴에서 핵심 문장 추출

```javascript
function extractCoreSentence(text) {
  // "~하려는 것임." 패턴 찾기 (한국 법령의 표준 형식)
  const corePattern = /([^.!?。]*?(?:하려|하기\s+위해)[^.!?。]*?[것함]\.)/;
  const match = text.match(corePattern);
  
  return match ? match[1].trim() : text.split('\n')[0].slice(0, 200);
}
```

#### 예시

**입력**: 
```
"근로자의 기본적 생활을 보장하고 노동조건을 개선하려는 것임."
```

**출력**:
```
"근로자의 기본적 생활을 보장하고 노동조건을 개선하려는 것임."
```

### 6.5 주의사항 및 트러블슈팅

#### 주의사항
- **정규표현식 수정 금지**: 이 함수들의 정규표현식은 여러 해의 데이터로 검증되었습니다.
- **인코딩**: 한글 처리 시 UTF-8 인코딩이 필수입니다.
- **개행 문자**: `\n` 또는 `\r\n` 모두 처리해야 합니다.

#### 트러블슈팅

| 증상 | 원인 | 해결책 |
|------|------|-------|
| "주요개정사항" 빈 배열 | ◇/◆ 패턴 없음 또는 합쳐진 형식 | 원본 텍스트에서 "주요내용" 키워드 확인 |
| "개정이유" 빈 텍스트 | 파싱 정규표현식 미매칭 | <법제처 제공> 태그 또는 특수문자 확인 |
| 변경사항 테이블 빈 배열 | 【개정문】 섹션 누락 또는 패턴 미매칭 | "~를 ~로 한다" 형식 확인 |

---

## 7. 연도별 업데이트 절차 (2027년, 2028년...)

이 섹션은 매년 반복해야 할 **정확한 체크리스트**입니다. 달력에 기록하고 매년 1월에 수행하세요.

### 7.1 사전 준비 (1월 초)

- [ ] 국가법령정보센터 Open API 인증키 확인 (유효기간 확인)
- [ ] GitHub 접근 권한 확인 (`tjdudfhr/RegRader` write 권한)
- [ ] 로컬 개발 환경 준비 (Node.js, Python 등)
- [ ] 지난해 규정 변경사항 검토 (새로운 카테고리 추가 여부)

### 7.2 Step 1: 국가법령정보센터에서 해당 연도 시행 법률 수집

```bash
# 스크립트 예시 (Python)
import requests
import json
from datetime import datetime

api_key = "YOUR_API_KEY"
year = 2027
start_date = f"{year}-01-01"
end_date = f"{year}-12-31"

# API 호출
url = "https://www.law.go.kr/DRF/lawSearch.do"
params = {
    "OC": api_key,
    "type": "JSON",
    "sort": "date",
    "pSize": 100
}

laws = []
for pIndex in range(1, 11):  # 최대 10 페이지
    params["pIndex"] = pIndex
    response = requests.get(url, params=params)
    data = response.json()
    
    if "search" not in data or not data["search"]:
        break
    
    for item in data["search"]:
        # 시행일자 필터링
        eff_date = item.get("effdt", "")
        if start_date <= eff_date <= end_date:
            laws.append(item)

# 결과 저장
with open(f"collected_{year}.json", "w", encoding="utf-8") as f:
    json.dump(laws, f, ensure_ascii=False, indent=2)
```

**주요 확인 사항**:
- [ ] API 응답 형식이 올바른지 확인
- [ ] 시행일자 범위가 정확한지 검증
- [ ] 중복 항목 제거
- [ ] 테스트 법령 (시범, 안내) 제외

### 7.3 Step 2: 회사 적용법규 목록 검토 및 업데이트

**파일 위치**: `docs/index.html` 내 `lawregistry-content` 탭

```html
<!-- index.html에서 다음 섹션 찾기 -->
<div id="lawregistry-content" class="tab-pane fade">
  <table>
    <thead>
      <tr>
        <th>법규 ID</th>
        <th>법규명</th>
        <th>카테고리</th>
      </tr>
    </thead>
    <tbody>
      <!-- 207개 항목 확인 -->
    </tbody>
  </table>
</div>
```

**검토 항목**:
- [ ] 신규 법규 추가 필요 여부 (회사 업무 확대 등)
- [ ] 폐지된 법규 제거
- [ ] 법규명 변경사항 반영
- [ ] 카테고리 분류 정확성 확인

### 7.4 Step 3: 매칭 작업 수행 → index.json 생성

매칭 스크립트 예시 (Python):

```python
import json
from difflib import SequenceMatcher

# 수집된 법령 로드
with open("collected_2027.json", "r", encoding="utf-8") as f:
    collected_laws = json.load(f)

# 회사 적용법규 로드 (index.html에서 추출)
company_laws = [
    {"id": "law_001", "name": "근로기준법"},
    {"id": "law_002", "name": "산업안전보건법"},
    # ... 207개 항목
]

# 매칭 함수
def match_law(collected_title, company_laws):
    """
    수집된 법령명을 회사 법규와 매칭
    반환: (matched_law_id, matchType)
    """
    
    # 1단계: 완전일치
    for claw in company_laws:
        if collected_title == claw["name"]:
            return claw["id"], "100%완전일치"
    
    # 2단계: 약칭 매칭
    aliases = {
        "근기법": "근로기준법",
        "산안법": "산업안전보건법",
        "개인정보보호법": "개인정보 보호법",
        # ... 추가 약칭
    }
    if collected_title in aliases:
        target = aliases[collected_title]
        for claw in company_laws:
            if claw["name"] == target:
                return claw["id"], "약칭일치"
    
    # 3단계: 부분일치 (포함 관계)
    for claw in company_laws:
        if (claw["name"] in collected_title or 
            collected_title in claw["name"]):
            # 유사도 계산
            ratio = SequenceMatcher(None, collected_title, claw["name"]).ratio()
            if ratio > 0.7:
                return claw["id"], f"부분일치({int(ratio*100)}%)"
    
    return None, "미매칭"

# index.json 생성
index_data = {
    "year": 2027,
    "generatedAt": datetime.now().isoformat(),
    "total": len(collected_laws),
    "items": []
}

for i, law in enumerate(collected_laws):
    matched_id, match_type = match_law(law["title"], company_laws)
    
    item = {
        "id": f"2027{i+1:05d}",
        "title": law["title"],
        "summary": law.get("summary", "")[:200],
        "effectiveDate": law.get("effdt", ""),
        "lawType": law.get("lawtype", "법률"),
        "status": law.get("status", "시행"),
        "ministry": law.get("ministry", ""),
        "categories": classify_category(law["title"]),
        "amendments": [{
            "date": law.get("effdt", ""),
            "reason": law.get("summary", "")
        }],
        "meta": {
            "lsId": law.get("lsId", ""),
            "matchType": match_type,
            "companyLawId": matched_id
        },
        "source": "국가법령정보센터",
        "originalTitle": law["title"]
    }
    
    index_data["items"].append(item)

# JSON 저장
with open("index.json", "w", encoding="utf-8") as f:
    json.dump(index_data, f, ensure_ascii=False, indent=2)
```

**검증 사항**:
- [ ] 총 항목 수가 예상 범위 내 (120~150개)
- [ ] 모든 항목이 시행일자를 가지고 있는지 확인
- [ ] 매칭 유형이 정확한지 샘플 검증 (20개 이상)
- [ ] JSON 형식 유효성 검사

### 7.5 Step 4: quarterly_details.json 분기별 데이터 생성

```python
from collections import defaultdict

# index.json 로드
with open("index.json", "r", encoding="utf-8") as f:
    index_data = json.load(f)

# 분기별 집계
quarterly = {
    "2027-Q1": {"count": 0, "items": []},
    "2027-Q2": {"count": 0, "items": []},
    "2027-Q3": {"count": 0, "items": []},
    "2027-Q4": {"count": 0, "items": []},
}

for item in index_data["items"]:
    month = int(item["effectiveDate"].split("-")[1])
    quarter = (month - 1) // 3 + 1
    quarter_key = f"2027-Q{quarter}"
    
    quarterly[quarter_key]["count"] += 1
    quarterly[quarter_key]["items"].append({
        "title": item["title"],
        "effectiveDate": item["effectiveDate"],
        "matchType": item["meta"]["matchType"]
    })

# 카테고리별 집계
by_category = defaultdict(int)
for item in index_data["items"]:
    for cat in item["categories"]:
        by_category[cat] += 1

# quarterly_details.json 저장
quarterly_data = {
    "year": 2027,
    "by_quarter": quarterly,
    "by_category": dict(by_category)
}

with open("quarterly_details.json", "w", encoding="utf-8") as f:
    json.dump(quarterly_data, f, ensure_ascii=False, indent=2)
```

### 7.6 Step 5: index.html 내 연도 관련 상수 업데이트

**파일**: `docs/index.html`

#### 5-1. 데이터 변수명 변경
```javascript
// 변경 전 (2026년)
const matched2026LawData = {...};

// 변경 후 (2027년)
const matched2027LawData = {...};
```

**찾기 및 바꾸기**:
- `matched2026LawData` → `matched2027LawData`
- `2026` → `2027` (연도 관련 모든 문자열)

#### 5-2. 분기별 수치 업데이트
```javascript
// index.html 내 분기 데이터 섹션
const quarterlyData = {
  "2027-Q1": 32,    // 실제 수치로 업데이트
  "2027-Q2": 28,
  "2027-Q3": 25,
  "2027-Q4": 19
};
```

#### 5-3. 카테고리별 수치 업데이트
```javascript
const categoryData = {
  "재무회계": 18,
  "환경": 12,
  "안전": 15,
  "인사노무": 25,
  "정보보호": 8,
  "지배구조": 10,
  "기타": 16
};
```

**확인 방법**:
```javascript
// index.html 콘솔에서 검증
> quarterlyData["2027-Q1"] + quarterlyData["2027-Q2"] + 
  quarterlyData["2027-Q3"] + quarterlyData["2027-Q4"]
104  // index.json의 total과 일치해야 함
```

### 7.7 Step 6: CACHE_VERSION 업데이트

**위치**: `docs/index.html` 상단의 `<script>` 섹션

```javascript
// 변경 전
const CACHE_VERSION = "2026.03.08.001";

// 변경 후 (업데이트 날짜 + 버전번호)
const CACHE_VERSION = "2027.01.15.001";
```

**버전 번호 규칙**:
- 형식: `YYYY.MM.DD.NNN`
- `YYYY.MM.DD`: 업데이트 실행 날짜
- `NNN`: 해당 날짜 내 버전 번호 (001부터 시작)

**예시**:
- 2027년 1월 15일 첫 업데이트: `2027.01.15.001`
- 같은 날 두 번째 업데이트: `2027.01.15.002`

### 7.8 Step 7: GitHub docs 폴더에 업로드

```bash
# 1. 파일 복사
cp index.json docs/
cp quarterly_details.json docs/

# 2. index.html도 수정 사항 반영
# (Step 5에서 수정 완료)

# 3. Git 커밋 및 푸시
cd /path/to/RegRader
git add docs/index.json docs/quarterly_details.json docs/index.html
git commit -m "Update law data for 2027: 134 laws (32 Q1, 28 Q2, 25 Q3, 19 Q4)"
git push origin main

# 또는 직접 GitHub 웹에서 파일 업로드
# https://github.com/tjdudfhr/RegRader/upload/main/docs/
```

**커밋 메시지 형식**:
```
Update law data for {YEAR}: {TOTAL} laws ({Q1} Q1, {Q2} Q2, {Q3} Q3, {Q4} Q4)
```

### 7.9 Step 8: 브라우저 캐시 확인 및 Hard Refresh

배포 후 반드시 수행:

1. **Hard Refresh 수행**
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

2. **개발자 도구에서 확인**
   ```javascript
   // 콘솔에서 실행
   > CACHE_VERSION
   "2027.01.15.001"
   
   > matched2027LawData.total
   134
   ```

3. **UI에서 확인**
   - 우측 상단에 연도가 "2027"으로 표시되어야 함
   - 분기별 통계가 새로운 수치로 표시되어야 함

### 7.10 완료 체크리스트

연도별 업데이트 완료 후 최종 확인:

- [ ] index.json: 파일 존재, 유효한 JSON 형식
- [ ] quarterly_details.json: 파일 존재, 분기별 합계 = index.json의 total
- [ ] index.html: CACHE_VERSION 업데이트됨
- [ ] index.html: matched{YEAR}LawData 변수명 일치
- [ ] GitHub에 파일 업로드 완료
- [ ] GitHub Actions 빌드 성공 확인
- [ ] 라이브 웹사이트에서 새로운 데이터 확인 (5-10분 대기)
- [ ] 브라우저에서 hard refresh 후 올바른 연도 표시 확인

---

## 8. 캐시 관리

### 캐시 전략의 필요성

RegRader는 GitHub Pages의 정적 호스팅 서비스를 사용합니다. 웹 브라우저의 기본 캐싱으로 인해 파일 업데이트 후에도 이전 버전이 표시될 수 있습니다. 이를 방지하기 위해 여러 계층의 캐시 관리 전략을 적용합니다.

### 8.1 HTTP 메타 태그 캐시 제어

**파일**: `docs/index.html` `<head>` 섹션

```html
<!-- 브라우저 캐시 비활성화 -->
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
```

**작동 원리**:
- `no-cache`: 캐시된 버전을 사용하지 말고 서버에 확인
- `no-store`: 응답을 캐시에 저장하지 않음
- `must-revalidate`: 캐시가 만료되면 반드시 재검증

### 8.2 JavaScript 버전 관리 (CACHE_VERSION)

**목적**: JSON 파일 로드 시 캐시 무효화

```javascript
// Step 1: 상수 정의
const CACHE_VERSION = "2027.01.15.001";

// Step 2: 캐시 버스팅 URL에 적용
async function loadLawData() {
  const response = await fetch(`/RegRader/index.json?v=${CACHE_VERSION}`);
  const data = await response.json();
  return data;
}

// Step 3: Service Worker 캐시 버전 비교
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(registration => {
    const currentVersion = localStorage.getItem('appVersion');
    
    if (currentVersion !== CACHE_VERSION) {
      // 버전 변경 시 모든 캐시 삭제
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName);
        });
      });
      
      localStorage.setItem('appVersion', CACHE_VERSION);
    }
  });
}
```

**버전 형식**: `YYYY.MM.DD.NNN`
- 변경될 때마다 새로운 버전 적용
- 이전 버전과 중복되지 않도록 주의

### 8.3 Service Worker 캐시 무효화

Service Worker가 설정되어 있는 경우, 다음과 같이 캐시를 제어합니다:

```javascript
// Service Worker 등록 시 강제 업데이트
navigator.serviceWorker.register('/RegRader/sw.js', { updateViaCache: 'none' });

// 페이지 로드 시 Service Worker 업데이트 확인
navigator.serviceWorker.ready.then(registration => {
  // 1시간마다 업데이트 확인
  setInterval(() => {
    registration.update();
  }, 3600000);
});
```

### 8.4 localStorage 버전 비교

**목적**: 클라이언트 측에서 캐시된 데이터 버전 추적

```javascript
function checkCacheValidity() {
  const storedVersion = localStorage.getItem('regRaderVersion');
  const currentVersion = CACHE_VERSION;
  
  if (storedVersion !== currentVersion) {
    console.log(`Cache invalidated: ${storedVersion} → ${currentVersion}`);
    
    // 캐시된 데이터 삭제
    localStorage.removeItem('lawDataCache');
    localStorage.removeItem('quarterlyDataCache');
    
    // 새 버전으로 업데이트
    localStorage.setItem('regRaderVersion', currentVersion);
    
    return false;  // 캐시 무효
  }
  
  return true;  // 캐시 유효
}
```

### 8.5 Hard Refresh 방법

최종 사용자가 캐시를 완전히 무효화하는 방법:

| OS | 브라우저 | 단축키 |
|-----|---------|-------|
| Windows/Linux | Chrome/Edge/Firefox | `Ctrl + Shift + R` |
| Mac | Chrome/Edge/Firefox | `Cmd + Shift + R` |
| iOS Safari | Safari | 설정 > Safari > 방문 기록 및 웹사이트 데이터 지우기 |
| Android | Chrome | 설정 > 앱 및 알림 > Chrome > 저장소 > 캐시 삭제 |

### 8.6 캐시 관리 모니터링

개발자 도구에서 캐시 상태 확인:

```javascript
// 콘솔에서 실행
// 1. 현재 버전 확인
console.log("Current CACHE_VERSION:", CACHE_VERSION);

// 2. localStorage 확인
console.log("Stored version:", localStorage.getItem('regRaderVersion'));

// 3. Service Worker 캐시 확인
caches.keys().then(names => {
  console.log("Cache names:", names);
  names.forEach(name => {
    caches.open(name).then(cache => {
      cache.keys().then(requests => {
        console.log(`Cache "${name}":`, requests.map(r => r.url));
      });
    });
  });
});
```

---

## 9. 새로고침 버튼 기능

### 목적

RegRader 우측 상단의 **새로고침 버튼** (🔄)은 단순한 페이지 새로고침이 아니라, 캐시를 완전히 삭제하고 최신 데이터를 강제로 로드하는 기능입니다.

### 버튼 위치

```html
<!-- index.html 헤더 영역 -->
<div class="header">
  <h1>RegRader</h1>
  <button id="refreshBtn" class="refresh-button" title="캐시 삭제 및 데이터 새로고침">
    🔄 새로고침
  </button>
</div>
```

### 함수: triggerDataUpdate()

```javascript
async function triggerDataUpdate() {
  console.log("Starting data update...");
  
  // Step 1: 캐시 클리어
  if ('caches' in window) {
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        caches.delete(cacheName).then(() => {
          console.log(`Cache deleted: ${cacheName}`);
        });
      });
    });
  }
  
  // Step 2: localStorage 클리어
  localStorage.removeItem('lawDataCache');
  localStorage.removeItem('quarterlyDataCache');
  localStorage.removeItem('regRaderVersion');
  
  // Step 3: Service Worker 언레지스터 (필요시)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        registration.unregister();
      });
    });
  }
  
  // Step 4: index.json 재로드 (버전 매개변수 포함)
  const cacheVersion = CACHE_VERSION;
  const timestamp = new Date().getTime();
  const url = `/RegRader/index.json?v=${cacheVersion}&t=${timestamp}`;
  
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Step 5: 데이터 파싱
    processLawData(data);
    
    // Step 6: UI 갱신
    updateUI(data);
    
    // Step 7: 성공 메시지
    showNotification("데이터가 성공적으로 업데이트되었습니다.", "success");
    console.log("Data update completed successfully");
    
  } catch (error) {
    console.error("Data update failed:", error);
    showNotification("데이터 업데이트에 실패했습니다. 잠시 후 다시 시도하세요.", "error");
  }
}

// 새로고침 버튼 이벤트 리스너
document.getElementById('refreshBtn').addEventListener('click', triggerDataUpdate);
```

### 동작 흐름도

```
사용자 클릭 (🔄 새로고침)
    ↓
triggerDataUpdate() 호출
    ↓
┌─→ caches.keys() 모든 캐시 삭제
│   ↓
│   다음 캐시 삭제 확인
│
├─→ localStorage에서 캐시된 데이터 삭제
│   ↓
│   lawDataCache, quarterlyDataCache 제거
│
├─→ Service Worker 언레지스터 (필수)
│   ↓
│   이전 Service Worker 정지
│
├─→ index.json 재로드 (캐시 무효화 매개변수 포함)
│   URL: /RegRader/index.json?v=2027.01.15.001&t=1705318245000
│   ↓
│   응답 확인 (HTTP 200)
│
├─→ JSON 파싱 및 데이터 처리
│   ↓
│   parseAmendmentText() 함수들 실행
│
├─→ UI 업데이트
│   ↓
│   대시보드 차트, 테이블 갱신
│
└─→ 성공 알림 메시지 표시
    ↓
    "데이터가 성공적으로 업데이트되었습니다."
```

### 주의사항

1. **네트워크 지연**: 업데이트 중에는 사용자에게 로딩 표시 제공
2. **에러 처리**: 업데이트 실패 시 이전 데이터 유지
3. **연속 클릭 방지**: 업데이트 중 버튼 비활성화
4. **타임스탬프**: 캐시 무효화를 위해 `&t={timestamp}` 추가

### 사용 예시

```javascript
// 새로고침 버튼을 클릭했을 때의 사용자 경험

// 1. 버튼 클릭 직후: "업데이트 중..." 표시
document.getElementById('refreshBtn').disabled = true;
document.getElementById('refreshBtn').textContent = "⏳ 업데이트 중...";

// 2. 3-5초 후: 데이터 로드 완료
document.getElementById('refreshBtn').disabled = false;
document.getElementById('refreshBtn').textContent = "🔄 새로고침";

// 3. 토스트 메시지: "데이터가 업데이트되었습니다"
```

---

## 10. 트러블슈팅

### 문제 1: 데이터가 표시되지 않음

#### 증상
- 웹사이트에 접속했을 때 대시보드가 비어있거나 "데이터 로드 중" 상태 유지

#### 진단 방법

```javascript
// 브라우저 개발자 도구(F12) > 콘솔에서 실행

// 1. 데이터 로드 확인
> lawData
undefined  // ← 문제! lawData가 로드되지 않음

// 2. 네트워크 요청 확인
// Network 탭 > index.json 클릭
// Status: 404 → 파일이 없음
// Status: 200 but empty → 파일이 비어있음

// 3. 콘솔 에러 확인
// Console 탭에서 에러 메시지 확인
```

#### 해결 방법

| 상황 | 원인 | 해결책 |
|------|------|-------|
| Status 404 | `index.json` 파일이 없음 | docs 폴더에 파일이 있는지 확인 |
| Status 200 but 데이터 없음 | JSON 파일이 비어있음 | JSON 파일 내용 확인, 재생성 |
| 파싱 에러 (콘솔 오류) | JSON 형식이 올바르지 않음 | `python3 -m json.tool index.json` 검증 |
| 캐시 문제 | 오래된 버전 캐시 | Hard Refresh (`Ctrl+Shift+R`) |

#### 상세 해결 절차

```bash
# 1. GitHub에 파일이 제대로 업로드되었는지 확인
# https://github.com/tjdudfhr/RegRader/tree/main/docs

# 2. 파일 내용 확인 (웹에서)
# 또는 로컬에서
cat docs/index.json | head -20

# 3. JSON 유효성 검사
python3 -m json.tool docs/index.json > /dev/null
echo $?  # 0이면 유효, 1이면 오류

# 4. GitHub Pages 배포 상태 확인
# https://github.com/tjdudfhr/RegRader/deployments
# 최신 배포의 상태가 "Success"인지 확인

# 5. 캐시 삭제 및 재로드
# Hard Refresh: Ctrl+Shift+R (Windows/Linux) 또는 Cmd+Shift+R (Mac)
```

### 문제 2: 팝업 내용이 비어있음

#### 증상
- 법령을 클릭했을 때 모달이 열리지만 "개정이유", "주요내용" 등이 표시되지 않음

#### 진단 방법

```javascript
// 개발자 도구 콘솔에서 실행

// 1. 해당 항목의 데이터 확인
> lawData.items[0]
{
  id: "202701001",
  title: "근로기준법",
  amendments: [{...}],
  ...
}

// 2. amendments 데이터 확인
> lawData.items[0].amendments[0].reason
""  // ← 빈 문자열!

// 3. 파싱 함수 테스트
> parseAmendmentText(lawData.items[0].amendments[0].reason, lawData.items[0])
{type: "", reason: "", contents: [], ...}  // ← 모두 비어있음
```

#### 해결 방법

| 상황 | 원인 | 해결책 |
|------|------|-------|
| amendments[0].reason 빈 문자열 | index.json의 데이터가 비어있음 | 데이터 수집/생성 단계 재검토 |
| reason에 ◇/◆ 없음 | 국가법령정보센터 API 형식 변경 | parseAmendmentText 함수 로직 검토 |
| 파싱 결과가 비어있음 | 정규표현식 미매칭 | 원본 텍스트 형식 확인 및 로직 수정 |

#### 상세 해결 절차

```python
# 1. index.json에서 해당 항목 확인
import json

with open("docs/index.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# 첫 번째 항목의 amendments 확인
item = data["items"][0]
print("Title:", item["title"])
print("Reason:", repr(item["amendments"][0]["reason"]))

# 2. 텍스트 패턴 확인
reason = item["amendments"][0]["reason"]
print("Has '◇':", "◇" in reason)
print("Has '【개정문】':", "【개정문】" in reason)
print("Has '개정이유':", "개정이유" in reason)

# 3. 비정상 항목 필터링
for item in data["items"]:
    if not item["amendments"] or not item["amendments"][0]["reason"]:
        print(f"Empty reason: {item['title']}")
```

**원본 텍스트 형식 확인 예시**:
```
정상: [일부개정] ◇ 개정이유 및 주요내용 ◇ ... 【개정문】 ...
비정상: [일부개정] 개정내용... (◇ 없음)
비정상: (아무 내용 없음)
```

### 문제 3: "주요개정사항" 누락

#### 증상
- 팝업에서 "개정이유"는 표시되지만 "주요내용" 섹션이 비어있음

#### 원인 분석

```javascript
// formatContentItems 함수의 처리 과정
const contentText = "...";  // 추출된 텍스트

// 1단계: 가.나.다 패턴 탐색
const koreanListPattern = /[가-나-다-라-마-바-사-아-자-차-카-타-파-하]\.\s*/g;
const hasKoreanList = contentText.match(koreanListPattern);
console.log("Has Korean list:", hasKoreanList);  // null이면 패턴 없음

// 2단계: 절 단위 분리 패턴
const clausePattern = /([^.!?]+(?:하도록\s+하고|하며|하는\s+한편))/g;
const hasClause = contentText.match(clausePattern);
console.log("Has clause:", hasClause);  // null이면 절도 없음
```

#### 해결 방법

| 확인 사항 | 가능한 원인 | 해결책 |
|---------|----------|------|
| ◇/◆ 구분자 없음 | API 응답 형식 변경 | 원본 텍스트 형식 확인 |
| "주요내용" 키워드 없음 | 합쳐진 형식 ("개정이유 및 주요내용") | parseAmendmentText 로직 검토 |
| 가.나.다 패턴 없음 | 절 단위 텍스트 | formatContentItems의 절 분리 패턴 확인 |
| 모두 비어있음 | 개정문만 있고 요약 없음 | 원본 데이터에서 요약 정보 추출 |

**디버깅 코드**:
```javascript
// 특정 항목의 파싱 결과 확인
const testItem = lawData.items.find(i => i.title === "근로기준법");
const rawText = testItem.amendments[0].reason;

console.log("=== Raw Text ===");
console.log(rawText);

console.log("=== Parsed Result ===");
const parsed = parseAmendmentText(rawText, testItem);
console.log(parsed);

console.log("=== Contents ===");
parsed.contents.forEach((c, i) => {
  console.log(`${i}: ${c}`);
});
```

### 문제 4: GitHub Pages 배포 지연

#### 증상
- 파일을 업로드했지만 웹사이트에 반영되지 않음

#### 진단 방법

```bash
# 1. GitHub Actions 빌드 상태 확인
# https://github.com/tjdudfhr/RegRader/actions

# 2. 최신 배포 확인
# https://github.com/tjdudfhr/RegRader/deployments

# 3. 명령줄에서 Git 상태 확인
cd /path/to/RegRader
git status
git log --oneline -5
```

#### 해결 방법

| 상황 | 원인 | 해결책 |
|------|------|-------|
| Actions에 "Pending" | 빌드 대기 중 | 5-10분 대기 |
| Actions에 "Failed" | 빌드 오류 | Actions 탭에서 오류 메시지 확인 |
| Deployments에 "Inactive" | GitHub Pages 설정 오류 | Settings > Pages에서 "Deploy from a branch" 확인 |
| 파일이 최신이 아님 | 푸시 실패 | `git push` 다시 실행, 인증 확인 |

**GitHub Pages 설정 확인**:
```
https://github.com/tjdudfhr/RegRader/settings/pages

확인 항목:
- Source: Deploy from a branch (또는 GitHub Actions)
- Branch: main /docs
- Status: "Your site is live at https://tjdudfhr.github.io/RegRader/"
```

#### 강제 재배포

```bash
# 1. 이전 커밋 추가 (트리거용)
echo "# Updated on $(date)" >> README.md

# 2. 스테이징 및 커밋
git add README.md
git commit -m "Trigger GitHub Pages rebuild"
git push origin main

# 3. GitHub Actions 탭에서 빌드 진행상황 모니터링
# https://github.com/tjdudfhr/RegRader/actions
```

### 문제 5: 매칭 데이터가 잘못됨

#### 증상
- 특정 법령이 회사 적용법규로 인식되지 않거나 잘못된 카테고리로 분류됨

#### 진단 방법

```javascript
// 개발자 도구 콘솔에서 실행

// 1. 해당 법령 검색
> const item = lawData.items.find(i => i.title.includes("근로"));
> item
{
  title: "근로기준법",
  meta: {
    matchType: "100%완전일치",
    companyLawId: "law_001"
  },
  categories: ["인사노무"]
}

// 2. 매칭 상태 확인
> item.meta.matchType
"100%완전일치"  // ← 정상

// 3. 카테고리 확인
> item.categories
["인사노무"]  // ← 정상

// 4. 회사 법규 목록에서 확인
> companyLaws.find(l => l.id === "law_001")
```

#### 해결 방법

**Step 1: index.html의 회사 법규 목록 확인**
```html
<!-- index.html lawregistry-content 탭 -->
<tbody>
  <tr>
    <td>law_001</td>
    <td>근로기준법</td>
    <td>인사노무</td>
  </tr>
</tbody>
```

**Step 2: 매칭 로직 재검토**
```python
# match_law 함수에서 문제 발생 여부 확인
def test_matching():
    collected_title = "근로기준법"
    
    # 정확한 일치 확인
    for law in company_laws:
        if law["name"] == collected_title:
            print(f"Matched: {law}")
```

**Step 3: 카테고리 분류 확인**
```python
def classify_category(title):
    category_map = {
        "근로기준법": ["인사노무"],
        "산업안전보건법": ["안전"],
        # ...
    }
    return category_map.get(title, ["기타"])
```

---

## 부록: 자주 묻는 질문 (FAQ)

### Q1: 새로운 법규를 추가하려면?
A: index.html의 `lawregistry-content` 테이블에 행을 추가하고, 다음 연도 업데이트 시 매칭 작업에 포함시킵니다. 즉시 반영이 필요하면 Step 7.3 ~ 7.8을 수행합니다.

### Q2: 특정 법령을 숨기려면?
A: index.json에서 해당 항목을 삭제하거나 "status"를 "폐지"로 변경합니다.

### Q3: 카테고리를 추가할 수 있나?
A: 가능하지만, index.html의 모든 참조 (UI, 차트, 필터)를 업데이트해야 합니다. 기존 7개 카테고리 사용을 권장합니다.

### Q4: 국가법령정보센터 API가 변경되면?
A: parseAmendmentText 등 파싱 함수를 수정합니다. 새로운 텍스트 형식이 있으면 정규표현식을 추가하고 이 매뉴얼을 업데이트합니다.

### Q5: 매년 수동으로 수집해야 하나?
A: 예. 자동화는 별도 프로젝트로 진행할 수 있습니다 (예: GitHub Actions 스케줄).

### Q6: 백업은 어떻게 하나?
A: GitHub에 모든 파일이 저장됩니다. 로컬에도 `git clone` 또는 `git pull`로 복사본을 유지하세요.

### Q7: 다른 사람과 협업할 때 주의사항?
A: Pull Request를 통해 변경사항을 검토한 후 병합합니다. 동일 파일 동시 편집을 피하세요.

---

## 결론

RegRader는 정성적인 법규 모니터링 도구로서, 매년 체계적인 업데이트를 통해 그 가치를 유지합니다. 이 매뉴얼의 7단계 절차를 따르면 누구든 효율적으로 시스템을 관리할 수 있습니다.

**핵심 원칙**:
- 데이터는 국가법령정보센터에서만 수집
- 파싱 함수는 수정하지 않기
- 연도별 상수만 업데이트
- 매해 1월 초에 업데이트 실행

질문이나 문제가 발생하면 섹션 10 (트러블슈팅)을 참조하거나, GitHub Issues에 보고해주세요.

**마지막 업데이트**: 2026년 3월 8일

