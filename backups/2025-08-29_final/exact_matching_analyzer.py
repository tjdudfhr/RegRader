#!/usr/bin/env python3
"""
100% 정확 매칭 분석기
- 깃허브 8직무 207개 vs 2809개 수집법령
- 완전 일치만 추출 (유사도 1.0)
"""

import pandas as pd
import json
import glob
import os
import re
from datetime import datetime

class ExactMatchingAnalyzer:
    """100% 정확 매칭 분석기"""
    
    def __init__(self):
        self.company_laws = None
        self.collected_laws = None
        self.exact_matches = []
        
    def load_github_company_laws(self):
        """깃허브 8직무 당사 적용법규 로드"""
        
        print("📋 깃허브 8직무 당사 적용법규 로드 중...")
        
        try:
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
                    "소관부처": item["meta"]["ministry"]
                }
                laws.append(law_info)
            
            self.company_laws = pd.DataFrame(laws)
            
            print(f"   ✅ {len(self.company_laws)}개 당사 적용법규 로드")
            
            # 직무별 분포
            category_counts = self.company_laws["직무카테고리"].value_counts()
            print(f"   📋 8개 직무별 분포:")
            for category, count in category_counts.items():
                print(f"      - {category}: {count}개")
            
            return True
            
        except Exception as e:
            print(f"   ❌ 로드 오류: {e}")
            return False
    
    def load_collected_laws(self):
        """수집된 법령 로드"""
        
        print(f"\n📊 수집된 법령 로드 중...")
        
        files = glob.glob("/home/user/webapp/2025_Laws_Complete_*.xlsx")
        if not files:
            print("❌ 수집된 법령 파일을 찾을 수 없습니다.")
            return False
        
        latest_file = max(files, key=os.path.getctime)
        print(f"   📂 파일: {os.path.basename(latest_file)}")
        
        try:
            self.collected_laws = pd.read_excel(latest_file, sheet_name="전체")
            print(f"   ✅ {len(self.collected_laws)}개 수집 법령 로드")
            return True
        except Exception as e:
            print(f"   ❌ 로드 오류: {e}")
            return False
    
    def normalize_law_name(self, law_name):
        """법령명 정규화 (완전 일치용)"""
        
        if pd.isna(law_name) or not law_name:
            return ""
        
        name = str(law_name).strip()
        
        # 공통 정규화 (완전 일치를 위해 최소한만)
        name = re.sub(r'\s+', ' ', name)  # 다중 공백을 단일 공백으로
        name = name.replace('·', '.')     # 중점을 마침표로 통일
        name = name.replace('ㆍ', '.')     # 가운뎃점을 마침표로 통일
        
        return name.strip()
    
    def find_exact_matches(self):
        """100% 정확 매칭 찾기"""
        
        print(f"\n🔍 100% 정확 매칭 분석 시작")
        print("=" * 60)
        
        exact_matches = []
        total_processed = 0
        
        print(f"📋 매칭 진행:")
        
        for idx, company_law in self.company_laws.iterrows():
            company_name = company_law["법령명"]
            company_job = company_law["직무카테고리"]
            
            total_processed += 1
            
            # 정규화된 당사 법령명
            normalized_company = self.normalize_law_name(company_name)
            
            if total_processed % 50 == 0:
                print(f"   진행률: {total_processed}/{len(self.company_laws)} ({total_processed/len(self.company_laws)*100:.1f}%)")
            
            # 수집된 법령에서 정확히 일치하는 항목 찾기
            for _, collected_law in self.collected_laws.iterrows():
                collected_name = collected_law["법령명"]
                normalized_collected = self.normalize_law_name(collected_name)
                
                # 100% 정확 매칭 (정규화된 이름이 완전 일치)
                if normalized_company == normalized_collected and normalized_company != "":
                    
                    match_info = {
                        "당사법규ID": company_law["법규ID"],
                        "당사법령명": company_name,
                        "직무카테고리": company_job,
                        "당사시행일자": company_law["시행일자"],
                        "수집법령명": collected_name,
                        "수집시행일자": collected_law.get("시행일자", ""),
                        "법령상태": collected_law.get("법령상태", ""),
                        "법령종류": collected_law.get("법령종류", ""),
                        "소관부처": collected_law.get("소관부처", ""),
                        "수집소스": collected_law.get("수집소스", ""),
                        "매칭타입": "100%완전일치"
                    }
                    exact_matches.append(match_info)
        
        print(f"   진행률: {len(self.company_laws)}/{len(self.company_laws)} (100.0%)")
        
        self.exact_matches = exact_matches
        
        print(f"\n📊 100% 정확 매칭 결과:")
        print(f"   • 당사 적용법규: {len(self.company_laws)}개")
        print(f"   • 100% 매칭: {len(exact_matches)}개")
        print(f"   • 매칭률: {len(exact_matches)/len(self.company_laws)*100:.1f}%")
        
        return exact_matches
    
    def analyze_exact_matches(self):
        """정확 매칭 결과 분석"""
        
        if not self.exact_matches:
            print("❌ 매칭 결과가 없습니다.")
            return
        
        df_matches = pd.DataFrame(self.exact_matches)
        
        print(f"\n🎯 100% 정확 매칭 상세 분석")
        print("=" * 60)
        
        # 1. 직무별 매칭 현황
        print(f"📋 직무별 100% 매칭:")
        job_matches = df_matches["직무카테고리"].value_counts()
        for job, count in job_matches.items():
            job_total = len(self.company_laws[self.company_laws["직무카테고리"] == job])
            match_rate = count / job_total * 100 if job_total > 0 else 0
            print(f"   • {job}: {count}개 (전체 {job_total}개 중 {match_rate:.1f}%)")
        
        # 2. 법령 상태별 분포
        print(f"\n🔍 매칭된 법령 상태별 분포:")
        status_matches = df_matches["법령상태"].value_counts()
        for status, count in status_matches.items():
            print(f"   • {status}: {count}개")
        
        # 3. 시행예정 법령 (가장 중요!)
        future_laws = df_matches[df_matches["법령상태"] == "시행예정"]
        if not future_laws.empty:
            print(f"\n🔮 시행예정 법령 (100% 매칭): {len(future_laws)}개")
            print(f"   🚨 2025년 중 당사 직접 영향 법령:")
            
            # 시행일자순 정렬
            future_sorted = future_laws.sort_values("수집시행일자")
            
            for idx, law in future_sorted.iterrows():
                print(f"      📅 {law['수집시행일자']}: {law['당사법령명']}")
                print(f"         직무: {law['직무카테고리']}, 소관부처: {law['소관부처']}")
        
        # 4. 같은 법령의 다른 시행일자 
        print(f"\n📋 동일 법령의 여러 시행일자:")
        law_name_counts = df_matches["당사법령명"].value_counts()
        multiple_dates = law_name_counts[law_name_counts > 1]
        
        if not multiple_dates.empty:
            print(f"   📊 {len(multiple_dates)}개 법령이 여러 시행일자를 가짐:")
            
            for law_name, count in multiple_dates.head(10).items():
                print(f"      • {law_name}: {count}개 시행일자")
                
                # 해당 법령의 모든 시행일자 표시
                law_versions = df_matches[df_matches["당사법령명"] == law_name]
                dates = law_versions["수집시행일자"].unique()
                # numpy 타입을 문자열로 변환 후 정렬 및 조인
                dates_str = [str(date) for date in dates if pd.notna(date)]
                print(f"        시행일자: {', '.join(sorted(dates_str))}")
        else:
            print(f"   ℹ️  모든 법령이 단일 시행일자를 가집니다.")
        
        # 5. 분기별 영향도
        print(f"\n📅 2025년 분기별 100% 매칭 법령:")
        q_counts = {"Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0}
        
        for _, match in df_matches.iterrows():
            date_str = str(match["수집시행일자"]).replace("-", "")
            if len(date_str) >= 8:
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
        
        return df_matches
    
    def save_exact_matches(self, df_matches):
        """정확 매칭 결과 저장"""
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"/home/user/webapp/100%매칭결과_{timestamp}.xlsx"
        
        try:
            with pd.ExcelWriter(filename, engine="openpyxl") as writer:
                # 전체 매칭 결과
                df_matches.to_excel(writer, sheet_name="100%매칭결과", index=False)
                
                # 직무별 매칭
                for job in df_matches["직무카테고리"].unique():
                    job_subset = df_matches[df_matches["직무카테고리"] == job]
                    job_subset.to_excel(writer, sheet_name=f"직무_{job}", index=False)
                
                # 상태별 매칭
                for status in df_matches["법령상태"].unique():
                    status_subset = df_matches[df_matches["법령상태"] == status]
                    status_subset.to_excel(writer, sheet_name=f"상태_{status}", index=False)
                
                # 시행예정만 별도 시트
                future_only = df_matches[df_matches["법령상태"] == "시행예정"]
                if not future_only.empty:
                    future_only.to_excel(writer, sheet_name="시행예정_100%매칭", index=False)
            
            print(f"\n💾 100% 매칭 결과 저장: {filename}")
            return filename
            
        except Exception as e:
            print(f"❌ 저장 오류: {e}")
            return ""

def main():
    """메인 실행"""
    
    print("🎯 100% 정확 매칭 분석기")
    print("🔹 깃허브 8직무 207개 vs 수집법령 100% 완전일치만 추출")
    print("=" * 70)
    
    analyzer = ExactMatchingAnalyzer()
    
    # 1. 데이터 로드
    if not analyzer.load_github_company_laws():
        return
    
    if not analyzer.load_collected_laws():
        return
    
    # 2. 100% 정확 매칭 찾기
    exact_matches = analyzer.find_exact_matches()
    
    if not exact_matches:
        print("❌ 100% 매칭된 법령이 없습니다.")
        return
    
    # 3. 매칭 결과 분석
    df_matches = analyzer.analyze_exact_matches()
    
    # 4. 결과 저장
    saved_file = analyzer.save_exact_matches(df_matches)
    
    if saved_file:
        print(f"\n🎉 100% 정확 매칭 분석 완료!")
        print(f"📂 결과 파일: {saved_file}")
        print(f"📊 총 {len(exact_matches)}개 완전 일치 법령 발견")

if __name__ == "__main__":
    main()