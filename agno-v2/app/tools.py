import json
from typing import Any, Callable

from .backend import call_restaurant_api, internal_headers


def build_tools(
    tenant_slug: str,
    request_headers: dict[str, str],
    on_tool: Callable[[str, dict[str, Any], dict[str, Any]], None] | None = None,
) -> list[Any]:
    headers = internal_headers(request_headers)

    def record(name: str, arguments: dict[str, Any], result: dict[str, Any]) -> str:
        if on_tool:
            on_tool(name, arguments, result)
        return json.dumps(result, ensure_ascii=False)

    async def get_restaurant_info() -> str:
        """Read current profile and opening hours for the server-bound tenant."""
        result = await call_restaurant_api(
            "GET", f"/api/v1/internal/tenants/{tenant_slug}/restaurant", headers=headers
        )
        return record("get_restaurant_info", {}, result)

    async def search_menu(query: str | None = None) -> str:
        """Read the active menu and current prices for the server-bound tenant."""
        if query is not None and (not isinstance(query, str) or len(query) > 120):
            raise ValueError("Invalid menu query")
        result = await call_restaurant_api(
            "GET", f"/api/v1/internal/tenants/{tenant_slug}/menu", headers=headers
        )
        if query:
            needle = query.casefold().strip()
            data = result.get("data", [])
            result = {**result, "data": [item for item in data if needle in f"{item.get('name', '')} {item.get('description', '')}".casefold()]}
        return record("search_menu", {"query": query}, result)

    async def search_knowledge(query: str) -> str:
        """Search only published FAQ and policy excerpts for the server-bound tenant."""
        if not isinstance(query, str) or not query.strip() or len(query) > 500:
            raise ValueError("Invalid knowledge query")
        result = await call_restaurant_api(
            "GET", f"/api/v1/internal/tenants/{tenant_slug}/knowledge", params={"q": query}, headers=headers
        )
        return record("search_knowledge", {"query": query}, result)

    return [get_restaurant_info, search_menu, search_knowledge]
