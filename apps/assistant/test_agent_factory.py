import unittest
from unittest.mock import patch

from agent_factory import ModelSettings, create_restaurant_agent


def settings(**overrides):
    data = {"OPENROUTER_MODEL": "example/demo:free", "OPENROUTER_ALLOWED_MODELS": "example/demo:free", "OPENROUTER_API_KEY": "synthetic-test-value"}
    data.update(overrides)
    return data


class AgentFactoryTest(unittest.TestCase):
    def test_rejects_paid_missing_or_non_allowlisted_model(self):
        for change in [dict(OPENROUTER_MODEL="example/paid"), dict(OPENROUTER_API_KEY=""), dict(OPENROUTER_ALLOWED_MODELS=""), dict(OPENROUTER_MODEL="example/other:free"), dict(OPENROUTER_ALLOWED_MODELS="example/paid")]:
            with self.subTest(change=list(change)):
                with self.assertRaisesRegex(ValueError, "Explicit free model"):
                    ModelSettings.from_environment(settings(**change))

    def test_settings_repr_does_not_show_key(self):
        self.assertNotIn("synthetic-test-value", repr(ModelSettings.from_environment(settings())))

    def test_constructs_one_read_only_agent_without_network(self):
        with patch("socket.socket.connect", side_effect=AssertionError("Network forbidden in offline test")):
            agent = create_restaurant_agent(ModelSettings.from_environment(settings()), "http://127.0.0.1:3001", "demo-padang")
        self.assertEqual(agent.model.id, "example/demo:free")
        self.assertEqual(agent.tool_call_limit, 1)
        self.assertFalse(agent.telemetry)
        self.assertFalse(agent.debug_mode)
        self.assertEqual(agent.model.max_retries, 0)
        self.assertEqual(len(agent.tools), 1)
        self.assertEqual(agent.tools[0].__name__, "get_restaurant_info")
        self.assertIsNone(agent.db)


if __name__ == "__main__":
    unittest.main()
