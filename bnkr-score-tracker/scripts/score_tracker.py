#!/usr/bin/env python3
"""bnkr-score-tracker — track your Bankr Score, explain category moves, render a shareable SVG card.

Data source: the public Bankr leaderboard API (api.bankr.bot), no auth needed.
Usage:
  score_tracker.py track <username>              # snapshot: rank, score, categories, 30d trend, delta
  score_tracker.py top [24h|7d|30d|total]        # leaderboard top 20
  score_tracker.py card <username> [out.svg]     # generate an SVG progress card (prints path)
History: appends every `track` snapshot to ~/.bnkr-score-tracker/history.jsonl so
you can see your own trend across runs.
"""
import json
import os
import sys
import time
import urllib.request
import urllib.parse

API = "https://api.bankr.bot/leaderboard"
HISTORY_DIR = os.path.expanduser("~/.bnkr-score-tracker")
HISTORY_FILE = os.path.join(HISTORY_DIR, "history.jsonl")
UA = {"User-Agent": "bnkr-score-tracker/1.0"}

CATEGORY_LABELS = {
    "bnkr": "BNKR staked",
    "partner": "Partner",
    "pnl": "PnL",
    "nft": "NFTs",
    "referral": "Referral",
    "llmUsage": "LLM Gateway",
    "social": "Social",
    "deployer": "Deployer",
    "developer": "Builder",
    "og": "OG",
}


def get(path, params=None):
    url = API + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode())


def resolve(username):
    res = get("/search", {"searchQuery": username})
    for r in res.get("results", []):
        if r["username"].lower() == username.lower():
            return r["socialAccountId"], r["username"]
    if res.get("results"):
        r = res["results"][0]
        return r["socialAccountId"], r["username"]
    sys.exit(f"No leaderboard account found for '{username}'")


def snapshot(username):
    account_id, handle = resolve(username)
    profile = get(f"/users/{account_id}/profile")
    scores = get(f"/users/{account_id}/scores", {"timeframe": "30d"})["scores"]
    try:
        progress = get(f"/users/{account_id}/score-progress")
    except Exception:
        progress = {}
    return account_id, handle, profile, scores, progress


def trend(progress):
    """Return (first, last, points) from the longest window in score-progress."""
    if not progress:
        return None
    key = sorted(progress.keys())[-1] if "30d" not in progress else "30d"
    data = progress[key].get("data") or []
    if len(data) < 2:
        return None
    first, last = data[0], data[-1]
    days = max(1, round((last["timestamp"] - first["timestamp"]) / 86400000))
    return first["score"], last["score"], days, [p["score"] for p in data]


def fmt_usd(x):
    return f"{x:,.0f}"


def cmd_track(username):
    account_id, handle, profile, scores, progress = snapshot(username)
    total = profile.get("totalScore", scores.get("total", {}).get("score", 0))
    rank = profile.get("rank")
    tr = trend(progress)
    row = {
        "ts": int(time.time() * 1000),
        "username": handle,
        "rank": rank,
        "totalScore": total,
        "categories": {k: v.get("score") for k, v in scores.items() if k != "total"},
    }
    os.makedirs(HISTORY_DIR, exist_ok=True)
    with open(HISTORY_FILE, "a") as f:
        f.write(json.dumps(row) + "\n")

    print(f"@{handle} — Bankr Score {total:.4f} — Rank #{rank}")
    club = " (Bankr Club)" if profile.get("bankrClub") else ""
    og = profile.get("ogTier")
    og = f" — OG tier {og}" if og else ""
    print(f"{club}{og}")
    print("\nCategories (30d, normalized contribution):")
    cats = sorted(
        ((k, v.get("score", 0), v.get("raw", 0)) for k, v in scores.items() if k != "total"),
        key=lambda t: -t[1],
    )
    for k, s, raw in cats:
        bar = "#" * max(1, int(s * 30)) if s > 0 else "·"
        label = CATEGORY_LABELS.get(k, k)
        print(f"  {label:<14} {s:>7.4f}  {bar}")
    top_cat = cats[0][0] if cats and cats[0][1] > 0 else None
    if tr:
        first, last, days, points = tr
        delta = last - first
        sign = "+" if delta >= 0 else ""
        print(f"\nTrend over {days}d: {sign}{delta:.5f} ({first:.5f} → {last:.5f})")
        if delta > 0 and top_cat:
            print(f"Main engine right now: {CATEGORY_LABELS.get(top_cat, top_cat)}.")
    prev = read_previous(handle)
    if prev:
        d = total - prev["totalScore"]
        dr = rank - prev["rank"] if rank and prev.get("rank") else None
        sign = "+" if d >= 0 else ""
        move = f", rank {sign}{dr if dr is not None else '?'}" if dr is not None else ""
        print(f"Since last snapshot: score {sign}{d:.5f}{move}")
    print(f"\nHistory: {HISTORY_FILE}")


def read_previous(handle):
    if not os.path.exists(HISTORY_FILE):
        return None
    prev = None
    with open(HISTORY_FILE) as f:
        for line in f:
            try:
                r = json.loads(line)
            except Exception:
                continue
            if r.get("username") == handle:
                prev = r
    return prev


def cmd_top(timeframe="24h"):
    tf = timeframe if timeframe in ("24h", "7d", "30d", "total") else "24h"
    res = get("/rankings", {"timeframe": tf, "limit": 20, "type": "total"})
    print(f"Top 20 — {tf}")
    for u in res.get("data", []):
        print(f"  #{u['rank']:>3} @{u['username']:<20} {u['totalScore']:.4f}")


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def cmd_card(username, out=None):
    account_id, handle, profile, scores, progress = snapshot(username)
    total = profile.get("totalScore", 0)
    rank = profile.get("rank") or "—"
    tr = trend(progress)
    points = tr[3] if tr else [total]
    lo, hi = min(points + [total]) or 0, max(points + [total]) or 1
    rng = (hi - lo) or 1
    W, H = 560, 380
    x0, y0, w, h = 40, 220, 480, 110
    poly = " ".join(
        f"{x0 + i * w / max(1, len(points) - 1):.1f},{y0 + h - (p - lo) / rng * h:.1f}"
        for i, p in enumerate(points)
    )
    avatar = profile.get("profilePicture") or ""
    cats = sorted(
        ((k, v.get("score", 0)) for k, v in scores.items() if k != "total"), key=lambda t: -t[1]
    )[:4]
    bars, by = [], 60
    for k, s in cats:
        label = CATEGORY_LABELS.get(k, k)
        bars.append(
            f'<text x="40" y="{by}" font-size="13" fill="#9a9aa8">{esc(label)}</text>'
            f'<rect x="40" y="{by + 6}" width="480" height="8" rx="4" fill="#2a2a35"/>'
            f'<rect x="40" y="{by + 6}" width="{max(2, 480 * min(1, s)):.0f}" height="8" rx="4" fill="#a78bfa"/>'
        )
        by += 36
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#1b1626"/><stop offset="1" stop-color="#241a38"/></linearGradient></defs>
  <rect width="{W}" height="{H}" rx="18" fill="url(#g)"/>
  <text x="40" y="36" font-family="monospace" font-size="14" fill="#a78bfa" letter-spacing="2">BNKR SCORE TRACKER</text>
  <text x="40" y="80" font-family="sans-serif" font-size="24" fill="#fff" font-weight="700">@{esc(handle)}</text>
  <text x="440" y="80" font-family="sans-serif" font-size="34" fill="#fff" font-weight="800" text-anchor="middle">#{rank}</text>
  <text x="440" y="100" font-family="monospace" font-size="11" fill="#9a9aa8" text-anchor="middle">RANK</text>
  <text x="40" y="120" font-family="monospace" font-size="30" fill="#a78bfa" font-weight="700">{total:.4f}</text>
  {''.join(bars)}
  <polyline points="{poly}" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linejoin="round"/>
  <text x="40" y="360" font-family="monospace" font-size="11" fill="#6b6b7a">score trend · bankr.bot/leaderboard</text>
</svg>'''
    path = out or os.path.join(HISTORY_DIR, f"card-{handle}.svg")
    os.makedirs(HISTORY_DIR, exist_ok=True)
    with open(path, "w") as f:
        f.write(svg)
    print(path)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "track"
    if cmd == "track":
        cmd_track(sys.argv[2])
    elif cmd == "top":
        cmd_top(sys.argv[2] if len(sys.argv) > 2 else "24h")
    elif cmd == "card":
        cmd_card(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
    else:
        print(__doc__)
        sys.exit(1)
