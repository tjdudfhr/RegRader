#!/usr/bin/env python3
"""
RegRader 앱 아이콘 생성 스크립트
사용법: python generate_icons.py

필요 라이브러리:
  pip install Pillow

원본 아이콘 파일: docs/icon-512.png (512x512 이상 권장)
"""

from PIL import Image
import os

# 원본 아이콘 경로 (512x512 png)
SOURCE_ICON = "docs/icon-512.png"

# iOS 아이콘 사이즈 목록 (파일명, 크기)
IOS_ICONS = [
    ("AppIcon-20@2x.png",   40),
    ("AppIcon-20@3x.png",   60),
    ("AppIcon-29@2x.png",   58),
    ("AppIcon-29@3x.png",   87),
    ("AppIcon-40@2x.png",   80),
    ("AppIcon-40@3x.png",   120),
    ("AppIcon-60@2x.png",   120),
    ("AppIcon-60@3x.png",   180),
    ("AppIcon-76.png",      76),
    ("AppIcon-76@2x.png",   152),
    ("AppIcon-83.5@2x.png", 167),
    ("AppIcon-1024.png",    1024),  # App Store용
]

# Android 아이콘 폴더 및 사이즈
ANDROID_ICONS = [
    ("mipmap-mdpi",    48),
    ("mipmap-hdpi",    72),
    ("mipmap-xhdpi",   96),
    ("mipmap-xxhdpi",  144),
    ("mipmap-xxxhdpi", 192),
]

# Google Play Store용
PLAY_STORE_ICON_SIZE = 512

def create_ios_icons(src_img, output_dir="icons/ios"):
    os.makedirs(output_dir, exist_ok=True)
    print("iOS 아이콘 생성 중...")
    for filename, size in IOS_ICONS:
        img = src_img.copy()
        img = img.resize((size, size), Image.LANCZOS)
        out_path = os.path.join(output_dir, filename)
        img.save(out_path, "PNG")
        print(f"  {filename} ({size}x{size})")
    print(f"iOS 아이콘 {len(IOS_ICONS)}개 생성 완료 -> {output_dir}/")

def create_android_icons(src_img, output_dir="icons/android"):
    os.makedirs(output_dir, exist_ok=True)
    print("Android 아이콘 생성 중...")
    for folder, size in ANDROID_ICONS:
        folder_path = os.path.join(output_dir, folder)
        os.makedirs(folder_path, exist_ok=True)
        img = src_img.copy()
        img = img.resize((size, size), Image.LANCZOS)
        out_path = os.path.join(folder_path, "ic_launcher.png")
        img.save(out_path, "PNG")

        # Round icon 버전도 생성
        out_round_path = os.path.join(folder_path, "ic_launcher_round.png")
        img.save(out_round_path, "PNG")
        print(f"  {folder}/ic_launcher.png ({size}x{size})")

    # Google Play Store용 512x512
    play_path = os.path.join(output_dir, "play_store_icon.png")
    img_play = src_img.copy().resize((PLAY_STORE_ICON_SIZE, PLAY_STORE_ICON_SIZE), Image.LANCZOS)
    img_play.save(play_path, "PNG")
    print(f"  play_store_icon.png ({PLAY_STORE_ICON_SIZE}x{PLAY_STORE_ICON_SIZE}) - Google Play 스토어용")

    print(f"Android 아이콘 생성 완료 -> {output_dir}/")

def main():
    if not os.path.exists(SOURCE_ICON):
        print(f"원본 아이콘 파일을 찾을 수 없습니다: {SOURCE_ICON}")
        print("   docs/icon-512.png 파일을 확인해주세요.")
        return

    print(f"원본 아이콘 로드: {SOURCE_ICON}")
    src_img = Image.open(SOURCE_ICON).convert("RGBA")
    print(f"원본 크기: {src_img.size[0]}x{src_img.size[1]}")

    if src_img.size[0] < 512 or src_img.size[1] < 512:
        print("경고: 원본 이미지가 512x512 미만입니다. 화질 저하가 발생할 수 있습니다.")

    create_ios_icons(src_img)
    create_android_icons(src_img)

    print("모든 아이콘 생성 완료!")
    print("생성된 폴더:")
    print("  icons/ios/       -> Xcode 프로젝트의 Assets.xcassets/AppIcon.appiconset/ 에 복사")
    print("  icons/android/   -> Android 프로젝트의 app/src/main/res/ 에 복사")

if __name__ == "__main__":
    main()
