"""Verify built web over loopback HTTP and stop the process afterwards."""
from pathlib import Path
import subprocess
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
process = subprocess.Popen(['node', str(ROOT / 'apps/web/node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3005'], cwd=ROOT / 'apps/web', stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(60):
        if process.poll() is not None:
            raise RuntimeError('Web process exited before readiness')
        try:
            with urlopen('http://127.0.0.1:3005', timeout=1) as response:
                body = response.read().decode()
                assert response.status == 200
                assert 'Ada sela,' in body
                assert 'Dapur Sela' in body
                assert 'Layanan reservasi belum tersedia' in body
                assert '/images/padang-table.webp' in body
            with urlopen('http://127.0.0.1:3005/images/padang-table.webp', timeout=5) as image:
                assert image.status == 200
                assert image.headers.get_content_type() == 'image/webp'
            with urlopen('http://127.0.0.1:3005/dashboard', timeout=5) as dashboard:
                assert '/login' in dashboard.geturl()
                assert 'Masuk ke ruang kerja' in dashboard.read().decode()
            print('PASS built restaurant web, local image and unauthenticated staff redirect over loopback HTTP')
            break
        except OSError:
            time.sleep(0.25)
    else:
        raise TimeoutError('Web did not become ready')
finally:
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)
