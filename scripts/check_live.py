#!/usr/bin/env python3
"""Post-deployment GitHub Pages smoke test, independent of local CI success."""
import hashlib
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE="https://mohdujjain.github.io/11am-literature/"
FILES=[
    "index.html","service-worker.js","reader-ui.js","reader-search.js",
    "reader-ui.css","offline-update.js","manifest.webmanifest",
    "og-image.png","icons/icon-192.png","icons/icon-512.png",
]
EXPECTED=list(range(1,19))+list(range(20,27))
PATTERN=re.compile(rb'<section class="chapter" data-chapter="(\d+)"')
def fetch(name):
    req=urllib.request.Request(BASE+name+"?release-smoke="+str(int(time.time())),
         headers={"User-Agent":"11AM-Literature-release-check/1.0",
                  "Cache-Control":"no-cache"})
    with urllib.request.urlopen(req,timeout=18) as response:
        if response.status!=200:
            raise AssertionError(name+" status "+str(response.status))
        return response.read()
def verify():
    responses={key:fetch(key) for key in FILES}
    for name,content in responses.items():
        local=(ROOT/name).read_bytes()
        if hashlib.sha256(content).digest()!=hashlib.sha256(local).digest():
            raise AssertionError(name+" live bytes differ from repository")
    numbers=[int(v) for v in PATTERN.findall(responses["index.html"])]
    if numbers!=EXPECTED:
        raise AssertionError("Live reading sequence incorrect: "+str(numbers))
    if b"reader-search.js" not in responses["index.html"]:
        raise AssertionError("Reader search asset is not referenced")
    print("PASS: live Pages matches exact repository edition, assets, and 25 readings")
if __name__=="__main__":
    for attempt in range(1,6):
        try:
            verify()
            raise SystemExit(0)
        except Exception as exc:
            print(f"Attempt {attempt}/5: {exc}",file=sys.stderr)
            if attempt<5:time.sleep(12)
    raise SystemExit("Live publication is not the expected edition")
