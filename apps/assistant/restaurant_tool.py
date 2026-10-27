"""Read-only public catalogue tool; no database or private-session access."""
from pydantic import ValidationError
from restaurant_schema import RestaurantResponse
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import urlopen


class ToolUnavailable(RuntimeError):
    pass


def make_restaurant_tool(base_url, tenant_slug, opener=urlopen):
    """Bind application-selected public catalogue context outside model arguments."""
    parsed = urlsplit(base_url)
    if parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "localhost") or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
        raise ValueError("Only a loopback API origin is supported")
    if not isinstance(tenant_slug, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", tenant_slug) or len(tenant_slug) > 80:
        raise ValueError("Invalid public tenant slug")
    endpoint = f"{base_url.rstrip('/')}/api/v1/public/tenants/{tenant_slug}/restaurant"

    def get_restaurant_info() -> dict:
        """Read the current restaurant public profile and booking policies from the API."""
        try:
            with opener(endpoint, timeout=5) as response:
                content = response.read(65537)
                if len(content) > 65536:
                    raise ToolUnavailable("Restaurant information is unavailable")
                result = RestaurantResponse.model_validate_json(content)
            if result.data.slug != tenant_slug:
                raise ToolUnavailable("Restaurant information is unavailable")
            return result.model_dump(mode="json")
        except (HTTPError, URLError, TimeoutError, OSError, ValueError, ValidationError, AttributeError, TypeError):
            raise ToolUnavailable("Restaurant information is unavailable") from None

    return get_restaurant_info
