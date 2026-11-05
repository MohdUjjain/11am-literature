#!/usr/bin/env python3
"""Validate Literature's public hosting layer; leave book/print internals untouched."""
import json
import re
import struct
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE="https://mohdujjain.github.io/11am-literature/"
EXPECTED=list(range(1,19))+list(range(20,27))
ASSETS=["index.html","manifest.webmanifest","offline-update.js",
        "reader-ui.js","reader-search.js","reader-ui.css",
        "icons/icon-192.png","icons/icon-512.png","og-image.png",
        "404.html","sitemap.xml","service-worker.js"]

class Inspect(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids=[];self.anchors=[];self.metas={};self.links=[];self.chapters=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if "id" in a:self.ids.append(a["id"])
        if tag=="meta":
            key=a.get("property",a.get("name"))
            if key:self.metas[key]=a.get("content","")
        if tag=="link":self.links.append(a)
        if tag=="a" and a.get("href","").startswith("#"):
            self.anchors.append(a["href"][1:])
        if tag=="section" and "chapter" in a.get("class","").split():
            self.chapters.append(int(a["data-chapter"]))

def main():
    for path in ASSETS:
        assert (ROOT/path).is_file(),"Missing "+path
    html=(ROOT/"index.html").read_text(encoding="utf-8")
    d=Inspect();d.feed(html)
    assert d.chapters==EXPECTED,f"Reading sequence changed: {d.chapters}"
    # Desktop assigns roadmap grid-column:2; mobile must cancel it explicitly.
    assert len(re.findall(r'<div class="opener-split">',html))==len(EXPECTED)
    assert len(re.findall(
        r'<div class="opener-split">\s*<div class="thesis-block">.*?</div>\s*<div class="roadmap">',
        html,re.S))==len(EXPECTED),"Thesis must precede roadmap in every reading"
    mobile=re.search(
        r'@media screen and \(max-width:900px\)\s*\{\s*'
        r'\.chapter-title-page \.opener-split\s*\{(?P<grid>[^}]+)\}\s*'
        r'\.chapter-title-page \.thesis-block,\s*'
        r'\.chapter-title-page \.roadmap\s*\{(?P<columns>[^}]+)\}',
        html,re.S)
    assert mobile is not None,"Missing screen-only opener fix"
    assert "grid-template-columns:minmax(0,1fr)" in mobile.group("grid").replace(" ","")
    assert "grid-column:1;" in mobile.group("columns").replace(" ","")

    assert len(d.ids)==len(set(d.ids)),"Duplicate element IDs"
    assert set(d.anchors)<=set(d.ids),"Broken in-page links"
    assert any(x.get("rel")=="canonical" and x.get("href")==BASE for x in d.links)
    assert any(x.get("rel")=="manifest" and x.get("href")=="./manifest.webmanifest" for x in d.links)
    assert d.metas.get("description") and "25" in d.metas["description"]
    expected={
      "og:site_name":"11AM Literature Dossier",
      "og:url":BASE,
      "og:image":BASE+"og-image.png",
      "og:image:secure_url":BASE+"og-image.png",
      "og:image:type":"image/png",
      "og:image:width":"1200",
      "og:image:height":"630",
      "twitter:card":"summary_large_image",
      "twitter:image":BASE+"og-image.png",
    }
    for key,val in expected.items():
        assert d.metas.get(key)==val,f"{key}: {d.metas.get(key)!r}"
    for key in ["og:title","og:description","og:image:alt","twitter:title",
                "twitter:description","twitter:image:alt"]:
        assert d.metas.get(key),f"Missing {key}"
    assert '<script src="./offline-update.js" defer></script>' in html
    assert 'id="pwa-save"' in html and 'id="pwa-install"' in html
    assert "window.DossierPrint" in html,"Existing print compositor missing"
    # All 25 readings remain intact, while the sidebar only navigates readings.
    assert 'id="reader-search-input"' in html
    assert 'id="reader-search-results"' in html
    assert 'role="search"' in html
    assert html.count('role="tab"')==2 and html.count('role="tabpanel"')==2
    for panel_id in ["panel-index","panel-tools","toc-list","lit-show-revisions",
                     "btn-print","range-spec","pwa-save","toggle-revision",
                     "toggle-contents-page","rh-chapter-tag"]:
        assert html.count('id="'+panel_id+'"')==1,panel_id
    assert html.count('class="reader-resume-button"')==2
    assert '<script src="./reader-search.js" defer></script>' in html
    assert '<script src="./reader-ui.js" defer></script>' in html
    assert '<link rel="stylesheet" href="./reader-ui.css">' in html
    assert "var coverLink = document.createElement('a')" not in html
    assert "headerTag.textContent = String(active.num).padStart(2, '0')" in html
    assert 'id="reader-search-toggle"' in html
    assert 'id="reader-search-results" role="region"' in html
    assert 'class="panel-heading"' in html
    assert html.count('class="reader-resume-label"')==2
    assert html.count('<symbol id="lit-icon-')>=8
    assert 'aria-controls="reader-search-input" aria-expanded="false"' in html
    assert "color-mix(in srgb, ' + accent + ' 40%, var(--parchment))" in html
    polish=(ROOT/"reader-ui.css").read_text(encoding="utf-8")
    assert '--lit-chapter-on-light' in polish and '--lit-chapter-on-dark' in polish
    assert 'height:100dvh' in polish and 'position:sticky;top:56px' in polish
    assert '#reading-header.search-open .reader-search-wrap' in polish
    controls=(ROOT/"reader-ui.js").read_text(encoding="utf-8")
    assert "window.LiteratureSearch.find" in controls
    assert "11am-literature-show-revisions-v1" in controls
    assert "11am-literature-reading-position-v1" in controls
    assert "id=\"panel-close\"" in html
    skin=(ROOT/"reader-ui.css").read_text(encoding="utf-8")
    assert "body.lit-revisions-hidden #book > .chapter > .revision-zone" in skin
    assert ".reader-search-hit-target{outline:none!important;" in skin

    assert html.count('id="rh-book-track"')==1
    assert html.count('id="rh-book-percent"')==1
    assert html.count('id="rh-chapter-ring"')==1
    assert html.count('id="rh-chapter-percent"')==1
    assert html.count('id="progress-fill"')==1
    assert 'aria-label="Progress through the complete Literature dossier"' in html
    assert 'aria-label="Progress through current reading"' in html
    assert "document.documentElement.scrollHeight - window.innerHeight" in html
    assert "chapters[i].el.getBoundingClientRect().top <= readingLine" in html
    assert "active.revision.getBoundingClientRect().top <= readingLine" in html

    manifest=json.loads((ROOT/"manifest.webmanifest").read_text(encoding="utf-8"))
    assert manifest["id"]=="/11am-literature/"
    assert manifest["start_url"]==manifest["scope"]=="./"
    assert manifest["display"]=="standalone"
    assert {x["sizes"] for x in manifest["icons"]}>={"192x192","512x512"}
    card=(ROOT/"og-image.png").read_bytes()
    assert card[:8]==bytes.fromhex("89504e470d0a1a0a")
    assert struct.unpack(">II",card[16:24])==(1200,630)
    root=ET.parse(ROOT/"sitemap.xml").getroot()
    assert any(el.text==BASE for el in root.iter())
    fallback=(ROOT/"404.html").read_text(encoding="utf-8")
    assert "noindex" in fallback and "/11am-literature/" in fallback
    worker=(ROOT/"service-worker.js").read_text(encoding="utf-8")
    assert "__CACHE_REVISION__" not in worker
    for p in ASSETS:
        if p!="service-worker.js":
            assert "'./"+p+"'" in worker or p=="index.html",f"Not precached: {p}"
    assert "cache.addAll(APP_SHELL)" in worker
    assert "PREPARE_FONTS" in worker and "FONTS_PREPARED" in worker
    assert "fonts.gstatic.com" in worker and "FONT_CACHE" in worker
    assert "prepareFonts(reg)" in html and "document.fonts.load" in html
    assert "EDITION_STATUS" in worker and "EDITION_STATUS" in html
    assert "reg.update()" in html and "checkForEdition(reg)" in html
    assert "saved copy verified" in html.lower()
    assert 'role="dialog" aria-modal="true"' in html
    assert "panel.inert = true" in html
    assert "var coverLink" not in html
    assert "skipWaiting()" in worker
    assert "CACHE_PREFIX" in worker
    assert "new URL(self.registration.scope)" in worker
    print("PASS: 25 readings, metadata, social preview, sitemap, 404, offline shell and install controls")

if __name__=="__main__":
    try:main()
    except Exception as ex:
        print("PUBLICATION CHECK FAILED:",ex,file=sys.stderr)
        raise SystemExit(1)
