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
from html.parser import HTMLParser
import hashlib
from rebuild_published_reader import without_title_source_information, apply_editorial_overrides

ROOT=Path(__file__).resolve().parents[1]
ZIP=ROOT/"source/Literature_Dossier_Source_Readings_01-26_Offline_PWA.zip"
EXPECTED=list(range(1,19))+list(range(20,27))
PATTERN=re.compile(r'<section\b[^>]*\bclass=["\']chapter["\'][^>]*\bdata-chapter=["\'](\d+)["\']',re.I)

def numbers(html):
    return [int(n) for n in PATTERN.findall(html)]

class ScholarlyText(HTMLParser):
    """Collect chapter text independently of the separate application shell."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.fragments=[]
    def handle_data(self,data):
        if data.strip():
            self.fragments.append(data)

def chapter_digests(html):
    starts=list(PATTERN.finditer(html))
    digests={}
    for i,match in enumerate(starts):
        end=starts[i+1].start() if i+1<len(starts) else html.find("</main>",match.end())
        if end<0:
            raise AssertionError("Cannot delimit published chapter " + match.group(1))
        parser=ScholarlyText()
        parser.feed(html[match.start():end])
        normalized=" ".join(" ".join(parser.fragments).split())
        digests[int(match.group(1))]=hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    return digests

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
            rebuilt_html=rebuilt.read_text(encoding="utf-8")
            chapters=numbers(rebuilt_html)
            assert chapters==EXPECTED,f"Source rebuild reading sequence differs: {chapters}"
            # Source notices were deliberately removed from the printed and
            # screen title pages; they are not scholarly reading prose.
            source_digests=chapter_digests(
                apply_editorial_overrides(without_title_source_information(
                    rebuilt_html,require_all=True)))
    published_html=(ROOT/"index.html").read_text(encoding="utf-8")
    published=numbers(published_html)
    assert published==EXPECTED,"Published reading sequence differs from source"
    assert 'class="source-cite"' not in published_html, "Title-page source notices remain"
    published_digests=chapter_digests(published_html)
    differences=[n for n in EXPECTED if source_digests.get(n)!=published_digests.get(n)]
    assert not differences, "Scholarly chapter-text parity failed for readings: "+str(differences)
    print("PASS: archived source rebuild, 25 chapter numbers and scholarly-text SHA-256 parity")

if __name__=="__main__":
    try:main()
    except Exception as e:
        print("SOURCE BUILD CHECK FAILED:",e,file=sys.stderr)
        raise SystemExit(1)
