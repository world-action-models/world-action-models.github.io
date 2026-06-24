#!/usr/bin/env node
// Zero-account SEO audit for the WAM survey homepage.
// Verifies KPIs 2/3/4 from SEO.md against the static files in this repo.
// Usage: node scripts/check-seo.mjs   (exit 0 = all critical checks pass)

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://world-action-models.github.io";

const read = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), "utf8") : null);
const index = read("index.html");
const bibtex = read("bibtex.html");

let critical = 0;
let failed = 0;
const line = (ok, label, soft = false) => {
  const mark = ok ? "PASS" : soft ? "WARN" : "FAIL";
  console.log(`  [${mark}] ${label}`);
  if (!ok && !soft) failed++;
  if (!soft) critical++;
};
const has = (html, re) => re.test(html);

console.log("\n# Indexability checklist (KPI 3)\n");
line(!!index, "index.html present");
line(!!bibtex, "bibtex.html present");
line(existsSync(join(ROOT, "robots.txt")), "robots.txt present");
line(existsSync(join(ROOT, "sitemap.xml")), "sitemap.xml present");

const robots = read("robots.txt") || "";
line(/Sitemap:\s*https?:\/\/\S+sitemap\.xml/i.test(robots), "robots.txt references sitemap");
const sitemap = read("sitemap.xml") || "";
line(sitemap.includes(`${ORIGIN}/`) && sitemap.includes("bibtex.html"), "sitemap lists both canonical pages");

for (const [name, html] of [["index", index], ["bibtex", bibtex]]) {
  if (!html) continue;
  console.log(`\n  -- ${name}.html --`);
  line(has(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']https?:\/\//i), `${name}: canonical link`);
  line(has(html, /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*index/i), `${name}: meta robots index`);
  line(has(html, /<title>[^<]{15,}<\/title>/i), `${name}: non-empty <title>`);
  line(has(html, /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{50,}/i), `${name}: meaningful description`);
  line(has(html, /<meta[^>]+property=["']og:title["']/i), `${name}: Open Graph tags`);
  line(has(html, /<meta[^>]+name=["']twitter:card["']/i), `${name}: Twitter Card tags`);
  line(has(html, /<html[^>]+lang=["'][a-z]/i), `${name}: html lang attribute`);
}

console.log("\n# Google Scholar citation tags (KPI 3)\n");
const authorTags = (index.match(/<meta[^>]+name=["']citation_author["']/gi) || []).length;
line(has(index, /citation_title/), "citation_title present");
line(authorTags >= 8, `citation_author × ${authorTags} (expected ≥ 8)`);
line(has(index, /citation_pdf_url/), "citation_pdf_url present");
line(has(index, /citation_arxiv_id/), "citation_arxiv_id present");
line(has(index, /citation_publication_date/), "citation_publication_date present");

console.log("\n# Structured data — JSON-LD (KPI 2)\n");
const ld = index.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i);
let types = [];
if (ld) {
  try {
    const data = JSON.parse(ld[1]);
    const graph = data["@graph"] || [data];
    types = graph.map((n) => n["@type"]).flat();
    line(true, "JSON-LD parses without error");
    for (const t of ["WebSite", "ScholarlyArticle", "Dataset", "Organization"]) {
      line(types.includes(t), `JSON-LD contains ${t}`);
    }
  } catch (e) {
    line(false, `JSON-LD parse error: ${e.message}`);
  }
} else {
  line(false, "JSON-LD block present");
}

console.log("\n# Target-keyword on-page coverage (KPI 4)\n");
const keywords = [
  "World Action Models", "WAM", "world models", "video world models",
  "vision-language-action", "VLA", "robot learning", "embodied",
  "predictive", "world model", "survey", "taxonomy",
];
const lc = index.toLowerCase();
for (const kw of keywords) {
  const count = lc.split(kw.toLowerCase()).length - 1;
  line(count >= 1, `"${kw}" — ${count}×`, count >= 1 ? false : true);
}

console.log(`\n${failed === 0 ? "ALL CRITICAL CHECKS PASS" : failed + " CRITICAL CHECK(S) FAILED"} (${critical} critical checks)\n`);
process.exit(failed === 0 ? 0 : 1);
