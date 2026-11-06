#!/usr/bin/env python3
"""Regression guard for source-backed editorial overrides; no external dependencies."""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
MANIFEST = json.loads((ROOT / "source/editorial-fidelity-overrides.json").read_text(encoding="utf-8"))
MATCH = re.compile(r'<section class="chapter" data-chapter="(\d+)"[^>]*>')
EXPECTED = list(range(1, 19)) + list(range(20, 27))

def chapters(html):
    matches = list(MATCH.finditer(html))
    assert [int(m.group(1)) for m in matches] == EXPECTED, "Reading inventory changed"
    segments = {}
    for i, m in enumerate(matches):
        end = matches[i+1].start() if i+1 < len(matches) else html.index("</main>", m.end())
        segments[int(m.group(1))] = html[m.start():end]
    return segments

def main():
    segments = chapters(HTML)
    assert MANIFEST["version"] == 1
    edits = MANIFEST["edits"]
    assert edits, "No chapter-scoped corrections registered"
    for i, edit in enumerate(edits):
        n = int(edit["reading"])
        assert n in segments, (i, n)
        original, revised = edit["find"], edit["replace"]
        expected = int(edit.get("expected", 1))
        assert original and original != revised and expected >= 1, (i, n)
        assert original not in segments[n], f"Original editorial insertion restored: reading {n}, edit {i}"
        if revised and segments[n].count(revised) < expected:
            # A later, deliberately ordered correction may replace the text
            # produced by an earlier correction in the same chapter.
            later = edits[i + 1:]
            superseded = any(
                int(other["reading"]) == n
                and revised in other["find"]
                and other["replace"] in segments[n]
                for other in later
            )
            assert superseded, f"Verified replacement missing: {n}, edit {i}"
    assert HTML.count('class="revision-zone"') == 25, "Revision zone lost"
    assert HTML.count('class="chapter-title-page"') == 25, "Chapter opener lost"
    for marker in ["data-note-id=\"s11-6-p1-n1\"", "data-note-id=\"s26-6-p0-n1\""]:
        assert marker not in HTML, "Unsupported warning-card restored: "+marker
    for n, markers in {
        4: ["muruwa", "100,000 prisoners"],
        11: ["Hadar", "qiṣāṣ"],
        15: ["72 times more likely", "37%"],
        17: ["Muʿtazila", "ḥudūd"],
        22: ["jeton", "dirham"],
        23: ["Lawāta", "360"],
        26: ["Ida Mae", "Chicago"],
    }.items():
        for marker in markers:
            assert marker.lower() in segments[n].lower(), f"Source-bearing material absent in {n}: {marker}"
    print(f"PASS: {len(edits)} editorial rules and all 25 publication chapters retained")

if __name__ == "__main__":
    main()
