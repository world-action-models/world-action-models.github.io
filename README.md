# World Action Models Survey Homepage

Static GitHub Pages homepage for the WAM survey.

## Contents

- `index.html`: deployed page.
- `assets/css/styles.css`: visual design.
- `assets/js/app.js`: client-side paper explorer.
- `assets/data/papers.json`: generated paper collection plus citation metadata.
- `assets/img/figures/`: local image and SVG figure assets.
- `assets/figures/html/`: tracked vector figure source documents embedded by the homepage.
- `scripts/update-paper-metadata.mjs`: refreshes exact arXiv first-version dates and citation counts.
- `.github/workflows/update-paper-metadata.yml`: weekly metadata refresh workflow.

## Local Preview

```bash
python3 -m http.server 8080
```

Then open `http://127.0.0.1:8080/`.

## Data Refresh

The paper collection is generated in the parent workspace by:

```bash
node ../materials/build-papers-data.mjs
node scripts/update-paper-metadata.mjs
```

The deployed repository is self-contained for weekly citation/date refreshes. The
workflow uses Semantic Scholar first and OpenAlex as fallback. If available, add a
`SEMANTIC_SCHOLAR_API_KEY` repository secret to raise the Semantic Scholar rate limit.
