#!/usr/bin/env python3
"""
현재 Excel 파일의 법령 수를 확인하는 스크립트
"""

import pandas as pd

def check_law_count():
    """현재 Excel 파일의 법령 수 확인"""
    
    excel_file = "/home/user/webapp/2025_Laws_Complete_20250828_083142.xlsx"
    
    try:
        # 전체 시트 읽기
        df_all = pd.read_excel(excel_file, sheet_name="전체")
        
        print(f"📊 현재 Excel 파일 분석: {excel_file.split('/')[-1]}")
        print("=" * 60)
        print(f"전체 법령 수: {len(df_all):,}개")
        
        # 법령상태별 분석
        if "법령상태" in df_all.columns:
            status_counts = df_all["법령상태"].value_counts()
            print(f"\n📋 법령상태별 분포:")
            for status, count in status_counts.items():
                print(f"   {status}: {count:,}개")
        
        # 수집소스별 분석
        if "수집소스" in df_all.columns:
            source_counts = df_all["수집소스"].value_counts()
            print(f"\n🔍 수집소스별 분포:")
            for source, count in source_counts.items():
                print(f"   {source}: {count:,}개")
        
        # 시행일자별 월 분포
        if "시행일자" in df_all.columns:
            df_all["시행일자_str"] = df_all["시행일자"].astype(str)
            df_all["월"] = df_all["시행일자_str"].str[:6]  # YYYYMM 형식
            month_counts = df_all["월"].value_counts().sort_index()
            print(f"\n📅 2025년 월별 시행 법령 분포 (상위 10개월):")
            for month, count in month_counts.head(10).items():
                if month.startswith("2025"):
                    print(f"   {month}: {count:,}개")
        
        return len(df_all)
        
    except Exception as e:
        print(f"❌ 파일 읽기 오류: {e}")
        return 0

def check_fast_collector_logic():
    """fast_law_collector의 로직 확인"""
    
    print(f"\n🔍 Fast Law Collector 로직 분석:")
    print("=" * 40)
    print("1. target=law (현행 법령)")
    print("2. target=eflaw (시행예정 법령)")
    print("3. efYd=20250101~20251231 (2025년 시행일자)")
    print("4. 중복 제거: 법령명 + 시행일자 기준")
    print("5. display=100, 페이지별 순차 수집")

if __name__ == "__main__":
    count = check_law_count()
    check_fast_collector_logic()
    
    print(f"\n💡 결론:")
    if count > 2700:
        print(f"   현재 수집량 {count:,}개는 이전 2,702개보다 {count - 2702}개 많습니다.")
        print(f"   가능한 원인:")
        print(f"   1. API 데이터 업데이트 (새로운 법령 추가)")
        print(f"   2. 중복 제거 기준 변경")
        print(f"   3. target=eflaw에서 추가 법령 발견")
    else:
        print(f"   현재 수집량 {count:,}개입니다.")