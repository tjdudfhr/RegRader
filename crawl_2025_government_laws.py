#!/usr/bin/env python3
"""
국가법령정보센터에서 2025년 시행일 기준 모든 법규 크롤링
- 시행일이 2025년인 모든 법령 수집
- 정확한 제목, 시행일, 법령ID 등 상세 정보 수집
"""

import requests
import json
import time
from datetime import datetime
import xml.etree.ElementTree as ET

class GovernmentLawCrawler:
    def __init__(self):
        # 국가법령정보센터 OpenAPI 기본 URL
        self.base_url = "https://www.law.go.kr/DRF/lawSearch.do"
        self.detail_url = "https://www.law.go.kr/DRF/lawService.do"
        
        # API 키 (공개 서비스)
        self.params = {
            'OC': 'tjdudfhr',  # 사용자 식별자
            'target': 'law',   # 검색 대상
            'type': 'XML'      # 응답 형식
        }
        
        self.crawled_laws = []
        
    def crawl_2025_laws(self):
        """2025년 시행일 기준 법령 크롤링"""
        print("🔍 2025년 시행 법령 크롤링 시작...")
        
        # 2025년 각 월별로 검색 (더 정확한 결과를 위해)
        for month in range(1, 13):
            print(f"📅 2025년 {month}월 법령 검색 중...")
            
            # 해당 월의 시작일과 종료일 계산
            start_date = f"2025{month:02d}01"
            if month == 12:
                end_date = "20251231"
            else:
                next_month = month + 1
                if next_month <= 12:
                    end_date = f"2025{next_month:02d}01"
                else:
                    end_date = "20251231"
            
            page = 1
            while True:
                # API 파라미터 설정
                search_params = self.params.copy()
                search_params.update({
                    'display': '100',  # 페이지당 결과 수
                    'page': str(page),
                    'search': '3',     # 시행일자 검색
                    'asdt': start_date,  # 시작 시행일
                    'aedt': end_date     # 종료 시행일
                })
                
                try:
                    response = requests.get(self.base_url, params=search_params, timeout=30)
                    response.raise_for_status()
                    
                    # XML 파싱
                    root = ET.fromstring(response.content)
                    
                    # 총 결과 수 확인
                    total_count_elem = root.find('.//totalCnt')
                    if total_count_elem is not None:
                        total_count = int(total_count_elem.text)
                        print(f"   - 총 {total_count}건 발견")
                    
                    # 법령 정보 추출
                    laws = root.findall('.//law')
                    if not laws:
                        print(f"   - {month}월 {page}페이지: 결과 없음")
                        break
                    
                    print(f"   - {month}월 {page}페이지: {len(laws)}건 처리")
                    
                    for law in laws:
                        law_info = self.extract_law_info(law)
                        if law_info and self.is_2025_enforcement(law_info.get('enforcement_date')):
                            # 중복 방지
                            if not any(existing['ls_id'] == law_info['ls_id'] for existing in self.crawled_laws):
                                self.crawled_laws.append(law_info)
                    
                    # 다음 페이지가 없으면 종료
                    if len(laws) < 100:
                        break
                    
                    page += 1
                    time.sleep(0.5)  # API 호출 간격
                    
                except requests.exceptions.RequestException as e:
                    print(f"   - API 요청 오류: {e}")
                    time.sleep(2)
                    continue
                except ET.ParseError as e:
                    print(f"   - XML 파싱 오류: {e}")
                    continue
        
        print(f"✅ 크롤링 완료: 총 {len(self.crawled_laws)}건")
        return self.crawled_laws
    
    def extract_law_info(self, law_element):
        """법령 정보 추출"""
        try:
            law_info = {
                'ls_id': self.get_text(law_element, 'lsId'),
                'title': self.get_text(law_element, 'lawNm'),
                'law_type': self.get_text(law_element, 'lawType'),
                'promulgation_date': self.get_text(law_element, 'promDt'),
                'enforcement_date': self.get_text(law_element, 'efctDt'),
                'ministry': self.get_text(law_element, 'admstNm'),
                'law_classification': self.get_text(law_element, 'lawClsCd')
            }
            
            # 필수 정보 확인
            if law_info['title'] and law_info['ls_id']:
                return law_info
            else:
                return None
                
        except Exception as e:
            print(f"   - 법령 정보 추출 오류: {e}")
            return None
    
    def get_text(self, element, tag_name):
        """XML 요소에서 텍스트 추출"""
        elem = element.find(tag_name)
        return elem.text.strip() if elem is not None and elem.text else ""
    
    def is_2025_enforcement(self, enforcement_date):
        """2025년 시행일인지 확인"""
        if not enforcement_date:
            return False
        return enforcement_date.startswith('2025')
    
    def save_to_file(self, filename='crawled_2025_government_laws.json'):
        """크롤링 결과를 파일로 저장"""
        data = {
            'crawled_at': datetime.now().isoformat(),
            'total_count': len(self.crawled_laws),
            'description': '2025년 시행 정부 법령 (국가법령정보센터)',
            'source': '국가법령정보센터 OpenAPI',
            'laws': self.crawled_laws
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"💾 결과 저장: {filename}")
        return filename

def main():
    """메인 실행 함수"""
    crawler = GovernmentLawCrawler()
    
    # 2025년 법령 크롤링
    laws = crawler.crawl_2025_laws()
    
    # 결과 저장
    filename = crawler.save_to_file()
    
    # 통계 정보 출력
    print("\n📊 크롤링 통계:")
    print(f"   - 총 법령 수: {len(laws)}건")
    
    # 월별 분포
    monthly_count = {}
    for law in laws:
        enforcement_date = law.get('enforcement_date', '')
        if len(enforcement_date) >= 6:
            month = enforcement_date[4:6]
            monthly_count[month] = monthly_count.get(month, 0) + 1
    
    print("   - 월별 분포:")
    for month, count in sorted(monthly_count.items()):
        print(f"     {month}월: {count}건")
    
    return filename

if __name__ == "__main__":
    main()