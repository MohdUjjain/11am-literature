# 11AM Literature Dossier — Through Reading 26

**[Open the installable reader](https://mohdujjain.github.io/11am-literature/)** · [Repository](https://github.com/MohdUjjain/11am-literature)

A single-file, landscape-oriented literature study dossier with **25 completed readings** (01–18 and 20–26). **Reading 19 has not been supplied and remains reserved**, not silently renamed. Each reading includes scholarly main notes, passage-linked learning aids, and six end-of-reading revision sections. All chapter text is inside the root `index.html`.

## Install and read offline

Open the GitHub Pages site online at least once, then open **Contents → Save / refresh offline copy**. The versioned service worker pre-caches the **entire HTML reader**, manifest and app icons. When offline, the installed app serves that cached copy; online navigation updates it. You can install from Chrome/Edge's browser menu or **Share → Add to Home Screen** on iPhone. A browser may clear or evict stored data, so no site can guarantee storage forever. The large standalone PDF is intentionally not auto-cached.

For this edition the service worker cache is `11am-lit-reader-01-26-v4` and will replace the previous cache when the new worker is installed and activated. Google Fonts are cached opportunistically, with readable system fallbacks if unavailable.

## GitHub Pages

The project is published from `main` at `/(root)`. If Pages has not been enabled, open **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root) → Save**. The app is scoped to `/11am-literature/`, not the account-wide root.

## Verified release

- **269 physical landscape PDF pages** (source composed to 269), 378 real hierarchical bookmarks, 25 Contents links.
- Reading 26: 4 main-note pages, 6 revision sections across 5 revision pages, plus its chapter opener; six memory aids gathered again in revision.
- All 24 new sidebar cards aligned exactly. **512 / 513** cards in the full book aligned; a pre-existing Reading 04 card is the single exception under offline fallback metrics.
- All earlier 24 chapter files and six stable publishing/index files preserved byte-for-byte. No CSS or compositor changes for this release.
- Source is the named Google Drive explainer for Reading 26. Claims have **not been independently verified** against the original literary work.
- The cumulative PDF is distributed in the conversation/Library, not auto-hosted by the site. The browser app can print/export selected chapters, but ordinary browser print may not preserve hierarchical PDF bookmarks.

## Reproducible source

The **complete 01–26 editable source ZIP** is included in the accompanying project deliverables/Library. The GitHub `source/` directory retains the earlier 01–25 source checkpoint; the published `index.html` is the current complete reader. The final ZIP contains `book-source/build.py`, `head-template.html`, `engine.js`, `styles.css`, all 25 chapter files, untouched source explainers, print exporter, tests, and `MANUAL_CHECKPOINT_READING_26.json`.

```bash
cd book-source
python build.py
# optional normal bookmarked PDF export on a computer with enough print-memory/time:
python export_bookmarked.py --font-profile offline --out output/complete.pdf
```

The last full PDF was built using a documented, verified fallback because one large Chromium print job timed out: fresh 4-page front matter, certified prior 01–25 PDF pages, and independently printed Reading 26, with restored bookmark and Contents link destinations. See `QA_READING_26.md` and `publish_incremental_26.py`.

## Next step

The dossier has processed every assigned reading except **Reading 19**, which remains unassigned. The recurring automation is disabled; future edits are manual.
