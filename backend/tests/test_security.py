import unittest

from app.security import enum_value, hash_password, hash_token, verify_password


class SecurityTests(unittest.TestCase):
    def test_password_roundtrip(self) -> None:
        hashed = hash_password("User123!")
        self.assertTrue(verify_password("User123!", hashed))
        self.assertFalse(verify_password("wrong-password", hashed))

    def test_token_hash_is_stable(self) -> None:
        self.assertEqual(hash_token("abc"), hash_token("abc"))
        self.assertNotEqual(hash_token("abc"), hash_token("abd"))

    def test_enum_value(self) -> None:
        self.assertEqual(enum_value("ADMIN"), "ADMIN")
        self.assertEqual(enum_value(None), "")


if __name__ == "__main__":
    unittest.main()
