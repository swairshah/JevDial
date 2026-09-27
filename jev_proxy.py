import json
import os
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load_env(path):
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.removeprefix("export ").partition("=")
        value = value.strip()
        if value[:1] in "\"'" and value[-1:] == value[:1]:
            value = value[1:-1]
        else:
            value = value.split(" #", 1)[0].strip()
        os.environ.setdefault(key.strip(), value)


load_env(ROOT / ".env")

JEV_UPSTREAM = os.environ.get("TYPESAFE_BASE_URL", "https://api.typesafe.ai").rstrip("/") + "/v1/systemone"
LLM_UPSTREAM = "https://openrouter.ai/api/v1/chat/completions"
KEV_UPSTREAM = "https://openrouter.ai/api/v1/systemone"
JEV_KEY = os.environ.get("TYPESAFE_API_KEY", "")
LLM_KEY = os.environ.get("OPENROUTER_API_KEY", "")

ROUTES = {
    "/api/jev": (JEV_UPSTREAM, JEV_KEY, "TYPESAFE_API_KEY"),
    "/api/llm": (LLM_UPSTREAM, LLM_KEY, "OPENROUTER_API_KEY"),
    "/api/kev": (KEV_UPSTREAM, LLM_KEY, "OPENROUTER_API_KEY"),
}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_body(self, status, body, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status, payload):
        self.send_body(status, json.dumps(payload).encode())

    def do_GET(self):
        if self.path.startswith("/api/jev/health"):
            return self.send_json(200, {"ok": True, "has_key": bool(JEV_KEY), "has_llm_key": bool(LLM_KEY)})
        if Path(self.path.split("?")[0]).name.startswith(".env"):
            return self.send_json(404, {"error": "not found"})
        return super().do_GET()

    def do_POST(self):
        route = ROUTES.get(self.path.split("?")[0].rstrip("/"))
        if not route:
            return self.send_json(404, {"error": "not found"})
        upstream, key, env_name = route
        data = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        auth = self.headers.get("Authorization") or (f"Bearer {key}" if key else "")
        if not auth:
            return self.send_json(401, {"error": f"No key. Set {env_name} in .env or paste it in Settings."})
        req = urllib.request.Request(
            upstream,
            data=data,
            method="POST",
            headers={
                "Authorization": auth,
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "word-dial-proxy",
                "X-Title": "Word Dial",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                status, body = resp.status, resp.read()
        except urllib.error.HTTPError as e:
            status, body = e.code, e.read()
        except urllib.error.URLError as e:
            return self.send_json(502, {"error": str(e.reason)})
        self.send_body(status, body)

    def log_message(self, fmt, *args):
        if args and "/api/" in str(args[0]):
            sys.stderr.write("%s\n" % (fmt % args))


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    mark = lambda k: "yes" if k else "no"
    print(f"Word Dial on http://127.0.0.1:{port}  (.env keys: TypeSafe {mark(JEV_KEY)}, OpenRouter {mark(LLM_KEY)})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
