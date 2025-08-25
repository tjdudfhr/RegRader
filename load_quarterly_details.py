#!/usr/bin/env python3
"""
분기별 상세 정보를 웹사이트에서 로드할 수 있도록 JSON 파일 생성
각 분기별로 실제 시행되는 법령 목록과 상세 정보 제공
"""

import json
from datetime import datetime

def create_quarterly_details():
    """분기별 상세 정보 JSON 파일 생성"""
    
    # 매칭된 법령 데이터 로드
    with open('docs/exact_matched_2025_laws.json', 'r', encoding='utf-8') as f:
        matched_data = json.load(f)
    
    # 분기별 상세 정보 구조 생성
    quarterly_details = {
        "generated_at": datetime.now().isoformat(),
        "description": "2025년 분기별 법령 시행 상세 정보",
        "total_matched": matched_data['matching_summary']['total_matched'],
        "quarters": {
            "Q1": {
                "period": "1월 ~ 3월",
                "count": 0,
                "laws": []
            },
            "Q2": {
                "period": "4월 ~ 6월", 
                "count": 0,
                "laws": []
            },
            "Q3": {
                "period": "7월 ~ 9월",
                "count": 0,
                "laws": []
            },
            "Q4": {
                "period": "10월 ~ 12월",
                "count": 0,
                "laws": []
            }
        }
    }
    
    # 매칭된 법령들을 분기별로 분류
    for law in matched_data['matched_laws']:
        quarter = law['quarter']
        
        law_detail = {
            "title": law['title'],
            "categories": law['categories'],
            "effective_date": law['government_info']['effective_date'],
            "law_type": law['government_info']['law_type'],
            "ministry": law['government_info']['ministry'],
            "detail_url": law['government_info']['detail_url'],
            "search_url": law['government_info']['search_url']
        }
        
        quarterly_details['quarters'][quarter]['laws'].append(law_detail)
        quarterly_details['quarters'][quarter]['count'] += 1
    
    # 각 분기별로 시행일 순으로 정렬
    for quarter in quarterly_details['quarters']:
        quarterly_details['quarters'][quarter]['laws'].sort(
            key=lambda x: x['effective_date']
        )
    
    # 파일 저장
    with open('docs/quarterly_details.json', 'w', encoding='utf-8') as f:
        json.dump(quarterly_details, f, ensure_ascii=False, indent=2)
    
    print("📅 분기별 상세 정보 생성 완료:")
    for quarter, data in quarterly_details['quarters'].items():
        print(f"   - {quarter} ({data['period']}): {data['count']}개")
    
    return 'docs/quarterly_details.json'

if __name__ == "__main__":
    create_quarterly_details()