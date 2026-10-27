"""Check compiled local services without connecting to external providers."""
import json
from pathlib import Path
import subprocess
import sys
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]


def check(command, url, expected):
    process = subprocess.Popen(command, cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(60):
            if process.poll() is not None:
                raise RuntimeError("Local service exited before readiness")
            try:
                with urlopen(url, timeout=1) as response:
                    payload = json.load(response)
                if payload != expected:
                    raise AssertionError("Unexpected health response")
                print(f"PASS {url}")
                return
            except OSError:
                time.sleep(0.25)
        raise TimeoutError("Local service did not become ready")
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


if __name__ == "__main__":
    check(["node", "apps/api/dist/main.js"], "http://127.0.0.1:3001/api/v1/health", {"status": "ok", "service": "restaurant-api"})
    check([sys.executable, "apps/assistant/health.py"], "http://127.0.0.1:8000/health", {"status": "ok", "service": "restaurant-assistant", "model_enabled": False})
