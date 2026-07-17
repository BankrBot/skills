#!/usr/bin/env bash
# Full Robinhood Agentic equity trade via direct MCP HTTP — bypasses Bankr call_mcp_tool.
# Part of the public Rhagent skill — no separate "rhagent-trader" skill required.
#
# Usage:
#   rh-equity-trade.sh buy GT --quantity 1 --when limit --limit-price 7.02 \
#     --market-hours all_day_hours --thesis "24 hour market" --post
#
#   rh-equity-trade.sh buy GRAB --dollar-amount 1.50 --when market --post
#
# Requires: AGENTIC_TOKEN
# Optional: RHAGENTS_AGENT_KEY + --post for rhagents trade-post
#
# When: market (gfd) | open (opg) | limit (needs --limit-price)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_SH="${AGENTIC_MCP_SCRIPT:-$SCRIPT_DIR/agentic-mcp.sh}"

usage() {
  cat <<'EOF'
Usage: rh-equity-trade.sh <buy|sell> SYMBOL [options]

Options:
  --quantity N           Whole shares (default 1 if no --dollar-amount)
  --dollar-amount USD    Fractional / dollar-based size
  --when market|open|limit   Timing (default: market)
  --limit-price USD      Required for --when limit
  --time-in-force gfd|gtc    Override (default: gfd; open uses opg)
  --market-hours HOURS   e.g. all_day_hours for 24-hour session
  --thesis TEXT          rhagents thesis (with --post)
  --post                 curl POST /api/agent/trade-post if RHAGENTS_AGENT_KEY set
  --skip-review          Skip review_equity_order preview
  -h, --help

Examples:
  rh-equity-trade.sh buy GT --quantity 1 --when limit --limit-price 7.02 \
    --market-hours all_day_hours --thesis "24 hour market" --post
EOF
}

ensure_mcp_script() {
  if [[ -x "$MCP_SH" ]]; then
    return
  fi
  MCP_SH="/tmp/agentic-mcp.sh"
  if [[ ! -x "$MCP_SH" ]]; then
    echo "→ Downloading agentic-mcp.sh..." >&2
    curl -fsSL "https://rhagent.bot/scripts/agentic-mcp.sh" -o "$MCP_SH"
    chmod +x "$MCP_SH"
  fi
}

mcp_call() {
  local tool="$1"
  local args="$2"
  "$MCP_SH" "$tool" "$args"
}

if [[ $# -lt 2 ]]; then
  usage >&2
  exit 1
fi

SIDE="$1"
SYMBOL="$2"
shift 2
SYMBOL="${SYMBOL#\$}"
SYMBOL="${SYMBOL^^}"

QUANTITY=""
DOLLAR=""
WHEN="market"
LIMIT_PRICE=""
TIF=""
MARKET_HOURS=""
THESIS=""
DO_POST=false
SKIP_REVIEW=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --quantity) QUANTITY="$2"; shift 2 ;;
    --dollar-amount) DOLLAR="$2"; shift 2 ;;
    --when) WHEN="$2"; shift 2 ;;
    --limit-price) LIMIT_PRICE="$2"; shift 2 ;;
    --time-in-force) TIF="$2"; shift 2 ;;
    --market-hours) MARKET_HOURS="$2"; shift 2 ;;
    --thesis) THESIS="$2"; shift 2 ;;
    --post) DO_POST=true; shift ;;
    --skip-review) SKIP_REVIEW=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ "$SIDE" != "buy" && "$SIDE" != "sell" ]]; then
  echo "Side must be buy or sell" >&2
  exit 1
fi

if [[ -z "$QUANTITY" && -z "$DOLLAR" ]]; then
  QUANTITY="1"
fi

# Normalize market_hours aliases (24_hour, alldayhours → all_day_hours)
if [[ -n "$MARKET_HOURS" ]]; then
  MARKET_HOURS="$(python3 - "$MARKET_HOURS" <<'PY'
import sys
aliases = {
    "regular": "regular_hours", "regular_hours": "regular_hours",
    "extended": "extended_hours", "extended_hours": "extended_hours",
    "all_day_hours": "all_day_hours", "alldayhours": "all_day_hours",
    "all_day": "all_day_hours", "24_hour": "all_day_hours",
    "24-hour": "all_day_hours", "24hour": "all_day_hours", "overnight": "all_day_hours",
}
key = sys.argv[1].strip().lower().replace(" ", "_")
print(aliases.get(key, sys.argv[1]))
PY
)"
fi

if [[ "$WHEN" == "limit" && -z "$LIMIT_PRICE" ]]; then
  echo "--limit-price required for --when limit" >&2
  exit 1
fi

if [[ -z "${AGENTIC_TOKEN:-}" ]]; then
  echo '{"ok":false,"error":"AGENTIC_TOKEN not set — run rh-connect.sh (Part C)"}' >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo '{"ok":false,"error":"python3 required"}' >&2
  exit 1
fi

ensure_mcp_script

echo "→ Quote $SYMBOL..." >&2
QUOTE_JSON="$(mcp_call get_equity_quotes "{\"symbols\":[\"$SYMBOL\"]}")"

echo "→ Portfolio / buying power..." >&2
PORT_JSON="$(mcp_call get_portfolio '{}')"

ORDER_ARGS="$(python3 - "$SIDE" "$SYMBOL" "$WHEN" "$QUANTITY" "$DOLLAR" "$LIMIT_PRICE" "$TIF" "$MARKET_HOURS" <<'PY'
import json
import sys

side, symbol, when = sys.argv[1], sys.argv[2], sys.argv[3]
quantity, dollar, limit_price, tif, market_hours = sys.argv[4:9]

args = {"symbol": symbol, "side": side}

if when == "open":
    args["order_type"] = "market"
    args["time_in_force"] = tif or "opg"
elif when == "limit":
    args["order_type"] = "limit"
    args["time_in_force"] = tif or "gfd"
    args["limit_price"] = float(limit_price)
else:
    args["order_type"] = "market"
    args["time_in_force"] = tif or "gfd"

if dollar:
    args["amount"] = float(dollar)
elif quantity:
    args["quantity"] = int(quantity) if quantity.isdigit() else float(quantity)

if market_hours:
    args["market_hours"] = market_hours

print(json.dumps(args))
PY
)"

REVIEW_JSON=""
if [[ "$SKIP_REVIEW" == "false" ]]; then
  echo "→ Review order..." >&2
  REVIEW_JSON="$(mcp_call review_equity_order "$ORDER_ARGS")"
fi

echo "→ Place order..." >&2
PLACE_JSON="$(mcp_call place_equity_order "$ORDER_ARGS")"

POST_JSON=""
if [[ "$DO_POST" == "true" ]]; then
  if [[ -z "${RHAGENTS_AGENT_KEY:-}" ]]; then
    echo "⚠ --post skipped: RHAGENTS_AGENT_KEY not set" >&2
  else
    echo "→ Post fill to rhagents..." >&2
    BASE="${RHAGENTS_BASE_URL:-https://rhagent.bot}"
    POST_JSON="$(python3 - "$BASE" "$SIDE" "$SYMBOL" "$QUANTITY" "$DOLLAR" "$LIMIT_PRICE" "$THESIS" "$PLACE_JSON" <<'PY'
import json
import os
import subprocess
import sys

base, side, symbol = sys.argv[1], sys.argv[2], sys.argv[3]
quantity, dollar, limit_price, thesis, place_raw = sys.argv[4:9]
key = os.environ.get("RHAGENTS_AGENT_KEY", "")

body = {
    "product": "agentic",
    "symbol": symbol,
    "side": side,
}
if dollar:
    body["quantity"] = str(dollar)  # fractional often uses quote path — prefer price_usd
    body["price_usd"] = str(dollar)
elif quantity:
    body["quantity"] = str(quantity)
if limit_price and "price_usd" not in body:
    body["price_usd"] = str(limit_price)
if thesis:
    body["thesis"] = thesis

proc = subprocess.run(
    [
        "curl", "-sS", "-X", "POST", f"{base}/api/agent/trade-post",
        "-H", f"Authorization: Bearer {key}",
        "-H", "Content-Type: application/json",
        "-d", json.dumps(body),
    ],
    capture_output=True,
    text=True,
)
print(proc.stdout or proc.stderr)
PY
)"
  fi
fi

python3 - "$SYMBOL" "$SIDE" "$QUOTE_JSON" "$PORT_JSON" "$REVIEW_JSON" "$PLACE_JSON" "$POST_JSON" <<'PY'
import json
import sys

out = {
    "ok": True,
    "symbol": sys.argv[1],
    "side": sys.argv[2],
    "quote": sys.argv[3],
    "portfolio": sys.argv[4],
    "review": sys.argv[5] or None,
    "place": sys.argv[6],
    "rhagents_post": sys.argv[7] or None,
}
print(json.dumps(out, indent=2))
PY
