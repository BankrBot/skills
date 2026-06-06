#!/usr/bin/env python3
"""
Place a stop-loss or take-profit order via Definitive Flash.

Usage:
  python3 place_order.py \
    --wallet  0xYOUR_WALLET \
    --token   0xTOKEN_ADDRESS \
    --qty     1000000.000000 \
    --type    stop-loss \
    --price   0.00025 \
    --symbol  TOKEN

  Qty: decimal token units, floored to 6 dp (avoids insufficient-balance 422).
  Price: USD per token, plain decimal — scientific notation is rejected by Definitive.

Environment:
  DEFINITIVE_API_KEY   dpka_* key from app.definitive.fi
  BANKR_API_KEY        Bankr API key with signing permissions
"""

import argparse, json, math, os, re, subprocess, sys, time, urllib.request as _req, urllib.error as _err

DEFINITIVE_BASE = "https://ddp.definitive.fi/v2/flash"
USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
CHAIN_ID = 8453


# ── Signing ───────────────────────────────────────────────────────────────────

def _keccak(data: bytes) -> bytes:
    from Crypto.Hash import keccak as _k
    h = _k.new(digest_bits=256)
    h.update(data)
    return h.digest()


def _sign_definitive_typed_data(typed_data_str: str, wallet: str) -> str:
    """
    Sign Definitive typed data for a ZeroDev Kernel v3.3 (EIP-7702) wallet.

    Kernel wraps the original hash before passing to ECDSAValidator:
        wrapped = keccak256(\\x19\\x01 || kernel_domain_sep
                            || keccak256(KWTH || original_hash))
    where kernel_domain: name="Kernel", version="0.3.3", chainId=8453,
          verifyingContract=wallet_address.

    We sign via a Kernel(bytes32 hash) typed data struct (type-0x00 SUDO path)
    so that bankr's eth_signTypedData_v4 produces the identical wrapped hash.
    """
    from eth_account import Account as _Acct

    td = json.loads(typed_data_str)
    if isinstance(td.get("domain", {}).get("chainId"), str):
        td["domain"]["chainId"] = int(td["domain"]["chainId"])

    dummy = _Acct.from_key(b"\x01" * 32)
    signed = dummy.sign_typed_data(full_message=td)
    original_hash: bytes = getattr(signed, "message_hash", None) or getattr(signed, "messageHash")

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
        "message": {"hash": "0x" + original_hash.hex()},
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
    return "0x00" + m[0][2:]  # type-0x00 SUDO prefix


# ── Definitive API ────────────────────────────────────────────────────────────

def _api_key() -> str:
    k = os.environ.get("DEFINITIVE_API_KEY", "")
    if not k:
        sys.exit("DEFINITIVE_API_KEY not set")
    return k


def _post(path: str, body: dict, timeout: int = 30) -> dict:
    data = json.dumps(body).encode()
    req = _req.Request(
        DEFINITIVE_BASE + path, data=data,
        headers={
            "Content-Type":          "application/json",
            "Accept":                "application/json",
            "x-definitive-api-key":  _api_key(),
            "User-Agent":            "Mozilla/5.0",
        },
    )
    try:
        return json.loads(_req.urlopen(req, timeout=timeout).read())
    except _err.HTTPError as e:
        body_str = e.read().decode()
        raise RuntimeError(f"HTTP {e.code}: {body_str}") from e


def _fmt(v: float) -> str:
    """Format float as plain decimal string — Definitive rejects scientific notation."""
    return f"{v:.18f}".rstrip("0").rstrip(".")


def _floor6(qty: float) -> float:
    """Floor to 6 decimal places to avoid float→wei precision exceeding balance."""
    return math.floor(qty * 1_000_000) / 1_000_000


# ── Order placement ───────────────────────────────────────────────────────────

def place_order(wallet: str, token: str, qty: float, order_type: str,
                price: float, symbol: str) -> str:
    """
    Place a stop-loss or take-profit order. Returns orderId.
    order_type: "stop-loss" or "take-profit"
    """
    safe_qty = _floor6(qty)
    trigger_type = "lower" if order_type == "stop-loss" else "upper"

    body_base = {
        "targetChain":  "base",
        "contraChain":  "base",
        "targetAsset":  token,
        "contraAsset":  USDC,
        "side":         "sell",
        "qty":          _fmt(safe_qty),
        "orderType":    order_type,
        "triggers": [{"notionalPrice": _fmt(price), "triggerType": trigger_type}],
        "funderAddress": wallet,
        "recipient":     wallet,
    }

    # Step 1: Quote
    print(f"[quote] {symbol} {order_type} @ ${price:.10g} ({safe_qty} tokens)…", flush=True)
    quote = _post("/quote", body_base)
    if "error" in quote:
        raise RuntimeError(f"Quote rejected: {quote['error']}")

    quote_id = quote["quoteId"]
    evm = quote.get("evm") or {}
    otd_str  = evm.get("orderTypedData")  or quote.get("orderTypedData")
    ptd_str  = evm.get("permitTypedData") or quote.get("permitTypedData")
    approve  = evm.get("approveTx")       or quote.get("approveTx")

    if not otd_str:
        raise RuntimeError("No orderTypedData in quote response")

    # Step 2: On-chain approval if needed
    if approve:
        print(f"[approve] Submitting ERC-20 approval…", flush=True)
        result = subprocess.run(
            ["bankr", "wallet", "submit", "tx",
             "--to", approve["to"], "--chain-id", str(CHAIN_ID),
             "--data", approve["data"], "-d", f"Approve Definitive for {symbol}"],
            capture_output=True, text=True, timeout=60, env={**os.environ},
        )
        combined = (result.stdout + result.stderr).lower()
        if "success" not in combined and "0x" not in combined:
            raise RuntimeError(f"Approval failed: {result.stdout + result.stderr}")
        print("[approve] Waiting 5s for on-chain confirmation…", flush=True)
        time.sleep(5)

    # Step 3: Sign orderTypedData
    print("[sign] Signing order typed data (Kernel v3.3 wrapper)…", flush=True)
    user_sig = _sign_definitive_typed_data(otd_str, wallet)

    # Step 3b: Sign permitTypedData if present
    permit_sig = None
    if ptd_str:
        print("[sign] Signing permit typed data…", flush=True)
        permit_sig = _sign_definitive_typed_data(ptd_str, wallet)

    # Step 4: Submit
    order_body = {**body_base, "quoteId": quote_id,
                  "userSignature": user_sig, "evmOrderTypedData": otd_str}
    if permit_sig and ptd_str:
        order_body["evmPermitTypedData"] = ptd_str
        order_body["evmPermitSignature"] = permit_sig

    print("[submit] Submitting order…", flush=True)
    resp = _post("/order", order_body, timeout=45)
    if "error" in resp:
        raise RuntimeError(f"Order rejected: {resp['error']}")

    order_id = resp.get("orderId", "")
    print(f"[ok] {symbol} {order_type} placed: {order_id}")
    return order_id


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--wallet",  required=True, help="Funder wallet address")
    p.add_argument("--token",   required=True, help="Token contract address on Base")
    p.add_argument("--qty",     required=True, type=float, help="Token quantity (decimal)")
    p.add_argument("--type",    required=True, dest="order_type",
                   choices=["stop-loss", "take-profit"],
                   help="Order type")
    p.add_argument("--price",   required=True, type=float, help="Trigger price in USD per token")
    p.add_argument("--symbol",  default="TOKEN", help="Token ticker (for logging)")
    args = p.parse_args()

    try:
        order_id = place_order(
            wallet=args.wallet,
            token=args.token,
            qty=args.qty,
            order_type=args.order_type,
            price=args.price,
            symbol=args.symbol,
        )
        print(order_id)
    except Exception as e:
        print(f"[error] {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
