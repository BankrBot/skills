#!/usr/bin/env python3
"""
Cancel a Definitive Flash order.

Usage:
  python3 cancel_order.py --wallet 0xYOUR_WALLET --orderid <uuid>

The cancel endpoint validates the signature via isValidSignature on the Kernel
wallet. This script wraps the personal_sign hash in a Kernel(bytes32 hash)
typed data struct (type-0x00 SUDO) — without this, Definitive returns 404.

Environment:
  DEFINITIVE_API_KEY   dpka_* key from app.definitive.fi
  BANKR_API_KEY        Bankr API key with signing permissions
"""

import argparse, json, os, re, subprocess, sys, urllib.request as _req, urllib.error as _err

DEFINITIVE_BASE = "https://ddp.definitive.fi/v2/flash"
CHAIN_ID = 8453


def _api_key() -> str:
    k = os.environ.get("DEFINITIVE_API_KEY", "")
    if not k:
        sys.exit("DEFINITIVE_API_KEY not set")
    return k


def _sign_cancel(order_id: str, wallet: str) -> str:
    """
    Sign the Definitive cancel message for a Kernel v3.3 smart wallet.

    Process:
      1. Compute personal_sign hash of the fixed cancel message string.
      2. Wrap that hash in Kernel(bytes32 hash) typed data.
      3. Sign with bankr eth_signTypedData_v4.
      4. Return "0x00" + sig (type-0x00 SUDO mode).
    """
    from eth_account import Account as _Acct
    from eth_account.messages import encode_defunct as _defunct

    cancel_msg = f"Definitive Flash v1 — Cancel Order\nOrder: {order_id}"

    dummy = _Acct.from_key(b"\x01" * 32)
    _signed = dummy.sign_message(_defunct(text=cancel_msg))
    personal_hash: bytes = getattr(_signed, "message_hash", None) or getattr(_signed, "messageHash")

    kernel_td = {
        "types": {
            "EIP712Domain": [
                {"name": "name",              "type": "string"},
                {"name": "version",           "type": "string"},
                {"name": "chainId",           "type": "uint256"},
                {"name": "verifyingContract", "type": "address"},
            ],
            "Kernel": [{"name": "hash", "type": "bytes32"}],
        },
        "domain": {
            "name":              "Kernel",
            "version":           "0.3.3",
            "chainId":           CHAIN_ID,
            "verifyingContract": wallet,
        },
        "primaryType": "Kernel",
        "message": {"hash": "0x" + personal_hash.hex()},
    }

    env = {**os.environ}
    result = subprocess.run(
        ["bankr", "wallet", "sign", "--type", "eth_signTypedData_v4",
         "--typed-data", json.dumps(kernel_td)],
        capture_output=True, text=True, timeout=30, env=env,
    )
    output = result.stdout + result.stderr
    m = re.search(r"0x[0-9a-fA-F]{130}", output)
    if not m:
        raise RuntimeError(f"bankr sign returned no signature: {output[:400]}")
    return "0x00" + m[0][2:]


def cancel_order(wallet: str, order_id: str) -> bool:
    """Cancel a Definitive Flash order. Returns True on success."""
    cancel_msg = f"Definitive Flash v1 — Cancel Order\nOrder: {order_id}"

    print(f"[sign] Signing cancel for {order_id[:8]}…", flush=True)
    sig = _sign_cancel(order_id, wallet)

    body = json.dumps({"cancelMessage": cancel_msg, "userSignature": sig}).encode()
    req = _req.Request(
        f"{DEFINITIVE_BASE}/orders/{order_id}/cancel",
        data=body,
        headers={
            "Content-Type":         "application/json",
            "Accept":               "application/json",
            "x-definitive-api-key": _api_key(),
            "User-Agent":           "Mozilla/5.0",
        },
        method="POST",
    )
    try:
        _req.urlopen(req, timeout=20)
        print(f"[ok] Order {order_id} cancelled")
        return True
    except _err.HTTPError as e:
        body_str = e.read().decode()
        print(f"[error] HTTP {e.code}: {body_str}", file=sys.stderr)
        return False


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--wallet",  required=True, help="Funder wallet address")
    p.add_argument("--orderid", required=True, help="Order UUID to cancel")
    args = p.parse_args()

    try:
        ok = cancel_order(wallet=args.wallet, order_id=args.orderid)
        sys.exit(0 if ok else 1)
    except Exception as e:
        print(f"[error] {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
