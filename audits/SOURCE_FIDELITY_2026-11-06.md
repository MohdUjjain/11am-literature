# Literature Dossier — Source-Fidelity Editorial Audit

**Audit date:** 6 November 2026  
**Scope:** Published readings 01–18 and 20–26 in `index.html`, reviewed against their corresponding numbered Google Drive **Blog** explainers supplied by the dossier owner. Reading 19 is not part of the published corpus.  
**Archive status:** The original complete 01–26 source ZIP is not rewritten.

## Editorial contract

The linked Drive explainers are the authority for *this* correction exercise. They are the notes from which the dossier was generated; they are not automatically a verification of the original scholarly articles or books. This audit does not introduce outside historical fact-checking or modern ideological judgments.

The notes may reorganize material, extract source-supported distinctions, and create clearly educational aids. They must not silently insert a new argument, moral evaluation, historical correction, contemporary disclaimer, or evidentiary doubt into the author's explanation. Source-authored qualifications remain.

## Inspection method

All 25 published chapters were scanned and sampled at chapter scope. Review included ordinary prose, headings, note tags, definition and concept boxes, Common Mistake cards, high-yield facts, memory aids, exam-oriented annotations, and revision material. A targeted sweep located imperative warnings, source-disclaimers, anachronism warnings, contemporary-statistic caveats and verification claims. Each proposed change was compared with its corresponding Drive explainer and patched with exact-match replacement.

**Important limit:** This is a source-based *editorial-interference audit*, not proof of complete word-for-word semantic equivalence across every sentence in all 25 readings. The automated sweeps are not a substitute for a second independent editorial reading of every paragraph. The entries below identify what was actually reviewed and changed.

## Chapter-by-chapter disposition

| Reading | Corrected occurrences | Source-fidelity disposition |
|---|---:|---|
| 01 | 3 | Petitioner/debtor roles; remove instructional warning |
| 02 | 0 | Source-authored distinction between office title and actual authority retained |
| 03 | 6 | Remove contemporary-census warnings; restore the narrated nine-speaker scene |
| 04 | 7 | Remove the assistant's gender judgment and verification warnings; preserve the source's contrast of laudatory and hostile chronicles |
| 05 | 5 | Restore the source's asserted etymology and analysis of identity without independent-verification caveats |
| 06 | 4 | Remove external historical/date checking; retain this reading's own chronology and terminology |
| 07 | 4 | Present ethnicity, community and library culture as discussed in the source |
| 08 | 4 | Retain this source's date and chronology without inserting cross-reading correction |
| 09 | 4 | Keep Saussure as the source's modern analogy without instructions to the student |
| 10 | 7 | Present Malcolm X's attributed arguments and media labels without added skepticism |
| 11 | 2 | Remove unsupported present-day legal warning; retain the classical Hidāya discussion |
| 12 | 1 | Present elite reactions and the litigant's case without a meta-warning |
| 13 | 1 | State the imagined boxing encounter directly |
| 14 | 1 | State the pedagogical function of the epistle's ending |
| 15 | 6 | Remove 2026/statistical warnings; retain 72×, 37%, and dress standardization as given |
| 16 | 4 | Restore the political function of genealogical rhetoric, without assistant-added doubts |
| 17 | 4 | Restore source's affirmative account of rationalist influence and legal reasoning |
| 18 | 1 | Discuss Luce's clinical language as literary analysis, not a medical disclaimer |
| 20 | 4 | Retain the Khaldūnian argument and its chronological evidence without extra methodological warnings |
| 21 | 1 | State the distinction between enforceable household law and ethical expectation |
| 22 | 1 | Explain the metrological ratio in the source's terms |
| 23 | 3 | Preserve the 360-village legend, later 63 count and Lawāta account without invented survey cautions |
| 24 | 1 | Present preservation through later chronicles as described in the source |
| 25 | 0 | Distinctions in courtly reception and the qaṣīda were source-grounded; no edit required |
| 26 | 4 | Remove invented-date and comparative-moral warnings while retaining the Mississippi and Chicago narrative |

**Total:** 77 independently recorded correction rules; 78 exact replacement sites across 23 readings. Readings 02 and 25 required no changes in this targeted audit. This is *not* a count of all assertions in the dossier.

## Substantive corrections

- **Reading 03:** Replaced extra warnings about whether the nine surviving fluent speakers should be treated as a 2026 census with the narrator's actual scene of the nine chairs.
- **Reading 04:** Removed an assistant-inserted verdict about historical gendered rhetoric. Kept the source's account of how medieval `muruwa`, `adab`, and later hostile chronicles shaped al-Afḍal's reputation. The prison narrative remains attributed to later chroniclers.
- **Reading 06 / Reading 08:** Removed cross-chapter corrective framing of the different dates given in two distinct supplied readings. Each chapter now preserves *its own* chronology instead of inserting a new reconciliation.
- **Reading 11:** Removed the standalone warning claiming the Hidāya illustrations are not present-day instructions. The neighboring definition of `hadar` and the underlying legal description remain.
- **Reading 15:** Removed the 2026 census caveat, preserving the source's comparison of computer ownership at the time of the discussed study and its own narrative of dress standardization.
- **Reading 17:** Removed an external skeptical qualification about documentary proof of a natural-rights transmission chain. The underlying source itself argues affirmatively for the intellectual connection; the notes should faithfully report that argument.
- **Reading 26:** Removed the unauthorized demand not to invent Ida Mae's later departure date and recast the Chicago/Mississippi passages as source-based description rather than comparative moral direction.

## Deliberately retained source qualifications

This is **not** a blanket deletion of words such as *warning*, *historical*, *critique*, *claim*, *alleged*, *mistake*, or *not*. For example:

- Reading 04's distinction between contemporary laudatory chronicles and later Ayyubid/Mamluk hostile narratives is intrinsic to the source.
- Reading 09's Saussure example is an explicitly modern analogy *present in the supplied explainer*.
- Reading 21's difference between legal manuals and court practice, and between enforceable law and moral expectation, belongs to the source's argument.
- Reading 22's competing theories concerning Fāṭimid glass jetons are presented as an unresolved scholarly debate in the source.
- Reading 23's comparison of a legendary earlier village count with a reported later figure is part of the supplied text.
- Reading 24's distinction between original writing, later transmission and surviving copies is central to its archival argument.

## Technical implementation and rebuild guarantees

1. `source/editorial-fidelity-overrides.json` records chapter-scoped, exact, documented replacements. A mismatched or duplicated original is a build **error**, not an invitation to make a fuzzy substitution.
2. `scripts/rebuild_published_reader.py` rebuilds the immutable source ZIP, removes previously approved title-page notices, applies the editorial overlay, then demands byte-for-byte parity with the published chapter body.
3. `scripts/verify_source_archive.py` compares semantic chapter text against this same corrected rebuild rather than falsely expecting an intentionally obsolete text checkpoint.
4. `tests/test_source_fidelity.py` checks all corrections, the original reading inventory, revision zones and specified retained source information. CI executes the test.
5. All corrections live on an isolated review branch. **No direct changes to `main`.**

## Future editorial boundary

No future chapter or redesign may introduce editorial skepticism or modern moral/political/academic qualifications unless they are themselves explicitly in the supplied source. If supplementation is requested later, it must be separately labelled and must never be substituted into the author's main account.
