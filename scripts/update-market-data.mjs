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

// GetRealStocks 是 SPA，数据可能由 JS 渲染。
// 策略 1: __NEXT_DATA__ JSON
// 策略 2: 纯文本提取
// 策略 3: 输出调试信息供人工排查

function tryNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) { console.log("No __NEXT_DATA__ found"); return null; }
  try {
    const data = JSON.parse(match[1]);
    console.log("Found __NEXT_DATA__");
    console.log("Top keys:", Object.keys(data));
    if (data.props?.pageProps) console.log("pageProps keys:", Object.keys(data.props.pageProps));
    return data;
  } catch (e) { console.warn("__NEXT_DATA__ parse failed:", e.message); return null; }
}

function tryTextExtraction(html) {
  const text = html
    .replace(/<!--.*?-->/gs, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

  const dollarMatches = [...text.matchAll(/\$[\d,.]+[KMBT]/g)];
  console.log(`Dollar values in text: ${dollarMatches.length}`);
  dollarMatches.forEach(m => console.log(`  ${m[0]} at ${m.index}`));
  if (dollarMatches.length === 0) return null;

  const metrics = [];
  const configs = [
    { id: "spot", label: "现货成交量 · 24H", patterns: [/Spot\s*Volume/i] },
    { id: "perp", label: "合约成交量 · 24H", patterns: [/Perp\s*Volume/i, /Perpetual/i] },
    { id: "oi", label: "未平仓量 · 全市场", patterns: [/Open\s*Interest/i] }
  ];

  for (const cfg of configs) {
    for (const pat of cfg.patterns) {
      const labelMatch = text.match(pat);
      if (!labelMatch) continue;
      const idx = labelMatch.index;
      const vicinity = text.slice(Math.max(0, idx - 500), idx + 500);
      const valueMatch = vicinity.match(/\$([\d,.]+[KMBT])/);
      const changeMatch = vicinity.match(/([▲▼])\s*([\d.]+)%/);
      if (valueMatch) {
        const changePct = changeMatch
          ? Number(changeMatch[2]) * (changeMatch[1] === "▼" ? -1 : 1)
          : 0;
        metrics.push({ id: cfg.id, label: cfg.label, value: "$" + valueMatch[1], changePct });
        console.log(`OK ${cfg.id}: $${valueMatch[1]} (${changePct > 0 ? "+" : ""}${changePct}%)`);
        break;
      }
    }
  }
  return metrics.length > 0 ? metrics : null;
}

console.log("=== Strategy 1: __NEXT_DATA__ ===");
const nextData = tryNextData(html);

console.log("\n=== Strategy 2: Text extraction ===");
const metrics = tryTextExtraction(html);

if (!metrics || metrics.length === 0) {
  console.log("\n=== Debug info ===");
  console.log("HTML length:", html.length);
  console.log("Contains Volume:", html.includes("Volume"));
  console.log("Contains $:", html.includes("$"));
  console.log("Contains 302:", html.includes("302"));
  console.log("\nLast 3000 chars of HTML:");
  console.log(html.slice(-3000));
  console.error("\nNo metrics extracted. Keeping existing data.");
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
console.log(`\nUpdated ${output} and ${scriptOutput}`);
console.table(payload.metrics);
