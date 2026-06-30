#!/usr/bin/env python3
"""Static server for src/ with Webflow-style clean URLs (/aboutme -> aboutme.html) AND
HTTP Range support (206 Partial Content) so <video> elements load/seek correctly."""
import os, sys, re, http.server, socketserver
from urllib.parse import urlparse, unquote

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5050

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def translate_path(self, path):
        p = unquote(urlparse(path).path)
        full = os.path.normpath(os.path.join(ROOT, p.lstrip("/")))
        if os.path.isdir(full):
            idx = os.path.join(full, "index.html")
            if os.path.exists(idx):
                return idx
        if not os.path.exists(full) and not os.path.splitext(full)[1]:
            html = full + ".html"
            if os.path.exists(html):
                return html
        return full

    def do_GET(self):
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)
        if rng and os.path.isfile(path):
            try:
                self._serve_range(path, rng)
                return
            except Exception:
                pass
        super().do_GET()

    def _serve_range(self, path, rng):
        size = os.path.getsize(path)
        m = re.match(r"bytes=(\d*)-(\d*)", rng)
        start_s, end_s = m.group(1), m.group(2)
        if start_s == "":  # suffix range: last N bytes
            length = int(end_s); start = max(0, size - length); end = size - 1
        else:
            start = int(start_s); end = int(end_s) if end_s else size - 1
        end = min(end, size - 1)
        if start > end or start >= size:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers(); return
        length = end - start + 1
        ctype = self.guess_type(path)
        self.send_response(206)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(length))
        self.end_headers()
        with open(path, "rb") as f:
            f.seek(start); remaining = length
            while remaining > 0:
                chunk = f.read(min(65536, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk); remaining -= len(chunk)

    def end_headers(self):
        # advertise range support on normal responses too
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def log_message(self, *a):
        pass

class TCP(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

with TCP(("127.0.0.1", PORT), H) as httpd:
    print(f"serving {ROOT} at http://127.0.0.1:{PORT}", flush=True)
    httpd.serve_forever()
