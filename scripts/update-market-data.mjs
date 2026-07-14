import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://getrealstocks.com/";
const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, "../data/market.json");
const scriptOutput = resolve(here, "../data/market-data.js");

const response = await fetch(SOURCE_URL, {
  headers: { "user-agent": "onchain-stocks-guide/1.0 (+GitHub Actions)" }
});
if (!response.ok) throw new Error(`Get Real Stocks returned HTTP ${response.status}`);
const html = await response.text();

function extractCard(englishLabel, id, chineseLabel) {
  const start = html.indexOf(`<span>${englishLabel}</span>`);
  if (start < 0) throw new Error(`Missing card: ${englishLabel}`);
  const fragment = html.slice(start, start + 2200);
  const value = fragment.match(/tabular-nums[^>]*>(\$[\d,.]+[KMBT]?)/)?.[1];
  const text = fragment.replace(/<!--.*?-->/gs, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const change = text.match(/([▲▼])\s*([\d.]+)%/);
  if (!value || !change) throw new Error(`Incomplete card: ${englishLabel}`);
  const changePct = Number(change[2]) * (change[1] === "▼" ? -1 : 1);
  return { id, label: chineseLabel, value, changePct };
}

const payload = {
  source: "Get Real Stocks",
  sourceUrl: SOURCE_URL,
  updatedAt: new Date().toISOString(),
  metrics: [
    extractCard("Spot Volume", "spot", "现货成交量 · 24H"),
    extractCard("Perp Volume", "perp", "合约成交量 · 24H"),
    extractCard("Open Interest", "oi", "未平仓量 · 全市场")
  ]
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
await writeFile(scriptOutput, `window.__MARKET_DATA__ = ${JSON.stringify(payload, null, 2)};\n`, "utf8");
console.log(`Updated ${output} and ${scriptOutput}`);
console.table(payload.metrics);
