"""
cli.py — Valam AI multimodal CLI backend (Part 2, step 1).

Current scope (step 1): argument parsing + Whisper ASR with AUTO language
detection (Tamil vs English). Intent parsing / branching / TTS arrive in
later steps.

Usage:
    python scripts/cli.py --image leaf.jpg --voice query.wav --lat 11.0 --lon 78.0 --lang en

Languages: voice language is auto-detected by Whisper unless --lang is given.
Response language priority (resolved in later steps): --lang > detected voice
language > English.
"""

import argparse
import os
import sys

# Same MPS/OpenMP guard main.py uses — Whisper loads torch, which crashes on
# import if these aren't set early.
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

# This script lives in backend/scripts/ but imports the `app` package from the
# backend root, so put that root (the parent of scripts/) on sys.path. Explicit
# so the CLI works no matter which directory it is launched from.
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="valam-cli",
        description="Valam AI multimodal check — crop, disease, pest.",
    )
    parser.add_argument(
        "--image", "-i", type=str, default=None,
        help="Path to a leaf/field photo (required for disease and pest checks).",
    )
    parser.add_argument(
        "--voice", "-v", type=str, default=None,
        help="Path to a voice audio file (Tamil or English).",
    )
    parser.add_argument(
        "--lat", type=float, default=None,
        help="Farm latitude (required for crop recommendation).",
    )
    parser.add_argument(
        "--lon", type=float, default=None,
        help="Farm longitude (required for crop recommendation).",
    )
    parser.add_argument(
        "--lang", type=str, default=None,
        choices=["en", "ta"],
        help="Force response language (overrides auto-detection).",
    )
    parser.add_argument(
        "--whisper-model", type=str,
        default=os.getenv("VALAM_WHISPER_MODEL", "base"),
        help="Whisper model size. 'base' is cached locally and detects "
             "Tamil/English reliably; 'tiny' is weakest at auto-detect.",
    )
    return parser


def run_asr(audio_path: str, whisper_model: str) -> dict:
    """Transcribe a voice file with Whisper auto language detection."""
    from app.services.dl.voice_service import VoiceService

    service = VoiceService(model_size=whisper_model)
    return service.transcribe(audio_path, language=None)


def main() -> int:
    args = build_parser().parse_args()

    print("=" * 78)
    print("VALAM AI CLI — step 1 (args + Whisper ASR auto language detection)")
    print("=" * 78)
    print(
        f"Inputs     : image={args.image!r} voice={args.voice!r} "
        f"lat={args.lat!r} lon={args.lon!r} lang_override={args.lang!r}"
    )
    print(f"Whisper    : model={args.whisper_model} (auto-detect language)")

    has_image = args.image is not None
    has_voice = args.voice is not None

    if not has_voice and not has_image:
        print("\nNo --voice or --image given. Nothing to process.")
        return 1

    asr_result = None
    if has_voice:
        asr_result = run_asr(args.voice, args.whisper_model)
        print("\n----- ASR -----")
        prob = asr_result["language_probability"]
        print(f"  detected language : {asr_result['language']}  "
              f"(p={prob:.2f})" if prob is not None else
              f"  detected language : {asr_result['language']}")
        print(f"  transcribed text  : {asr_result['text']}")
        if asr_result["text"] == "":
            print("  ^ Whisper heard nothing (empty audio?)")
    else:
        print("\nNo voice file given — ASR skipped (image-only flow).")

    # ----- Step 2: bilingual intent parsing -----
    detected_lang = (asr_result or {}).get("language") or "ta"
    query_text = (asr_result or {}).get("text") or ""

    from app.services.dl.intent_parser import parse_intent

    parsed = parse_intent(query_text, language=detected_lang)
    print("\n----- INTENT -----")
    print(f"  intent            : {parsed['intent']}")
    if parsed["matched_keywords"]:
        print(f"  matched keywords  : {parsed['matched_keywords']}")
    if parsed["translated_for_match"]:
        print("  (Tamil text was translated to English to match)")

    if not has_voice:
        print("  (no voice input -> intent starts as 'unclear';\n"
              "   image/location decide what to run in step 3)")

    if args.lang:
        print(f"\nResponse language override : {args.lang} "
              f"(takes priority in later steps)")
    else:
        print("\nResponse language          : will resolve from detected voice "
              "language (English if no voice).")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())