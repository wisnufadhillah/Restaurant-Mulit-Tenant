import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))
from chat import is_in_scope, mask_private, run_tool, validate_args, validate_output


class ChatbotSimulatorTests(unittest.TestCase):
    def test_private_values_are_masked(self):
        safe = mask_private("Hubungi 081234567890 atau demo@example.com")
        self.assertNotIn("081234567890", safe)
        self.assertNotIn("demo@example.com", safe)

    def test_invalid_tool_and_arguments_are_rejected(self):
        with self.assertRaises(ValueError):
            validate_args("cancel_reservation", {})
        with self.assertRaises(ValueError):
            validate_args("check_availability", {"date": "2026-11-06", "time": "19:00", "pax": 0})

    def test_scope_guard_rejects_unrelated_requests(self):
        self.assertFalse(is_in_scope("Buatkan saya coding landing page coffee shop"))
        self.assertTrue(is_in_scope("Harga Rendang Demo berapa?"))

    def test_output_must_be_grounded_and_must_not_claim_booking(self):
        menu = run_tool("search_menu", {"query": "Rendang"}, "demo-padang")
        self.assertTrue(validate_output("Harga menu Rendang?", "Harganya Rp 32.000.", [{"name": "search_menu", "result": menu}]))
        self.assertFalse(validate_output("Harga menu Rendang?", "Harganya Rp 99.000.", [{"name": "search_menu", "result": menu}]))
        proposal = run_tool("prepare_reservation", {"date": "2026-11-06", "time": "19:00", "pax": 4}, "demo-padang")
        self.assertFalse(validate_output("Reservasi meja 4 orang", "Reservasi berhasil dibuat.", [{"name": "prepare_reservation", "result": proposal}]))

    def test_availability_is_deterministic_and_proposal_does_not_write(self):
        args = {"date": "2026-11-06", "time": "19:00", "pax": 4}
        first = run_tool("check_availability", args, "demo-padang")
        second = run_tool("check_availability", args, "demo-padang")
        self.assertEqual(first, second)
        proposal = run_tool("prepare_reservation", args, "demo-padang")
        self.assertFalse(proposal["write_performed"])
        self.assertTrue(proposal["proposal_id"].startswith("proposal-"))


if __name__ == "__main__":
    unittest.main()
