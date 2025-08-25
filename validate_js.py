#!/usr/bin/env python3
import re
import json

def extract_precise_data_from_html():
    """HTML에서 preciseMatchedData를 추출하여 유효성 검사"""
    
    with open('docs/index.html', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # preciseMatchedData 찾기
    pattern = r'const preciseMatchedData = ({.*?});'
    match = re.search(pattern, content, re.DOTALL)
    
    if not match:
        print("❌ preciseMatchedData를 찾을 수 없습니다")
        return
    
    js_data = match.group(1)
    print("📄 JavaScript 데이터 길이:", len(js_data))
    
    try:
        # JSON으로 파싱 시도
        parsed_data = json.loads(js_data)
        print("✅ JSON 파싱 성공!")
        print(f"📊 총 법령: {parsed_data.get('total_laws', 0)}")
        print(f"📅 분기별: {parsed_data.get('by_quarter', {})}")
        return parsed_data
    except json.JSONDecodeError as e:
        print(f"❌ JSON 파싱 오류: {e}")
        print(f"오류 위치: {e.pos}")
        
        # 오류 위치 주변 텍스트 표시
        start = max(0, e.pos - 100)
        end = min(len(js_data), e.pos + 100)
        context = js_data[start:end]
        print(f"오류 컨텍스트:\n{context}")
        
        return None

if __name__ == "__main__":
    extract_precise_data_from_html()