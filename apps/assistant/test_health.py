import unittest
from importlib.metadata import version

from agno.agent import Agent
from agno.models.openrouter import OpenRouter
from health import HealthHandler


class FoundationTest(unittest.TestCase):
    def test_agent_dependencies_import_without_inference(self):
        self.assertTrue(version("agno"))
        self.assertTrue(callable(Agent))
        self.assertTrue(callable(OpenRouter))

    def test_health_handler_exists_without_model_credentials(self):
        self.assertTrue(callable(HealthHandler.do_GET))


if __name__ == "__main__":
    unittest.main()
