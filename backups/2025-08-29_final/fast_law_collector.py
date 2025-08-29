#!/usr/bin/env python3
"""
빠른 2025년 법령 수집기
- target=law + target=eflaw 이중 접근
- 2,702개 법령 빠른 수집
"""

import requests
import pandas as pd
from datetime import datetime
import time

class FastLawCollector:
    """빠른 법령 수집기"""
    
    def __init__(self):
        self.base_url = "https://www.law.go.kr/DRF/lawSearch.do"
        self.oc = "knowhow1"
        self.all_laws = []
        
    def fetch_laws_by_target(self, target):
        """특정 target으로 법령 수집"""
        
        print(f"📊 Target={target} 법령 수집 중...")
        
        laws = []
        page = 1
        
        while True:
            params = {
                "OC": self.oc,
                "target": target,
                "type": "JSON", 
                "efYd": "20250101~20251231",
                "display": 100,
                "page": page,
                "sort": "efasc"
            }
            
            try:
                response = requests.get(self.base_url, params=params, timeout=30)
                response.raise_for_status()
                
                data = response.json()
                
                if not data or "LawSearch" not in data:
                    break
                    
                law_search = data["LawSearch"]
                
                if not law_search or "law" not in law_search:
                    break
                
                law_items = law_search["law"]
                if not law_items:
                    break
                
                # 리스트가 아니면 단일 항목을 리스트로 변환
                if not isinstance(law_items, list):
                    law_items = [law_items]
                
                for item in law_items:
                    law_info = {
                        "법령ID": item.get("법령일련번호", ""),
                        "법령명": item.get("법령명한글", ""),
                        "시행일자": item.get("시행일자", ""),
                        "공포일자": item.get("공포일자", ""), 
                        "소관부처": item.get("소관부처명", ""),
                        "법령종류": item.get("법종구분명", ""),
                        "법령상태": "현행" if target == "law" else "시행예정",
                        "수집소스": f"target={target}",
                        "수집일시": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }
                    laws.append(law_info)
                
                print(f"   페이지 {page}: {len(law_items)}개 수집 (누적: {len(laws)}개)")
                page += 1
                
                # API 부하 방지
                time.sleep(0.1)
                
            except Exception as e:
                print(f"   ❌ 오류 (페이지 {page}): {e}")
                break
        
        print(f"   ✅ Target={target} 총 {len(laws)}개 수집 완료")
        return laws
    
    def collect_all_laws(self):
        """모든 법령 수집 (현행 + 시행예정)"""
        
        print("🚀 2025년 법령 전체 수집 시작")
        print("=" * 50)
        
        # 1. 현행 법령 수집
        current_laws = self.fetch_laws_by_target("law")
        
        # 2. 시행예정 법령 수집  
        future_laws = self.fetch_laws_by_target("eflaw")
        
        # 3. 통합 및 중복 제거
        all_laws = current_laws + future_laws
        
        print(f"\n📊 수집 결과:")
        print(f"   현행 법령: {len(current_laws):,}개")
        print(f"   시행예정 법령: {len(future_laws):,}개")
        print(f"   전체 수집: {len(all_laws):,}개")
        
        # 중복 제거 (법령명 + 시행일자 기준)
        df = pd.DataFrame(all_laws)
        df_unique = df.drop_duplicates(subset=["법령명", "시행일자"], keep="first")
        
        print(f"   중복 제거 후: {len(df_unique):,}개")
        
        self.all_laws = df_unique
        return df_unique
    
    def save_to_excel(self):
        """Excel 파일로 저장"""
        
        if len(self.all_laws) == 0:
            print("❌ 저장할 데이터가 없습니다.")
            return ""
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"/home/user/webapp/2025_Laws_Complete_{timestamp}.xlsx"
        
        try:
            with pd.ExcelWriter(filename, engine="openpyxl") as writer:
                # 전체 시트
                self.all_laws.to_excel(writer, sheet_name="전체", index=False)
                
                # 상태별 시트
                for status in self.all_laws["법령상태"].unique():
                    subset = self.all_laws[self.all_laws["법령상태"] == status]
                    subset.to_excel(writer, sheet_name=f"상태_{status}", index=False)
                
                # 소스별 시트
                for source in self.all_laws["수집소스"].unique():
                    subset = self.all_laws[self.all_laws["수집소스"] == source] 
                    subset.to_excel(writer, sheet_name=f"소스_{source.replace('=', '_')}", index=False)
            
            print(f"\n💾 저장 완료: {filename}")
            print(f"📊 총 {len(self.all_laws):,}개 법령 데이터")
            
            return filename
            
        except Exception as e:
            print(f"❌ 저장 오류: {e}")
            return ""

def main():
    """메인 실행"""
    
    collector = FastLawCollector()
    
    # 법령 수집
    df_laws = collector.collect_all_laws()
    
    if len(df_laws) == 0:
        print("❌ 수집된 법령이 없습니다.")
        return
    
    # Excel 저장
    saved_file = collector.save_to_excel()
    
    if saved_file:
        print(f"\n🎉 2025년 법령 수집 완료!")
        print(f"📂 파일: {saved_file}")

if __name__ == "__main__":
    main()