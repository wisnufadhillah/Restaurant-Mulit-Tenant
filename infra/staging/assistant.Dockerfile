FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /uvx /bin/
ENV UV_PYTHON_DOWNLOADS=never UV_LINK_MODE=copy
WORKDIR /app/agno-v2
COPY agno-v2/pyproject.toml agno-v2/uv.lock ./
COPY agno-v2/app ./app
RUN uv sync --frozen --no-dev --python /usr/local/bin/python

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app/agno-v2
COPY --from=build /app/agno-v2 /app/agno-v2
COPY apps/assistant /app/apps/assistant
COPY infra/staging/assistant-entrypoint.py /app/infra/staging/assistant-entrypoint.py
USER 10001:10001
ENTRYPOINT ["python", "/app/infra/staging/assistant-entrypoint.py"]
