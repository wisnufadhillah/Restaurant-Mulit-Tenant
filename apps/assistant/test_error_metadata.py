import json
import unittest
import httpx
from error_metadata import safe_error_metadata


class MetadataTest(unittest.TestCase):
    def test_platform_headers_and_upstream_marker_are_separate(self):
        self.assertEqual(safe_error_metadata(429, httpx.Headers({'x-ratelimit-limit': '20', 'x-ratelimit-remaining': '0'}), b'{}')['limit_scope'], 'platform')
        body = json.dumps({'error': {'message': 'synthetic-private', 'metadata': {'provider_code': 'synthetic-private', 'error_type': 'provider_rate_limit_exceeded'}}}).encode()
        result = safe_error_metadata(429, httpx.Headers(), body)
        self.assertEqual(result['limit_scope'], 'upstream')
        self.assertNotIn('synthetic-private', json.dumps(result))

    def test_untrusted_headers_and_malformed_body_are_not_logged(self):
        result = safe_error_metadata(429, httpx.Headers({'retry-after': 'synthetic-private', 'x-ratelimit-limit': '9' * 100}), b'not json')
        self.assertEqual(result, {'limit_scope': 'unknown'})


if __name__ == '__main__':
    unittest.main()
