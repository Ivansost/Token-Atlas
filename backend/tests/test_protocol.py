import unittest

from backend.app.protocol import (
    DEFAULT_MAX_TOKENS,
    MAX_PROMPT_CHARS,
    RequestValidationError,
    parse_generation_request,
)


class RequestValidationTests(unittest.TestCase):
    def test_valid_request_is_trimmed_and_defaults_length(self):
        request = parse_generation_request({"prompt": "  hello  "})
        self.assertEqual(request.prompt, "hello")
        self.assertEqual(request.max_tokens, DEFAULT_MAX_TOKENS)

    def test_invalid_shapes_and_bounds_are_rejected(self):
        invalid = [
            [],
            {"prompt": 42},
            {"prompt": "   "},
            {"prompt": "x" * (MAX_PROMPT_CHARS + 1)},
            {"prompt": "hello", "max_tokens": True},
            {"prompt": "hello", "max_tokens": "60"},
            {"prompt": "hello", "max_tokens": 0},
            {"prompt": "hello", "max_tokens": 121},
        ]
        for payload in invalid:
            with self.subTest(payload=payload):
                with self.assertRaises(RequestValidationError):
                    parse_generation_request(payload)


if __name__ == "__main__":
    unittest.main()
