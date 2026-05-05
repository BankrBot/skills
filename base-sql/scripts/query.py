#!/usr/bin/env python3
"""
query.py — Run a SQL query against the Coinbase CDP Base SQL API.

Usage:
    python3 query.py "SELECT * FROM base.transfers WHERE ... LIMIT 10"
    python3 query.py --file query.sql
    echo "SELECT ..." | python3 query.py -

Auth (in priority order):
    1. --key / -k flag
    2. CDP_CLIENT_KEY environment variable
    3. CDP_KEY_FILE environment variable (path to a file containing the key)
    4. ~/.cdp/client-key.txt

Get a free key at: https://portal.cdp.coinbase.com/projects/api-keys/client-key

Exit codes:
    0  success (results printed as JSON)
    1  error (message printed to stderr)
"""

import sys
import os
import json
import argparse
import urllib.request
import urllib.error
from pathlib import Path

API_URL = "https://api.cdp.coinbase.com/platform/v2/data/query/run"

_DEFAULT_KEY_PATHS = [
    Path(os.environ.get("CDP_KEY_FILE", "")) if os.environ.get("CDP_KEY_FILE") else None,
    Path.home() / ".cdp" / "client-key.txt",
]


def _load_api_key(override: str = "") -> str:
    if override:
        return override
    if os.environ.get("CDP_CLIENT_KEY"):
        return os.environ["CDP_CLIENT_KEY"]
    for path in _DEFAULT_KEY_PATHS:
        if path and path.exists():
            return path.read_text().strip()
    return ""


def run_query(sql: str, api_key: str = "", timeout: int = 30) -> list:
    """
    Run a SQL query. Returns a list of row dicts.
    Raises RuntimeError on failure.

    api_key is optional — if omitted, auto-loads from CDP_CLIENT_KEY env var
    or ~/.cdp/client-key.txt.
    """
    if not api_key:
        api_key = _load_api_key()
    if not api_key:
        raise RuntimeError(
            "No CDP Client API key found. "
            "Set CDP_CLIENT_KEY env var, use --key, or save key to ~/.cdp/client-key.txt. "
            "Get a free key: https://portal.cdp.coinbase.com/projects/api-keys/client-key"
        )
    payload = json.dumps({"sql": sql}).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("result", [])
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        raise RuntimeError(f"HTTP {e.code}: {body}")


def main():
    parser = argparse.ArgumentParser(
        description="CDP Base SQL API query runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("sql", nargs="?", help="SQL query string, or '-' to read from stdin")
    parser.add_argument("--file", "-f", help="Path to .sql file")
    parser.add_argument("--key", "-k", help="CDP Client API key (overrides env/file)")
    args = parser.parse_args()

    api_key = _load_api_key(args.key or "")
    if not api_key:
        print(
            "Error: No CDP Client API key found.\n"
            "Set CDP_CLIENT_KEY env var, use --key, or save key to ~/.cdp/client-key.txt\n"
            "Get a free key: https://portal.cdp.coinbase.com/projects/api-keys/client-key",
            file=sys.stderr,
        )
        sys.exit(1)

    if args.file:
        with open(args.file) as f:
            sql = f.read().strip()
    elif args.sql == "-" or (not args.sql and not sys.stdin.isatty()):
        sql = sys.stdin.read().strip()
    elif args.sql:
        sql = args.sql.strip()
    else:
        parser.print_help()
        sys.exit(1)

    try:
        rows = run_query(sql, api_key)
    except RuntimeError as e:
        print(f"Query failed: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"-- {len(rows)} rows")
    print(json.dumps(rows, indent=2))


if __name__ == "__main__":
    main()
