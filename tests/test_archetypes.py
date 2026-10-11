"""판정 체계 점검을 단위 테스트로도 돌린다 (네트워크 없음)."""
import unittest

from engine import selfcheck


class SelfCheckTest(unittest.TestCase):
    def test_structure(self):
        errs = [e for e in selfcheck.check_structure() if not e.startswith("사전 판단이 없는")]
        self.assertEqual(errs, [])

    def test_archetypes_and_invariants(self):
        errs, n = selfcheck.check_archetypes()
        self.assertGreater(n, 100)
        self.assertEqual(errs, [])


if __name__ == "__main__":
    unittest.main()
