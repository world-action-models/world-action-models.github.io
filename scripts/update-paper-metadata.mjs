#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dataPath = path.join(repoRoot, "assets/data/papers.json");
const now = new Date().toISOString();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normaliseTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\\[a-z]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleScore(a, b) {
  const left = new Set(normaliseTitle(a).split(" ").filter(Boolean));
  const right = new Set(normaliseTitle(b).split(" ").filter(Boolean));
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / Math.max(left.size, right.size);
}

function extractArxivEntries(xml) {
  const entries = new Map();
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const block = match[1];
    const id = block.match(/<id>http:\/\/arxiv\.org\/abs\/([0-9]+\.[0-9]+)v\d+<\/id>/)?.[1];
    const published = block.match(/<published>([^<]+)<\/published>/)?.[1];
    if (id && published) entries.set(id, published.slice(0, 10));
  }
  return entries;
}

async function updateArxivDates(papers) {
  const ids = [...new Set(papers.map((paper) => paper.arxivId).filter(Boolean))];
  const found = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url = `https://export.arxiv.org/api/query?id_list=${batch.join(",")}&max_results=${batch.length}`;
    try {
      const response = await fetch(url, { headers: { "User-Agent": "wam-homepage-metadata/1.0" } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const xml = await response.text();
      for (const [id, date] of extractArxivEntries(xml)) found.set(id, date);
    } catch (error) {
      console.warn(`arXiv batch failed at ${batch[0]}: ${error.message}`);
    }
    await sleep(3200);
  }

  for (const paper of papers) {
    const date = found.get(paper.arxivId);
    if (date) {
      paper.firstVersionDate = date;
      paper.firstVersionDatePrecision = "day";
      paper.firstVersionSource = "arXiv API";
    }
  }
}

async function updateSemanticScholarCounts(papers) {
  const key = process.env.SEMANTIC_SCHOLAR_API_KEY;
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "wam-homepage-metadata/1.0",
  };
  if (key) headers["x-api-key"] = key;

  const candidates = papers.filter((paper) => paper.arxivId);
  for (let i = 0; i < candidates.length; i += 100) {
    const batch = candidates.slice(i, i + 100);
    try {
      const response = await fetch(
        "https://api.semanticscholar.org/graph/v1/paper/batch?fields=paperId,title,citationCount,externalIds",
        {
          method: "POST",
          headers,
          body: JSON.stringify({ ids: batch.map((paper) => `ARXIV:${paper.arxivId}`) }),
        },
      );
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const records = await response.json();
      records.forEach((record, index) => {
        if (record && Number.isFinite(record.citationCount)) {
          const paper = batch[index];
          paper.citationCount = record.citationCount;
          paper.citationSource = "Semantic Scholar";
          paper.citationUpdatedAt = now;
        }
      });
    } catch (error) {
      console.warn(`Semantic Scholar batch failed at ${batch[0]?.arxivId}: ${error.message}`);
    }
    await sleep(key ? 1200 : 5000);
  }
}

async function updateOpenAlexFallbackCounts(papers) {
  const missing = papers.filter((paper) => !Number.isFinite(paper.citationCount));
  for (const paper of missing) {
    const params = new URLSearchParams({
      search: paper.title,
      "per-page": "1",
      select: "id,display_name,cited_by_count,publication_date",
    });
    try {
      const response = await fetch(`https://api.openalex.org/works?${params}`, {
        headers: { "User-Agent": "wam-homepage-metadata/1.0" },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const data = await response.json();
      const result = data.results?.[0];
      if (result && titleScore(paper.title, result.display_name) >= 0.78) {
        paper.citationCount = Number(result.cited_by_count) || 0;
        paper.citationSource = "OpenAlex";
        paper.citationUpdatedAt = now;
        if (result.publication_date && paper.firstVersionDatePrecision !== "day") {
          paper.firstVersionDate = result.publication_date;
          paper.firstVersionDatePrecision = "day";
          paper.firstVersionSource = "OpenAlex";
        }
      }
    } catch (error) {
      console.warn(`OpenAlex lookup failed for ${paper.shortName}: ${error.message}`);
    }
    await sleep(260);
  }
}

async function main() {
  const payload = JSON.parse(await fs.readFile(dataPath, "utf8"));
  await updateArxivDates(payload.papers);
  await updateSemanticScholarCounts(payload.papers);
  await updateOpenAlexFallbackCounts(payload.papers);

  for (const paper of payload.papers) {
    if (!Number.isFinite(paper.citationCount)) {
      paper.citationCount = 0;
      paper.citationSource = "not indexed";
      paper.citationUpdatedAt = now;
    }
  }

  payload.metadata.metadataUpdatedAt = now;
  payload.metadata.citationSources = ["Semantic Scholar", "OpenAlex"];
  payload.papers.sort((a, b) => String(a.firstVersionDate).localeCompare(String(b.firstVersionDate)));
  await fs.writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Updated ${payload.papers.length} paper records at ${now}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
