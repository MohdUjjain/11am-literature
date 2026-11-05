#!/usr/bin/env python3
"""Check the complete source archive is present, buildable and aligned by reading inventory.

The original zipped chapter source is retained without rewriting historical study notes.
Publication-only changes in index.html are intentionally independent of that archive.
"""
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ZIP=ROOT/"source/Literature_Dossier_Source_Readings_01-26_Offline_PWA.zip"
EXPECTED=list(range(1,19))+list(range(20,27))
PATTERN=re.compile(r'<section\b[^>]*\bclass=["\']chapter["\'][^>]*\bdata-chapter=["\'](\d+)["\']',re.I)

def numbers(html):
    return [int(n) for n in PATTERN.findall(html)]

def main():
    assert ZIP.exists(),"The latest 01-26 complete source ZIP is missing"
    with zipfile.ZipFile(ZIP) as z:
        assert z.testzip() is None,"Invalid source ZIP"
        names=z.namelist()
        assert any(x.endswith("/build.py") for x in names),"Source build.py missing"
        assert any(x.endswith("/engine.js") for x in names),"Source engine.js missing"
        assert any(x.endswith("/styles.css") for x in names),"Source styles.css missing"
        assert len([x for x in names if ("/chapters/" in x and x.endswith(".html"))])>=20, "Source chapter files missing"
        with tempfile.TemporaryDirectory() as td:
            z.extractall(td)
            root=Path(td)
            builders=[p for p in root.rglob("build.py") if "book-source" in p.parts]
            assert builders,"No book-source/build.py in source archive"
            builder=builders[0]
            run=subprocess.run([sys.executable,str(builder)],cwd=builder.parent,
                               capture_output=True,text=True,timeout=120)
            assert run.returncode==0,"Source build failed: "+run.stderr[-1500:]
            outputs=[p for p in root.rglob("*.html") if p.stat().st_size>300000 and
                     numbers(p.read_text(encoding="utf-8"))==EXPECTED]
            assert outputs,"Source builder did not produce an assembled HTML book"
            rebuilt=max(outputs,key=lambda p:p.stat().st_mtime)
            chapters=numbers(rebuilt.read_text(encoding="utf-8"))
            assert chapters==EXPECTED,f"Source rebuild reading sequence differs: {chapters}"
    published=numbers((ROOT/"index.html").read_text(encoding="utf-8"))
    assert published==EXPECTED,"Published reading sequence differs from source"
    print("PASS: source ZIP integrity and reproducible 25-reading HTML assembly")

if __name__=="__main__":
    try:main()
    except Exception as e:
        print("SOURCE BUILD CHECK FAILED:",e,file=sys.stderr)
        raise SystemExit(1)
