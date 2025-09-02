#!/usr/bin/env python3
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

os.chdir('/home/user/webapp/docs')
server = HTTPServer(('0.0.0.0', 8080), SimpleHTTPRequestHandler)
print("Server running on port 8080")
server.serve_forever()
