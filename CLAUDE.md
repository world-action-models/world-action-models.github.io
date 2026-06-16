# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static GitHub Pages site: the academic project homepage and interactive paper explorer for the "World Action Models (WAM): A Survey" paper. There is **no build step, no framework, and no `package.json`** — `index.html` is served as-is, styled by `assets/css/styles.css`, and driven by a single vanilla ES-module script (`assets/js/app.js`). Node is used only by the standalone metadata-refresh script.

## Commands

```bash
# Local preview (then open http://127.0.0.1:8080/)
python3 -m http.server 8080

# Refresh citation counts + exact arXiv first-version dates, in place
node scripts/update-paper-metadata.mjs
```

The `SEMANTIC_SCHOLAR_API_KEY` env var (optional) raises the Semantic Scholar rate limit during a refresh. There are no tests or linters configured.

## Data flow

`assets/data/papers.json` is the single source of truth for the explorer — `app.js` fetches it at runtime and renders everything from it. The file has two parts: `metadata` (generation/update timestamps, source provenance, total count) and `papers[]` (one object per survey paper).

The data is **generated outside this repo** (the original `build-papers-data.mjs` lives in a sibling workspace, not here) from the survey's LaTeX paper table and bibliography. This repo is self-contained only for the *weekly refresh* — `scripts/update-paper-metadata.mjs` rewrites `papers.json` in place, filling `firstVersionDate` from the arXiv API and `citationCount` from Semantic Scholar (OpenAlex as title-matched fallback, threshold 0.78). `.github/workflows/update-paper-metadata.yml` runs this every Monday and commits the result. So treat `papers.json`'s taxonomy fields as authored-elsewhere; only the date/citation fields are owned by this repo.

Each paper carries five taxonomy axes used by the explorer: `philosophy`, `substrate`, `backbone`, `coupling`, `deployment`, plus `tldr`, `backboneDetail`, and arXiv/citation metadata.

## Explorer architecture (`assets/js/app.js`)

Plain client-side rendering — a single `state` object, then `renderFilters()` / `renderMatrix()` / `renderPapers()` rebuild DOM from `innerHTML` on every change. `sync()` re-renders all three.

Two kinds of filter controls, and the distinction matters when editing:

- **`backbone`, `coupling`, `deployment`** filter buttons are generated dynamically via `uniqueValues()` — new values appearing in `papers.json` show up automatically.
- **`philosophy` and `substrateGroup`** are driven by the **hardcoded ordered arrays** `philosophyOrder` and `substrateOrder` at the top of the file. These also define the rows/columns of the taxonomy matrix. If `papers.json` introduces a new philosophy or substrate group, it will **not** appear in the segmented controls or the matrix until you add it to these arrays.

`substrate` in the data is free-form (e.g. `"Pixel (decoded)"`); `substrateGroups()` maps it to the four coarse buckets (Pixel-grounded / Feature / Geometric / Affordance) via regex. The matrix cells and the substrate filter operate on these derived groups, not the raw `substrate` string. A paper can belong to multiple groups.

## Assets

All assets are local copies so the Pages repo is self-contained; see `ASSET_SOURCES.md` for the origin and any post-processing of each figure/font. `fig-wam-definition.svg` is a code-native vector figure (text/arrows/boxes are SVG objects) — edit it as markup, not as a raster.
