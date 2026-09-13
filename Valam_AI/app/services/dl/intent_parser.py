"""
app/services/dl/intent_parser.py

Bilingual (Tamil + English) keyword intent parser for the CLI.

Classifies a spoken/written query into exactly one of:
    crop_recommendation  -> needs lat/long (soil + weather pipeline)
    disease_check        -> needs a leaf photo
    pest_check           -> needs a field/leaf photo
    unclear              -> keyword list matched nothing

Strategy:
- match the query in its OWN language (Tamil text against Tamil keywords,
  English text against English keywords);
- matching is OFFLINE and substring/word based (deliberately NOT a
  translator call — Whisper's 'base' model merges spoken Tamil into
  loosely-spelled chunks, so keyword *stems* like "வளர்" (grow) are used
  and matched as substrings);
- pest/disease keywords take precedence over generic crop words so a phrase
  like "my crop has disease" routes to disease_check, not crop_recommendation.
"""

INTENTS = ("crop_recommendation", "disease_check", "pest_check", "unclear")

ENGLISH_KEYWORDS = {
    "disease_check": [
        "disease", "sick", "infected", "infection",
        "spots", "spot", "wilting", "wilt", "blight", "rust", "rot",
        "yellowing", "fungus", "fungal",
    ],
    "pest_check": [
        "pest", "pests", "insect", "insects", "bug", "bugs", "worm",
        "worms", "caterpillar", "aphid", "aphids", "borer", "whitefly",
        "mites", "mite", "grasshopper", "beetle", "thrips", "armyworm",
    ],
    "crop_recommendation": [
        "crop", "crops", "grow", "growing", "plant", "planting",
        "suggest", "recommend", "recommendation", "which crop", "what to",
        "soil", "land", "field", "suitable", "best",
    ],
}

TAMIL_KEYWORDS = {
    "disease_check": [
        "நோய்", "நோயால்", "நோயுற்ற", "ரோய்", "வாடல்", "வாடும்",
        "புள்ளி", "புள்ளிகள்", "அழுகல்", "அழுகி",
    ],
    "pest_check": [
        "பூச்சி", "பூச்சிகள்", "பூசு", "வண்டு", "அந்துப்பூச்சி", "புழு",
        "கம்பளிப்புழு", "அசுவினி", "கொசு", "வெட்டுக்கிளி",
    ],
    "crop_recommendation": [
        "பயிர்", "பயிர்கள்", "வளர்க்க", "வளர்", "நிலம்", "மண்", "வயல்",
        "வயலில்", "பயிரிட", "என்ன பயிர்", "செய்வது", "பரிந்துரை", "விளை",
        "நட", "நடவு", "விதை", "விதைக்க", "அறுவடை",
    ],
}

# Match HIGH-priority (pest/disease) keyword lists first, then crop, so a
# phrase like "my crop has disease" or "worms on my crop leaves" routes to
# the right image check instead of crop_recommendation. Note: bare
# "leaf"/"leaves" deliberately are NOT keywords — "check this leaf" on its
# own is ambiguous (unknown disease vs pest) and should come back as
# "unclear", letting the image+model fallback path pick both checks.
_PRIORITY = ("pest_check", "disease_check", "crop_recommendation")

# Curated "forgiving stems": these are the ONLY keywords allowed to match via
# consonant-skeleton (see _tamil_consonants/_seq_within below). Whisper's
# 'base' model routinely mangles these specific Tamil words (doubled
# consonants collapse: பூச்சி->பூசி; initial consonant swaps: நோய்->ரோய்;
# merges words: ...பையிர்வளர்களாம்). Everything else must match EXACTLY as
# a substring, which is why common polysemes like "வேண்டும்" (should) never
# false-positive against "வண்டு" (beetle).
TAMIL_SKELETON_STEMS = {
    "crop_recommendation": ["பயிர", "வயல"],
    "pest_check": ["பூச"],
    "disease_check": ["ரோய்"],
}


def _tokenize(text: str) -> list[str]:
    return [t for t in text.casefold().split() if t]


# --- Tamil consonant-sequence matching -------------------------------------
# Whisper's 'base' model merges spoken Tamil into loosely-spelled chunks
# (doubled consonants collapse, a vowel sign gets swapped). Exact substring
# matching then misses real words ("பூச்சி" transcribed as "பூசி"). Robust
# trick: strip all Tamil vowel signs / vowels, and match the keyword's
# *consonant sequence* inside the text's consonant sequence, allowing a
# small gap (spans <= len(keyword) + _GAP). Order is preserved.
_GAP = 3

_TAMIL_VOWELS_START = 0x0B85  # அ
_TAMIL_VOWELS_END = 0x0B94    # ஔ
_TAMIL_SIGNS_START = 0x0BBE   # ா .. ௌ (incl. ி ீ ு ூ ெ ே ை ொ ோ ௌ), pulli ஂ/ஃ excluded
_TAMIL_SIGNS_END = 0x0BD7
_TAMIL_CONSONANT_START = 0x0B95  # க
_TAMIL_CONSONANT_END = 0x0BB9    # (0B95..0BB9, except the sign ranges overlap safely)


def _tamil_consonants(s: str) -> str:
    out = []
    for ch in s:
        cp = ord(ch)
        if _TAMIL_VOWELS_START <= cp <= _TAMIL_VOWELS_END:
            continue
        if _TAMIL_SIGNS_START <= cp <= _TAMIL_SIGNS_END:
            continue
        if _TAMIL_CONSONANT_START <= cp <= _TAMIL_CONSONANT_END:
            out.append(ch)
    return "".join(out)


def _seq_within(txt: str, kw: str, max_span: int) -> bool:
    """True if kw's chars appear in txt in order within max_span positions."""
    if not kw:
        return False
    n = len(txt)
    for start in range(n):
        if txt[start] != kw[0]:
            continue
        prev, j = start, 1
        limit = min(n, start + max_span)
        while j < len(kw) and prev + 1 < limit:
            found = -1
            for k in range(prev + 1, limit):
                if txt[k] == kw[j]:
                    found = k
                    break
            if found == -1:
                break
            j += 1
            prev = found
        if j == len(kw):
            return True
    return False


def _match_language(text: str, keywords: dict, language: str) -> tuple[str | None, list[str]]:
    """Return (intent, matched_keywords) or (None, []) for one keyword set."""
    lowered = text.casefold()

    if language == "ta":
        text_cons = _tamil_consonants(lowered)
        for intent in _PRIORITY:
            hits = []
            for k in keywords[intent]:
                if k.casefold() in lowered:
                    hits.append(k)
            for stem in TAMIL_SKELETON_STEMS.get(intent, ()):
                if stem in hits:
                    continue
                kc = _tamil_consonants(stem.casefold())
                if len(kc) >= 2 and _seq_within(text_cons, kc, len(kc) + _GAP):
                    hits.append(stem)
            if hits:
                return intent, hits
        return None, []

    for intent in _PRIORITY:
        hits = [k for k in keywords[intent] if k.casefold() in lowered]
        if hits:
            return intent, hits
    return None, []


def parse_intent(text: str, language: str = "en") -> dict:
    """
    Classify a spoken query. Purely offline — no translation calls.

    Returns: {"intent": <one of INTENTS>, "matched_keywords": [...],
              "language": lang, "translated_for_match": False}
    """
    text = (text or "").strip()
    if not text:
        return {
            "intent": "unclear",
            "matched_keywords": [],
            "language": language,
            "translated_for_match": False,
        }

    lang = "ta" if language in ("ta", "tam", "tamil") else "en"
    keyword_sets = TAMIL_KEYWORDS if lang == "ta" else ENGLISH_KEYWORDS

    intent, matched = _match_language(text, keyword_sets, lang)

    return {
        "intent": intent if intent is not None else "unclear",
        "matched_keywords": matched,
        "language": lang,
        "translated_for_match": False,
    }