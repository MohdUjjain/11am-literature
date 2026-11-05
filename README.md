# 11AM Literature Dossier

**An installable, offline-ready literary study companion.** Published readings: **01–18, 20–23**; Reading 19 remains reserved and unassigned. The entire available reading dossier lives inside a single HTML file, with full passage-linked study sidebars and six-part revision sections for each chapter.

**[Read / install the study app](https://mohdujjain.github.io/11am-literature/)**

## GitHub Pages activation

This repository publishes from `main` at the repository root. If the URL has not appeared yet, open **Settings → Pages → Build and deployment → Deploy from a branch → `main` → `/(root)` → Save**. This one-time Pages setting is required when GitHub Pages has not yet been activated for a new repository. Leave the `.nojekyll` file at the root.

## Install and offline reading

Open the HTTPS site online at least once. The service worker precaches the **full `index.html`**, manifest and app icons, so the reader opens offline from an installed app or the same site URL afterward. For an explicit check, open **Contents & Export → Install & offline reading → Save / refresh offline copy**. You can do this again on later editions to update the stored copy. The browser may evict storage if space is low; clicking Save also asks the browser for persistent storage where supported. No web app can guarantee that an OS or browser will store a cache forever.

On Chrome or Edge use **Install app** from the address bar / browser menu or the in-app button when offered. On iPhone/iPad use **Share → Add to Home Screen**. The website requires HTTPS for service workers, which GitHub Pages provides. The large print PDF is *not* automatically cached; download it separately if needed. The app can print/export its current chapters from the browser (PDF bookmarks depend on the printing method).

## Offline update policy

- The service worker is scoped to `/11am-literature/`, not the account root.
- Every online navigation uses **network-first HTML** and updates the offline snapshot after a successful response. Offline navigation falls back to the latest successfully cached complete reader.
- The new worker pre-caches `index.html` before activating. Versioned caches prevent an incomplete new installation from deleting the preceding edition.
- On future publishing updates that modify core filenames or service-worker logic, bump `VERSION` in `service-worker.js` and validate the app offline again.
- Google-hosted display fonts are attempted for offline caching; if unavailable the same text remains readable with system fallbacks. No font binaries are committed to this repository.

## Source and consistency

`index.html` is assembled from the canonical modular source, not hand-edited. The publishing source and checkpoint are retained separately as **Literature_Dossier_Source_Readings_01-23_Editorial.zip** in the project Library. Preserve original chapter content, six callout categories and six revision zones; never alter the compositor just to force lower page counts. The source build script uses `head-template.html`, `styles.css`, `engine.js`, `cover.html` and the chapter modules.

### Verification

Use browser Developer Tools → Application → Service Workers and Cache Storage: `11am-lit-reader-…-core` must contain `index.html`, `manifest.webmanifest`, and both icons. Test using **Offline** network mode, then reload and check all completed readings still load. The web app must be served through HTTPS or localhost; service workers do not work on `file://`.

Editorial caveat: these are study notes generated from supplied academic reading explainers, and have not been independently verified against original publications.


## Latest dossier release — Readings 22–23

Current volume: **22 completed readings** (Reading 19 reserved); full PDF baseline **239 landscape pages, 336 real bookmarks**, and 22 Contents links. The two newest chapters are **The Monetary History of Egypt, 642–1517** and **1068 in the Fayyum**. All 47 new sidebar notes are placed on pages containing their linked passages. PWA offline cache: `11am-lit-reader-01-23-v2`. The editable source archive is under `source/`.
