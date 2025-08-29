#!/usr/bin/env python3
"""
정확한 8개 직무별 당사 적용법규와 2,702개 법령 매핑 분석
- 깃허브 저장된 실제 8직무 데이터 사용
- 수치만 확인용
"""

import pandas as pd
import json
import glob
import os
import re
from difflib import SequenceMatcher

class Correct8JobMappingAnalyzer:
    """정확한 8직무 매핑 분석기"""
    
    def __init__(self):
        self.company_laws = None
        self.collected_laws = None
        
    def load_github_company_laws(self):
        """깃허브 저장된 실제 8직무 당사 적용법규 로드"""
        
        print("📋 깃허브 저장된 8직무 당사 적용법규 로드 중...")
        
        try:
            # docs/index.json에서 실제 당사 적용법규 로드
            with open("/home/user/webapp/docs/index.json", "r", encoding="utf-8") as f:
                data = json.load(f)
            
            laws = []
            for item in data["items"]:
                law_info = {
                    "법규ID": item["id"],
                    "법령명": item["title"], 
                    "직무카테고리": item["categories"][0] if item["categories"] else "미분류",
                    "시행일자": item["effectiveDate"],
                    "법령종류": item["lawType"],
                    "소관부처": item["meta"]["ministry"],
                    "우선순위": "높음",  # 모든 당사 적용법규는 높은 우선순위로 설정
                    "적용범위": "전사"
                }
                laws.append(law_info)
            
            self.company_laws = pd.DataFrame(laws)
            
            print(f"   ✅ {len(self.company_laws)}개 당사 적용법규 로드 완료")
            print(f"   📂 데이터 출처: docs/index.json (깃허브 저장)")
            
            # 직무별 분포 확인
            print(f"   📋 직무별 분포:")
            category_counts = self.company_laws["직무카테고리"].value_counts()
            for category, count in category_counts.items():
                print(f"      - {category}: {count}개")
            
            return True
            
        except Exception as e:
            print(f"   ❌ 로드 오류: {e}")
            return False
    
    def load_collected_laws(self):
        """2,702개 수집 법령 로드"""
        
        print("\n📊 수집된 2025년 법령 로드 중...")
        
        collected_files = glob.glob("/home/user/webapp/2025_Laws_Complete_*.xlsx")
        if not collected_files:
            collected_files = glob.glob("/home/user/webapp/법령_2025_현행시행예정_*.xlsx")
        
        if not collected_files:
            print("❌ 수집된 법령 파일을 찾을 수 없습니다.")
            return False
        
        latest_collected_file = max(collected_files, key=os.path.getctime)
        print(f"   📂 수집법령 파일: {os.path.basename(latest_collected_file)}")
        
        try:
            self.collected_laws = pd.read_excel(latest_collected_file, sheet_name="전체")
            print(f"   ✅ {len(self.collected_laws)}개 수집 법령 로드 완료")
            return True
        except Exception as e:
            print(f"   ❌ 수집법령 로드 오류: {e}")
            return False
    
    def normalize_law_name(self, law_name):
        """법령명 정규화"""
        
        if pd.isna(law_name) or not law_name:
            return ""
        
        name = str(law_name).strip()
        name = re.sub(r'\s+', ' ', name)  # 다중 공백 제거
        name = re.sub(r'[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]', '', name)  # 특수문자 제거
        name = name.replace(' ', '')  # 모든 공백 제거
        
        return name.lower()
    
    def calculate_similarity(self, name1, name2):
        """법령명 유사도 계산"""
        
        norm1 = self.normalize_law_name(name1)
        norm2 = self.normalize_law_name(name2)
        
        if not norm1 or not norm2:
            return 0.0
        
        # 완전 일치
        if norm1 == norm2:
            return 1.0
        
        # 포함 관계
        if norm1 in norm2 or norm2 in norm1:
            return 0.9
        
        # 유사도 계산
        return SequenceMatcher(None, norm1, norm2).ratio()
    
    def quick_mapping_analysis(self, min_similarity=0.8):
        """빠른 매핑 분석 (수치만)"""
        
        print(f"\n🔍 정확한 8직무 매핑 분석 실행 (최소 유사도: {min_similarity})")
        print("=" * 70)
        
        total_matches = 0
        job_matches = {}
        priority_matches = {}
        status_matches = {}
        future_matches = []
        high_impact_matches = []
        
        # 직무별 카운터 초기화
        for job in self.company_laws["직무카테고리"].unique():
            job_matches[job] = 0
        
        print(f"📋 매핑 진행 상황:")
        
        for idx, company_law in self.company_laws.iterrows():
            company_name = company_law["법령명"]
            company_job = company_law["직무카테고리"]
            company_priority = company_law["우선순위"]
            
            if (idx + 1) % 50 == 0:
                print(f"   진행률: {idx+1}/{len(self.company_laws)} ({(idx+1)/len(self.company_laws)*100:.1f}%)")
            
            law_matches = 0
            
            for _, collected_law in self.collected_laws.iterrows():
                collected_name = collected_law["법령명"]
                similarity = self.calculate_similarity(company_name, collected_name)
                
                if similarity >= min_similarity:
                    law_matches += 1
                    total_matches += 1
                    
                    # 직무별 카운트
                    job_matches[company_job] += 1
                    
                    # 상태별 카운트
                    status = collected_law.get("법령상태", "")
                    if status in status_matches:
                        status_matches[status] += 1
                    else:
                        status_matches[status] = 1
                    
                    # 시행예정 법령 체크
                    if status == "시행예정":
                        future_matches.append({
                            "당사법령": company_name,
                            "직무": company_job,
                            "우선순위": company_priority,
                            "시행일자": collected_law.get("시행일자", ""),
                            "수집법령": collected_name,
                            "유사도": similarity
                        })
                        
                        # 모든 당사 적용법규가 높은 우선순위이므로 
                        # 시행예정 = 최고 영향도
                        high_impact_matches.append({
                            "당사법령": company_name,
                            "직무": company_job,
                            "시행일자": collected_law.get("시행일자", ""),
                            "수집법령": collected_name,
                            "유사도": similarity
                        })
        
        print(f"   진행률: {len(self.company_laws)}/{len(self.company_laws)} (100.0%)")
        
        return {
            "총매칭수": total_matches,
            "직무별매칭": job_matches,
            "상태별매칭": status_matches,
            "시행예정매칭": future_matches,
            "최고영향도매칭": high_impact_matches
        }
    
    def print_analysis_results(self, results):
        """분석 결과 출력"""
        
        print(f"\n🎯 정확한 8직무 법령 매핑 분석 결과")
        print("=" * 70)
        
        # 기본 통계
        total_company_laws = len(self.company_laws)
        total_matches = results["총매칭수"]
        match_rate = total_matches / total_company_laws * 100
        
        print(f"📊 기본 통계:")
        print(f"   • 당사 적용법규: {total_company_laws:,}개 (실제 깃허브 저장 데이터)")
        print(f"   • 수집된 법령: {len(self.collected_laws):,}개")
        print(f"   • 총 매칭 수: {total_matches:,}개")
        print(f"   • 매칭률: {match_rate:.1f}%")
        
        # 직무별 매칭 현황
        print(f"\n📋 8개 직무별 매칭 현황:")
        # 매칭 수 기준으로 정렬
        sorted_jobs = sorted(results["직무별매칭"].items(), key=lambda x: x[1], reverse=True)
        for job, count in sorted_jobs:
            job_total = len(self.company_laws[self.company_laws["직무카테고리"] == job])
            job_rate = count / job_total * 100 if job_total > 0 else 0
            print(f"   • {job}: {count:,}개 매칭 (법규 {job_total}개 중 {job_rate:.1f}%)")
        
        # 상태별 매칭
        print(f"\n🔍 법령 상태별 매칭:")
        for status, count in sorted(results["상태별매칭"].items(), key=lambda x: x[1], reverse=True):
            print(f"   • {status}: {count:,}개")
        
        # 시행예정 법령 (핵심!)
        future_count = len(results["시행예정매칭"])
        print(f"\n🔮 시행예정 법령 매칭: {future_count:,}개")
        if future_count > 0:
            print(f"   ⚠️  2025년 중 당사에 영향을 줄 새로운 법령들")
            
            # 직무별 시행예정 분포
            future_by_job = {}
            for match in results["시행예정매칭"]:
                job = match["직무"]
                if job in future_by_job:
                    future_by_job[job] += 1
                else:
                    future_by_job[job] = 1
            
            print(f"   📋 직무별 시행예정:")
            for job, count in sorted(future_by_job.items(), key=lambda x: x[1], reverse=True):
                print(f"      - {job}: {count}개")
        
        # 최고 영향도 (당사 적용법규 + 시행예정)
        high_impact_count = len(results["최고영향도매칭"])
        print(f"\n🚨 최고 영향도 법령: {high_impact_count:,}개")
        print(f"   (당사 적용법규 + 시행예정 = 즉시 대응 필요)")
        
        if high_impact_count > 0:
            print(f"   🔥 즉시 대응 필요 법령 (상위 10개):")
            # 시행일자 기준으로 정렬
            sorted_high_impact = sorted(results["최고영향도매칭"], 
                                      key=lambda x: x["시행일자"])
            
            for i, match in enumerate(sorted_high_impact[:10]):
                print(f"      {i+1:2d}. {match['시행일자']}: {match['당사법령']} ({match['직무']})")
                if match['유사도'] < 1.0:
                    print(f"          → 매칭: {match['수집법령']} (유사도: {match['유사도']:.3f})")
        
        # 분기별 영향도
        if future_count > 0:
            print(f"\n📅 2025년 분기별 시행예정 법령:")
            q_counts = {"Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0}
            
            for match in results["시행예정매칭"]:
                date_str = match["시행일자"].replace("-", "")
                if "20250101" <= date_str <= "20250331":
                    q_counts["Q1"] += 1
                elif "20250401" <= date_str <= "20250630":
                    q_counts["Q2"] += 1
                elif "20250701" <= date_str <= "20250930":
                    q_counts["Q3"] += 1
                elif "20251001" <= date_str <= "20251231":
                    q_counts["Q4"] += 1
            
            for quarter, count in q_counts.items():
                print(f"   • 2025 {quarter}: {count}개")
        
        # 요약 정보
        print(f"\n📈 핵심 요약:")
        print(f"   • 전체 매칭률: {match_rate:.1f}%")
        print(f"   • 시행예정 법령: {future_count}개 (당사 대응 필요)")
        print(f"   • 최고 우선순위: {high_impact_count}개 (즉시 대응)")
        if results["직무별매칭"]:
            max_job = max(results['직무별매칭'].items(), key=lambda x: x[1])
            print(f"   • 가장 많은 매칭 직무: {max_job[0]} ({max_job[1]}개)")

def main():
    """메인 실행 함수"""
    
    print("🚀 정확한 8직무 vs 2,702개 법령 매핑 분석")
    print("🔹 깃허브 저장된 실제 당사 적용법규 사용")
    print("=" * 70)
    
    analyzer = Correct8JobMappingAnalyzer()
    
    # 데이터 로드
    if not analyzer.load_github_company_laws():
        return
    
    if not analyzer.load_collected_laws():
        return
    
    # 매핑 분석
    results = analyzer.quick_mapping_analysis(min_similarity=0.8)
    
    # 결과 출력
    analyzer.print_analysis_results(results)
    
    print(f"\n✅ 정확한 8직무 매핑 분석 완료!")

if __name__ == "__main__":
    main()