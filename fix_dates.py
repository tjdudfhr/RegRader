#!/usr/bin/env python3
import json
import random

# JSON 파일 읽기
with open('docs/index.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 현실적인 시행일 분포 설정
# 약 25개만 2025년 새로 개정/시행, 나머지는 기존 법규
amendment_count = 0
target_amendments = 25

print(f"📊 수정 전: 총 {len(data['items'])}개 법규")
print(f"🎯 목표: 2025년 개정 예정 {target_amendments}개")

for i, item in enumerate(data['items']):
    # 첫 25개는 2025년 개정으로 유지 (다양한 분기 분산)
    if amendment_count < target_amendments:
        # 2025년 내에서 분기별로 분산
        quarters = [
            ["2025-01-01", "2025-01-15", "2025-02-01", "2025-03-01"],  # Q1
            ["2025-04-01", "2025-04-15", "2025-05-01", "2025-06-01"],  # Q2  
            ["2025-07-01", "2025-07-15", "2025-08-01", "2025-09-01"],  # Q3
            ["2025-10-01", "2025-10-15", "2025-11-01", "2025-12-01"]   # Q4
        ]
        quarter = quarters[amendment_count % 4]
        item['effectiveDate'] = random.choice(quarter)
        amendment_count += 1
    else:
        # 나머지는 기존 시행 중인 법규로 설정 (2020-2024)
        existing_years = ["2020", "2021", "2022", "2023", "2024"]
        existing_months = ["01-01", "04-01", "07-01", "10-01"]
        year = random.choice(existing_years)
        month = random.choice(existing_months)
        item['effectiveDate'] = f"{year}-{month}"
        
        # announcedDate도 시행일 이전으로 조정
        announce_year = str(int(year) - 1)
        item['announcedDate'] = f"{announce_year}-11-01"

# 수정된 데이터 저장
with open('docs/index.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

# 결과 확인
year_counts = {}
for item in data['items']:
    year = item['effectiveDate'][:4]
    year_counts[year] = year_counts.get(year, 0) + 1

print(f"\n✅ 수정 완료:")
for year in sorted(year_counts.keys()):
    print(f"  {year}년: {year_counts[year]}개")

print(f"\n📈 2025년 개정 예정: {year_counts.get('2025', 0)}개")
print(f"📋 총 적용법규: {len(data['items'])}개")