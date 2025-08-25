#!/usr/bin/env python3
import http.server
import socketserver
import os
import sys

PORT = 8000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="/home/user/webapp/docs", **kwargs)
    
    def log_message(self, format, *args):
        sys.stdout.write(f"{self.log_date_time_string()} - {format % args}\n")
        sys.stdout.flush()

if __name__ == "__main__":
    os.chdir("/home/user/webapp/docs")
    
    with socketserver.TCPServer(("0.0.0.0", PORT), MyHTTPRequestHandler) as httpd:
        print(f"✅ 서버가 포트 {PORT}에서 시작되었습니다.")
        print(f"📁 문서 루트: /home/user/webapp/docs")
        sys.stdout.flush()
        httpd.serve_forever()