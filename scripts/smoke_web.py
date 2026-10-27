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
                assert 'Website restoran' in body
            print('PASS built web serves placeholder over loopback HTTP')
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
