# Discoverability scorecard (website-only)

The goal — *"get this homepage indexed as widely as possible and ranked as high
as possible, ahead of the competing survey"* — turned into measurable targets
that can be **verified with nothing but a browser and a local audit** (no
Search-Console / analytics account required, because our operating scope is the
website itself).

## Scorecard

| # | KPI | How to verify (zero accounts) | Target | When checkable |
|---|-----|-------------------------------|--------|----------------|
| 1 | Technical SEO score | `npx lighthouse https://world-action-models.github.io/ --only-categories=seo --view` (or Chrome DevTools → Lighthouse) | **100** | now |
| 2 | Structured-data validity | Paste the URL into <https://search.google.com/test/rich-results>; or locally `node scripts/check-seo.mjs` | **0 errors**, WebSite + ScholarlyArticle + Dataset detected | now |
| 3 | Indexability checklist | `node scripts/check-seo.mjs` (canonical, robots, sitemap, unique title/description, Scholar tags, OG/Twitter, lang) | **100% pass** | now |
| 4 | Target-keyword on-page coverage | `node scripts/check-seo.mjs` greps the rendered page for every keyword below | every keyword present ≥1× | now |
| 5 | Index coverage | Search Google/Bing for `site:world-action-models.github.io` | every canonical page listed | days–weeks after deploy |
| 6 | Google Scholar inclusion | Search Scholar for `World Action Models: A Survey` | found, with `[PDF]` / `[HTML]` link | weeks after deploy |

## Target keywords (must appear on-page)

Branded / category terms we want to own:

- World Action Models · WAM · world action model survey
- world models · video world models · world model survey
- vision-language-action · VLA · VLA survey
- robot learning · embodied AI · embodied intelligence
- predictive action models · robot foundation models
- generative world models for robotics

## What is implemented on-site (the ceiling's foundation)

- Canonical URLs, `robots` directives, `robots.txt`, `sitemap.xml`
- Open Graph + Twitter Card (rich previews when the link is shared → earns clicks/links)
- **Google Scholar `citation_*` tags** — the lever for academic indexing
- JSON-LD `@graph`: `WebSite` + `ScholarlyArticle` + `Dataset` (the 109-paper explorer,
  eligible for Google Dataset Search) + `Organization`
- Keyword-aligned `<title>`, `<h1>`, `<meta description>`, and body copy
- `404.html` marked `noindex`

## The honest ceiling (outside website scope)

On-site work guarantees we are **fully and correctly indexable and maximally
relevant** — that is the floor for ranking, not a guarantee of out-ranking an
established competitor. The dominant ranking lever is **backlinks / domain
authority**, which is off-site. The only on-site way to influence it is to make
the page *worth linking to* — which is why the interactive explorer, shareable
OG image, and the `Dataset` markup matter. Anything beyond that (arXiv homepage
field, Papers-with-Code, awesome-list README, social posts) lives off this repo.
