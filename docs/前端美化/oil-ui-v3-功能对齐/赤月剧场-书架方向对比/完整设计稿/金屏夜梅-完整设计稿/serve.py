"""Serve the local design collection on its existing preview port."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class DesignServer(ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True
    allow_reuse_address = True

if __name__ == "__main__":
    collection = Path(__file__).resolve().parents[2]
    handler = partial(SimpleHTTPRequestHandler, directory=str(collection))
    DesignServer(("127.0.0.1", 8880), handler).serve_forever()
