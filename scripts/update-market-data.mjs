import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://getrealstocks.com/";
const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, "../data/market.json");
const scriptOutput = resolve(here, "../data/market-data.js");

let html;
try {
  const response = await fetch(SOURCE_URL, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; OnstockGuide/1.0)" }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  html = await response.text();
} catch (e) {
  console.error(`Fetch failed: ${e.message}. Keeping existing data.`);
  process.exit(0);
}

const text = html
  .replace(/<!--.*?-->/gs, "")
  .replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<style[\s\S]*?<\/style>/gi, "")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ");

const allValues = [...text.matchAll(/\$([\d,.]+[KMBT])/g)].map(m => ({
  value: "$" + m[1],
  index: m.index
}));

const allChanges = [...text.matchAll(/([▲▼])\s*([\d.]+)%/g)].map(m => ({
  pct: Number(m[2]) * (m[1] === "\u25BC" ? -1 : 1),
  index: m.index
}));

console.log(`Found ${allValues.length} dollar values, ${allChanges.length} change percentages`);
allValues.slice(0, 5).forEach(v => console.log(`  ${v.value} at ${v.index}`));

const labels = [
  { id: "spot", label: "\u73B0\u8D27\u6210\u4EA4\u91CF \u00B7 24H" },
  { id: "perp", label: "\u5408\u7EA6\u6210\u4EA4\u91CF \u00B7 24H" },
  { id: "oi", label: "\u672A\u5E73\u4ED3\u91CF \u00B7 \u5168\u5E02\u573A" }
];

const metrics = [];
for (let i = 0; i < Math.min(3, allValues.length); i++) {
  const v = allValues[i];
  const nearestChange = allChanges.find(c => c.index > v.index && c.index - v.index < 200);
  const changePct = nearestChange ? nearestChange.pct : 0;
  metrics.push({
    id: labels[i].id,
    label: labels[i].label,
    value: v.value,
    changePct
  });
  console.log(`OK ${labels[i].id}: ${v.value} (${changePct > 0 ? "+" : ""}${changePct}%)`);
}

if (metrics.length === 0) {
  console.error("No metrics extracted. Keeping existing data.");
  process.exit(0);
}

const payload = {
  source: "Get Real Stocks",
  sourceUrl: SOURCE_URL,
  updatedAt: new Date().toISOString(),
  metrics
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
await writeFile(scriptOutput, `window.__MARKET_DATA__ = ${JSON.stringify(payload, null, 2)};\n`, "utf8");
console.log("\nUpdated market data successfully");
console.table(payload.metrics);
