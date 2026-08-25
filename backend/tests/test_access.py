import unittest

from backend.app.access import SlidingWindowLimiter, normalise_origins, origin_allowed


class OriginTests(unittest.TestCase):
    def test_origin_matching_is_exact_and_normalised(self):
        allowed = normalise_origins(["https://example.com/", " http://localhost:5173 "])
        self.assertTrue(origin_allowed("https://example.com", allowed))
        self.assertTrue(origin_allowed("http://localhost:5173", allowed))
        self.assertFalse(origin_allowed("https://example.com.attacker.test", allowed))
        self.assertFalse(origin_allowed(None, allowed))


class SlidingWindowLimiterTests(unittest.TestCase):
    def test_client_limit_expires_on_a_rolling_window(self):
        limiter = SlidingWindowLimiter(client_limit=2, global_limit=10, window_seconds=60)
        self.assertTrue(limiter.check("a", now=0).allowed)
        self.assertTrue(limiter.check("a", now=10).allowed)
        blocked = limiter.check("a", now=20)
        self.assertFalse(blocked.allowed)
        self.assertEqual(blocked.retry_after_seconds, 40)
        self.assertTrue(limiter.check("a", now=61).allowed)

    def test_global_limit_catches_rotating_clients(self):
        limiter = SlidingWindowLimiter(client_limit=5, global_limit=2, window_seconds=30)
        self.assertTrue(limiter.check("a", now=0).allowed)
        self.assertTrue(limiter.check("b", now=1).allowed)
        blocked = limiter.check("c", now=2)
        self.assertFalse(blocked.allowed)
        self.assertEqual(blocked.retry_after_seconds, 28)


if __name__ == "__main__":
    unittest.main()
