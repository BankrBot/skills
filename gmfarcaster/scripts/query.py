"""Query the GM Farcaster Warpee Knowledge API and print a cited answer.

This is the runnable backend for the `gmfarcaster` Claude skill. It pays the
API's x402 402 challenge automatically, signing with the operator's own wallet.
The x402 "exact" EVM scheme is gasless for the buyer (EIP-3009), so the wallet
needs USDC on Base but no ETH.

    pip install -r requirements.txt
    export GMFARCASTER_PRIVATE_KEY=0x...   # a wallet holding USDC on Base
    python query.py "What is the Clanker Ecosystem Fund?"

Networks: Base mainnet = eip155:8453 (real USDC) | Base Sepolia = eip155:84532 (test USDC).
"""
import os
import sys

import requests
from eth_account import Account
from x402 import x402ClientSync
from x402.mechanisms.evm.exact.client import ExactEvmScheme
from x402.mechanisms.evm.signers import EthAccountSigner
from x402.http.clients.requests import x402_requests

API_URL = os.environ.get("GMFARCASTER_API_URL", "https://api.gmfarcaster.com/v1/query")
NETWORK = os.environ.get("GMFARCASTER_NETWORK", "eip155:8453")  # default: Base mainnet


def main() -> None:
    key = os.environ.get("GMFARCASTER_PRIVATE_KEY")
    if not key:
        sys.exit(
            "Missing GMFARCASTER_PRIVATE_KEY. Set it to the private key of a wallet "
            "holding USDC on Base (no ETH needed — x402 settlement is gasless). "
            "Each query costs ~$0.005 USDC."
        )

    query = " ".join(sys.argv[1:]).strip()
    if not query:
        sys.exit('Usage: python query.py "<your question about the GM Farcaster archive>"')

    account = Account.from_key(key)
    client = x402ClientSync()
    client.register(NETWORK, ExactEvmScheme(EthAccountSigner(account)))
    session = x402_requests(client)  # auto-handles 402 -> pay -> retry

    try:
        resp = session.post(API_URL, json={"query": query}, timeout=300)
        resp.raise_for_status()
    except requests.HTTPError:
        status = resp.status_code
        hint = {
            402: "Payment could not be completed — check the wallet holds USDC on Base.",
            400: "The query was rejected (empty or too long).",
        }.get(status, "Please try again shortly.")
        sys.exit(f"GM Farcaster API request failed (HTTP {status}). {hint}")
    except requests.RequestException as e:
        sys.exit(f"Could not reach the GM Farcaster API: {type(e).__name__}.")

    data = resp.json()
    print(data.get("answer", "(no answer returned)"))

    citations = data.get("citations") or []
    if citations:
        print("\nSources:")
        for c in citations:
            label = c.get("title") or c.get("display_name") or c.get("episode") or "source"
            url = c.get("url", "")
            print(f"- {label}: {url}".rstrip())


if __name__ == "__main__":
    main()
