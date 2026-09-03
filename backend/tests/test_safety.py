import unittest

from app.safety import screen_prompt


class PromptSafetyTests(unittest.TestCase):
    def test_allows_ordinary_prompts(self) -> None:
        self.assertIsNone(screen_prompt("A cinematic view of mountains at dawn"))
        self.assertIsNone(screen_prompt("classic oil painting of a harbor"))
        self.assertIsNone(screen_prompt("an assassin in a misty forest"))
        self.assertIsNone(screen_prompt("children playing soccer in a sunny park"))

    def test_blocks_profanity(self) -> None:
        self.assertIsNotNone(screen_prompt("a fuck-ton of neon lights in a city"))
        self.assertIsNotNone(screen_prompt("f u c k this landscape"))
        self.assertIsNotNone(screen_prompt("sh1t covered alleyway"))
        self.assertIsNotNone(screen_prompt("fuuuck this landscape"))

    def test_does_not_match_inside_longer_words(self) -> None:
        self.assertIsNone(screen_prompt("a classic still life with fruit"))
        self.assertIsNone(screen_prompt("the scunthorpe skyline at dusk"))

    def test_blocks_minor_sexual_combination(self) -> None:
        self.assertIsNotNone(screen_prompt("nude child in a garden"))
        self.assertIsNotNone(screen_prompt("a 12 year old sexy portrait"))
        self.assertIsNone(screen_prompt("a 12 year old soccer player kicking a ball"))


if __name__ == "__main__":
    unittest.main()
