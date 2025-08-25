#!/usr/bin/env python3
"""
당사 적용 207개 법규와 크롤링된 2025년 법령 간 100% 정확한 제목 매칭
- 제목의 완전 일치만 인정 (공백, 특수문자 정규화 후)
- 매칭된 법규에 2025년 실제 시행일 정보 추가
- 분기별 분류를 위한 시행일 기준 정리
"""

import json
import re
from datetime import datetime

class ExactLawMatcher:
    def __init__(self):
        self.company_laws = []
        self.government_laws = []
        self.matched_laws = []
        
    def normalize_title(self, title):
        """제목 정규화 (공백, 특수문자 통일)"""
        if not title:
            return ""
        
        # 기본 정리
        title = title.strip()
        
        # 여러 공백을 하나로
        title = re.sub(r'\s+', ' ', title)
        
        # 특수문자 정규화
        title = title.replace('·', '·')  # 중점 통일
        title = title.replace('・', '·')
        title = title.replace('∙', '·')
        
        return title
    
    def load_company_laws(self):
        """당사 적용 207개 법규 로드"""
        print("📋 당사 적용 207개 법규 로드 중...")
        
        with open('docs/index.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        self.company_laws = data.get('items', [])
        print(f"   - 로드 완료: {len(self.company_laws)}개")
        
        # 제목 정규화
        for law in self.company_laws:
            law['normalized_title'] = self.normalize_title(law['title'])
        
        return len(self.company_laws)
    
    def load_government_laws(self):
        """크롤링된 2025년 정부 법령 로드"""
        print("🏛️ 2025년 정부 법령 데이터 로드 중...")
        
        with open('docs/crawled_2025_laws.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        self.government_laws = data.get('laws', [])
        print(f"   - 로드 완료: {len(self.government_laws)}개")
        
        # 제목 정규화
        for law in self.government_laws:
            law['normalized_title'] = self.normalize_title(law['title'])
        
        return len(self.government_laws)
    
    def perform_exact_matching(self):
        """100% 정확한 제목 매칭 수행"""
        print("🎯 100% 정확한 제목 매칭 시작...")
        
        matched_count = 0
        
        for company_law in self.company_laws:
            company_title = company_law['normalized_title']
            
            # 정부 법령에서 정확히 일치하는 제목 찾기
            for gov_law in self.government_laws:
                gov_title = gov_law['normalized_title']
                
                # 100% 정확한 매칭
                if company_title == gov_title:
                    # 매칭된 법률 정보 생성
                    matched_law = self.create_matched_law(company_law, gov_law)
                    self.matched_laws.append(matched_law)
                    matched_count += 1
                    
                    print(f"   ✅ 매칭: {company_title}")
                    break  # 첫 번째 매칭된 것으로 충분
        
        print(f"📊 매칭 결과: {matched_count}개 / {len(self.company_laws)}개 ({matched_count/len(self.company_laws)*100:.1f}%)")
        return matched_count
    
    def create_matched_law(self, company_law, gov_law):
        """매칭된 법률 정보 생성"""
        # 분기 계산
        quarter = self.get_quarter_from_date(gov_law['effectiveDate'])
        
        matched_law = {
            # 기본 정보 (당사 법규 기준)
            "id": company_law['id'],
            "title": company_law['title'],
            "categories": company_law['categories'],
            
            # 2025년 실제 정부 정보
            "government_info": {
                "effective_date": gov_law['effectiveDate'],
                "law_type": gov_law['lawType'],
                "ministry": gov_law['ministry'],
                "ls_id": gov_law['lsId'],
                "detail_url": gov_law['detailUrl'],
                "search_url": gov_law['searchUrl']
            },
            
            # 분기 정보
            "quarter": quarter,
            "year": 2025,
            
            # 매칭 정보
            "match_type": "100%_exact_title",
            "match_confidence": 1.0,
            "matched_at": datetime.now().isoformat()
        }
        
        return matched_law
    
    def get_quarter_from_date(self, date_str):
        """시행일에서 분기 계산"""
        if not date_str or len(date_str) < 8:
            return "Q4"  # 기본값
        
        try:
            # YYYY-MM-DD 형식에서 월 추출
            month = int(date_str[5:7])
            
            if 1 <= month <= 3:
                return "Q1"
            elif 4 <= month <= 6:
                return "Q2"
            elif 7 <= month <= 9:
                return "Q3"
            else:
                return "Q4"
                
        except (ValueError, IndexError):
            return "Q4"  # 오류 시 기본값
    
    def generate_quarterly_statistics(self):
        """분기별 통계 생성"""
        quarterly_stats = {
            "Q1": {"count": 0, "laws": []},
            "Q2": {"count": 0, "laws": []}, 
            "Q3": {"count": 0, "laws": []},
            "Q4": {"count": 0, "laws": []}
        }
        
        category_stats = {}
        
        for law in self.matched_laws:
            quarter = law['quarter']
            quarterly_stats[quarter]['count'] += 1
            quarterly_stats[quarter]['laws'].append({
                "title": law['title'],
                "effective_date": law['government_info']['effective_date'],
                "categories": law['categories'],
                "law_type": law['government_info']['law_type']
            })
            
            # 카테고리별 통계
            for category in law['categories']:
                if category not in category_stats:
                    category_stats[category] = 0
                category_stats[category] += 1
        
        return quarterly_stats, category_stats
    
    def save_results(self):
        """매칭 결과 저장"""
        quarterly_stats, category_stats = self.generate_quarterly_statistics()
        
        results = {
            "generated_at": datetime.now().isoformat(),
            "description": "당사 적용 207개 법규와 2025년 정부 법령 100% 정확한 매칭 결과",
            "source_data": {
                "company_laws_count": len(self.company_laws),
                "government_laws_count": len(self.government_laws)
            },
            "matching_summary": {
                "total_matched": len(self.matched_laws),
                "matching_rate": len(self.matched_laws) / len(self.company_laws) * 100,
                "matching_method": "100%_exact_title_matching"
            },
            "quarterly_distribution": quarterly_stats,
            "category_distribution": category_stats,
            "matched_laws": self.matched_laws
        }
        
        # 매칭 결과 저장
        with open('docs/exact_matched_2025_laws.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        
        print(f"💾 매칭 결과 저장: docs/exact_matched_2025_laws.json")
        
        # 통계 출력
        print("\n📊 매칭 통계:")
        print(f"   - 총 매칭: {len(self.matched_laws)}개 / {len(self.company_laws)}개")
        print(f"   - 매칭률: {len(self.matched_laws) / len(self.company_laws) * 100:.1f}%")
        
        print("\n📅 분기별 분포:")
        for quarter, data in quarterly_stats.items():
            print(f"   - {quarter}: {data['count']}개")
        
        print("\n👔 직무별 분포:")
        for category, count in sorted(category_stats.items()):
            print(f"   - {category}: {count}개")
        
        return 'docs/exact_matched_2025_laws.json'

def main():
    """메인 실행 함수"""
    matcher = ExactLawMatcher()
    
    # 데이터 로드
    matcher.load_company_laws()
    matcher.load_government_laws()
    
    # 정확한 매칭 수행
    matched_count = matcher.perform_exact_matching()
    
    # 결과 저장
    result_file = matcher.save_results()
    
    print(f"\n✅ 100% 정확한 매칭 완료!")
    print(f"📁 결과 파일: {result_file}")
    
    return result_file

if __name__ == "__main__":
    main()