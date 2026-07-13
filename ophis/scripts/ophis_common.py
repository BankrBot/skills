"""Shared helpers for the Ophis Bankr skill: chain maps, appData, ABI encoding,
Ophis/CoW orderbook calls, and the Bankr Submit API.

All endpoint URLs and contract addresses below are taken from @ophis/sdk
(packages/sdk/src/{orderbook,domain,partner-fee,flow}.ts). See references/api.md
for the source-of-truth citations.

Ophis is CoW Protocol intent settlement: a swap is an OFF-CHAIN signed order, not
a normal swap tx. From a Bankr-managed wallet we authorize the order with the
`presign` scheme — POST the order, then send an on-chain setPreSignature(uid,true)
to the Settlement contract via the Bankr Submit API — so no raw message-signing is
needed (a clean fit for Bankr's transaction-submission model).
"""
from __future__ import annotations

import json
import os
import re
import socket
import sys
import urllib.request
import urllib.error

# ── Per-chain orderbook base URL (OPHIS_ORDERBOOK_URLS, orderbook.ts) ──────────
# CoW-hosted chains hit api.cow.fi/<slug>; OP + Unichain hit the Ophis self-hosted
# orderbook (hitting api.cow.fi there silently bypasses the Ophis solver + fee).
ORDERBOOK_URLS = {
    1:        "https://api.cow.fi/mainnet",
    100:      "https://api.cow.fi/xdai",
    137:      "https://api.cow.fi/polygon",
    8453:     "https://api.cow.fi/base",
    42161:    "https://api.cow.fi/arbitrum_one",
    43114:    "https://api.cow.fi/avalanche",
    56:       "https://api.cow.fi/bnb",
    59144:    "https://api.cow.fi/linea",
    9745:     "https://api.cow.fi/plasma",
    57073:    "https://api.cow.fi/ink",
    11155111: "https://api.cow.fi/sepolia",
    10:       "https://optimism-mainnet.ophis.fi",   # Ophis-sovereign
    130:      "https://unichain-mainnet.ophis.fi",   # Ophis-sovereign
}

# ── Settlement (setPreSignature target) + VaultRelayer (approve spender) ───────
# domain.ts. Canonical CoW addresses on hosted chains; NON-canonical on OP/Unichain
# (using the canonical addresses there makes the order/signature silently invalid).
_CANONICAL_SETTLEMENT = "0x9008D19f58AAbD9eD0D60971565AA8510560ab41"
_CANONICAL_RELAYER = "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110"
SETTLEMENT = {
    10:  "0x310784c7FCE12d578dA6f53460777bAc9718B859",
    130: "0x108A678716e5E1776036eF044CAB7064226F714E",
}
VAULT_RELAYER = {
    10:  "0x83847EaB41ad9ea43809ce71569eB2e9daF51830",
    130: "0xaB29E2a859704C914E55566Ae9b3A7EDE25959cb",
}

# ── Ophis partner fee (partner-fee.ts) ────────────────────────────────────────
OPHIS_PARTNER_FEE_RECIPIENT = "0x858f0F5eE954846D47155F5203c04aF1819eCeF8"  # Ophis Safe
OPHIS_VOLUME_FEE_BPS = 5          # integrator/partner rate
OPHIS_STABLE_VOLUME_FEE_BPS = 1   # stable-stable pair rate
APP_DATA_VERSION = "1.4.0"

REBATE_INDEXER_URL = "https://rebates.ophis.fi"
BANKR_API = "https://api.bankr.bot"


def orderbook_url(chain_id: int) -> str:
    url = ORDERBOOK_URLS.get(chain_id)
    if not url:
        sys.exit(
            f"chain {chain_id} has no Ophis orderbook (unsupported or paused). "
            f"Supported: {sorted(ORDERBOOK_URLS)}"
        )
    return url


def settlement_address(chain_id: int) -> str:
    return SETTLEMENT.get(chain_id, _CANONICAL_SETTLEMENT)


def vault_relayer(chain_id: int) -> str:
    return VAULT_RELAYER.get(chain_id, _CANONICAL_RELAYER)


# ── keccak256 (needed for appDataHash + the setPreSignature selector) ──────────
# hashlib.sha3_256 is NOT keccak256 (different padding), so we need a keccak lib.
def keccak256(data: bytes) -> bytes:
    try:
        import sha3  # pysha3
        h = sha3.keccak_256()
        h.update(data)
        return h.digest()
    except Exception:
        pass
    try:
        from Crypto.Hash import keccak  # pycryptodome
        h = keccak.new(digest_bits=256)
        h.update(data)
        return h.digest()
    except Exception:
        pass
    try:
        from eth_hash.auto import keccak as ek  # eth-hash
        return ek(data)
    except Exception:
        pass
    sys.exit(
        "No keccak256 backend found. Install one:\n"
        "  pip install pysha3        # or\n"
        "  pip install pycryptodome  # or\n"
        "  pip install 'eth-hash[pycryptodome]'"
    )


# ── Ophis appData (flow.ts / partner-fee.ts / referral.ts) ────────────────────
def build_app_data(referral_code: str | None = None, is_stable_pair: bool = False):
    """Return (full_app_data_string, app_data_hash_0x).

    appCode MUST be the literal 'ophis' or the rebate indexer silently drops the
    order. partnerFee is the CIP-75 VOLUME shape {volumeBps, recipient}. The pair
    is signed with appData=hash but SUBMITTED with appData=full string + a separate
    appDataHash; the backend checks keccak256(full) == hash, so the two are always
    self-consistent here regardless of key ordering.
    """
    metadata = {
        "partnerFee": {
            "volumeBps": OPHIS_STABLE_VOLUME_FEE_BPS if is_stable_pair else OPHIS_VOLUME_FEE_BPS,
            "recipient": OPHIS_PARTNER_FEE_RECIPIENT,
        },
        "hooks": {},
    }
    if referral_code:
        # Validate against the SDK grammar /^[a-z0-9_-]{3,64}$/ (referral.ts) and FAIL
        # LOUDLY on a bad code — an unmatchable code would be silently written to
        # appData, so the order settles but the referrer earns NO rebate (silent
        # unattribution). Optional: omitting the code still yields a valid fee-bearing
        # order, you just forgo the rebate.
        code = referral_code.strip().lower()
        if not re.match(r"^[a-z0-9_-]{3,64}$", code):
            sys.exit(f"invalid referral code {referral_code!r}: must match [a-z0-9_-]{{3,64}}")
        metadata["ophisReferrer"] = {"code": code}
    doc = {"appCode": "ophis", "metadata": metadata, "version": APP_DATA_VERSION}
    # Deterministic compact JSON (sorted keys), matching cow-sdk's stringify.
    full = json.dumps(doc, sort_keys=True, separators=(",", ":"))
    app_hash = "0x" + keccak256(full.encode("utf-8")).hex()
    return full, app_hash


# ── Minimal ABI encoding (no web3 dependency) ─────────────────────────────────
def _pad(hex_no0x: str) -> str:
    return hex_no0x.rjust(64, "0")


def encode_approve(spender: str, amount: int) -> str:
    """approve(address,uint256) — selector 0x095ea7b3."""
    return "0x095ea7b3" + _pad(spender.lower().replace("0x", "")) + _pad(format(amount, "x"))


def encode_set_presignature(order_uid_hex: str, signed: bool = True) -> str:
    """setPreSignature(bytes orderUid, bool signed).

    orderUid is a dynamic `bytes` (56 bytes for a CoW order UID), so the head is
    [offset=0x40, bool] and the tail is [length, data-padded-to-32].
    """
    selector = keccak256(b"setPreSignature(bytes,bool)")[:4].hex()
    uid = order_uid_hex.lower().replace("0x", "")
    length = len(uid) // 2
    padded_data = uid + "0" * ((64 - (len(uid) % 64)) % 64)
    return (
        "0x" + selector
        + _pad(format(64, "x"))               # offset to the bytes arg (0x40)
        + _pad("1" if signed else "0")        # bool signed
        + _pad(format(length, "x"))           # bytes length (56)
        + padded_data                          # uid, right-padded to 32
    )


# ── HTTP + Bankr Submit API ───────────────────────────────────────────────────
def _http(method: str, url: str, body: dict | None = None, headers: dict | None = None,
          timeout: int = 60) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("content-type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        sys.exit(f"{method} {url} -> HTTP {e.code}: {detail[:500]}")
    except (urllib.error.URLError, socket.timeout, TimeoutError) as e:
        # A DNS/connection/timeout failure must exit cleanly, not dump a traceback.
        sys.exit(f"{method} {url} -> network error: {e}")


def bankr_api_key() -> str:
    key = os.environ.get("BANKR_API_KEY")
    if not key:
        cfg = os.path.expanduser("~/.bankr/config.json")
        if os.path.exists(cfg):
            with open(cfg) as f:
                key = json.load(f).get("apiKey")
    if not key:
        sys.exit("Set BANKR_API_KEY (or configure ~/.bankr/config.json). Get a key at bankr.bot/api-keys.")
    return key


def bankr_wallet_address(key: str, chain_slug: str = "base") -> str:
    res = _http("GET", f"{BANKR_API}/agent/balances?chains={chain_slug}", headers={"X-API-Key": key})
    # Bankr returns the EVM wallet address on the balances payload; support a few shapes.
    addr = res.get("address") or res.get("wallet") or (res.get("data") or {}).get("address")
    if not addr:
        sys.exit(f"could not resolve the Bankr wallet address from /agent/balances: {json.dumps(res)[:300]}")
    return addr


def bankr_submit(key: str, chain_id: int, to: str, data: str, description: str, value: str = "0") -> dict:
    res = _http(
        "POST", f"{BANKR_API}/agent/submit",
        body={
            "transaction": {"to": to, "chainId": chain_id, "value": value, "data": data},
            "description": description,
            "waitForConfirmation": True,
        },
        headers={"X-API-Key": key},
        timeout=120,  # waitForConfirmation blocks on the tx being mined
    )
    # Treat an explicit success flag OR a returned transactionHash as success (the
    # exact success key is confirmed against a live /agent/submit response).
    if not (res.get("success") or res.get("transactionHash")):
        sys.exit(f"Bankr submit failed ({description}): {json.dumps(res)[:400]}")
    return res


# ── Ophis / CoW orderbook ─────────────────────────────────────────────────────
def get_quote(chain_id: int, sell_token: str, buy_token: str, sell_amount_wei: int,
              from_addr: str, full_app_data: str, app_data_hash: str) -> dict:
    base = orderbook_url(chain_id)
    body = {
        "sellToken": sell_token,
        "buyToken": buy_token,
        "from": from_addr,
        "receiver": from_addr,
        "kind": "sell",
        "sellAmountBeforeFee": str(sell_amount_wei),
        "partiallyFillable": False,
        "sellTokenBalance": "erc20",
        "buyTokenBalance": "erc20",
        "priceQuality": "optimal",
        "signingScheme": "eip712",   # pricing only; the order below uses presign
        "onchainOrder": False,
        "appData": full_app_data,
        "appDataHash": app_data_hash,
        "validFor": 1200,
    }
    res = _http("POST", f"{base}/api/v1/quote", body=body)
    quote = res.get("quote") or res
    return quote


def put_app_data(chain_id: int, app_data_hash: str, full_app_data: str) -> None:
    """Upload the full appData so solvers can read the partnerFee for this hash."""
    base = orderbook_url(chain_id)
    _http("PUT", f"{base}/api/v1/app_data/{app_data_hash}", body={"fullAppData": full_app_data})


def post_order(chain_id: int, order: dict) -> str:
    base = orderbook_url(chain_id)
    res = _http("POST", f"{base}/api/v1/orders", body=order)
    # The orderbook returns the order UID as a bare JSON string (or under a key).
    if isinstance(res, str):
        return res
    uid = res.get("uid") or res.get("orderUid") or res
    if not isinstance(uid, str) or not uid.startswith("0x"):
        sys.exit(f"unexpected POST /orders response (no order uid): {json.dumps(res)[:300]}")
    return uid


def enroll_wallet(wallet: str) -> None:
    """Best-effort: register the wallet so the rebate indexer indexes its trades.
    Idempotent GET /tier/{wallet}. MUST NOT block or abort the swap — a rebate-
    indexer outage (DNS/connection/timeout/non-2xx) is swallowed so the healthy
    swap+fee path still proceeds. Uses a raw urllib call (not _http, which exits on
    error) so every failure mode is caught here."""
    try:
        req = urllib.request.Request(f"{REBATE_INDEXER_URL}/tier/{wallet}", method="GET")
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp.read()
    except Exception:
        pass


def to_wei(amount_human: str, decimals: int) -> int:
    from decimal import Decimal
    return int(Decimal(amount_human) * (Decimal(10) ** decimals))
