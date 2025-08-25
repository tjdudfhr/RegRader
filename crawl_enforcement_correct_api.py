#!/usr/bin/env python3
import requests
import json
import time
from datetime import datetime
import xml.etree.ElementTree as ET

def crawl_2025_laws_with_correct_enforcement_params():
    """올바른 API 파라미터로 시행일 기준 2025년 법령 크롤링"""
    
    print("🔧 올바른 API 파라미터로 시행일 기준 2025년 법령 크롤링!")
    print("=" * 60)
    
    api_key = "20241119YCRNECRQT4Q7SHAZE6P5AXRF"
    base_url = "https://www.law.go.kr/DRF/lawService.do"
    
    all_laws = []
    
    # 다양한 파라미터 조합으로 시도
    param_combinations = [
        # 조합 1: 기본 검색 + 정렬
        {
            'OC': api_key,
            'target': 'law',
            'type': 'XML',
            'display': '100',
            'page': 1,
            'sort': 'enfcDate',  # 시행일순 정렬
            'order': 'desc'      # 내림차순
        },
        # 조합 2: 시행일 범위 지정 (다른 파라미터명 시도)
        {
            'OC': api_key,
            'target': 'law',
            'type': 'XML',
            'display': '100',
            'page': 1,
            'enfcDate': '2025',  # 2025년 시행
        },
        # 조합 3: 검색어로 2025 포함
        {
            'OC': api_key,
            'target': 'law',
            'type': 'XML',
            'display': '100',
            'page': 1,
            'query': '2025'
        }
    ]
    
    for i, params in enumerate(param_combinations, 1):
        print(f"\n🧪 파라미터 조합 {i} 시도:")
        for key, value in params.items():
            if key != 'OC':  # API 키는 숨김
                print(f"   {key}: {value}")
        
        try:
            response = requests.get(base_url, params=params, timeout=30)
            response.raise_for_status()
            
            content = response.text
            
            # 디버깅을 위해 응답 저장
            debug_file = f'docs/_debug/api_test_combination_{i}.xml'
            with open(debug_file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"📄 응답 저장: {debug_file}")
            
            # HTML 오류 페이지인지 확인
            if content.strip().startswith('<!DOCTYPE html') or '<html' in content[:100]:
                print("❌ HTML 오류 페이지 반환됨")
                continue
            
            # XML 파싱 시도
            try:
                root = ET.fromstring(content)
                
                # 다양한 가능한 경로로 법령 요소 찾기
                law_elements = (root.findall('.//law') or 
                              root.findall('.//Law') or 
                              root.findall('.//item') or
                              root.findall('.//LawService'))
                
                if law_elements:
                    print(f"✅ {len(law_elements)}개 법령 요소 발견!")
                    
                    # 첫 번째 요소 구조 확인
                    if len(law_elements) > 0:
                        first_law = law_elements[0]
                        print("📋 첫 번째 법령 요소 구조:")
                        for child in first_law:
                            print(f"  - {child.tag}: {child.text[:50] if child.text else 'None'}...")
                    
                    # 이 조합이 작동하므로 전체 크롤링 진행
                    return crawl_with_working_params(params)
                else:
                    print("❌ 법령 요소를 찾을 수 없음")
                    
                    # 전체 XML 구조 확인
                    print("📋 XML 루트 구조:")
                    for child in root:
                        print(f"  - {child.tag}: {child.text[:50] if child.text else 'None'}...")
                
            except ET.ParseError as e:
                print(f"❌ XML 파싱 오류: {e}")
                continue
                
        except Exception as e:
            print(f"❌ 요청 오류: {e}")
            continue
    
    print("\n❌ 모든 파라미터 조합이 실패했습니다.")
    return None

def crawl_with_working_params(base_params):
    """작동하는 파라미터로 전체 크롤링 수행"""
    
    print(f"\n🚀 작동하는 파라미터로 전체 크롤링 시작!")
    
    base_url = "https://www.law.go.kr/DRF/lawService.do"
    all_laws = []
    page = 1
    
    while True:
        params = base_params.copy()
        params['page'] = page
        
        print(f"📄 페이지 {page} 크롤링 중...")
        
        try:
            response = requests.get(base_url, params=params, timeout=30)
            response.raise_for_status()
            
            root = ET.fromstring(response.text)
            law_elements = (root.findall('.//law') or 
                          root.findall('.//Law') or 
                          root.findall('.//item') or
                          root.findall('.//LawService'))
            
            if not law_elements:
                print("❌ 더 이상 법령이 없습니다.")
                break
            
            page_laws = []
            
            for law_elem in law_elements:
                law_data = {}
                
                # 모든 하위 요소 수집
                for child in law_elem:
                    if child.text and child.text.strip():
                        law_data[child.tag] = child.text.strip()
                
                # 시행일이 2025년인 것만 필터링
                enforcement_fields = ['시행일자', 'enfcDate', '시행일', 'enforcementDate', 'effDate']
                enforcement_date = None
                
                for field in enforcement_fields:
                    if field in law_data and '2025' in law_data[field]:
                        enforcement_date = law_data[field]
                        break
                
                if not enforcement_date:
                    continue
                
                # 정규화된 데이터
                normalized_law = {
                    'title': (law_data.get('법령명') or 
                             law_data.get('lawNm') or
                             law_data.get('법령명칭') or ''),
                    'lsId': (law_data.get('법령일련번호') or 
                            law_data.get('lsId') or ''),
                    'enforcement_date': enforcement_date,
                    'promulgation_date': (law_data.get('공포일자') or 
                                        law_data.get('promDate') or ''),
                    'ministry': (law_data.get('소관부처') or 
                               law_data.get('minstNm') or ''),
                    'law_type': (law_data.get('법종구분') or 
                               law_data.get('lawType') or ''),
                    'raw_data': law_data
                }
                
                if normalized_law['title']:
                    page_laws.append(normalized_law)
            
            all_laws.extend(page_laws)
            print(f"✅ 페이지 {page}: {len(page_laws)}개 법령 (2025년 시행), 총 {len(all_laws)}개")
            
            if len(law_elements) < int(base_params.get('display', 100)):
                break
                
            page += 1
            time.sleep(0.5)
            
            if page > 30:  # 안전장치
                break
                
        except Exception as e:
            print(f"❌ 페이지 {page} 크롤링 오류: {e}")
            break
    
    # 결과 저장
    result = {
        'crawled_at': datetime.now().isoformat(),
        'search_method': 'working_params',
        'total_count': len(all_laws),
        'laws': all_laws
    }
    
    output_file = 'docs/enforcement_2025_laws_correct.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ 시행일 기준 2025년 법령 크롤링 완료!")
    print(f"📊 총 수집: {len(all_laws)}개")
    print(f"📁 저장: {output_file}")
    
    return result

if __name__ == "__main__":
    crawl_2025_laws_with_correct_enforcement_params()