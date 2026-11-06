#!/usr/bin/env python3
"""Recreate index.html using the archived scholarly chapter build and the
approved modern publication shell. The only presentation-level redaction removes
25 user-requested source-information paragraphs from title pages. No PDF output.
"""
from pathlib import Path
import argparse
import hashlib
import re
import subprocess
import sys
import tempfile
import zipfile

ROOT=Path(__file__).resolve().parents[1]
ARCHIVE=ROOT/"source/Literature_Dossier_Source_Readings_01-26_Offline_PWA.zip"
BEFORE=ROOT/"source/publication-shell-before-chapters.html"
AFTER=ROOT/"source/publication-shell-after-chapters.html"
PUBLISHED=ROOT/"index.html"
CHAPTER=re.compile(r'<section\s+class="chapter"\s+data-chapter="(\d+)"',re.I)
EXPECTED=list(range(1,19))+list(range(20,27))
TITLE_SOURCE_RE=re.compile(r'<p class="source-cite">[^<]*</p>')

def without_title_source_information(html, require_all=False):
    """Approved presentation edit, never modify narrative, callouts or revision."""
    cleaned, count=TITLE_SOURCE_RE.subn("",html)
    if require_all and count!=len(EXPECTED):
        raise AssertionError(f"Archived build must have {len(EXPECTED)} title notices; got {count}")
    return cleaned


def extract_chapters(html):
    matches=list(CHAPTER.finditer(html))
    numbers=[int(m.group(1)) for m in matches]
    if numbers!=EXPECTED:
        raise ValueError("Unexpected chapter inventory: "+str(numbers))
    main_end=html.find("</main>",matches[-1].end())
    if main_end<0:
        raise ValueError("Missing closing book main")
    last_end=html.rfind("</section>",matches[-1].start(),main_end)
    if last_end<0:
        raise ValueError("Missing final chapter closing section")
    return html[matches[0].start():last_end+len("</section>")]

def rebuilt_source():
    with tempfile.TemporaryDirectory() as td:
        with zipfile.ZipFile(ARCHIVE) as z:
            if z.testzip() is not None:
                raise ValueError("Source ZIP is corrupt")
            z.extractall(td)
        builders=[p for p in Path(td).rglob("build.py") if "book-source" in p.parts]
        if len(builders)!=1:
            raise ValueError("Cannot identify the chapter source builder")
        process=subprocess.run([sys.executable,str(builders[0])],
            cwd=builders[0].parent,capture_output=True,text=True,timeout=120)
        if process.returncode:
            raise RuntimeError(process.stderr[-2500:])
        outputs=[p for p in Path(td).rglob("*.html")
                 if p.stat().st_size>300000 and CHAPTER.search(
                    p.read_text(encoding="utf-8"))]
        for p in sorted(outputs,key=lambda path:path.stat().st_mtime,reverse=True):
            raw=p.read_text(encoding="utf-8")
            if [int(m.group(1)) for m in CHAPTER.finditer(raw)]==EXPECTED:
                return extract_chapters(raw)
        raise ValueError("Source builder produced no complete 25-reading output")

def digest(data):
    return hashlib.sha256(data.encode("utf-8")).hexdigest()

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--write",action="store_true",
        help="Write index.html only when the archived chapters reconstruct exactly")
    args=parser.parse_args()
    original=PUBLISHED.read_text(encoding="utf-8")
    expected_body=extract_chapters(original)
    # The historical ZIP remains unmodified; remove only the explicitly
    # rejected title-page source-information paragraphs when publishing.
    source_body=without_title_source_information(rebuilt_source(),require_all=True)
    if TITLE_SOURCE_RE.search(expected_body):
        raise AssertionError("Published title-page source-information notice remains")
    if source_body!=expected_body:
        # Do not overwrite chapters or silently normalize scholarly markup.
        offset=next((i for i,(a,b) in enumerate(zip(source_body,expected_body))
                     if a!=b),min(len(source_body),len(expected_body)))
        raise AssertionError(
            "Archived source chapter markup differs from published reader; "
            "first differing character "+str(offset)+"; lengths "+
            str(len(source_body))+" / "+str(len(expected_body))+
            "; SHA256 "+digest(source_body)[:12]+" / "+digest(expected_body)[:12])
    assembled=BEFORE.read_text(encoding="utf-8")+source_body+AFTER.read_text(encoding="utf-8")
    if args.write:
        PUBLISHED.write_text(assembled,encoding="utf-8")
    elif assembled!=original:
        raise AssertionError("Publication shell does not reproduce current index.html")
    print("PASS: source archive + approved shell reproduce complete published HTML byte-for-byte")
    return 0

if __name__=="__main__":
    try:raise SystemExit(main())
    except Exception as exc:
        print("PUBLICATION REBUILD FAILED:",exc,file=sys.stderr)
        raise SystemExit(1)
