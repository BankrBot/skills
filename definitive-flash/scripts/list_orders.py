#!/usr/bin/env python3
"""
List active Definitive Flash orders for a wallet.

Usage:
  python3 list_orders.py --wallet 0xYOUR_WALLET [--all]

  --all    Include cancelled and filled orders (default: active only)

Environment:
  DEFINITIVE_API_KEY   dpka_* key from app.definitive.fi
"""

import argparse, json, os, sys, urllib.request as _req, urllib.error as _err

DEFINITIVE_BASE = "https://ddp.definitive.fi/v2/flash"
ACTIVE = {"ORDER_STATUS_PENDING", "ORDER_STATUS_ACCEPTED", "ORDER_STATUS_PARTIALLY_FILLED"}


def _api_key() -> str:
    k = os.environ.get("DEFINITIVE_API_KEY", "")
    if not k:
        sys.exit("DEFINITIVE_API_KEY not set")
    return k


def fetch_orders(wallet: str, active_only: bool = True) -> list[dict]:
    headers = {
        "x-definitive-api-key": _api_key(),
        "Accept":               "application/json",
        "User-Agent":           "Mozilla/5.0",
    }
    orders = []
    page_token = None
    while True:
        qs = f"funderAddress={wallet}"
        if page_token:
            qs += f"&pageToken={page_token}"
        req = _req.Request(f"{DEFINITIVE_BASE}/orders?{qs}", headers=headers)
        try:
            data = json.loads(_req.urlopen(req, timeout=20).read())
        except _err.HTTPError as e:
            sys.exit(f"API error {e.code}: {e.read().decode()}")
        for o in data.get("orders", []):
            if active_only and o.get("status") not in ACTIVE:
                continue
            orders.append(o)
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return orders


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--wallet", required=True, help="Funder wallet address")
    p.add_argument("--all",    action="store_true", help="Include closed orders")
    p.add_argument("--json",   action="store_true", dest="json_out",
                   help="Output raw JSON")
    args = p.parse_args()

    orders = fetch_orders(args.wallet, active_only=not args.all)

    if args.json_out:
        print(json.dumps(orders, indent=2))
        return

    if not orders:
        print("No orders found.")
        return

    from collections import defaultdict
    by_token: dict[str, list] = defaultdict(list)
    for o in orders:
        ta = o.get("targetAsset") or {}
        key = f"{ta.get('ticker','?')} ({ta.get('address','')[:10]})"
        by_token[key].append(o)

    total = len(orders)
    active_count = sum(1 for o in orders if o.get("status") in ACTIVE)
    print(f"Orders: {active_count} active / {total} total\n")

    for token, ords in sorted(by_token.items()):
        print(f"  {token}")
        for o in ords:
            trigger = o.get("trigger") or {}
            price   = trigger.get("notionalPrice", "—")
            status  = o.get("status", "").replace("ORDER_STATUS_", "")
            oid     = o.get("orderId", "")[:8]
            placed  = o.get("placedAt", "")[:10]
            print(f"    {o['orderType']:14s}  @ {price:30s}  [{status}]  {oid}  {placed}")
        print()


if __name__ == "__main__":
    main()
