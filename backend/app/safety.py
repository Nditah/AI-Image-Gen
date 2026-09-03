"""Prompt safety filter. Runs before any provider call so blocked text never leaves the API."""

from __future__ import annotations

import re
from dataclasses import dataclass

# Client-facing message is generic so callers cannot probe the denylist.
BLOCKED_PROMPT_MESSAGE = "This prompt was blocked by the content safety filter."
PROMPT_BLOCKED_CODE = "PROMPT_BLOCKED"

_DIGIT_LEET_TABLE = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t"})

# Standalone terms. Short words are matched on word boundaries only.
_BLOCKED_WORDS: dict[str, frozenset[str]] = {
    "OTHER": frozenset(
        {
            "fuck",
            "fucking",
            "fucked",
            "fucker",
            "shit",
            "shitty",
            "asshole",
            "bastard",
            "bitch",
            "cunt",
            "dick",
            "cock",
            "pussy",
            "whore",
            "slut",
            "wtf",
            "nsfw",
            "porn",
            "porno",
            "pornography",
            "xxx",
            "hentai",
            "boobs",
            "tits",
            "dildo",
            "orgasm",
            "cum",
            "semen",
            "masturbate",
            "masturbation",
        }
    ),
    "HATE_OR_HARASSMENT": frozenset(
        {
            "nigger",
            "nigga",
            "faggot",
            "fag",
            "kike",
            "spic",
            "retard",
            "retarded",
        }
    ),
    "VIOLENT_EXTREMISM": frozenset(
        {
            "beheading",
            "decapitate",
            "decapitation",
            "disembowel",
            "gore",
            "gory",
        }
    ),
    "NON_CONSENSUAL_INTIMATE": frozenset(
        {
            "rape",
            "raping",
            "raped",
            "molest",
            "molestation",
            "nonconsensual",
        }
    ),
    "DECEPTIVE_DEEPFAKE": frozenset(
        {
            "deepfake",
            "deepnude",
        }
    ),
    "CSAM": frozenset(
        {
            "loli",
            "lolita",
            "shota",
            "pedo",
            "pedophile",
            "paedophile",
            "childporn",
        }
    ),
}

_BLOCKED_PHRASES: dict[str, frozenset[str]] = {
    "CSAM": frozenset(
        {
            "child porn",
            "child pornography",
            "kids porn",
            "nude child",
            "naked child",
            "nude kid",
            "naked kid",
        }
    ),
    "NON_CONSENSUAL_INTIMATE": frozenset(
        {
            "revenge porn",
            "non consensual",
            "without consent",
        }
    ),
}

_MINOR_TERMS = frozenset(
    {
        "child",
        "children",
        "kid",
        "kids",
        "toddler",
        "infant",
        "minor",
        "underage",
        "preteen",
        "loli",
        "shota",
        "schoolgirl",
        "schoolboy",
    }
)

_SEXUAL_TERMS = frozenset(
    {
        "sex",
        "sexual",
        "sexy",
        "nude",
        "naked",
        "nsfw",
        "porn",
        "erotic",
        "hentai",
        "boobs",
        "tits",
        "penis",
        "vagina",
        "rape",
    }
)

_AGE_RE = re.compile(r"\b([0-9]{1,2})\s*(?:years?\s*old|yo|y/?o)\b")
_NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")
_REPEAT_RE = re.compile(r"(.)\1{2,}")
_ALL_REPEAT_RE = re.compile(r"(.)\1+")


@dataclass(frozen=True)
class PromptSafetyViolation:
    category: str
    reason: str


class PromptBlockedError(Exception):
    def __init__(self, violation: PromptSafetyViolation) -> None:
        super().__init__(BLOCKED_PROMPT_MESSAGE)
        self.violation = violation
        self.status_code = 400
        self.code = PROMPT_BLOCKED_CODE


def _decode_leet_token(token: str) -> str:
    if any(ch.isalpha() for ch in token) and any(ch.isdigit() for ch in token):
        return token.translate(_DIGIT_LEET_TABLE)
    return token


def _normalize(prompt: str) -> str:
    lowered = prompt.lower().replace("*", "").replace("@", "a").replace("$", "s").replace("!", "i")
    spaced = _NON_ALNUM_RE.sub(" ", lowered)
    decoded = " ".join(_decode_leet_token(token) for token in spaced.split() if token)
    return _REPEAT_RE.sub(r"\1\1", decoded).strip()


def _token_list(normalized: str) -> list[str]:
    return [token for token in normalized.split() if token]


def _join_single_letter_runs(tokens: list[str]) -> set[str]:
    """Rebuild words that were split as f u c k without matching inside scunthorpe."""
    rebuilt: set[str] = set()
    buffer: list[str] = []
    for token in tokens:
        if len(token) == 1:
            buffer.append(token)
            continue
        if buffer:
            rebuilt.add("".join(buffer))
            buffer = []
        rebuilt.add(token)
    if buffer:
        rebuilt.add("".join(buffer))
    return rebuilt


def _contains_term(normalized: str, squeezed: str, rebuilt_tokens: set[str], term: str) -> bool:
    if " " in term:
        padded_term = f" {term} "
        return padded_term in f" {normalized} " or padded_term in f" {squeezed} "
    pattern = rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])"
    if re.search(pattern, normalized) or re.search(pattern, squeezed):
        return True
    return len(term) >= 4 and term in rebuilt_tokens


def screen_prompt(prompt: str) -> PromptSafetyViolation | None:
    """Return a violation if the prompt must not be sent to an image provider."""
    normalized = _normalize(prompt)
    squeezed = _ALL_REPEAT_RE.sub(r"\1", normalized)
    tokens = _token_list(normalized)
    token_set = set(tokens) | set(_token_list(squeezed))
    rebuilt_tokens = _join_single_letter_runs(tokens) | _join_single_letter_runs(_token_list(squeezed))

    for category, phrases in _BLOCKED_PHRASES.items():
        for phrase in phrases:
            if _contains_term(normalized, squeezed, rebuilt_tokens, phrase):
                return PromptSafetyViolation(category=category, reason="blocked_phrase")

    for category, words in _BLOCKED_WORDS.items():
        for word in words:
            if _contains_term(normalized, squeezed, rebuilt_tokens, word):
                return PromptSafetyViolation(category=category, reason="blocked_term")

    if token_set & _MINOR_TERMS and token_set & _SEXUAL_TERMS:
        return PromptSafetyViolation(category="CSAM", reason="minor_sexual_combination")

    for haystack in (normalized, squeezed):
        for match in _AGE_RE.finditer(haystack):
            if int(match.group(1)) < 18 and token_set & _SEXUAL_TERMS:
                return PromptSafetyViolation(category="CSAM", reason="underage_sexual_combination")

    return None


def ensure_prompt_allowed(prompt: str) -> None:
    violation = screen_prompt(prompt)
    if violation is not None:
        raise PromptBlockedError(violation)
