#!/usr/bin/env python3
"""Agent Kickbacks — BankrBot skill example script.

Demonstrates the full ad earning flow:
1. Request ad during thinking time
2. Display ad to user
3. Track impression
4. Check earnings
"""

import httpx

API = "https://agent-kickbacks-production.up.railway.app"


def request_ad(wallet: str, context: str = "general", surface: str = "response_footer") -> dict | None:
    """Request an ad from the marketplace."""
    try:
        resp = httpx.post(
            f"{API}/ad/request",
            json={
                "user_wallet": wallet,
                "agent": "bankr",
                "context": context,
                "surface": surface,
            },
            timeout=2.0,
        )
        if resp.status_code == 200:
            return resp.json()
    except httpx.HTTPError:
        pass
    return None


def track_impression(ad_id: str, wallet: str, token: str) -> bool:
    """Track a confirmed ad impression."""
    try:
        resp = httpx.post(
            f"{API}/ad/impression",
            json={"ad_id": ad_id, "user_wallet": wallet, "token": token},
            timeout=2.0,
        )
        return resp.status_code == 200
    except httpx.HTTPError:
        return False


def track_click(ad_id: str, wallet: str) -> bool:
    """Track an ad click."""
    try:
        resp = httpx.post(
            f"{API}/ad/click",
            json={"ad_id": ad_id, "user_wallet": wallet},
            timeout=2.0,
        )
        return resp.status_code == 200
    except httpx.HTTPError:
        return False


def check_earnings(wallet: str) -> dict:
    """Check earnings balance."""
    try:
        resp = httpx.get(f"{API}/earnings/{wallet}", timeout=5.0)
        if resp.status_code == 200:
            return resp.json()
    except httpx.HTTPError:
        pass
    return {"balance": 0.0, "total_earned": 0.0, "total_impressions": 0, "total_clicks": 0}


def request_payout(wallet: str) -> dict:
    """Request a USDC payout."""
    try:
        resp = httpx.post(
            f"{API}/payout/request",
            json={"wallet_address": wallet},
            timeout=10.0,
        )
        if resp.status_code == 200:
            return resp.json()
    except httpx.HTTPError:
        pass
    return {"status": "error"}


if __name__ == "__main__":
    import sys

    wallet = sys.argv[1] if len(sys.argv) > 1 else "0x0000000000000000000000000000000000000000"

    print(f"=== Agent Kickbacks Demo (wallet: {wallet[:10]}...) ===\n")

    # 1. Request ad
    print("1. Requesting ad...")
    ad = request_ad(wallet, context="defi trading")
    if ad:
        print(f"   ✅ Ad: {ad['title']}")
        print(f"   📝 {ad['body']}")
        print(f"   💰 Earn: ${ad['earn_amount']:.4f}")
    else:
        print("   ❌ No ads available")

    # 2. Check earnings
    print("\n2. Checking earnings...")
    earnings = check_earnings(wallet)
    print(f"   💰 Balance: ${earnings['balance']:.4f}")
    print(f"   📊 Impressions: {earnings['total_impressions']}")
    print(f"   🖱️ Clicks: {earnings['total_clicks']}")

    print("\n=== Done ===")
