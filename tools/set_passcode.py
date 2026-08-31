#!/usr/bin/env python3
"""Set the site passcode.

    python3 tools/set_passcode.py "our passcode"

Only the SHA-256 hash is written into assets/js/gate.js — the passcode itself
never lands in the repo. Read assets/js/gate.js for what the gate protects
(the pages) and what it does not (the photo and video files themselves).
"""
import hashlib, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GATE = os.path.join(ROOT, "assets", "js", "gate.js")


def main():
    if len(sys.argv) != 2 or not sys.argv[1].strip():
        print(__doc__)
        sys.exit(1)

    passcode = sys.argv[1].strip()
    if len(passcode) < 4:
        print("Use at least 4 characters.")
        sys.exit(1)

    digest = hashlib.sha256(passcode.encode("utf-8")).hexdigest()

    with open(GATE, encoding="utf-8") as f:
        src = f.read()

    new, n = re.subn(r'var HASH = "[0-9a-f]*";', f'var HASH = "{digest}";', src, count=1)
    if n != 1:
        print("Could not find the HASH line in assets/js/gate.js")
        sys.exit(1)

    with open(GATE, "w", encoding="utf-8") as f:
        f.write(new)

    print(f"Passcode set. Hash written to {os.path.relpath(GATE, ROOT)}.")
    print("Commit and push for it to take effect on the live site.")


if __name__ == "__main__":
    main()
