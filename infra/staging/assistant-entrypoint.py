"""Load mounted service secrets without exposing values in command arguments."""
import os
from pathlib import Path
import re
import sys


def secret(name: str, minimum: int = 1) -> str:
    path = os.environ.get(f"{name}_FILE", "")
    if not re.fullmatch(r"/run/secrets/[a-z_]+", path):
        raise ValueError("Missing secret file")
    value = Path(path).read_text(encoding="utf-8")
    if value.endswith("\n"):
        value = value[:-1].removesuffix("\r")
    if len(value) < minimum or any(char in value for char in "\r\n\0"):
        raise ValueError("Invalid secret file")
    return value


def main() -> None:
    for name in ("ASSISTANT_GATEWAY_TOKEN", "INTERNAL_TOOL_SERVICE_TOKEN"):
        os.environ[name] = secret(name, 32)
    os.environ["OPENROUTER_API_KEY"] = secret("OPENROUTER_API_KEY")
    os.execv("/app/agno-v2/.venv/bin/python", [
        "/app/agno-v2/.venv/bin/python", "-m", "uvicorn", "app.main:app",
        "--host", "127.0.0.1", "--port", "8010", "--no-access-log",
    ])


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("Staging configuration invalid; details suppressed", file=sys.stderr)
        sys.exit(1)
