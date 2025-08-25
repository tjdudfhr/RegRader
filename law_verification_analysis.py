#!/usr/bin/env python3
"""
2025년 법령 시행일자 검증 스크립트
현재 크롤링된 데이터의 시행일자를 검증하고 올바른 분기로 재분류
"""

import json
import requests
from datetime import datetime
import time

def load_quarterly_data():
    """현재 분기별 데이터 로드"""
    with open('docs/quarterly_details.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def analyze_suspicious_dates(data):
    """의심스러운 시행일자 패턴 분석"""
    suspicious_laws = []
    
    for quarter, info in data['quarters'].items():
        for law in info['laws']:
            title = law['title']
            date = law['effective_date']
            ministry = law.get('ministry', '')
            
            # 의심스러운 패턴들
            suspicious_patterns = [
                # 같은 날짜에 너무 많은 법령이 시행되는 경우
                (date, '10-02'),  # 개인정보보호법이 10월 2일로 잘못 분류된 케이스
                # 부처별로 동일한 날짜가 반복되는 경우
                # 일반적이지 않은 개정 시기 (예: 주말, 공휴일 등)
            ]
            
            # 개인정보보호법 특별 검증
            if '개인정보' in title and date == '2025-10-02':
                suspicious_laws.append({
                    'title': title,
                    'current_date': date,
                    'current_quarter': quarter,
                    'ministry': ministry,
                    'issue': '개인정보보호법은 3월 13일 시행으로 알려져 있음 (Q1)',
                    'suggested_date': '2025-03-13',
                    'suggested_quarter': 'Q1'
                })
            
            # 동일한 부처에서 같은 날 여러 법령 시행 체크
            same_day_count = sum(1 for other_law in info['laws'] 
                               if other_law['effective_date'] == date and 
                                  other_law.get('ministry') == ministry)
            
            if same_day_count > 3:  # 같은 부처에서 같은 날 3개 이상
                suspicious_laws.append({
                    'title': title,
                    'current_date': date,
                    'current_quarter': quarter,
                    'ministry': ministry,
                    'issue': f'같은 부처({ministry})에서 같은 날({date}) {same_day_count}개 법령 시행',
                    'suggested_action': '개별 검증 필요'
                })
    
    return suspicious_laws

def search_law_verification(law_title):
    """특정 법령의 정확한 시행일자 검색"""
    print(f"🔍 {law_title} 검증 중...")
    
    # 국가법령정보센터 검색 URL 생성
    import urllib.parse
    encoded_title = urllib.parse.quote(law_title)
    search_url = f"https://www.law.go.kr/lsSc.do?query={encoded_title}"
    
    return {
        'title': law_title,
        'search_url': search_url,
        'verification_needed': True
    }

def generate_verification_report():
    """검증 보고서 생성"""
    data = load_quarterly_data()
    suspicious = analyze_suspicious_dates(data)
    
    report = {
        'verification_date': datetime.now().isoformat(),
        'total_laws': data['total_matched'],
        'suspicious_count': len(suspicious),
        'suspicious_laws': suspicious,
        'verification_priority': []
    }
    
    # 우선순위별 검증 목록
    high_priority = [law for law in suspicious if '개인정보' in law['title']]
    medium_priority = [law for law in suspicious if law.get('issue', '').startswith('같은 부처')]
    
    report['verification_priority'] = {
        'high': high_priority,
        'medium': medium_priority
    }
    
    return report

def main():
    print("🚀 2025년 법령 시행일자 검증 시작...")
    
    # 검증 보고서 생성
    report = generate_verification_report()
    
    # 결과 출력
    print(f"\n📊 검증 결과:")
    print(f"   총 법령 수: {report['total_laws']}개")
    print(f"   의심 법령 수: {report['suspicious_count']}개")
    
    if report['verification_priority']['high']:
        print(f"\n🚨 고우선순위 검증 필요:")
        for law in report['verification_priority']['high']:
            print(f"   - {law['title']}")
            print(f"     현재: {law['current_date']} ({law['current_quarter']})")
            print(f"     문제: {law['issue']}")
            if 'suggested_date' in law:
                print(f"     제안: {law['suggested_date']} ({law['suggested_quarter']})")
            print()
    
    # 보고서 저장
    with open('docs/law_verification_report.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    print("✅ 검증 보고서가 docs/law_verification_report.json에 저장되었습니다.")
    
    return report

if __name__ == "__main__":
    main()