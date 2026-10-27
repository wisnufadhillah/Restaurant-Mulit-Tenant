"""Exercise the Python tool against the local API without model inference."""
from pathlib import Path
import subprocess
import sys
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'apps' / 'assistant'))
from restaurant_tool import make_restaurant_tool


def main():
    process = subprocess.Popen(['node', 'apps/api/dist/main.js'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(60):
            if process.poll() is not None:
                raise RuntimeError('API process exited before readiness')
            try:
                with urlopen('http://127.0.0.1:3001/api/v1/health', timeout=1):
                    break
            except OSError:
                time.sleep(0.25)
        else:
            raise TimeoutError('API did not become ready')
        for slug in ('demo-padang', 'demo-keluarga'):
            result = make_restaurant_tool('http://127.0.0.1:3001', slug)()
            assert result['data']['slug'] == slug
            assert len(result['data']['outlets']) == 1
        print('PASS Python tool -> local API -> PostgreSQL for two public catalogues; no model called')
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


if __name__ == '__main__':
    main()
