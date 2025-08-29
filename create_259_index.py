import pandas as pd
import json
import hashlib
from datetime import datetime

# 259개 매칭 데이터 읽기
df = pd.read_excel('100%매칭결과_20250828_083842.xlsx')

# 새로운 index.json 구조 생성
category_counts = df['직무카테고리'].value_counts()
data = {
    "generatedAt": int(datetime.now().timestamp()),
    "year": 2025,
    "description": "2025년 당사 적용 법규 259개 매칭 결과",
    "total_laws": len(df),
    "category_counts": {str(k): int(v) for k, v in category_counts.items()},
    "items": []
}

# 각 법령을 items에 추가
for idx, row in df.iterrows():
    # 고유 ID 생성
    law_id = hashlib.md5(f"{row['당사법령명']}_{row['수집시행일자']}".encode()).hexdigest()
    
    # 시행일자 처리
    effective_date = ""
    if pd.notna(row['수집시행일자']):
        date_str = str(row['수집시행일자'])
        if len(date_str) == 8:  # YYYYMMDD 형식
            effective_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
        else:
            effective_date = date_str
    
    item = {
        "id": law_id,
        "title": str(row['수집법령명']) if pd.notna(row['수집법령명']) else "",
        "summary": "",
        "effectiveDate": effective_date,
        "lawType": str(row['법령종류']) if pd.notna(row['법령종류']) else "",
        "status": str(row['법령상태']) if pd.notna(row['법령상태']) else "",
        "ministry": str(row['소관부처']) if pd.notna(row['소관부처']) else "",
        "categories": [str(row['직무카테고리'])] if pd.notna(row['직무카테고리']) else [],
        "amendments": [],
        "source": str(row['수집소스']) if pd.notna(row['수집소스']) else "",
        "originalTitle": str(row['당사법령명']) if pd.notna(row['당사법령명']) else ""
    }
    
    data["items"].append(item)

# 기존 파일 백업
import shutil
shutil.copy('docs/index.json', 'docs/index_207_backup.json')

# 새 파일 저장
with open('docs/index.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"✅ 259개 법령 데이터로 index.json 업데이트 완료")
print(f"\n직무별 분포:")
for cat, count in data["category_counts"].items():
    print(f"  {cat}: {count}개")
print(f"\n총 법령 수: {data['total_laws']}개")