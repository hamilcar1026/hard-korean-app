#!/usr/bin/env python
"""
Seed Supabase tables with vocabulary and grammar from JSON files.

Usage:
  python scripts/seed_supabase.py

Requires environment variables:
  SUPABASE_URL       - e.g. https://xxxx.supabase.co
  SUPABASE_SERVICE_KEY - service_role key (not anon)
"""
import json
import os
import sys
import urllib.request
import urllib.error


def post_json(url: str, data: list, headers: dict) -> dict:
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()}")
        sys.exit(1)


def batch(lst, n=500):
    for i in range(0, len(lst), n):
        yield lst[i : i + n]


def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.")
        sys.exit(1)

    headers = {
        "Content-Type": "application/json",
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Prefer": "return=minimal",
    }

    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # ── Vocabulary ──────────────────────────────────────────────────────────
    vocab_path = os.path.join(base, "src", "vocabulary.json")
    with open(vocab_path, encoding="utf-8") as f:
        vocab = json.load(f)

    print(f"Seeding {len(vocab)} vocabulary entries...")
    for i, chunk in enumerate(batch(vocab)):
        rows = [
            {
                "level":        r["level"],
                "word":         r["word"],
                "pos":          r["pos"],
                "romanization": r["romanization"],
                "meaning":      r["meaning"],
                "example_kr":   r.get("example_kr", ""),
                "example_en":   r.get("example_en", ""),
            }
            for r in chunk
        ]
        post_json(f"{url}/rest/v1/vocabulary", rows, headers)
        print(f"  Batch {i + 1}: {len(rows)} rows")

    # ── Grammar ─────────────────────────────────────────────────────────────
    grammar_path = os.path.join(base, "src", "grammar.json")
    with open(grammar_path, encoding="utf-8") as f:
        grammar = json.load(f)

    print(f"\nSeeding {len(grammar)} grammar entries...")
    for i, chunk in enumerate(batch(grammar, 200)):
        rows = [
            {
                "level":    r["level"],
                "category": r["category"],
                "form":     r["form"],
                "related":  r.get("related", ""),
                "meaning":  r.get("meaning", ""),
                "examples": r.get("examples", []),
            }
            for r in chunk
        ]
        post_json(f"{url}/rest/v1/grammar", rows, headers)
        print(f"  Batch {i + 1}: {len(rows)} rows")

    print("\nDone!")


if __name__ == "__main__":
    main()
