"""后端可视化 Demo 页。

打开 http://localhost:8000/ 即可看到茶库、冷启动 Feed 顺序与一条示例推荐，
作为「后端也能可视化」的入口。API 完整文档见 /docs。
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from models import SENSORY_DIMS
from services.recommendation import (
    cold_start_feed,
    explain_recommendation,
    recommend,
)
from services.tea_profile import list_teas

# 9 维感官的中文标签（与 recommendation.DIM_LABELS 对齐）
_DIM_LABELS = ["鲜爽", "甜润", "醇厚", "焙火", "涩感", "花香", "果香", "干净", "回甘"]


def _escape(text: str) -> str:
    """极简 HTML 转义（防止种子数据里的特殊字符破坏结构）。"""
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _sensory_bars(vector) -> str:
    """把 9 维感官向量渲染成一排迷你条形（0-10 归一化到百分比）。"""
    if not vector:
        return ""
    bars = []
    for label, value in zip(_DIM_LABELS, vector):
        pct = max(0, min(100, round(float(value) * 10)))
        bars.append(
            f'<div class="dim"><span class="dname">{label}</span>'
            f'<span class="dbar"><i style="width:{pct}%"></i></span>'
            f'<span class="dval">{float(value):.1f}</span></div>'
        )
    return '<div class="sensory">' + "".join(bars) + "</div>"


def _tea_card(tea) -> str:
    blind = tea.blind_copy or {}
    tags = blind.get("tags", [])
    return f"""
    <article class="card">
      <div class="card-top">
        <span class="emoji">{_escape(tea.emoji or '🍃')}</span>
        <div>
          <h3>{_escape(tea.name)}</h3>
          <div class="region">{_escape(tea.region)} · {_escape(tea.tea_type)}</div>
        </div>
      </div>
      <div class="tags">{''.join(f'<span class="tag">{_escape(t)}</span>' for t in tags)}</div>
      <p class="headline">「{_escape(blind.get('headline', ''))}」</p>
      <p class="desc">{_escape(blind.get('description', ''))}</p>
      {_sensory_bars(tea.sensory_vector)}
    </article>
    """


def render_demo_html(db: Session) -> str:
    """渲染 Demo 页 HTML。"""
    teas = list_teas(db)
    cards = "".join(_tea_card(t) for t in teas)

    # 冷启动 Feed 顺序 + 一条示例推荐
    feed_ids = cold_start_feed(db, count=5)
    feed_names = []
    for tid in feed_ids:
        t = next((x for x in teas if x.id == tid), None)
        feed_names.append(t.name if t else tid)

    reco_ids = recommend(db, "demo", top_k=1)
    reco_html = ""
    if reco_ids:
        t = next((x for x in teas if x.id == reco_ids[0]), None)
        if t:
            reason = explain_recommendation(db, "demo", t.id)
            reco_html = f"""
    <div class="reco">
      <span class="reco-emoji">{_escape(t.emoji or '🍃')}</span>
      <div>
        <div class="reco-label">当前最想让你试的一杯</div>
        <div class="reco-name">{_escape(t.name)}</div>
        <div class="reco-reason">{_escape(reason)}</div>
      </div>
    </div>
    """

    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>刷茶 API · Demo</title>
<style>
  :root {{
    --bg:#F7F3EA; --ink:#1F3D2B; --ink-soft:#4A6552; --ink-faint:#8B9A8D;
    --leaf:#6F9A4E; --leaf-deep:#557C3A; --leaf-mist:#DCE8CF;
    --amber:#C99A5B; --amber-mist:#EFE0C4; --line:rgba(31,61,43,.1);
    --serif:"Songti SC","Noto Serif SC","STSong","SimSun",serif;
    --sans:-apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  }}
  * {{ box-sizing:border-box; margin:0; padding:0; }}
  body {{
    font-family:var(--sans); color:var(--ink); background:var(--bg);
    -webkit-font-smoothing:antialiased; line-height:1.6;
  }}
  header {{
    display:flex; align-items:center; justify-content:space-between;
    padding:20px 32px; border-bottom:1px solid var(--line);
    background:rgba(253,251,245,.8); backdrop-filter:blur(8px);
  }}
  .logo {{ font-family:var(--serif); font-size:20px; font-weight:700; }}
  .logo span {{ font-family:var(--sans); font-size:11px; letter-spacing:.22em; color:var(--ink-faint); margin-left:8px; }}
  header a {{ color:var(--leaf-deep); text-decoration:none; font-size:13px; font-weight:600; }}
  main {{ max-width:1080px; margin:0 auto; padding:32px; }}
  .hero {{ margin-bottom:36px; }}
  .hero h1 {{ font-family:var(--serif); font-size:34px; line-height:1.3; font-weight:700; }}
  .hero p {{ color:var(--ink-soft); margin-top:10px; font-size:14px; }}
  h2 {{ font-family:var(--serif); font-size:20px; margin:28px 0 16px; }}
  .grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:16px; }}
  .card {{
    background:#FDFBF5; border:1px solid var(--line); border-radius:18px;
    padding:18px; box-shadow:0 1px 2px rgba(31,61,43,.03), 0 6px 20px rgba(31,61,43,.05);
  }}
  .card-top {{ display:flex; align-items:center; gap:12px; margin-bottom:10px; }}
  .emoji {{ font-size:34px; }}
  h3 {{ font-family:var(--serif); font-size:18px; font-weight:700; }}
  .region {{ font-size:12px; color:var(--ink-faint); }}
  .tags {{ display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; }}
  .tag {{ font-size:11.5px; font-weight:600; color:var(--leaf-deep); background:var(--leaf-mist); padding:3px 9px; border-radius:8px; }}
  .headline {{ font-size:14px; color:var(--ink); font-weight:600; margin-bottom:4px; }}
  .desc {{ font-size:12.5px; color:var(--ink-soft); }}
  .sensory {{ margin-top:12px; padding-top:10px; border-top:1px dashed var(--line); }}
  .dim {{ display:flex; align-items:center; gap:6px; font-size:10.5px; color:var(--ink-faint); margin-bottom:3px; }}
  .dname {{ width:28px; flex:none; }}
  .dbar {{ flex:1; height:5px; background:var(--bg); border-radius:3px; overflow:hidden; }}
  .dbar i {{ display:block; height:100%; background:linear-gradient(90deg,var(--leaf-mist),var(--leaf)); border-radius:3px; }}
  .dval {{ width:24px; text-align:right; flex:none; color:var(--ink-soft); }}
  .feed {{ display:flex; flex-wrap:wrap; gap:8px; align-items:center; }}
  .feed .step {{
    display:inline-flex; align-items:center; gap:8px;
    background:#FDFBF5; border:1px solid var(--line); border-radius:12px; padding:8px 14px; font-size:13px;
  }}
  .feed .step b {{ color:var(--leaf-deep); margin-right:2px; }}
  .feed .arrow {{ color:var(--ink-faint); }}
  .reco {{
    display:flex; gap:14px; align-items:center; max-width:520px;
    background:linear-gradient(145deg,var(--leaf-mist),#E7F0DC);
    border-radius:18px; padding:18px; margin-top:4px;
  }}
  .reco-emoji {{ font-size:34px; }}
  .reco-label {{ font-size:11px; letter-spacing:.14em; color:var(--leaf-deep); font-weight:700; }}
  .reco-name {{ font-family:var(--serif); font-size:20px; font-weight:700; }}
  .reco-reason {{ font-size:12.5px; color:var(--ink-soft); margin-top:4px; }}
  footer {{ color:var(--ink-faint); font-size:12px; padding:0 32px 40px; }}
  footer a {{ color:var(--leaf-deep); }}
</style>
</head>
<body>
  <header>
    <div class="logo">🍃 刷茶<span>SHUACHA API</span></div>
    <a href="/docs">API 文档 →</a>
  </header>
  <main>
    <section class="hero">
      <h1>你不用先懂茶。<br/>刷几下，茶先开始懂你。</h1>
      <p>后端 Demo · 茶库 {len(teas)} 款 · 冷启动 Feed · 一条示例推荐</p>
    </section>

    <section>
      <h2>茶库 · {len(teas)} 款</h2>
      <div class="grid">{cards}</div>
    </section>

    <section>
      <h2>冷启动 Feed 顺序（感官差异贪心）</h2>
      <div class="feed">
        {''.join(f'<span class="step"><b>{i + 1}</b>{_escape(n)}</span><span class="arrow">→</span>' for i, n in enumerate(feed_names)).rstrip('<span class="arrow">→</span>')}
      </div>
    </section>

    <section>
      <h2>示例推荐</h2>
      {reco_html or '<p style="color:var(--ink-faint)">暂无推荐。</p>'}
    </section>
  </main>
  <footer>数据来自本地种子库（SQLite）· 完整接口见 <a href="/docs">/docs</a></footer>
</body>
</html>
"""
