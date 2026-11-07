import unittest
from knowledge_response import validated_knowledge, knowledge_question

class KnowledgeResponseTest(unittest.TestCase):
    def test_policy_detection_is_bounded_and_does_not_replace_operational_routing(self):
        for question in ['Boleh membawa kue?', 'Ada parkir?', 'Informasi alergen?', 'Menu dan kebijakan hewan?']:
            self.assertTrue(knowledge_question(question))
        for question in ['Harga rendang?', 'Jam buka hari ini?', 'Mau reservasi']:
            self.assertFalse(knowledge_question(question))

    def test_bounded_public_source_is_preserved(self):
        item = {'documentId': '11111111-1111-4111-8111-111111111111', 'revision': 1, 'position': 0, 'title': 'Synthetic FAQ', 'text': 'Synthetic guidance only.'}
        response = {'data': [item], 'source': 'restaurant_knowledge'}
        self.assertEqual(validated_knowledge(response), response)
        self.assertEqual(validated_knowledge({'data': [], 'source': 'restaurant_knowledge'})['data'], [])
        for change in [{'tenantId': 'foreign'}, {'revision': True}, {'text': 'x' * 2001}, {'documentId': 'invalid'}]:
            with self.assertRaises((ValueError, TypeError)):
                validated_knowledge({'data': [{**item, **change}], 'source': 'restaurant_knowledge'})
