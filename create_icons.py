#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
import base64
from io import BytesIO

def create_icon(size):
    # 이미지 생성
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 배경 - 보라색 그라데이션 효과를 단색으로 대체
    background_color = (102, 126, 234)  # #667eea
    draw.rounded_rectangle([0, 0, size, size], radius=size//8, fill=background_color)
    
    # 텍스트 - RR
    text = "RR"
    # 기본 폰트 사용
    try:
        font_size = int(size * 0.35)
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        font = ImageFont.load_default()
    
    # 텍스트 위치 계산
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    position = ((size - text_width) // 2, (size - text_height) // 2 - size // 20)
    
    # 텍스트 그리기
    draw.text(position, text, fill='white', font=font)
    
    # 서브 텍스트 - 법령
    subtext = "법령"
    try:
        subfont_size = int(size * 0.12)
        subfont = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", subfont_size)
    except:
        subfont = ImageFont.load_default()
    
    sub_bbox = draw.textbbox((0, 0), subtext, font=subfont)
    sub_width = sub_bbox[2] - sub_bbox[0]
    sub_position = ((size - sub_width) // 2, size // 2 + size // 4)
    draw.text(sub_position, subtext, fill='white', font=subfont)
    
    return img

# 아이콘 생성 및 저장
icon_192 = create_icon(192)
icon_512 = create_icon(512)

icon_192.save('docs/icon-192.png', 'PNG')
icon_512.save('docs/icon-512.png', 'PNG')

print("아이콘 생성 완료!")
print("- docs/icon-192.png")
print("- docs/icon-512.png")