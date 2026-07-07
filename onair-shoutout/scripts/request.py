"""On-Air Shoutout skill backend — submit a shoutout (paid x402) or check status (free).

Submit pays the API's x402 toll ($5 USDC on Base, gasless via EIP-3009) and POSTs
the shoutout. It returns a RECEIPT (request_id + status pending_review), NOT a
confirmed read — GM Farcaster reviews every request and may decline + refund.

    pip install "x402>=2.13" "eth-account>=0.13.5" requests
    export GMFARCASTER_PRIVATE_KEY=0x...   # a wallet holding USDC on Base

    # submit:
    python request.py --sponsor "Acme Frames" --read "Today's GM is brought to you by Acme..." --url https://acme.xyz
    # check status (free, no payment):
    python request.py --status sho_8f3c2a1b9d4e

Networks: Base mainnet = eip155:8453 (real USDC) | Base Sepolia = eip155:84532 (test USDC).
"""
import argparse
import json
import os
import sys

import requests

API_URL = os.environ.get(
    "GMFARCASTER_SHOUTOUT_API_URL", "https://gateway.gmfarcaster.com/v1/shoutout"
)
NETWORK = os.environ.get("GMFARCASTER_NETWORK", "eip155:8453")  # Base mainnet


def _status_base() -> str:
    # Derive the API origin from the submit URL so --status hits the same deployment.
    return API_URL.rsplit("/v1/", 1)[0]


def submit(args: argparse.Namespace) -> None:
    from eth_account import Account
    from x402 import x402ClientSync
    from x402.mechanisms.evm.exact.client import ExactEvmScheme
    from x402.mechanisms.evm.signers import EthAccountSigner
    from x402.http.clients.requests import x402_requests

    key = os.environ.get("GMFARCASTER_PRIVATE_KEY")
    if not key:
        sys.exit("Set GMFARCASTER_PRIVATE_KEY to a wallet holding USDC on Base.")

    account = Account.from_key(key)
    client = x402ClientSync()
    client.register(NETWORK, ExactEvmScheme(EthAccountSigner(account)))
    session = x402_requests(client)  # auto-handles 402 -> pay -> retry

    body = {"sponsor_name": args.sponsor, "read_text": args.read}
    if args.url:
        body["url"] = args.url
    if args.refund_to:
        body["refund_to_wallet"] = args.refund_to
    if args.notes:
        body["notes"] = args.notes

    resp = session.post(API_URL, json=body, timeout=60)
    resp.raise_for_status()
    data = resp.json()

    print("Shoutout submitted — PENDING EDITORIAL REVIEW.")
    print("This is NOT a confirmed read: GM Farcaster may decline and refund it.")
    print(f"  request_id: {data.get('request_id')}")
    print(f"  status:     {data.get('status')}")
    print(f"  status_url: {data.get('status_url')}")
    print(f"  amount:     {data.get('amount')}")
    print("\nKeep the request_id. Check status with: python request.py --status <request_id>")


def check_status(request_id: str) -> None:
    resp = requests.get(f"{_status_base()}/v1/shoutout/{request_id}", timeout=30)
    resp.raise_for_status()
    print(json.dumps(resp.json(), indent=2))


def main() -> None:
    p = argparse.ArgumentParser(description="Submit or check an On-Air Shoutout.")
    p.add_argument("--sponsor", help="Sponsor name (read on air).")
    p.add_argument("--read", help="The message read live on air (max 280 chars).")
    p.add_argument("--url", help="Optional link to mention.")
    p.add_argument("--refund-to", dest="refund_to", help="Optional refund wallet override.")
    p.add_argument("--notes", help="Optional internal note (never read on air).")
    p.add_argument("--status", dest="status_id", help="Check status of a request_id (free).")
    args = p.parse_args()

    if args.status_id:
        check_status(args.status_id)
        return
    if not args.sponsor or not args.read:
        p.error("submit requires --sponsor and --read (or use --status <request_id>)")
    submit(args)


if __name__ == "__main__":
    main()
