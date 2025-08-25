#!/usr/bin/env python3
import requests
import json
import time
from datetime import datetime
import os

def crawl_precise_2025_laws_by_enforcement_date():
    """시행일 기준으로 정확한 2025년 법령 크롤링"""
    
    print("🎯 시행일 기준 2025년 법령 정확한 크롤링 시작!")
    print("=" * 60)
    
    # OpenAPI 키 - 실제 사용 시에는 환경변수나 설정파일에서 가져오기
    api_key = "20241119YCRNECRQT4Q7SHAZE6P5AXRF"
    base_url = "https://www.law.go.kr/DRF/lawService.do"
    
    all_laws = []
    page = 1
    
    # 2025년 시행일 기준으로 정확하게 검색
    # 시행일이 2025년 1월 1일부터 2025년 12월 31일 사이인 법령들
    enforcement_date_from = "20250101"  # 시행일 시작
    enforcement_date_to = "20251231"    # 시행일 종료
    
    while True:
        params = {
            'OC': api_key,
            'target': 'law',
            'type': 'XML',
            'display': '100',  # 한 페이지당 100개
            'page': page,
            'enfcDateFrom': enforcement_date_from,  # 시행일 시작일
            'enfcDateTo': enforcement_date_to,      # 시행일 종료일
            'sort': 'enfcDate'  # 시행일 순 정렬
        }
        
        print(f"📄 페이지 {page} 크롤링 중... (시행일: {enforcement_date_from}~{enforcement_date_to})")
        
        try:
            response = requests.get(base_url, params=params, timeout=30)
            response.raise_for_status()
            
            # XML을 JSON으로 파싱하지 않고 우선 텍스트로 확인
            content = response.text
            
            # 디버깅을 위해 첫 페이지 응답 저장
            if page == 1:
                with open('docs/_debug/enforcement_date_api_response_p1.xml', 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"📄 첫 페이지 응답을 저장했습니다: docs/_debug/enforcement_date_api_response_p1.xml")
            
            # XML 파싱을 위해 간단한 파싱 시도
            import xml.etree.ElementTree as ET
            root = ET.fromstring(content)
            
            # 법령 항목들 찾기
            law_elements = root.findall('.//law') or root.findall('.//법령')
            
            if not law_elements:
                print(f"❌ 페이지 {page}에서 법령을 찾을 수 없습니다.")
                
                # 전체 응답 구조 확인
                print("📋 API 응답 구조:")
                for elem in root:
                    print(f"  - {elem.tag}: {elem.text[:100] if elem.text else 'No text'}")
                
                break
            
            page_laws = []
            
            for law_elem in law_elements:
                try:
                    # 각 법령 정보 추출
                    law_data = {}
                    
                    # 기본 필드들 추출
                    for child in law_elem:
                        if child.text and child.text.strip():
                            law_data[child.tag] = child.text.strip()
                    
                    # 필수 필드 확인
                    if not law_data.get('법령명') and not law_data.get('lawNm'):
                        continue
                        
                    # 시행일 확인 (여러 가능한 필드명)
                    enforcement_date = (law_data.get('시행일자') or 
                                      law_data.get('enfcDate') or 
                                      law_data.get('시행일') or 
                                      law_data.get('enforcementDate'))
                    
                    if not enforcement_date:
                        continue
                    
                    # 2025년 시행일인지 확인
                    if not enforcement_date.startswith('2025'):
                        continue
                    
                    # 정규화된 데이터 구조
                    normalized_law = {
                        'title': law_data.get('법령명') or law_data.get('lawNm', ''),
                        'lsId': law_data.get('법령일련번호') or law_data.get('lsId', ''),
                        'enforcement_date': enforcement_date,
                        'promulgation_date': (law_data.get('공포일자') or 
                                            law_data.get('promDate') or 
                                            law_data.get('공포일') or ''),
                        'ministry': (law_data.get('소관부처') or 
                                   law_data.get('minstNm') or 
                                   law_data.get('부처') or ''),
                        'law_type': (law_data.get('법종구분') or 
                                   law_data.get('lawType') or 
                                   law_data.get('법령종류') or ''),
                        'raw_data': law_data
                    }
                    
                    if normalized_law['title']:
                        page_laws.append(normalized_law)
                        
                except Exception as e:
                    print(f"⚠️ 법령 파싱 오류: {e}")
                    continue
            
            if not page_laws:
                print(f"❌ 페이지 {page}에서 유효한 법령이 없습니다.")
                break
            
            all_laws.extend(page_laws)
            print(f"✅ 페이지 {page}: {len(page_laws)}개 법령 수집 완료 (총 {len(all_laws)}개)")
            
            # 더 이상 데이터가 없으면 중단
            if len(page_laws) < 100:
                print("📄 마지막 페이지에 도달했습니다.")
                break
                
            page += 1
            
            # API 호출 간격 조절
            if page % 10 == 0:
                print(f"⏸️ API 호출 제한 방지를 위해 잠시 대기... (현재 {len(all_laws)}개 수집)")
                time.sleep(2)
            else:
                time.sleep(0.5)
            
            # 안전장치: 너무 많은 페이지 방지
            if page > 50:
                print("⚠️ 안전장치: 50페이지 제한에 도달했습니다.")
                break
                
        except requests.exceptions.RequestException as e:
            print(f"❌ API 요청 오류 (페이지 {page}): {e}")
            if page == 1:
                return None
            break
        except ET.ParseError as e:
            print(f"❌ XML 파싱 오류 (페이지 {page}): {e}")
            break
        except Exception as e:
            print(f"❌ 예상치 못한 오류 (페이지 {page}): {e}")
            break
    
    if not all_laws:
        print("❌ 시행일 기준 2025년 법령을 찾을 수 없습니다.")
        return None
    
    # 결과 정리
    result = {
        'crawled_at': datetime.now().isoformat(),
        'search_criteria': {
            'enforcement_date_from': enforcement_date_from,
            'enforcement_date_to': enforcement_date_to,
            'search_type': '시행일 기준'
        },
        'total_count': len(all_laws),
        'laws': all_laws
    }
    
    # 파일 저장
    output_file = 'docs/precise_enforcement_2025_laws.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print("=" * 60)
    print(f"✅ 시행일 기준 2025년 법령 크롤링 완료!")
    print(f"📊 총 수집된 법령: {len(all_laws)}개")
    print(f"📁 저장된 파일: {output_file}")
    print(f"🔍 검색 기준: 시행일 {enforcement_date_from}~{enforcement_date_to}")
    
    # 샘플 출력
    if len(all_laws) > 0:
        print("\n📋 수집된 법령 샘플:")
        for i, law in enumerate(all_laws[:5]):
            print(f"  {i+1}. {law['title']} (시행: {law['enforcement_date']})")
    
    return result

if __name__ == "__main__":
    crawl_precise_2025_laws_by_enforcement_date()