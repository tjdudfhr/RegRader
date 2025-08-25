#!/usr/bin/env python3
"""
사용자 제공 실제 적용 법규 206개를 직무별로 분류하여 새로운 법률 데이터베이스 생성
"""

import json
import hashlib
import time
from datetime import datetime

def generate_law_id(title):
    """법령 제목을 기반으로 고유 ID 생성"""
    return hashlib.md5(title.encode('utf-8')).hexdigest()

def categorize_law(title):
    """법령 제목을 기반으로 직무별 카테고리 분류"""
    
    # 인사노무 관련 키워드
    hr_keywords = [
        '파견근로자', '채용절차', '장애인고용', '장애인차별', '남녀고용평등', 
        '기간제', '단시간근로자', '근로기준법', '최저임금', '근로자퇴직급여', 
        '근로복지', '고용보험', '고용정책', '노동조합', '노동관계조정', 
        '근로자 참여', '협력 증진'
    ]
    
    # 공정거래 관련 키워드
    fair_trade_keywords = [
        '대리점 거래', '독점규제', '공정거래', '하도급거래', '상생협력', 
        '약관의 규제', '부정청탁', '금품등 수수'
    ]
    
    # 지식재산권 관련 키워드
    ip_keywords = [
        '특허법', '실용신안법', '의장법', '상표법', '부정경쟁방지', '영업비밀보호',
        '산업기술의 유출방지', '국가첨단전략산업'
    ]
    
    # 정보보호 관련 키워드  
    info_security_keywords = [
        '개인정보 보호', '정보통신망', '정보보호산업', '정보보호'
    ]
    
    # 재무회계 관련 키워드
    finance_keywords = [
        '상법', '외부감사', '법인세법', '지방세법', '임시수입부가가치세법',
        '증권거래세법', '종합부동산세법', '국제조세조정', '자본시장과 금융투자업'
    ]
    
    # 환경 관련 키워드
    environment_keywords = [
        '대기환경보전', '토양환경보전', '물환경보전', '폐기물관리', '해양폐기물',
        '잔류성 오염물질', '화학물질관리', '소음·진동관리', '자원의 절약과 재활용',
        '하수도법', '악취방지', '환경영향평가', '온실가스 배출권', '에너지이용 합리화',
        '환경정책기본법', '환경개선비용', '환경기술', '환경산업', '먹는물관리',
        '수도법', '자원순환기본법', '화학물질의 등록', '기후위기', '탄소중립',
        '녹색성장', '건설폐기물'
    ]
    
    # 안전 관련 키워드
    safety_keywords = [
        '산업안전보건', '고압가스 안전관리', '소방시설', '중대재해 처벌',
        '석면안전관리', '위험물 안전관리', '연구실 안전환경', '전기안전관리',
        '화재의 예방', '안전관리', '액화석유가스', '도시가스사업', '원자력안전',
        '승강기 안전관리', '감염병의 예방', '식품위생'
    ]
    
    # 키워드 매칭을 통한 카테고리 분류
    for keyword in hr_keywords:
        if keyword in title:
            return ['인사노무']
    
    for keyword in fair_trade_keywords:
        if keyword in title:
            return ['공정거래']
    
    for keyword in ip_keywords:
        if keyword in title:
            return ['지식재산권']
    
    for keyword in info_security_keywords:
        if keyword in title:
            return ['정보보호']
    
    for keyword in finance_keywords:
        if keyword in title:
            return ['재무회계']
    
    for keyword in environment_keywords:
        if keyword in title:
            return ['환경']
    
    for keyword in safety_keywords:
        if keyword in title:
            return ['안전']
    
    # 기본값: 지배구조 (분류되지 않은 법령)
    return ['지배구조']

def create_new_law_database():
    """새로운 법률 데이터베이스 생성"""
    
    # 법률 리스트 읽기
    with open('new_company_laws.txt', 'r', encoding='utf-8') as f:
        law_titles = [line.strip() for line in f if line.strip()]
    
    print(f"📋 총 {len(law_titles)}개 법령 처리 시작...")
    
    laws = []
    category_counts = {}
    
    for title in law_titles:
        # 카테고리 분류
        categories = categorize_law(title)
        
        # 카테고리별 개수 집계
        for category in categories:
            category_counts[category] = category_counts.get(category, 0) + 1
        
        # 법령 객체 생성
        law_obj = {
            "id": generate_law_id(title),
            "title": title,
            "summary": "",
            "effectiveDate": "2025-01-01",  # 기본 시행일
            "announcedDate": None,
            "lawType": "개정",
            "categories": categories,
            "meta": {
                "ministry": "관계부처",
                "lsId": None
            },
            "source": {
                "name": "실제 적용 법규",
                "url": f"https://www.law.go.kr/lsSc.do?query={title}",
                "search": f"https://www.law.go.kr/lsSc.do?query={title}"
            }
        }
        
        laws.append(law_obj)
    
    # 최종 데이터베이스 구조
    database = {
        "generatedAt": int(time.time()),
        "year": 2025,
        "description": "실제 당사 적용 법규 데이터베이스",
        "total_laws": len(laws),
        "category_counts": category_counts,
        "items": laws
    }
    
    # JSON 파일로 저장
    with open('docs/index.json', 'w', encoding='utf-8') as f:
        json.dump(database, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 새로운 법률 데이터베이스 생성 완료!")
    print(f"📊 총 법령 수: {len(laws)}개")
    print("📊 직무별 분포:")
    for category, count in sorted(category_counts.items()):
        print(f"   - {category}: {count}개")
    
    return database

if __name__ == "__main__":
    create_new_law_database()