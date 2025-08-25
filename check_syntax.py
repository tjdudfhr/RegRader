#!/usr/bin/env python3
import re

def extract_and_check_script():
    """HTML에서 script 태그 내용을 추출하여 구문 검사"""
    
    with open('docs/index.html', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # <script> 태그 내용 추출
    script_pattern = r'<script>(.*?)</script>'
    scripts = re.findall(script_pattern, content, re.DOTALL)
    
    print(f"📄 발견된 스크립트 블록: {len(scripts)}개")
    
    for i, script in enumerate(scripts):
        if len(script.strip()) > 100:  # 의미있는 스크립트만
            print(f"\n🔍 스크립트 블록 #{i+1} (길이: {len(script)})")
            
            # 중괄호 개수 검사
            open_braces = script.count('{')
            close_braces = script.count('}')
            
            print(f"   중괄호 열림: {open_braces}")
            print(f"   중괄호 닫힘: {close_braces}")
            print(f"   균형: {'✅' if open_braces == close_braces else '❌'}")
            
            # 괄호 개수 검사
            open_parens = script.count('(')
            close_parens = script.count(')')
            
            print(f"   소괄호 열림: {open_parens}")
            print(f"   소괄호 닫힘: {close_parens}")
            print(f"   균형: {'✅' if open_parens == close_parens else '❌'}")
            
            # 대괄호 개수 검사
            open_brackets = script.count('[')
            close_brackets = script.count(']')
            
            print(f"   대괄호 열림: {open_brackets}")
            print(f"   대괄호 닫힘: {close_brackets}")
            print(f"   균형: {'✅' if open_brackets == close_brackets else '❌'}")
            
            if open_braces != close_braces:
                print(f"❌ 중괄호 불균형 감지!")
                # 불균형 위치 찾기
                balance = 0
                problem_line = 1
                for j, char in enumerate(script):
                    if char == '\n':
                        problem_line += 1
                    elif char == '{':
                        balance += 1
                    elif char == '}':
                        balance -= 1
                        if balance < 0:
                            print(f"   문제 위치: 라인 {problem_line} 근처")
                            break

if __name__ == "__main__":
    extract_and_check_script()