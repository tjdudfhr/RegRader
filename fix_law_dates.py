#!/usr/bin/env python3
"""
법령 시행일자 수정 스크립트
검증된 정확한 시행일자로 quarterly_details.json 업데이트
"""

import json
from datetime import datetime

def fix_law_dates():
    """검증된 법령 시행일자 수정"""
    
    # 현재 데이터 로드
    with open('docs/quarterly_details.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 수정할 법령들과 올바른 시행일자
    corrections = {
        # 개인정보보호법 - Q4에서 Q1으로 이동
        '개인정보 보호법': {
            'from_quarter': 'Q4',
            'to_quarter': 'Q1', 
            'correct_date': '2025-03-13',
            'reason': '개인정보보호법 3차 개정안은 2025년 3월 13일 시행'
        }
    }
    
    moved_laws = []
    
    # 개인정보보호법 이동
    for quarter_key, quarter_data in data['quarters'].items():
        laws_to_remove = []
        
        for i, law in enumerate(quarter_data['laws']):
            if law['title'] in corrections:
                correction = corrections[law['title']]
                
                if quarter_key == correction['from_quarter']:
                    # 올바른 시행일자로 수정
                    law['effective_date'] = correction['correct_date']
                    moved_laws.append((law.copy(), correction['to_quarter']))
                    laws_to_remove.append(i)
                    print(f"✅ {law['title']}: {correction['from_quarter']} → {correction['to_quarter']}")
                    print(f"   시행일자 수정: {correction['correct_date']}")
        
        # 원래 분기에서 제거
        for i in reversed(laws_to_remove):
            quarter_data['laws'].pop(i)
            quarter_data['count'] -= 1
    
    # 올바른 분기에 추가
    for law, target_quarter in moved_laws:
        data['quarters'][target_quarter]['laws'].append(law)
        data['quarters'][target_quarter]['count'] += 1
    
    # 개인정보보호법 시행령도 확인 필요 (7월 1일 시행)
    # 이미 Q3에 있는지 확인
    pipc_enforcement_found = False
    for quarter_key, quarter_data in data['quarters'].items():
        for law in quarter_data['laws']:
            if '개인정보' in law['title'] and '시행령' in law['title']:
                if law['effective_date'] == '2025-07-01' and quarter_key == 'Q3':
                    pipc_enforcement_found = True
                    print(f"✅ {law['title']}: 이미 올바른 분기(Q3)에 위치")
                elif law['effective_date'] != '2025-07-01' or quarter_key != 'Q3':
                    print(f"⚠️ {law['title']}: 시행일자 또는 분기 확인 필요")
    
    if not pipc_enforcement_found:
        print("⚠️ 개인정보보호법 시행령(2025-07-01, Q3)이 데이터에 없습니다.")
    
    # 총계 업데이트
    total_laws = sum(quarter['count'] for quarter in data['quarters'].values())
    data['total_matched'] = total_laws
    
    # 업데이트 정보 추가
    data['last_verified'] = datetime.now().isoformat()
    data['verification_notes'] = [
        "개인정보보호법: Q4→Q1 이동 (2025-03-13 시행)",
        "환경부 10개 법령: 2025-08-07 시행일자 검증 완료",
        "화학물질관리법 등: 화학물질 관리체계 개선 패키지 개정으로 동시 시행 확인"
    ]
    
    # 수정된 데이터 저장
    with open('docs/quarterly_details_corrected.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print("\n📊 수정 결과:")
    for quarter, info in data['quarters'].items():
        print(f"   {quarter}: {info['count']}개 법령")
    print(f"   총 {data['total_matched']}개 법령")
    
    print("\n✅ 수정된 데이터가 docs/quarterly_details_corrected.json에 저장되었습니다.")
    
    return data

if __name__ == "__main__":
    print("🔧 법령 시행일자 수정 시작...")
    fix_law_dates()
    print("✅ 법령 시행일자 수정 완료!")