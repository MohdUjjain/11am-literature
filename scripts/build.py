#!/usr/bin/env python3
"""Deterministically derive the service-worker revision from published assets."""
import argparse
import hashlib
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCES=[
    "index.html", "manifest.webmanifest", "offline-update.js",
    "reader-search.js", "reader-ui.js", "reader-ui.css",
    "icons/icon-192.png", "icons/icon-512.png",
    "og-image.png", "404.html", "sitemap.xml",
    "scripts/service-worker.template.js",
]
TARGET=ROOT/"service-worker.js"

def build():
    manifest=[]
    for path in SOURCES:
        raw=(ROOT/path).read_bytes()
        manifest.append(path+"="+hashlib.sha256(raw).hexdigest())
    revision=hashlib.sha256(("\n".join(manifest)+"\n").encode()).hexdigest()[:12]
    template=(ROOT/"scripts/service-worker.template.js").read_text(encoding="utf-8")
    if template.count("__CACHE_REVISION__") != 1:
        raise RuntimeError("Exactly one __CACHE_REVISION__ token is required")
    return template.replace("__CACHE_REVISION__",revision),revision

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--check",action="store_true")
    args=parser.parse_args()
    built,revision=build()
    if args.check:
        if not TARGET.exists() or TARGET.read_text(encoding="utf-8")!=built:
            print("Stale service-worker.js; expected revision",revision,file=sys.stderr)
            return 1
        print("PASS: reproducible offline cache revision",revision)
        return 0
    TARGET.write_text(built,encoding="utf-8")
    print("Wrote service-worker.js with revision",revision)
    return 0

if __name__=="__main__":
    raise SystemExit(main())
