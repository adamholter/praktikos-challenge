"""Receive a locally recorded browser demo. Bound to loopback only."""
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import sys
output = Path(sys.argv[1]).expanduser()
class Receiver(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', 'http://localhost:5183')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    def do_POST(self):
        length=int(self.headers.get('Content-Length','0'))
        if self.path!='/recording' or length>100_000_000:
            self.send_error(400);return
        data=self.rfile.read(length)
        output.write_bytes(data)
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', 'http://localhost:5183')
        self.end_headers();self.wfile.write(str(len(data)).encode())
HTTPServer(('127.0.0.1',5194),Receiver).serve_forever()
