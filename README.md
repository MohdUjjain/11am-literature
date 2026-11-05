# 11AM Literature Dossier — Through Reading 26

**[Open the installable reader](https://mohdujjain.github.io/11am-literature/)** · [Repository](https://github.com/MohdUjjain/11am-literature)

A single-file, landscape-oriented literature study dossier with **25 completed readings** (01–18 and 20–26). **Reading 19 has not been supplied and remains reserved**, not silently renamed. Each reading includes scholarly main notes, passage-linked learning aids, and six end-of-reading revision sections. All chapter text is inside the root `index.html`.

## Install and read offline

Open the GitHub Pages site online at least once, then open **Contents → Save / refresh offline copy**. The versioned service worker pre-caches the **entire HTML reader**, manifest and app icons. When offline, the installed app serves that cached copy; online navigation updates it. You can install from Chrome/Edge's browser menu or **Share → Add to Home Screen** on iPhone. A browser may clear or evict stored data, so no site can guarantee storage forever. The large standalone PDF is intentionally not auto-cached.

The complete reader is cached atomically using a service-worker revision automatically derived from the published HTML and assets. When an updated edition has been fully saved, an existing app session shows **New Literature edition saved** with a reload control. The existing manual **Save / refresh offline copy** option and optional persistent-storage request remain available. Google Fonts are cached as the reader uses them, and the **Save / refresh offline copy** control also proactively loads the Latin and Arabic font faces, sending approved Google Fonts resources to the worker through `PREPARE_FONTS`. The font cache persists across book editions. If font downloads fail, the full offline reader remains saved and readable system fallbacks are used.

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

The **complete 01–26 editable source ZIP** is included in the accompanying project deliverables/Library. The GitHub `source/` directory retains the complete 01–26 source checkpoint alongside earlier snapshots; the published `index.html` is the current complete reader. The final ZIP contains `book-source/build.py`, `head-template.html`, `engine.js`, `styles.css`, all 25 chapter files, untouched source explainers, print exporter, tests, and `MANUAL_CHECKPOINT_READING_26.json`.

```bash
cd book-source
python build.py
# optional normal bookmarked PDF export on a computer with enough print-memory/time:
python export_bookmarked.py --font-profile offline --out output/complete.pdf
```

The last full PDF was built using a documented, verified fallback because one large Chromium print job timed out: fresh 4-page front matter, certified prior 01–25 PDF pages, and independently printed Reading 26, with restored bookmark and Contents link destinations. See `QA_READING_26.md` and `publish_incremental_26.py`.

## Next step

The dossier has processed every assigned reading except **Reading 19**, which remains unassigned. The recurring automation is disabled; future edits are manual.

## Website publishing upgrades

- **Preview and discovery:** `og-image.png` (1200 × 630, generated from `scripts/render_social.py`), Open Graph/Twitter metadata in `index.html`, a one-page `sitemap.xml`, and a branded `404.html`.
- **Offline editions:** `scripts/service-worker.template.js` is the authored worker; `scripts/build.py` writes `service-worker.js` with a content-derived cache revision. `offline-update.js` offers a reload once a new service worker takes control. The PWA stays scoped to `/11am-literature/` and never pre-caches PDFs.
- **Build/verification:** `.github/workflows/verify-pages.yml` regenerates image and worker, checks the source ZIP can reassemble the 25-reading book, validates publication metadata, and simulates offline loading and interrupted installation. On main it commits only the regenerated publishing assets when they differ; it does not alter the notes or print compositor.
- **Local verification:** `python -m pip install Pillow==12.3.0`, `python scripts/render_social.py`, `python scripts/build.py`, `python scripts/verify_source_archive.py`, `python tests/verify_publication.py`, `node tests/test_service_worker.mjs`, then `python scripts/build.py --check`.

## Reading progress indicators

The reader's sticky top rail tracks **continuous progress through the entire dossier**, including the cover and the published readings; it never resets when a new reading begins. A separate circular indicator shows **completion of the currently visible reading**, including that reading's revision pages, and resets for the next reading. The reserved Reading 19 is not counted as published content. Both controls are screen-only, and the landscape PDF print compositor remains unchanged.

## Search and sidebar organisation

The sticky reading header now includes **Search all notes**, a local full-text search over the available academic readings (headings, paragraphs, passage-linked notes, lists, tables and revision sections). Search results are ranked, labelled by reading and section, and jump to the corresponding text. Search works offline because both the indexer and the reader content are saved in the PWA. The sidebar has two tabs: **Index** for the reading tree, and **Tools** for on-screen revision/summary visibility, print/export selection, and offline installation. The Cover link was removed from the reading index; the optional printable Contents page remains available under Tools.

Revision/summary visibility is saved locally on the device; hiding on screen does not remove it from print/export unless the separate printing checkbox is unchecked. **Continue Reading** appears in both tabs and remembers the most recent reading and approximate position in local device storage. Opening the reader does not automatically jump away from the cover; the choice to resume is explicit.

The sticky header shows only the reading number followed by its title. Book-wide progress and the independent circular reading progress are unchanged in their semantics.

## Pass A — Reader reliability and interaction

- **Continue Reading** now stores a stable section or passage identifier with a local offset, rather than only a percentage of the chapter's changing height. Existing percentage-only checkpoints remain readable and are converted during subsequent reading. The guide still opens at the cover until the user explicitly chooses to resume.
- **Hidden revision links:** Following an index or search link to a hidden revision temporarily reveals the destination. The stored **Show revision/summary sections** preference remains unchanged; changing that toggle clears temporary reveals.
- **Sticky-header navigation:** Anchor offsets follow the measured header height, including its two-row mobile layout.
- **Sidebar focus:** The offscreen drawer is inert when closed, has dialog semantics while open, keeps keyboard Tab focus inside, and restores focus to its launcher on Escape or dismissal. Navigating to a reading instead focuses the destination.
- **Offline update/refresh:** The action explicitly checks for a newer service-worker edition when online, verifies the active edition's complete cache with an `EDITION_STATUS` worker response, and distinguishes a successfully checked copy from an offline or incomplete update check. Optional font preparation remains independent of book availability.
