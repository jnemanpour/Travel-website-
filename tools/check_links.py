#!/usr/bin/env python3
"""Fail if any HTML file points at a local file that isn't there.

Broken asset paths are the failure mode this site is most prone to — media gets
moved between folders and a background-image or a poster quietly 404s.
"""
import os, re, sys, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_SCHEMES = ("http://", "https://", "//", "data:", "mailto:", "tel:", "#", "javascript:")
REF = re.compile(r'(?:href|src)="([^"#][^"]*)"|url\((?:\'|")?([^\'")]+)(?:\'|")?\)')

def main():
    bad, checked = [], 0
    for dirpath, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d != ".git"]
        for f in files:
            if not f.endswith(".html"):
                continue
            path = os.path.join(dirpath, f)
            with open(path, encoding="utf-8") as fh:
                html = fh.read()
            for m in REF.finditer(html):
                url = m.group(1) or m.group(2)
                if not url or url.startswith(SKIP_SCHEMES):
                    continue
                # Skip anything built by script at runtime.
                if "+" in url or "{" in url:
                    continue
                url = urllib.parse.unquote(url.split("#")[0].split("?")[0])
                if not url:
                    continue
                checked += 1
                if not os.path.exists(os.path.normpath(os.path.join(dirpath, url))):
                    bad.append(f"{os.path.relpath(path, ROOT)} -> {url}")

    print(f"checked {checked} local references")
    if bad:
        print("\nbroken:")
        for b in sorted(set(bad)):
            print("  ", b)
        sys.exit(1)
    print("all resolve")

if __name__ == "__main__":
    main()
