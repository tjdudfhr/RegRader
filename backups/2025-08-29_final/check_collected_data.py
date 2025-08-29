#!/usr/bin/env python3
"""
수집된 데이터 분석
"""

import pandas as pd
import glob

def analyze_collected_data():
    """수집된 데이터 분석"""
    
    # 최신 파일 찾기
    files = glob.glob("/home/user/webapp/2025_Laws_Complete_*.xlsx")
    if not files:
        print("❌ 파일을 찾을 수 없습니다.")
        return
    
    latest_file = max(files, key=lambda x: x)
    print(f"📂 분석 파일: {latest_file}")
    
    try:
        df = pd.read_excel(latest_file, sheet_name="전체")
        
        print(f"\n📊 데이터 분석:")
        print(f"   총 건수: {len(df):,}개")
        
        # 상태별 분포
        print(f"\n🔍 상태별 분포:")
        if "법령상태" in df.columns:
            status_counts = df["법령상태"].value_counts()
            for status, count in status_counts.items():
                print(f"   - {status}: {count:,}개")
        
        # 소스별 분포  
        print(f"\n📋 소스별 분포:")
        if "수집소스" in df.columns:
            source_counts = df["수집소스"].value_counts()
            for source, count in source_counts.items():
                print(f"   - {source}: {count:,}개")
        
        # 연도별 분포
        print(f"\n📅 시행일자 범위:")
        if "시행일자" in df.columns:
            df_clean = df[df["시행일자"].notna()]
            if len(df_clean) > 0:
                min_date = df_clean["시행일자"].min()
                max_date = df_clean["시행일자"].max()
                print(f"   - 최소: {min_date}")
                print(f"   - 최대: {max_date}")
        
        # 샘플 데이터
        print(f"\n📋 샘플 데이터 (상위 5개):")
        print(df[["법령명", "시행일자", "법령상태", "수집소스"]].head())
        
        return df
        
    except Exception as e:
        print(f"❌ 분석 오류: {e}")
        return None

if __name__ == "__main__":
    analyze_collected_data()