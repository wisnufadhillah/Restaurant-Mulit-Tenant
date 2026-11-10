"""Explicit local browser live smoke; global inference cap, real internal API."""
import logging
import os
import uvicorn
from app import main
from smoke_live import LiveTransport

if os.environ.get('ALLOW_BROWSER_LIVE') != '1':
    raise RuntimeError('Explicit live approval required')
LiveTransport.limit = 6
original = main.run_gateway


async def bounded(request):
    return await original(request, model_transport=LiveTransport())


main.run_gateway = bounded
logging.disable(logging.CRITICAL)
uvicorn.run(main.app, host='127.0.0.1', port=8111, access_log=False, log_level='critical')
