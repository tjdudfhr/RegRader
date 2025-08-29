#!/usr/bin/env python3
"""
분기별 법규 분류기
- 259개 100% 매칭 법규를 분기별로 분류
- GitHub 문서 구조에 맞는 JSON 생성
"""

import pandas as pd
import json
import os
from datetime import datetime
from collections import defaultdict

class QuarterlyClassifier:
    """분기별 법규 분류기"""
    
    def __init__(self):
        self.matched_laws = None
        self.quarterly_data = {
            "2025Q1": [],
            "2025Q2": [],
            "2025Q3": [],
            "2025Q4": [],
            "기타": []
        }
        
    def load_matched_laws(self):
        """100% 매칭 결과 로드"""
        
        print("📊 100% 매칭 결과 로드 중...")
        
        try:
            # 최신 매칭 결과 파일 찾기
            import glob
            files = glob.glob("/home/user/webapp/100%매칭결과_*.xlsx")
            if not files:
                print("❌ 매칭 결과 파일을 찾을 수 없습니다.")
                return False
            
            latest_file = max(files, key=os.path.getctime)
            print(f"   📂 파일: {os.path.basename(latest_file)}")
            
            # 전체 매칭 결과 시트 읽기
            self.matched_laws = pd.read_excel(latest_file, sheet_name="100%매칭결과")
            
            print(f"   ✅ {len(self.matched_laws)}개 매칭 법규 로드")
            return True
            
        except Exception as e:
            print(f"   ❌ 로드 오류: {e}")
            return False
    
    def classify_by_quarter(self):
        """시행일자 기준 분기별 분류"""
        
        print(f"\n🗓️ 시행일자 기준 분기별 분류 시작")
        print("=" * 50)
        
        for idx, law in self.matched_laws.iterrows():
            enforcement_date = str(law.get("수집시행일자", "")).replace("-", "")
            law_info = self.create_law_info(law, idx + 1)
            
            # 분기 분류
            quarter = self.determine_quarter(enforcement_date)
            self.quarterly_data[quarter].append(law_info)
        
        # 분기별 통계 출력
        print(f"\n📊 분기별 분류 결과:")
        for quarter, laws in self.quarterly_data.items():
            print(f"   • {quarter}: {len(laws)}개")
        
        return self.quarterly_data
    
    def determine_quarter(self, date_str):
        """날짜 문자열로부터 분기 결정"""
        
        if len(date_str) < 8:
            return "기타"
        
        try:
            if date_str.startswith("2025"):
                month = int(date_str[4:6])
                if 1 <= month <= 3:
                    return "2025Q1"
                elif 4 <= month <= 6:
                    return "2025Q2"
                elif 7 <= month <= 9:
                    return "2025Q3"
                elif 10 <= month <= 12:
                    return "2025Q4"
            return "기타"
        except:
            return "기타"
    
    def create_law_info(self, law, sequence_id):
        """법규 정보 객체 생성"""
        
        # 시행일자 포맷 변환 (YYYYMMDD → YYYY-MM-DD)
        enforcement_date = str(law.get("수집시행일자", "")).replace("-", "")
        formatted_date = f"{enforcement_date[:4]}-{enforcement_date[4:6]}-{enforcement_date[6:8]}" if len(enforcement_date) >= 8 else enforcement_date
        
        return {
            "id": f"law_{sequence_id:03d}",
            "title": str(law.get("당사법령명", "")),
            "collectedTitle": str(law.get("수집법령명", "")),
            "effectiveDate": formatted_date,
            "originalDate": str(law.get("당사시행일자", "")),
            "lawType": str(law.get("법령종류", "")),
            "status": str(law.get("법령상태", "")),
            "categories": [str(law.get("직무카테고리", ""))],
            "meta": {
                "ministry": str(law.get("소관부처", "")),
                "source": str(law.get("수집소스", "")),
                "matchType": str(law.get("매칭타입", "")),
                "companyLawId": str(law.get("당사법규ID", ""))
            }
        }
    
    def generate_quarterly_files(self):
        """분기별 JSON 파일 생성"""
        
        print(f"\n📁 분기별 JSON 파일 생성 중...")
        
        # docs 폴더 확인/생성
        docs_path = "/home/user/webapp/docs"
        quarters_path = os.path.join(docs_path, "quarters")
        
        os.makedirs(quarters_path, exist_ok=True)
        
        generated_files = []
        
        for quarter, laws in self.quarterly_data.items():
            if not laws and quarter == "기타":  # 기타가 비어있으면 스킵
                continue
                
            # 분기별 파일 생성
            quarter_data = {
                "quarter": quarter,
                "year": 2025 if quarter.startswith("2025") else None,
                "generatedAt": datetime.now().isoformat(),
                "totalCount": len(laws),
                "description": f"{quarter} 시행 예정/현행 법규 목록 (100% 완전 매칭)",
                "items": laws
            }
            
            # 직무별 통계 추가
            categories_count = defaultdict(int)
            status_count = defaultdict(int)
            
            for law in laws:
                if law["categories"][0]:
                    categories_count[law["categories"][0]] += 1
                status_count[law["status"]] += 1
            
            quarter_data["statistics"] = {
                "byCategory": dict(categories_count),
                "byStatus": dict(status_count)
            }
            
            # JSON 파일 저장
            filename = f"{quarter.lower()}_laws.json"
            filepath = os.path.join(quarters_path, filename)
            
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(quarter_data, f, ensure_ascii=False, indent=2)
            
            generated_files.append(filepath)
            print(f"   ✅ {filename}: {len(laws)}개 법규")
        
        # 전체 요약 파일 생성
        summary_data = {
            "title": "2025년 분기별 법규 분류 요약",
            "generatedAt": datetime.now().isoformat(),
            "totalMatched": len(self.matched_laws),
            "quarterlyBreakdown": {
                quarter: {
                    "count": len(laws),
                    "percentage": round(len(laws) / len(self.matched_laws) * 100, 1) if len(self.matched_laws) > 0 else 0
                } for quarter, laws in self.quarterly_data.items() if laws
            },
            "description": "GitHub RegRader 프로젝트 - 당사 적용법규 207개 vs 수집법령 2809개 100% 완전 매칭 결과"
        }
        
        summary_path = os.path.join(quarters_path, "summary.json")
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(summary_data, f, ensure_ascii=False, indent=2)
        
        generated_files.append(summary_path)
        print(f"   ✅ summary.json: 전체 요약")
        
        return generated_files
    
    def update_main_index(self):
        """메인 index.json 파일 업데이트"""
        
        print(f"\n📋 메인 index.json 업데이트 중...")
        
        index_path = "/home/user/webapp/docs/index.json"
        
        try:
            # 기존 index.json 읽기
            with open(index_path, "r", encoding="utf-8") as f:
                main_data = json.load(f)
            
            # 분기별 링크 정보 추가
            main_data["quarterlyClassification"] = {
                "description": "2025년 분기별 법규 분류 (100% 완전 매칭 기준)",
                "totalMatched": len(self.matched_laws),
                "lastUpdated": datetime.now().isoformat(),
                "quarters": {
                    quarter: {
                        "count": len(laws),
                        "file": f"quarters/{quarter.lower()}_laws.json"
                    } for quarter, laws in self.quarterly_data.items() if laws
                }
            }
            
            # 업데이트된 index.json 저장
            with open(index_path, "w", encoding="utf-8") as f:
                json.dump(main_data, f, ensure_ascii=False, indent=2)
            
            print(f"   ✅ index.json 업데이트 완료")
            return True
            
        except Exception as e:
            print(f"   ❌ 업데이트 오류: {e}")
            return False

def main():
    """메인 실행"""
    
    print("🗓️ 분기별 법규 분류기")
    print("🔹 259개 100% 매칭 법규 → 분기별 JSON 파일 생성")
    print("=" * 60)
    
    classifier = QuarterlyClassifier()
    
    # 1. 매칭 결과 로드
    if not classifier.load_matched_laws():
        return
    
    # 2. 분기별 분류
    quarterly_data = classifier.classify_by_quarter()
    
    # 3. JSON 파일 생성
    generated_files = classifier.generate_quarterly_files()
    
    # 4. 메인 index 업데이트
    classifier.update_main_index()
    
    print(f"\n🎉 분기별 분류 완료!")
    print(f"📂 생성된 파일:")
    for file_path in generated_files:
        print(f"   • {os.path.basename(file_path)}")
    
    print(f"\n📊 분기별 요약:")
    total = sum(len(laws) for laws in quarterly_data.values())
    for quarter, laws in quarterly_data.items():
        if laws:
            percentage = len(laws) / total * 100 if total > 0 else 0
            print(f"   • {quarter}: {len(laws)}개 ({percentage:.1f}%)")

if __name__ == "__main__":
    main()