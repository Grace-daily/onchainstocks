#!/usr/bin/env python3
"""
每月检查 CRS 政策相关的官方信源是否有更新。
监控 OECD 的 CRS 资源中心与自动交换关系页；有变化输出 diff 供人工判断，
由人工决定是否需要在 crs.html 中补充内容。可在 SOURCES 中自行增删信源。
"""
import re, sys, pathlib, difflib, urllib.request

SOURCES = [
    ("OECD CRS 资源中心",
     "https://www.oecd.org/tax/automatic-exchange/common-reporting-standard.html",
     "scripts/snapshots/oecd-crs-hub.txt"),
    ("OECD 自动交换关系（CRS/CARF 激活列表）",
     "https://www.oecd.org/en/topics/sub-issues/international-standards-on-tax-transparency/automatic-exchange-of-information-exchange-relationships.html",
     "scripts/snapshots/oecd-aeoi-relationships.txt"),
]

def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; OnstockGuideMonitor/1.0)"})
    html = urllib.request.urlopen(req, timeout=45).read().decode("utf-8", "ignore")
    html = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", html, flags=re.I)
    text = re.sub(r"<[^>]+>", "\n", html)
    lines = [l.strip() for l in text.splitlines()]
    return "\n".join(l for l in lines if l and len(l) > 1)

def main() -> int:
    changed_reports = []
    for name, url, snap in SOURCES:
        snap_path = pathlib.Path(snap)
        snap_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            new = fetch_text(url)
        except Exception as e:
            print(f"[跳过] {name} 抓取失败：{e}")
            continue
        old = snap_path.read_text(encoding="utf-8") if snap_path.exists() else ""
        if not old:
            snap_path.write_text(new, encoding="utf-8")
            print(f"[初始化] {name} 首次快照已保存")
            continue
        if new == old:
            print(f"[无变化] {name}")
            continue
        diff = list(difflib.unified_diff(
            old.splitlines(), new.splitlines(),
            fromfile="上次快照", tofile="本次抓取", lineterm="", n=1))
        changed_reports.append(f"### {name}\n{url}\n\n```diff\n" + "\n".join(diff[:120]) + "\n```")
        snap_path.write_text(new, encoding="utf-8")
        print(f"[有变化] {name}")

    if changed_reports:
        pathlib.Path("crs-diff.md").write_text("\n\n".join(changed_reports), encoding="utf-8")
        return 42
    return 0

if __name__ == "__main__":
    sys.exit(main())
