import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://getrealstocks.com/";
const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, "../data/market.json");
const scriptOutput = resolve(here, "../data/market-data.js");

let html;
try {
  const response = await fetch(SOURCE_URL, {
    headers: { "user-agent": "onchain-stocks-guide/1.0 (+GitHub Actions)" }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  html = await response.text();
} catch (e) {
  console.error(`Fetch failed: ${e.message}. Keeping existing data.`);
  process.exit(0);
}

// 从页面底部的三个大数字指标中提取数据
// 新版页面格式: "$302.9M" "▲ 107.55% vs 4 Weeks ago" "Perp Volume(24h)· All Markets"
function extractMetrics(html) {
  const metrics = [];
  const patterns = [
    { id: "spot", label: "现货成交量 · 24H", match: /Spot\s*Volume/i, fallback: /Volume.*?All\s*Markets/i },
    { id: "perp", label: "合约成交量 · 24H", match: /Perp\s*Volume/i },
    { id: "oi", label: "未平仓量 · 全市场", match: /Open\s*Interest/i }
  ];

  // 提取所有美元数值和百分比变化
  const text = html.replace(/<!--.*?-->/gs, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  
  for (const p of patterns) {
    try {
      // 在文本中找到标签位置
      const labelMatch = text.match(p.match) || (p.fallback && text.match(p.fallback));
      if (!labelMatch) {
        console.warn(`Label not found: ${p.id}, trying alternative extraction`);
        continue;
      }
      
      // 在标签附近200字符范围内搜索数值
      const idx = labelMatch.index;
      const vicinity = text.slice(Math.max(0, idx - 300), idx + 300);
      
      // 匹配美元数值（如 $302.9M, $5.5B, $30.7B）
      const valueMatch = vicinity.match(/\$[\d,.]+[KMBT]?/);
      // 匹配百分比变化（如 ▲ 107.55%, ▼ 3.2%）
      const changeMatch = vicinity.match(/([▲▼])\s*([\d.]+)%/);
      
      if (valueMatch) {
        const changePct = changeMatch 
          ? Number(changeMatch[2]) * (changeMatch[1] === "▼" ? -1 : 1)
          : 0;
        metrics.push({ id: p.id, label: p.label, value: valueMatch[0], changePct });
        console.log(`✓ ${p.id}: ${valueMatch[0]} (${changePct > 0 ? "+" : ""}${changePct}%)`);
      } else {
        console.warn(`Value not found for ${p.id}`);
      }
    } catch (e) {
      console.warn(`Error extracting ${p.id}: ${e.message}`);
    }
  }
  return metrics;
}

const metrics = extractMetrics(html);

if (metrics.length === 0) {
  console.error("No metrics extracted. Page structure may have changed significantly. Keeping existing data.");
  process.exit(0);
}

const payload = {
  source: "Get Real Stocks",
  sourceUrl: SOURCE_URL,
  updatedAt: new Date().toISOString(),
  metrics
};

// 如果提取到的指标少于预期，输出警告但仍然更新（部分数据好过完全过时）
if (metrics.length < 3) {
  console.warn(`Only ${metrics.length}/3 metrics extracted. Some cards may show stale data.`);
}

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
await writeFile(scriptOutput, `window.__MARKET_DATA__ = ${JSON.stringify(payload, null, 2)};\n`, "utf8");
console.log(`Updated ${output} and ${scriptOutput}`);
console.table(payload.metrics);
