import io
import json
import unittest
from urllib.error import URLError

from restaurant_tool import make_restaurant_tool, ToolUnavailable


class RestaurantToolTest(unittest.TestCase):
    def response(self, slug="demo-padang"):
        return io.BytesIO(json.dumps({"data": {"slug": slug, "name": "Demo", "outlets": []}, "source": "restaurant_api", "retrieved_at": "2026-10-27T00:00:00Z"}).encode())

    def test_tool_has_no_model_tenant_argument(self):
        calls = []
        def opener(url, timeout):
            calls.append((url, timeout))
            return self.response()
        tool = make_restaurant_tool("http://127.0.0.1:3001", "demo-padang", opener)
        self.assertEqual(tool()["data"]["slug"], "demo-padang")
        self.assertEqual(calls[0][1], 5)
        with self.assertRaises(TypeError):
            tool(tenant_id="other")

    def test_mismatched_tenant_result_is_rejected(self):
        tool = make_restaurant_tool("http://localhost:3001", "demo-padang", lambda *a, **k: self.response("demo-keluarga"))
        with self.assertRaises(ToolUnavailable):
            tool()

    def test_timeout_has_safe_failure_without_fabricated_data(self):
        def opener(*args, **kwargs):
            raise URLError("connection details")
        with self.assertRaisesRegex(ToolUnavailable, "^Restaurant information is unavailable$"):
            make_restaurant_tool("http://localhost:3001", "demo-padang", opener)()

    def test_invalid_context_is_rejected(self):
        for origin in ["https://example.com", "http://localhost@evil.test", "http://localhost/path"]:
            with self.assertRaises(ValueError):
                make_restaurant_tool(origin, "demo-padang")
        with self.assertRaises(ValueError):
            make_restaurant_tool("http://localhost", "../other")


    def test_malformed_and_unexpected_response_fields_are_rejected(self):
        valid = {"data": {"slug": "demo-padang", "name": "Demo", "outlets": []}, "source": "restaurant_api", "retrieved_at": "2026-10-27T00:00:00Z"}
        bad = [[], None, {**valid, "extra": "private"}, {**valid, "retrieved_at": "yesterday"}, {**valid, "retrieved_at": "2026-10-27T00:00:00"}, {**valid, "data": {"slug": "demo-padang", "name": "Demo", "outlets": [{}]}}]
        for payload in bad:
            with self.subTest(payload_type=type(payload).__name__):
                tool = make_restaurant_tool("http://localhost:3001", "demo-padang", lambda *a, **k: io.BytesIO(json.dumps(payload).encode()))
                with self.assertRaises(ToolUnavailable):
                    tool()

    def test_invalid_json_and_oversize_payload_are_rejected(self):
        for body in [b"not json", b"x" * 65537]:
            tool = make_restaurant_tool("http://localhost:3001", "demo-padang", lambda *a, **k: io.BytesIO(body))
            with self.assertRaises(ToolUnavailable):
                tool()

if __name__ == "__main__":
    unittest.main()
