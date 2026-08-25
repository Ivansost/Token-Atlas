import unittest

from backend.app.events import attention_ref, step_event, token_ref


class EventPrecisionTests(unittest.TestCase):
    def test_model_measurements_are_not_rounded_to_zero(self):
        probability = 4.9e-7
        weight = 3.1e-8
        self.assertEqual(token_ref(7, "x", probability)["prob"], probability)
        self.assertEqual(attention_ref(2, "y", weight)["weight"], weight)

        event = step_event(
            0,
            token_ref(7, "x", probability),
            [],
            [],
            [weight, probability],
            [],
        )
        self.assertEqual(event["attention_row"], [weight, probability])


if __name__ == "__main__":
    unittest.main()
