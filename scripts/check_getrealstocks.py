#!/usr/bin/env python3
"""
每周检查 GetRealStocks.com 是否有更新。
逻辑：抓取页面 → 提取正文文本 → 与仓库中的快照比对 → 有差异则输出 diff 并更新快照。
不修改网站内容，只做提醒；数据是否同步到 index.html 由人工确认。
"""
import re, sys, pathlib, difflib, urllib.request

URL = "https://getrealstocks.com/"
SNAPSHOT = pathlib.Path("scripts/getrealstocks-snapshot.txt")

def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; OnstockGuideMonitor/1.0)"})
    html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
    # 去掉脚本/样式，抽取可见文本
    html = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", html, flags=re.I)
    text = re.sub(r"<[^>]+>", "\n", html)
    lines = [l.strip() for l in text.splitlines()]
    lines = [l for l in lines if l and len(l) > 1]
    return "\n".join(lines)

def main() -> int:
    new = fetch_text(URL)
    old = SNAPSHOT.read_text(encoding="utf-8") if SNAPSHOT.exists() else ""

    if not old:
        SNAPSHOT.write_text(new, encoding="utf-8")
        print("首次运行，已保存快照。")
        return 0

    if new == old:
        print("无变化。")
        return 0

    diff = list(difflib.unified_diff(
        old.splitlines(), new.splitlines(),
        fromfile="上次快照", tofile="本次抓取", lineterm="", n=1))
    body = "\n".join(diff[:200])
    pathlib.Path("diff.txt").write_text(body, encoding="utf-8")
    SNAPSHOT.write_text(new, encoding="utf-8")
    print("检测到变化，diff 已写入 diff.txt")
    return 42  # 特殊退出码：告诉 workflow 有变化

if __name__ == "__main__":
    sys.exit(main())
