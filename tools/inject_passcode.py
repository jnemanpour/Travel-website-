#!/usr/bin/env python3
"""Stamp the site passcode into assets/js/gate.js.

Reads the passcode from the SITE_PASSCODE environment variable — in CI that
comes from the repository secret of the same name, so the passcode itself never
lands in the repo.

    SITE_PASSCODE="..." python3 tools/inject_passcode.py

Writes a fresh random salt and a PBKDF2-SHA256 verifier over the placeholders.
The verifier is necessarily readable in the served JavaScript (the check runs in
the browser), so the iteration count is what makes it expensive to attack
offline rather than instant.

    --check   verify the placeholders were replaced, and nothing else.
"""
import hashlib
import os
import re
import secrets
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GATE = os.path.join(ROOT, "assets", "js", "gate.js")
ITERATIONS = 250_000
PLACEHOLDER = "__SITE_PASSCODE"


def read():
    with open(GATE, encoding="utf-8") as f:
        return f.read()


def check():
    """Look at the declarations only — the placeholder string also appears in
    gate.js's own guard, so scanning the whole file gives a false positive."""
    src = read()
    salt = re.search(r'var SALT = "([^"]*)";', src)
    verifier = re.search(r'var VERIFIER = "([^"]*)";', src)

    if not salt or not verifier:
        print("FAIL: could not find the SALT/VERIFIER declarations in gate.js.")
        sys.exit(1)

    if salt.group(1).startswith(PLACEHOLDER) or verifier.group(1).startswith(PLACEHOLDER):
        print("FAIL: gate.js still has unstamped passcode placeholders.")
        print("The site would deploy with no passcode. Is the SITE_PASSCODE secret set?")
        sys.exit(1)

    if not re.fullmatch(r"[0-9a-f]{32}", salt.group(1)):
        print("FAIL: salt is not a 16-byte hex value.")
        sys.exit(1)

    if not re.fullmatch(r"[0-9a-f]{64}", verifier.group(1)):
        print("FAIL: verifier is not a 32-byte hex value.")
        sys.exit(1)

    print("gate.js carries a stamped passcode.")


def inject():
    passcode = os.environ.get("SITE_PASSCODE", "")
    if not passcode.strip():
        print("SITE_PASSCODE is not set.")
        print()
        print("Add it under Settings -> Secrets and variables -> Actions ->")
        print("New repository secret, named SITE_PASSCODE.")
        sys.exit(1)

    passcode = passcode.strip()
    if len(passcode) < 6:
        print("Use a passcode of at least 6 characters.")
        sys.exit(1)

    salt = secrets.token_bytes(16)
    verifier = hashlib.pbkdf2_hmac(
        "sha256", passcode.encode("utf-8"), salt, ITERATIONS, 32
    ).hex()

    src = read()
    src, a = re.subn(r'var SALT = "[^"]*";', f'var SALT = "{salt.hex()}";', src, count=1)
    src, b = re.subn(
        r'var VERIFIER = "[^"]*";', f'var VERIFIER = "{verifier}";', src, count=1
    )
    if a != 1 or b != 1:
        print("Could not find the SALT/VERIFIER lines in assets/js/gate.js")
        sys.exit(1)

    with open(GATE, "w", encoding="utf-8") as f:
        f.write(src)

    # Never print the passcode or the verifier.
    print(f"Passcode stamped into {os.path.relpath(GATE, ROOT)} "
          f"({ITERATIONS:,} PBKDF2 iterations).")


if __name__ == "__main__":
    check() if "--check" in sys.argv else inject()
