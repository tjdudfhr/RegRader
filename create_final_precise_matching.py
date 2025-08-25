#!/usr/bin/env python3
import json
from datetime import datetime

def create_final_precise_matching():
    """100% 정확한 매칭 결과만으로 최종 데이터 생성"""
    
    print("🎯 100% 정확한 매칭 결과로 최종 데이터 생성!")
    print("=" * 60)
    
    # 정부 분석 결과 로드 (100% 정확한 매칭 목록)
    with open('docs/government_law_analysis.json', 'r', encoding='utf-8') as f:
        analysis_data = json.load(f)
    
    exact_matches = analysis_data.get('exact_matches', [])
    print(f"📊 100% 정확한 매칭: {len(exact_matches)}개")
    
    # 우리 212개 법령 데이터 로드
    with open('docs/index.json', 'r', encoding='utf-8') as f:
        our_data = json.load(f)
    our_laws = our_data.get('items', [])
    
    # 100% 정확한 매칭만 추출
    final_matched_laws = []
    
    for match in exact_matches:
        our_title = match['our_title']
        
        # 우리 법령에서 해당 제목 찾기
        our_law = None
        for law in our_laws:
            if law.get('title', '').strip() == our_title:
                our_law = law
                break
        
        if our_law:
            # 정부 시행일 정보 추가
            final_law = our_law.copy()
            final_law.update({
                'government_enforcement_date': match['enforcement_date'],
                'government_lsId': match['lsId'],
                'government_title': match['gov_title'],
                'match_type': '100%_exact',
                'match_confidence': 1.0,
                'original_effective_date': our_law.get('effectiveDate', ''),
                'updated_effective_date': match['enforcement_date']  # 정부 시행일로 업데이트
            })
            
            # effectiveDate를 정부 시행일로 교체
            final_law['effectiveDate'] = match['enforcement_date']
            
            final_matched_laws.append(final_law)
    
    print(f"✅ 최종 매칭된 법령: {len(final_matched_laws)}개")
    
    # 분기별 분석
    quarterly_stats = {'Q1': 0, 'Q2': 0, 'Q3': 0, 'Q4': 0}
    
    for law in final_matched_laws:
        enforcement_date = law.get('effectiveDate', '')
        if len(enforcement_date) >= 7:
            try:
                month = int(enforcement_date[5:7])
                if 1 <= month <= 3:
                    quarterly_stats['Q1'] += 1
                elif 4 <= month <= 6:
                    quarterly_stats['Q2'] += 1
                elif 7 <= month <= 9:
                    quarterly_stats['Q3'] += 1
                elif 10 <= month <= 12:
                    quarterly_stats['Q4'] += 1
            except (ValueError, IndexError):
                pass
    
    # 직무별 분석
    job_function_stats = {}
    for law in final_matched_laws:
        categories = law.get('categories', [])
        for category in categories:
            job_function_stats[category] = job_function_stats.get(category, 0) + 1
    
    # 시행 상태 분석 (2025-08-25 기준)
    current_date = '2025-08-25'
    implemented_count = 0
    upcoming_count = 0
    
    for law in final_matched_laws:
        enforcement_date = law.get('effectiveDate', '')
        if enforcement_date:
            if enforcement_date <= current_date:
                implemented_count += 1
            else:
                upcoming_count += 1
    
    # 결과 정리
    result = {
        'matched_at': datetime.now().isoformat(),
        'matching_method': '100%_exact_government_verified',
        'description': '정부 국가법령정보센터에서 크롤링한 2025년 시행 법령과 100% 정확히 일치하는 법령만 선별',
        'our_total_laws': len(our_laws),
        'matched_count': len(final_matched_laws),
        'unmatched_count': len(our_laws) - len(final_matched_laws),
        'match_percentage': round(len(final_matched_laws)/len(our_laws)*100, 2),
        'implemented_count': implemented_count,
        'upcoming_count': upcoming_count,
        'by_quarter_counts': quarterly_stats,
        'by_category_counts': dict(sorted(job_function_stats.items(), key=lambda x: x[1], reverse=True)),
        'matched_laws': final_matched_laws
    }
    
    # 파일 저장
    output_file = 'docs/final_precise_matching_result.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print("\n" + "=" * 60)
    print("📊 최종 100% 정확한 매칭 결과:")
    print(f"   총 매칭: {len(final_matched_laws)}개")
    print(f"   매칭률: {result['match_percentage']}%")
    print(f"   시행 완료: {implemented_count}개")
    print(f"   시행 예정: {upcoming_count}개")
    
    print("\n📅 분기별 분포:")
    for quarter, count in quarterly_stats.items():
        print(f"   {quarter}: {count}개")
    
    print("\n👥 직무별 분포:")
    sorted_categories = sorted(job_function_stats.items(), key=lambda x: x[1], reverse=True)
    for category, count in sorted_categories:
        print(f"   {category}: {count}개")
    
    print(f"\n📁 최종 결과 저장: {output_file}")
    
    return result

if __name__ == "__main__":
    create_final_precise_matching()