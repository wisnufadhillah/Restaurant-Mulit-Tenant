from __future__ import annotations

from typing import Any, Callable


def build_playground_tools(on_tool_start: Callable | None = None, on_tool_end: Callable | None = None) -> list[Any]:
    def traced(name: str, args: dict[str, Any], result: dict[str, Any]) -> str:
        if on_tool_start:
            on_tool_start(name, args)
        if on_tool_end:
            on_tool_end(name, result)
        import json
        return json.dumps(result, ensure_ascii=False)

    def get_restaurant_data() -> str:
        """Get mock restaurant profile and menu data."""
        return traced("get_restaurant_data", {}, {
            "restaurant": "Warung Nusantara Playground",
            "menu": [
                {"name": "Nasi Goreng Kampung", "price": 28000, "available": True},
                {"name": "Ayam Bakar Madu", "price": 35000, "available": True},
                {"name": "Es Teh Manis", "price": 8000, "available": True},
            ],
        })

    def check_availability(date: str, time: str, guest_count: int, preferred_area: str | None = None) -> str:
        """Check mock table availability for a date, time, and guest count."""
        return traced("check_availability", {"date": date, "time": time, "guest_count": guest_count, "preferred_area": preferred_area}, {
            "available": True,
            "table": "A-04",
            "area": preferred_area or "Indoor",
            "date": date,
            "time": time,
            "guest_count": guest_count,
        })

    return [get_restaurant_data, check_availability]
