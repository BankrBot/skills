#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any


GRAPHQL_URL = "https://blue-api.morpho.org/graphql"
BASE_RPC_URL = os.environ.get("BASE_RPC_URL", "https://base.llamarpc.com")
USER_AGENT = "fxusd-morpho/0.1 (+https://github.com/huwangtao123/fxsave-dapp)"
MORPHO_BLUE_ADDRESS = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb"
BASE_CHAIN_ID = 8453
ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")


@dataclass(frozen=True)
class Token:
    symbol: str
    address: str
    decimals: int


TOKEN_REGISTRY = {
    "fxUSD": Token("fxUSD", "0x55380fe7a1910dff29a47b622057ab4139da42c5", 18),
    "USDC": Token("USDC", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 6),
    "WETH": Token("WETH", "0x4200000000000000000000000000000000000006", 18),
    "wstETH": Token("wstETH", "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452", 18),
    "cbBTC": Token("cbBTC", "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", 8),
    "BNKR": Token("BNKR", "0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b", 18),
    "CLANKER": Token("CLANKER", "0x1bc0c42215582d5A085795f4baDbaC3ff36d1Bcb", 18),
    "VVV": Token("VVV", "0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf", 18),
    "VIRTUAL": Token("VIRTUAL", "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b", 18),
}
STABLE_COLLATERAL_SYMBOLS = {"FXUSD", "USDC", "USDT", "DAI", "USDS"}
BLUECHIP_COLLATERAL_SYMBOLS = {"WETH", "wstETH", "cbBTC"}


DISCOVER_QUERY = """
query Markets($chainId: Int!, $loanAsset: String!) {
  markets(where: { chainId_in: [$chainId], loanAssetAddress_in: [$loanAsset] }) {
    items {
      uniqueKey
      listed
      lltv
      irmAddress
      morphoBlue {
        address
        chain {
          id
          network
        }
      }
      loanAsset {
        address
        symbol
        decimals
      }
      collateralAsset {
        address
        symbol
        decimals
      }
      oracle {
        address
      }
      state {
        supplyApy
        borrowApy
        supplyAssets
        supplyShares
        supplyAssetsUsd
        borrowAssets
        borrowAssetsUsd
        liquidityAssets
        liquidityAssetsUsd
        utilization
      }
      warnings {
        type
        level
      }
    }
  }
}
"""

MARKET_BY_KEY_QUERY = """
query Market($key: String!, $chainId: Int!) {
  marketByUniqueKey(uniqueKey: $key, chainId: $chainId) {
    uniqueKey
    listed
    lltv
    irmAddress
    morphoBlue {
      address
      chain {
        id
        network
      }
    }
    loanAsset {
      address
      symbol
      decimals
    }
    collateralAsset {
      address
      symbol
      decimals
    }
    oracle {
      address
    }
    state {
      supplyApy
      borrowApy
      supplyAssets
      supplyShares
      supplyAssetsUsd
      borrowAssets
      borrowAssetsUsd
      liquidityAssets
      liquidityAssetsUsd
      utilization
    }
    warnings {
      type
      level
    }
  }
}
"""

USER_POSITIONS_QUERY = """
query Positions($chainId: Int!, $user: String!) {
  marketPositions(where: { chainId_in: [$chainId], userAddress_in: [$user] }) {
    items {
      healthFactor
      listed
      priceVariationToLiquidationPrice
      market {
        uniqueKey
        listed
        lltv
        irmAddress
        morphoBlue {
          address
        }
        loanAsset {
          address
          symbol
          decimals
        }
        collateralAsset {
          address
          symbol
          decimals
        }
        oracle {
          address
        }
        state {
          supplyApy
          borrowApy
          supplyAssets
          supplyShares
          supplyAssetsUsd
          borrowAssets
          borrowAssetsUsd
          liquidityAssets
          liquidityAssetsUsd
          utilization
        }
        warnings {
          type
          level
        }
      }
      state {
        collateral
        collateralUsd
        supplyAssets
        supplyAssetsUsd
        supplyShares
        borrowAssets
        borrowAssetsUsd
        borrowShares
      }
    }
  }
}
"""


def request_graphql(query: str, variables: dict[str, Any]) -> Any:
    last_error: Exception | None = None
    payload = json.dumps({"query": query, "variables": variables}).encode("utf-8")

    for delay in (0.0, 0.4, 1.0):
        if delay:
            time.sleep(delay)

        request = urllib.request.Request(
            GRAPHQL_URL,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": USER_AGENT,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                decoded = json.loads(response.read().decode("utf-8"))
                if decoded.get("errors"):
                    raise ValueError(f"GraphQL error: {decoded['errors']}")
                return decoded["data"]
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code != 429:
                raw = error.read().decode("utf-8")
                raise ValueError(f"GraphQL HTTP error {error.code}: {raw}") from error

    if last_error is not None:
        raise last_error
    raise ValueError("Unexpected GraphQL request failure.")


def post_json(url: str, payload: dict[str, Any]) -> Any:
    encoded = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=encoded,
        headers={
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def rpc_call(rpc_url: str, to: str, data: str) -> str:
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_call",
        "params": [
            {
                "to": to,
                "data": data,
            },
            "latest",
        ],
    }
    response = post_json(rpc_url, payload)
    if "error" in response:
        raise ValueError(f"RPC call failed: {response['error']}")
    result = response.get("result")
    if not isinstance(result, str) or not result.startswith("0x"):
        raise ValueError("Unexpected RPC result.")
    return result


def validate_address(value: str, field_name: str) -> str:
    if not ADDRESS_RE.match(value):
        raise ValueError(f"Invalid {field_name}: {value}")
    return value


def parse_units(value: str, decimals: int) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("Amount is required.")
    if normalized.count(".") > 1:
        raise ValueError(f"Invalid amount: {value}")

    whole, _, fraction = normalized.partition(".")
    if not whole:
        whole = "0"
    if not whole.isdigit() or (fraction and not fraction.isdigit()):
        raise ValueError(f"Invalid amount: {value}")

    padded_fraction = (fraction + ("0" * decimals))[:decimals]
    combined = f"{whole}{padded_fraction}".lstrip("0")
    return combined or "0"


def parse_fraction(value: str) -> str:
    try:
        parsed = Decimal(value)
    except InvalidOperation as error:
        raise ValueError(f"Invalid fraction: {value}") from error

    if parsed <= 0 or parsed > 1:
        raise ValueError("Fraction must be greater than 0 and less than or equal to 1.")
    return format(parsed.normalize(), "f")


def fraction_to_parts(value: str) -> tuple[int, int]:
    normalized = parse_fraction(value)
    whole, _, fraction = normalized.partition(".")
    numerator = int(f"{whole}{fraction}") if fraction else int(whole)
    denominator = 10 ** len(fraction) if fraction else 1
    return numerator, denominator


def pad_hex(value: str) -> str:
    return value[2:].lower().rjust(64, "0")


def encode_uint256(value: int | str) -> str:
    return hex(int(value))[2:].rjust(64, "0")


def encode_call(selector: str, words: list[str]) -> str:
    return f"{selector}{''.join(words)}"


def encode_empty_bytes(offset_words: int) -> list[str]:
    return [encode_uint256(offset_words * 32), encode_uint256(0)]


def build_approve_transaction(token: str, spender: str, amount: str) -> dict[str, Any]:
    return {
        "to": token,
        "chainId": BASE_CHAIN_ID,
        "value": "0",
        "data": encode_call("0x095ea7b3", [pad_hex(spender), encode_uint256(amount)]),
    }


def build_bankr_submit_request(transaction: dict[str, Any], description: str) -> dict[str, Any]:
    return {
        "transaction": transaction,
        "description": description,
        "waitForConfirmation": True,
    }


def build_bankr_steps(steps: list[tuple[str, dict[str, Any]]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for index, (description, transaction) in enumerate(steps, start=1):
        result.append(
            {
                "step": index,
                "description": description,
                "request": build_bankr_submit_request(transaction, description),
            }
        )
    return result


def erc20_balance_of(rpc_url: str, contract: str, owner: str) -> int:
    return int(rpc_call(rpc_url, contract, f"0x70a08231{pad_hex(owner)}"), 16)


def erc20_allowance(rpc_url: str, contract: str, owner: str, spender: str) -> int:
    return int(rpc_call(rpc_url, contract, f"0xdd62ed3e{pad_hex(owner)}{pad_hex(spender)}"), 16)


def decode_words(hex_data: str, words: int) -> list[int]:
    raw = hex_data[2:]
    if len(raw) < words * 64:
        raise ValueError("RPC response shorter than expected.")
    result: list[int] = []
    for index in range(words):
        start = index * 64
        result.append(int(raw[start : start + 64], 16))
    return result


def morpho_position(rpc_url: str, morpho: str, market_key: str, user_address: str) -> dict[str, str]:
    data = f"0x93c52062{market_key[2:].rjust(64, '0')}{pad_hex(user_address)}"
    supply_shares, borrow_shares, collateral = decode_words(rpc_call(rpc_url, morpho, data), 3)
    return {
        "supplyShares": str(supply_shares),
        "borrowShares": str(borrow_shares),
        "collateral": str(collateral),
    }


def morpho_market_state(rpc_url: str, morpho: str, market_key: str) -> dict[str, str]:
    data = f"0x5c60e39a{market_key[2:].rjust(64, '0')}"
    total_supply_assets, total_supply_shares, total_borrow_assets, total_borrow_shares, last_update, fee = decode_words(
        rpc_call(rpc_url, morpho, data),
        6,
    )
    return {
        "totalSupplyAssets": str(total_supply_assets),
        "totalSupplyShares": str(total_supply_shares),
        "totalBorrowAssets": str(total_borrow_assets),
        "totalBorrowShares": str(total_borrow_shares),
        "lastUpdate": str(last_update),
        "fee": str(fee),
    }


def estimate_assets_from_shares(shares: int, total_assets: int, total_shares: int, round_up: bool = False) -> int:
    if shares <= 0 or total_assets <= 0 or total_shares <= 0:
        return 0
    numerator = shares * total_assets
    if round_up:
        return (numerator + total_shares - 1) // total_shares
    return numerator // total_shares


def resolve_loan_token(value: str | None) -> Token:
    if not value:
        return TOKEN_REGISTRY["fxUSD"]
    preset = TOKEN_REGISTRY.get(value)
    if preset:
        return preset
    for token in TOKEN_REGISTRY.values():
        if token.address.lower() == value.lower():
            return token
    raise ValueError(f"Unknown loan token: {value}")


def classify_collateral(symbol: str | None) -> tuple[str, str]:
    normalized = (symbol or "").upper()
    if normalized in STABLE_COLLATERAL_SYMBOLS:
        return (
            "stable-collateral",
            "Collateral is stable or correlated, so borrower-side collateral volatility is lower.",
        )
    if symbol in BLUECHIP_COLLATERAL_SYMBOLS or normalized in {item.upper() for item in BLUECHIP_COLLATERAL_SYMBOLS}:
        return (
            "bluechip-collateral",
            "Collateral is a blue-chip asset, which is generally safer than tail-risk altcoin collateral.",
        )
    return (
        "altcoin-collateral",
        "Collateral is a volatile or tail-risk asset, so borrower defaults and bad debt risk are higher.",
    )


def normalize_market(market: dict[str, Any]) -> dict[str, Any]:
    state = market.get("state") or {}
    collateral_asset = market.get("collateralAsset") or {}
    loan_asset = market.get("loanAsset") or {}
    morpho_blue = market.get("morphoBlue") or {}
    oracle = market.get("oracle") or {}
    warnings = market.get("warnings") or []
    collateral_symbol = collateral_asset.get("symbol")
    risk_class, risk_summary = classify_collateral(collateral_symbol)

    return {
        "uniqueKey": market.get("uniqueKey"),
        "title": f"{loan_asset.get('symbol', 'asset')}/{collateral_symbol or 'unknown'}",
        "listed": bool(market.get("listed")),
        "morphoBlueAddress": morpho_blue.get("address") or MORPHO_BLUE_ADDRESS,
        "loanAsset": {
            "address": loan_asset.get("address"),
            "symbol": loan_asset.get("symbol"),
            "decimals": loan_asset.get("decimals"),
        },
        "collateralAsset": {
            "address": collateral_asset.get("address"),
            "symbol": collateral_symbol,
            "decimals": collateral_asset.get("decimals"),
        },
        "oracleAddress": oracle.get("address"),
        "irmAddress": market.get("irmAddress"),
        "lltv": market.get("lltv"),
        "lltvPercent": round((int(market.get("lltv") or 0) / 1e18) * 100, 2),
        "collateralRiskClass": risk_class,
        "collateralRiskSummary": risk_summary,
        "state": {
            "supplyApy": state.get("supplyApy") or 0,
            "borrowApy": state.get("borrowApy") or 0,
            "supplyAssets": state.get("supplyAssets") or "0",
            "supplyShares": state.get("supplyShares") or "0",
            "supplyAssetsUsd": state.get("supplyAssetsUsd") or 0,
            "borrowAssets": state.get("borrowAssets") or "0",
            "borrowAssetsUsd": state.get("borrowAssetsUsd") or 0,
            "liquidityAssets": state.get("liquidityAssets") or "0",
            "liquidityAssetsUsd": state.get("liquidityAssetsUsd") or 0,
            "utilization": state.get("utilization") or 0,
        },
        "warnings": warnings,
    }


def rank_market(market: dict[str, Any]) -> tuple[float, list[str]]:
    score = 0.0
    reasons: list[str] = []
    state = market["state"]
    supply_apy_pct = float(state["supplyApy"]) * 100
    liquidity_usd = float(state["liquidityAssetsUsd"] or 0)
    supply_assets_usd = float(state["supplyAssetsUsd"] or 0)
    utilization = float(state["utilization"] or 0)

    if market["listed"]:
        score += 35
        reasons.append("listed market")
    else:
        score -= 40
        reasons.append("unlisted market penalty")

    risk_class = market["collateralRiskClass"]
    if risk_class == "stable-collateral":
        score += 18
        reasons.append("stable collateral bonus")
    elif risk_class == "bluechip-collateral":
        score += 12
        reasons.append("blue-chip collateral bonus")
    else:
        score -= 10
        reasons.append("altcoin collateral penalty")

    score += min(supply_apy_pct, 8)
    if supply_apy_pct > 0:
        reasons.append(f"supply APY {supply_apy_pct:.2f}%")

    if liquidity_usd > 0:
        score += min(math.log10(liquidity_usd + 1) * 6, 18)
        reasons.append(f"liquidity ${liquidity_usd:,.2f}")

    if supply_assets_usd > 0:
        score += min(math.log10(supply_assets_usd + 1) * 4, 12)
        reasons.append(f"supply TVL ${supply_assets_usd:,.2f}")

    if utilization > 0.9:
        score -= 10
        reasons.append("very high utilization penalty")
    elif utilization > 0.75:
        score -= 5
        reasons.append("high utilization penalty")
    else:
        score += 2
        reasons.append("healthy utilization")

    if market["warnings"]:
        score -= 12
        reasons.append("warnings present")

    return score, reasons


def fetch_markets(loan_token: Token) -> list[dict[str, Any]]:
    data = request_graphql(DISCOVER_QUERY, {"chainId": BASE_CHAIN_ID, "loanAsset": loan_token.address})
    items = data["markets"]["items"]
    return [normalize_market(item) for item in items]


def fetch_market_by_key(market_key: str) -> dict[str, Any]:
    data = request_graphql(MARKET_BY_KEY_QUERY, {"key": market_key, "chainId": BASE_CHAIN_ID})
    market = data.get("marketByUniqueKey")
    if not market:
        raise ValueError(f"No Morpho market found for key {market_key}.")
    return normalize_market(market)


def fetch_user_positions(user_address: str, loan_token: Token) -> list[dict[str, Any]]:
    data = request_graphql(USER_POSITIONS_QUERY, {"chainId": BASE_CHAIN_ID, "user": user_address})
    items = data["marketPositions"]["items"]
    filtered: list[dict[str, Any]] = []
    for item in items:
        market = normalize_market(item["market"])
        if market["loanAsset"]["address"].lower() != loan_token.address.lower():
            continue
        filtered.append(
            {
                "market": market,
                "listed": item.get("listed"),
                "healthFactor": item.get("healthFactor"),
                "priceVariationToLiquidationPrice": item.get("priceVariationToLiquidationPrice"),
                "state": item.get("state") or {},
            }
        )
    return filtered


def resolve_user_position(
    *,
    positions: list[dict[str, Any]],
    market_key: str | None,
    collateral_token: str | None,
) -> dict[str, Any]:
    if market_key:
        matches = [position for position in positions if position["market"]["uniqueKey"].lower() == market_key.lower()]
        if not matches:
            raise ValueError(f"No Morpho position matched market key {market_key}.")
        return matches[0]

    if collateral_token:
        normalized = collateral_token.lower()
        matches = [
            position
            for position in positions
            if (position["market"]["collateralAsset"]["symbol"] or "").lower() == normalized
            or (position["market"]["collateralAsset"]["address"] or "").lower() == normalized
        ]
        if not matches:
            raise ValueError(f"No Morpho position matched collateral token {collateral_token}.")
        if len(matches) > 1:
            raise ValueError("Multiple Morpho positions matched. Use --market-key for an exact selection.")
        return matches[0]

    active = [
        position
        for position in positions
        if float(position["state"].get("collateralUsd") or 0) > 0 or float(position["state"].get("borrowAssetsUsd") or 0) > 0
    ]
    if len(active) != 1:
        raise ValueError("Multiple or zero Morpho risk positions matched. Use --market-key or --collateral-token.")
    return active[0]


def resolve_market(
    *,
    markets: list[dict[str, Any]],
    market_key: str | None,
    collateral_token: str | None,
) -> dict[str, Any]:
    if market_key:
        matches = [market for market in markets if market["uniqueKey"].lower() == market_key.lower()]
        if not matches:
            raise ValueError(f"No Morpho market matched unique key {market_key}.")
        return matches[0]

    if collateral_token:
        normalized = collateral_token.lower()
        matches = [
            market
            for market in markets
            if (market["collateralAsset"]["symbol"] or "").lower() == normalized
            or (market["collateralAsset"]["address"] or "").lower() == normalized
        ]
        if not matches:
            raise ValueError(f"No Morpho market matched collateral token {collateral_token}.")
        if len(matches) > 1:
            raise ValueError("Multiple Morpho markets matched. Use --market-key for an exact selection.")
        return matches[0]

    raise ValueError("Provide --market-key or --collateral-token.")


def recommended_markets(markets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ranked: list[dict[str, Any]] = []
    for market in markets:
        entry = dict(market)
        score, reasons = rank_market(entry)
        entry["score"] = round(score, 2)
        entry["reasons"] = reasons
        ranked.append(entry)
    ranked.sort(key=lambda item: item["score"], reverse=True)
    return ranked


def build_market_param_words(market: dict[str, Any]) -> list[str]:
    return [
        pad_hex(market["loanAsset"]["address"]),
        pad_hex(market["collateralAsset"]["address"]),
        pad_hex(market["oracleAddress"]),
        pad_hex(market["irmAddress"]),
        encode_uint256(market["lltv"]),
    ]


def build_supply_transaction(market: dict[str, Any], amount: str, on_behalf: str) -> dict[str, Any]:
    words = build_market_param_words(market) + [
        encode_uint256(amount),
        encode_uint256(0),
        pad_hex(on_behalf),
        *encode_empty_bytes(9),
    ]
    return {
        "to": market["morphoBlueAddress"],
        "chainId": BASE_CHAIN_ID,
        "value": "0",
        "data": encode_call("0xa99aad89", words),
    }


def build_withdraw_transaction(market: dict[str, Any], shares: str, on_behalf: str, receiver: str) -> dict[str, Any]:
    words = build_market_param_words(market) + [
        encode_uint256(0),
        encode_uint256(shares),
        pad_hex(on_behalf),
        pad_hex(receiver),
    ]
    return {
        "to": market["morphoBlueAddress"],
        "chainId": BASE_CHAIN_ID,
        "value": "0",
        "data": encode_call("0x5c2bea49", words),
    }


def build_borrow_transaction(market: dict[str, Any], amount: str, on_behalf: str, receiver: str) -> dict[str, Any]:
    words = build_market_param_words(market) + [
        encode_uint256(amount),
        encode_uint256(0),
        pad_hex(on_behalf),
        pad_hex(receiver),
    ]
    return {
        "to": market["morphoBlueAddress"],
        "chainId": BASE_CHAIN_ID,
        "value": "0",
        "data": encode_call("0x50d8cd4b", words),
    }


def build_repay_transaction(market: dict[str, Any], assets: str, shares: str, on_behalf: str) -> dict[str, Any]:
    words = build_market_param_words(market) + [
        encode_uint256(assets),
        encode_uint256(shares),
        pad_hex(on_behalf),
        *encode_empty_bytes(9),
    ]
    return {
        "to": market["morphoBlueAddress"],
        "chainId": BASE_CHAIN_ID,
        "value": "0",
        "data": encode_call("0x20b76e81", words),
    }


def build_supply_collateral_transaction(market: dict[str, Any], amount: str, on_behalf: str) -> dict[str, Any]:
    words = build_market_param_words(market) + [
        encode_uint256(amount),
        pad_hex(on_behalf),
        *encode_empty_bytes(8),
    ]
    return {
        "to": market["morphoBlueAddress"],
        "chainId": BASE_CHAIN_ID,
        "value": "0",
        "data": encode_call("0x238d6579", words),
    }


def recommended_max_ltv_percent(max_ltv_percent: float) -> float:
    return round(max_ltv_percent * 0.8, 2)


def risk_adjusted_max_ltv_percent(market: dict[str, Any]) -> float:
    max_ltv_percent = float(market["lltvPercent"])
    risk_class = market["collateralRiskClass"]
    if risk_class == "stable-collateral":
        return round(max_ltv_percent * 0.85, 2)
    if risk_class == "bluechip-collateral":
        return round(max_ltv_percent * 0.8, 2)
    return round(max_ltv_percent * 0.6, 2)


def compute_risk_metrics(
    *,
    market: dict[str, Any],
    graph_state: dict[str, Any],
    health_factor: float | None,
    price_variation_to_liquidation_price: float | None,
    projected_additional_borrow_usd: float = 0.0,
    projected_additional_collateral_usd: float = 0.0,
) -> dict[str, Any]:
    collateral_usd = float(graph_state.get("collateralUsd") or 0)
    current_borrow_usd = float(graph_state.get("borrowAssetsUsd") or 0)
    max_ltv_percent = float(market["lltvPercent"])
    recommended_ltv_percent = recommended_max_ltv_percent(max_ltv_percent)
    risk_adjusted_ltv_percent = risk_adjusted_max_ltv_percent(market)

    current_ltv_percent = None
    projected_ltv_percent = None
    protocol_headroom_usd = None
    recommended_headroom_usd = None
    risk_adjusted_headroom_usd = None
    projected_buffer_to_lltv_percent = None

    if collateral_usd > 0:
        current_ltv_percent = round((current_borrow_usd / collateral_usd) * 100, 4)
        projected_borrow_usd = max(current_borrow_usd + projected_additional_borrow_usd, 0)
        projected_collateral_usd = max(collateral_usd + projected_additional_collateral_usd, collateral_usd)
        projected_ltv_percent = round((projected_borrow_usd / projected_collateral_usd) * 100, 4)
        protocol_headroom_usd = round(max((collateral_usd * max_ltv_percent / 100) - current_borrow_usd, 0), 6)
        recommended_headroom_usd = round(
            max((collateral_usd * recommended_ltv_percent / 100) - current_borrow_usd, 0),
            6,
        )
        risk_adjusted_headroom_usd = round(
            max((collateral_usd * risk_adjusted_ltv_percent / 100) - current_borrow_usd, 0),
            6,
        )
        projected_buffer_to_lltv_percent = round(max_ltv_percent - projected_ltv_percent, 4)

    status = "no-borrow-risk"
    if collateral_usd <= 0:
        status = "no-collateral"
    elif current_ltv_percent is not None:
        if current_ltv_percent >= max_ltv_percent or (health_factor is not None and health_factor <= 1):
            status = "liquidation-risk"
        elif current_ltv_percent >= recommended_ltv_percent:
            status = "caution"
        else:
            status = "healthy"

    return {
        "collateralUsd": collateral_usd,
        "currentBorrowUsd": current_borrow_usd,
        "currentLtvPercent": current_ltv_percent,
        "projectedAdditionalBorrowUsd": projected_additional_borrow_usd,
        "projectedAdditionalCollateralUsd": projected_additional_collateral_usd,
        "projectedLtvPercent": projected_ltv_percent,
        "maxLtvPercent": max_ltv_percent,
        "recommendedMaxLtvPercent": recommended_ltv_percent,
        "riskAdjustedMaxLtvPercent": risk_adjusted_ltv_percent,
        "protocolHeadroomUsd": protocol_headroom_usd,
        "recommendedHeadroomUsd": recommended_headroom_usd,
        "riskAdjustedHeadroomUsd": risk_adjusted_headroom_usd,
        "projectedBufferToLltvPercent": projected_buffer_to_lltv_percent,
        "healthFactor": health_factor,
        "priceVariationToLiquidationPrice": price_variation_to_liquidation_price,
        "status": status,
    }


def build_risk_notes(market: dict[str, Any], mode: str) -> list[str]:
    notes = [
        "Morpho market parameters and APY are live and can change over time.",
        "Supplying to a Morpho market is simpler than borrowing, but it still depends on collateral quality and liquidity.",
        market["collateralRiskSummary"],
    ]
    if mode == "withdraw":
        notes.append("Withdrawing from a market with active borrow or collateral positions can fail or reduce safety margins.")
    if mode == "borrow":
        notes.append("Borrowing should remain a manual decision path with explicit LTV and liquidation-buffer review.")
    if mode == "repay":
        notes.append("Repaying debt should lower LTV, but you should re-run alert-check after confirmation to verify the new safety margin.")
    if mode == "add-collateral":
        notes.append("Adding collateral should widen the liquidation buffer, but you should re-run alert-check after confirmation to verify the new safety margin.")
    if market["warnings"]:
        notes.append("Market warnings are present and should be reviewed before execution.")
    return notes


def find_position_for_market(positions: list[dict[str, Any]], market_key: str) -> dict[str, Any] | None:
    for position in positions:
        if position["market"]["uniqueKey"].lower() == market_key.lower():
            return position
    return None


def estimate_collateral_value_usd(
    *,
    market: dict[str, Any],
    graph_state: dict[str, Any],
    collateral_assets_raw: int,
) -> float | None:
    current_collateral_raw = int(graph_state.get("collateral") or 0)
    current_collateral_usd = float(graph_state.get("collateralUsd") or 0)
    if current_collateral_raw <= 0 or current_collateral_usd <= 0 or collateral_assets_raw <= 0:
        return None
    return round((current_collateral_usd / current_collateral_raw) * collateral_assets_raw, 6)


def severity_rank(level: str) -> int:
    order = {
        "ok": 0,
        "warning": 1,
        "critical": 2,
    }
    return order.get(level, 0)


def liquidation_distance_percent(value: float | None) -> float | None:
    if value is None:
        return None
    return round(abs(value) * 100, 4)


def monitoring_interval(level: str, risk_class: str) -> str:
    if level == "critical":
        return "15m"
    if level == "warning":
        return "1h" if risk_class == "altcoin-collateral" else "4h"
    if risk_class == "altcoin-collateral":
        return "6h"
    if risk_class == "bluechip-collateral":
        return "12h"
    return "24h"


def evaluate_alert(
    *,
    market: dict[str, Any],
    risk_metrics: dict[str, Any],
    warning_health_factor: float,
    critical_health_factor: float,
    warning_liquidation_distance_percent: float,
    critical_liquidation_distance_percent: float,
    warning_buffer_to_lltv_percent: float,
    critical_buffer_to_lltv_percent: float,
) -> dict[str, Any]:
    risk_class = market["collateralRiskClass"]
    current_ltv_percent = risk_metrics.get("currentLtvPercent")
    max_ltv_percent = risk_metrics.get("maxLtvPercent")
    recommended_ltv_percent = risk_metrics.get("recommendedMaxLtvPercent")
    risk_adjusted_ltv_percent = risk_metrics.get("riskAdjustedMaxLtvPercent")
    health_factor = risk_metrics.get("healthFactor")
    buffer_to_lltv_percent = risk_metrics.get("projectedBufferToLltvPercent")
    distance_percent = liquidation_distance_percent(risk_metrics.get("priceVariationToLiquidationPrice"))
    status = risk_metrics.get("status")

    warning_ltv_percent = risk_adjusted_ltv_percent if risk_class == "altcoin-collateral" else recommended_ltv_percent
    warning_reasons: list[str] = []
    critical_reasons: list[str] = []

    if status == "liquidation-risk":
        critical_reasons.append("Position is already flagged as liquidation-risk.")
    if current_ltv_percent is not None and max_ltv_percent is not None and current_ltv_percent >= max_ltv_percent:
        critical_reasons.append("Current LTV is at or above the protocol maximum.")
    if health_factor is not None and health_factor <= critical_health_factor:
        critical_reasons.append(
            f"Health factor {health_factor:.3f} is at or below the critical threshold {critical_health_factor:.2f}."
        )
    if buffer_to_lltv_percent is not None and buffer_to_lltv_percent <= critical_buffer_to_lltv_percent:
        critical_reasons.append(
            f"Buffer to LLTV is only {buffer_to_lltv_percent:.2f}%, below the critical threshold {critical_buffer_to_lltv_percent:.2f}%."
        )
    if distance_percent is not None and distance_percent <= critical_liquidation_distance_percent:
        critical_reasons.append(
            f"Estimated distance to liquidation is only {distance_percent:.2f}%, below the critical threshold {critical_liquidation_distance_percent:.2f}%."
        )

    if current_ltv_percent is not None and warning_ltv_percent is not None and current_ltv_percent >= warning_ltv_percent:
        warning_reasons.append(
            f"Current LTV {current_ltv_percent:.2f}% is at or above the warning ceiling {warning_ltv_percent:.2f}%."
        )
    if health_factor is not None and health_factor <= warning_health_factor:
        warning_reasons.append(
            f"Health factor {health_factor:.3f} is at or below the warning threshold {warning_health_factor:.2f}."
        )
    if buffer_to_lltv_percent is not None and buffer_to_lltv_percent <= warning_buffer_to_lltv_percent:
        warning_reasons.append(
            f"Buffer to LLTV is {buffer_to_lltv_percent:.2f}%, below the warning threshold {warning_buffer_to_lltv_percent:.2f}%."
        )
    if distance_percent is not None and distance_percent <= warning_liquidation_distance_percent:
        warning_reasons.append(
            f"Estimated distance to liquidation is {distance_percent:.2f}%, below the warning threshold {warning_liquidation_distance_percent:.2f}%."
        )

    level = "ok"
    reasons: list[str] = []
    if critical_reasons:
        level = "critical"
        reasons = critical_reasons
    elif warning_reasons:
        level = "warning"
        reasons = warning_reasons

    if level == "critical":
        action = "Do not increase borrow. Consider repaying debt or adding collateral immediately."
    elif level == "warning":
        action = "Monitor closely and consider lowering LTV before conditions worsen."
    else:
        action = "No immediate alert. Keep monitoring the position, especially before borrowing more."

    return {
        "triggered": level != "ok",
        "level": level,
        "warningLtvPercent": warning_ltv_percent,
        "criticalLtvPercent": max_ltv_percent,
        "estimatedDistanceToLiquidationPercent": distance_percent,
        "reasons": reasons,
        "recommendedAction": action,
        "recommendedRecheckIn": monitoring_interval(level, risk_class),
    }


def print_json(payload: Any) -> None:
    print(json.dumps(payload, indent=2, sort_keys=True))


def discover_command(args: argparse.Namespace) -> int:
    loan_token = resolve_loan_token(args.loan_token)
    markets = fetch_markets(loan_token)
    summary = {
        "listed": sum(1 for market in markets if market["listed"]),
        "unlisted": sum(1 for market in markets if not market["listed"]),
        "stableCollateral": sum(1 for market in markets if market["collateralRiskClass"] == "stable-collateral"),
        "bluechipCollateral": sum(1 for market in markets if market["collateralRiskClass"] == "bluechip-collateral"),
        "altcoinCollateral": sum(1 for market in markets if market["collateralRiskClass"] == "altcoin-collateral"),
    }
    print_json(
        {
            "command": "discover",
            "loanToken": loan_token.symbol,
            "count": len(markets),
            "summary": summary,
            "markets": markets,
        }
    )
    return 0


def recommend_command(args: argparse.Namespace) -> int:
    loan_token = resolve_loan_token(args.loan_token)
    markets = recommended_markets(fetch_markets(loan_token))
    print_json(
        {
            "command": "recommend",
            "loanToken": loan_token.symbol,
            "top": markets[: args.limit],
        }
    )
    return 0


def position_reads_command(args: argparse.Namespace) -> int:
    loan_token = resolve_loan_token(args.loan_token)
    user_address = validate_address(args.from_address, "from-address")
    positions = fetch_user_positions(user_address, loan_token)

    onchain_positions: list[dict[str, Any]] = []
    for item in positions:
        market = item["market"]
        morpho_address = market["morphoBlueAddress"]
        onchain_state = morpho_position(args.rpc_url, morpho_address, market["uniqueKey"], user_address)
        onchain_market = morpho_market_state(args.rpc_url, morpho_address, market["uniqueKey"])
        supply_assets_est = estimate_assets_from_shares(
            int(onchain_state["supplyShares"]),
            int(onchain_market["totalSupplyAssets"]),
            int(onchain_market["totalSupplyShares"]),
            round_up=False,
        )
        borrow_assets_est = estimate_assets_from_shares(
            int(onchain_state["borrowShares"]),
            int(onchain_market["totalBorrowAssets"]),
            int(onchain_market["totalBorrowShares"]),
            round_up=True,
        )
        onchain_positions.append(
            {
                "market": market,
                "graphState": item["state"],
                "healthFactor": item["healthFactor"],
                "priceVariationToLiquidationPrice": item["priceVariationToLiquidationPrice"],
                "riskMetrics": compute_risk_metrics(
                    market=market,
                    graph_state=item["state"],
                    health_factor=item["healthFactor"],
                    price_variation_to_liquidation_price=item["priceVariationToLiquidationPrice"],
                ),
                "onchainPosition": onchain_state,
                "onchainMarketState": onchain_market,
                "estimatedSupplyAssets": str(supply_assets_est),
                "estimatedBorrowAssets": str(borrow_assets_est),
            }
        )

    print_json(
        {
            "command": "position-reads",
            "userAddress": user_address,
            "loanToken": loan_token.symbol,
            "positionCount": len(onchain_positions),
            "positions": onchain_positions,
        }
    )
    return 0


def supply_plan_command(args: argparse.Namespace) -> int:
    loan_token = resolve_loan_token(args.loan_token)
    markets = fetch_markets(loan_token)
    if args.market_key or args.collateral_token:
        market = resolve_market(markets=markets, market_key=args.market_key, collateral_token=args.collateral_token)
        selection_mode = "explicit"
        selection_reasons: list[str] = []
    else:
        ranked = recommended_markets(markets)
        if not ranked:
            raise ValueError(f"No live Morpho markets were found for {loan_token.symbol}.")
        market = ranked[0]
        selection_mode = "recommended"
        selection_reasons = market.get("reasons", [])

    user_address = validate_address(args.from_address, "from-address")
    amount_raw = parse_units(args.amount, int(market["loanAsset"]["decimals"]))
    morpho_address = market["morphoBlueAddress"]

    current_balance = erc20_balance_of(args.rpc_url, market["loanAsset"]["address"], user_address)
    current_allowance = erc20_allowance(args.rpc_url, market["loanAsset"]["address"], user_address, morpho_address)
    current_position = morpho_position(args.rpc_url, morpho_address, market["uniqueKey"], user_address)

    has_sufficient_balance = current_balance >= int(amount_raw)
    needs_approval = current_allowance < int(amount_raw)

    approval: dict[str, str] | None = None
    approval_transaction: dict[str, Any] | None = None
    if needs_approval:
        approval = {
            "spender": morpho_address,
            "token": market["loanAsset"]["address"],
            "amount": amount_raw,
        }
        approval_transaction = build_approve_transaction(market["loanAsset"]["address"], morpho_address, amount_raw)

    supply_transaction = build_supply_transaction(market, amount_raw, user_address)
    bankr_steps: list[tuple[str, dict[str, Any]]] = []
    if approval_transaction is not None:
        bankr_steps.append(
            (
                f"Approve {market['loanAsset']['symbol']} for Morpho Blue",
                approval_transaction,
            )
        )
    bankr_steps.append(
        (
            f"Supply {args.amount} {market['loanAsset']['symbol']} to Morpho {market['title']}",
            supply_transaction,
        )
    )

    print_json(
        {
            "command": "supply-plan",
            "selectionMode": selection_mode,
            "selectionReasons": selection_reasons,
            "userAddress": user_address,
            "market": market,
            "liveState": {
                "rpcUrl": args.rpc_url,
                "currentTokenBalance": str(current_balance),
                "currentAllowance": str(current_allowance),
                "currentPosition": current_position,
            },
            "executionReadiness": {
                "hasSufficientBalance": has_sufficient_balance,
                "needsApproval": needs_approval,
                "readyToExecute": has_sufficient_balance,
            },
            "approval": approval,
            "bankrReady": {
                "endpoint": "POST /agent/submit",
                "steps": build_bankr_steps(bankr_steps),
            },
            "supplyCall": {
                "chainId": BASE_CHAIN_ID,
                "to": morpho_address,
                "function": "supply((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv),uint256 assets,uint256 shares,address onBehalf,bytes data)",
                "args": {
                    "marketParams": {
                        "loanToken": market["loanAsset"]["address"],
                        "collateralToken": market["collateralAsset"]["address"],
                        "oracle": market["oracleAddress"],
                        "irm": market["irmAddress"],
                        "lltv": market["lltv"],
                    },
                    "assets": amount_raw,
                    "shares": "0",
                    "onBehalf": user_address,
                    "data": "0x",
                },
            },
            "supplyTransaction": supply_transaction,
            "riskNotes": build_risk_notes(market, "supply"),
        }
    )
    return 0


def withdraw_plan_command(args: argparse.Namespace) -> int:
    loan_token = resolve_loan_token(args.loan_token)
    user_address = validate_address(args.from_address, "from-address")
    user_positions = fetch_user_positions(user_address, loan_token)

    if args.market_key or args.collateral_token:
        market = resolve_market(
            markets=[item["market"] for item in user_positions] or fetch_markets(loan_token),
            market_key=args.market_key,
            collateral_token=args.collateral_token,
        )
    else:
        positive_supply_positions = [item for item in user_positions if int(item["state"].get("supplyShares") or 0) > 0]
        if len(positive_supply_positions) != 1:
            raise ValueError("Multiple or zero Morpho supply positions matched. Use --market-key or --collateral-token.")
        market = positive_supply_positions[0]["market"]

    morpho_address = market["morphoBlueAddress"]
    onchain_position = morpho_position(args.rpc_url, morpho_address, market["uniqueKey"], user_address)
    onchain_market = morpho_market_state(args.rpc_url, morpho_address, market["uniqueKey"])

    current_supply_shares = int(onchain_position["supplyShares"])
    current_borrow_shares = int(onchain_position["borrowShares"])
    current_collateral = int(onchain_position["collateral"])
    if current_supply_shares <= 0:
        raise ValueError("No withdrawable Morpho supply shares were found for this wallet and market.")

    numerator, denominator = fraction_to_parts(args.fraction)
    computed_shares = (current_supply_shares * numerator) // denominator
    if computed_shares <= 0:
        raise ValueError("Computed withdraw shares were zero. Increase the fraction.")

    estimated_assets = estimate_assets_from_shares(
        computed_shares,
        int(onchain_market["totalSupplyAssets"]),
        int(onchain_market["totalSupplyShares"]),
        round_up=False,
    )

    withdraw_transaction = build_withdraw_transaction(market, str(computed_shares), user_address, user_address)
    blocked_by_active_leverage = current_borrow_shares > 0 or current_collateral > 0

    print_json(
        {
            "command": "withdraw-plan",
            "userAddress": user_address,
            "market": market,
            "liveState": {
                "rpcUrl": args.rpc_url,
                "currentPosition": onchain_position,
                "currentMarketState": onchain_market,
            },
            "sharePlan": {
                "mode": "fraction",
                "fraction": parse_fraction(args.fraction),
                "currentSupplyShares": str(current_supply_shares),
                "computedShares": str(computed_shares),
                "estimatedAssetsOut": str(estimated_assets),
                "instruction": "Use shares for partial or full Morpho withdrawals to reduce asset/share rounding risk.",
            },
            "executionReadiness": {
                "hasSupplyPosition": current_supply_shares > 0,
                "hasActiveBorrowShares": current_borrow_shares > 0,
                "hasActiveCollateral": current_collateral > 0,
                "requiresBorrowPositionReview": blocked_by_active_leverage,
                "readyToExecute": not blocked_by_active_leverage,
            },
            "bankrReady": {
                "endpoint": "POST /agent/submit",
                "steps": build_bankr_steps(
                    [
                        (
                            f"Withdraw {parse_fraction(args.fraction)} of supplied {market['loanAsset']['symbol']} from Morpho {market['title']}",
                            withdraw_transaction,
                        )
                    ]
                ),
            },
            "withdrawCall": {
                "chainId": BASE_CHAIN_ID,
                "to": morpho_address,
                "function": "withdraw((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv),uint256 assets,uint256 shares,address onBehalf,address receiver)",
                "args": {
                    "marketParams": {
                        "loanToken": market["loanAsset"]["address"],
                        "collateralToken": market["collateralAsset"]["address"],
                        "oracle": market["oracleAddress"],
                        "irm": market["irmAddress"],
                        "lltv": market["lltv"],
                    },
                    "assets": "0",
                    "shares": str(computed_shares),
                    "onBehalf": user_address,
                    "receiver": user_address,
                },
            },
            "withdrawTransaction": withdraw_transaction,
            "riskNotes": build_risk_notes(market, "withdraw"),
        }
    )
    return 0


def risk_check_command(args: argparse.Namespace) -> int:
    loan_token = resolve_loan_token(args.loan_token)
    user_address = validate_address(args.from_address, "from-address")
    positions = fetch_user_positions(user_address, loan_token)

    if args.market_key or args.collateral_token:
        positions = [resolve_user_position(positions=positions, market_key=args.market_key, collateral_token=args.collateral_token)]

    results: list[dict[str, Any]] = []
    for position in positions:
        results.append(
            {
                "market": position["market"],
                "graphState": position["state"],
                "healthFactor": position["healthFactor"],
                "priceVariationToLiquidationPrice": position["priceVariationToLiquidationPrice"],
                "riskMetrics": compute_risk_metrics(
                    market=position["market"],
                    graph_state=position["state"],
                    health_factor=position["healthFactor"],
                    price_variation_to_liquidation_price=position["priceVariationToLiquidationPrice"],
                ),
                "quickChecks": [
                    "Keep currentLtvPercent well below the protocol maxLtvPercent.",
                    "Use recommendedMaxLtvPercent as the fast operational ceiling for agent decisions.",
                    "If healthFactor trends toward 1 or priceVariationToLiquidationPrice shrinks, reduce borrow or add collateral.",
                ],
            }
        )

    print_json(
        {
            "command": "risk-check",
            "userAddress": user_address,
            "loanToken": loan_token.symbol,
            "positions": results,
        }
    )
    return 0


def alert_check_command(args: argparse.Namespace) -> int:
    loan_token = resolve_loan_token(args.loan_token)
    user_address = validate_address(args.from_address, "from-address")
    positions = fetch_user_positions(user_address, loan_token)

    if args.market_key or args.collateral_token:
        positions = [resolve_user_position(positions=positions, market_key=args.market_key, collateral_token=args.collateral_token)]

    alerts: list[dict[str, Any]] = []
    highest_level = "ok"
    for position in positions:
        risk_metrics = compute_risk_metrics(
            market=position["market"],
            graph_state=position["state"],
            health_factor=position["healthFactor"],
            price_variation_to_liquidation_price=position["priceVariationToLiquidationPrice"],
        )
        alert = evaluate_alert(
            market=position["market"],
            risk_metrics=risk_metrics,
            warning_health_factor=args.warning_health_factor,
            critical_health_factor=args.critical_health_factor,
            warning_liquidation_distance_percent=args.warning_liquidation_distance_percent,
            critical_liquidation_distance_percent=args.critical_liquidation_distance_percent,
            warning_buffer_to_lltv_percent=args.warning_buffer_to_lltv_percent,
            critical_buffer_to_lltv_percent=args.critical_buffer_to_lltv_percent,
        )
        if severity_rank(alert["level"]) > severity_rank(highest_level):
            highest_level = alert["level"]
        alerts.append(
            {
                "market": position["market"],
                "graphState": position["state"],
                "riskMetrics": risk_metrics,
                "alert": alert,
                "monitoringNotes": [
                    "Re-run alert-check on a timer for ongoing borrow positions.",
                    "If the alert level moves from ok to warning, prepare a repay or add-collateral plan.",
                    "If the alert level moves to critical, treat it as an active risk event rather than a passive reminder.",
                ],
            }
        )

    summary = {
        "positionCount": len(alerts),
        "ok": sum(1 for item in alerts if item["alert"]["level"] == "ok"),
        "warning": sum(1 for item in alerts if item["alert"]["level"] == "warning"),
        "critical": sum(1 for item in alerts if item["alert"]["level"] == "critical"),
        "highestLevel": highest_level,
        "alertTriggered": highest_level != "ok",
    }

    payload = {
        "command": "alert-check",
        "userAddress": user_address,
        "loanToken": loan_token.symbol,
        "thresholds": {
            "warningHealthFactor": args.warning_health_factor,
            "criticalHealthFactor": args.critical_health_factor,
            "warningLiquidationDistancePercent": args.warning_liquidation_distance_percent,
            "criticalLiquidationDistancePercent": args.critical_liquidation_distance_percent,
            "warningBufferToLltvPercent": args.warning_buffer_to_lltv_percent,
            "criticalBufferToLltvPercent": args.critical_buffer_to_lltv_percent,
        },
        "summary": summary,
        "positions": alerts,
    }
    print_json(payload)

    if args.fail_on and severity_rank(highest_level) >= severity_rank(args.fail_on):
        return 2
    return 0


def repay_plan_command(args: argparse.Namespace) -> int:
    loan_token = resolve_loan_token(args.loan_token)
    user_address = validate_address(args.from_address, "from-address")
    positions = fetch_user_positions(user_address, loan_token)
    selected_position = resolve_user_position(
        positions=positions,
        market_key=args.market_key,
        collateral_token=args.collateral_token,
    )

    market = selected_position["market"]
    graph_state = selected_position["state"]
    morpho_address = market["morphoBlueAddress"]
    onchain_position = morpho_position(args.rpc_url, morpho_address, market["uniqueKey"], user_address)
    onchain_market = morpho_market_state(args.rpc_url, morpho_address, market["uniqueKey"])

    current_borrow_shares = int(onchain_position["borrowShares"])
    if current_borrow_shares <= 0:
        raise ValueError("No borrow shares were found for this wallet and market.")

    estimated_current_borrow_assets = estimate_assets_from_shares(
        current_borrow_shares,
        int(onchain_market["totalBorrowAssets"]),
        int(onchain_market["totalBorrowShares"]),
        round_up=True,
    )
    if estimated_current_borrow_assets <= 0:
        raise ValueError("Estimated current borrow assets were zero. Refresh state and try again.")

    current_balance = erc20_balance_of(args.rpc_url, market["loanAsset"]["address"], user_address)
    current_allowance = erc20_allowance(args.rpc_url, market["loanAsset"]["address"], user_address, morpho_address)

    request: dict[str, Any]
    repay_transaction: dict[str, Any]
    approval_amount: int
    estimated_assets_required: int
    projected_repay_usd: float

    if args.amount is not None:
        amount_raw = int(parse_units(args.amount, int(market["loanAsset"]["decimals"])))
        if amount_raw <= 0:
            raise ValueError("Repay amount must be greater than zero.")
        if amount_raw > estimated_current_borrow_assets:
            raise ValueError("Requested repay amount exceeds current estimated debt. Use a smaller amount or --fraction 1.")

        request = {
            "mode": "assets",
            "amount": args.amount,
            "amountRaw": str(amount_raw),
            "loanToken": market["loanAsset"]["symbol"],
        }
        repay_transaction = build_repay_transaction(market, str(amount_raw), "0", user_address)
        approval_amount = amount_raw
        estimated_assets_required = amount_raw
        projected_repay_usd = float(args.amount)
    else:
        fraction = parse_fraction(args.fraction)
        numerator, denominator = fraction_to_parts(fraction)
        computed_shares = (current_borrow_shares * numerator) // denominator
        if computed_shares <= 0:
            raise ValueError("Computed repay shares were zero. Increase the fraction.")

        estimated_assets_required = estimate_assets_from_shares(
            computed_shares,
            int(onchain_market["totalBorrowAssets"]),
            int(onchain_market["totalBorrowShares"]),
            round_up=True,
        )
        approval_amount = estimated_assets_required + max(estimated_assets_required // 100, 1)
        request = {
            "mode": "shares",
            "fraction": fraction,
            "currentBorrowShares": str(current_borrow_shares),
            "repayShares": str(computed_shares),
            "estimatedAssetsRequired": str(estimated_assets_required),
            "approvalBufferAmount": str(approval_amount),
            "instruction": "Share-based repay is safer for full-position debt reduction because it avoids asset/share rounding drift.",
        }
        repay_transaction = build_repay_transaction(market, "0", str(computed_shares), user_address)
        projected_repay_usd = estimated_assets_required / (10 ** int(market["loanAsset"]["decimals"]))

    has_sufficient_balance = current_balance >= estimated_assets_required
    needs_approval = current_allowance < approval_amount

    approval: dict[str, str] | None = None
    approval_transaction: dict[str, Any] | None = None
    if needs_approval:
        approval = {
            "spender": morpho_address,
            "token": market["loanAsset"]["address"],
            "amount": str(approval_amount),
        }
        approval_transaction = build_approve_transaction(market["loanAsset"]["address"], morpho_address, str(approval_amount))

    post_action_risk_metrics = compute_risk_metrics(
        market=market,
        graph_state=graph_state,
        health_factor=selected_position["healthFactor"],
        price_variation_to_liquidation_price=selected_position["priceVariationToLiquidationPrice"],
        projected_additional_borrow_usd=-projected_repay_usd,
    )

    bankr_steps: list[tuple[str, dict[str, Any]]] = []
    if approval_transaction is not None:
        bankr_steps.append(
            (
                f"Approve {market['loanAsset']['symbol']} for Morpho Blue repayment",
                approval_transaction,
            )
        )
    bankr_steps.append(
        (
            f"Repay {market['loanAsset']['symbol']} debt on Morpho {market['title']}",
            repay_transaction,
        )
    )

    print_json(
        {
            "command": "repay-plan",
            "userAddress": user_address,
            "market": market,
            "graphState": graph_state,
            "liveState": {
                "rpcUrl": args.rpc_url,
                "currentTokenBalance": str(current_balance),
                "currentAllowance": str(current_allowance),
                "currentPosition": onchain_position,
                "currentMarketState": onchain_market,
                "estimatedCurrentBorrowAssets": str(estimated_current_borrow_assets),
            },
            "repayRequest": request,
            "executionReadiness": {
                "hasBorrowPosition": current_borrow_shares > 0,
                "hasSufficientBalance": has_sufficient_balance,
                "needsApproval": needs_approval,
                "readyToExecute": has_sufficient_balance,
            },
            "approval": approval,
            "bankrReady": {
                "endpoint": "POST /agent/submit",
                "steps": build_bankr_steps(bankr_steps),
            },
            "repayCall": {
                "chainId": BASE_CHAIN_ID,
                "to": morpho_address,
                "function": "repay((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv),uint256 assets,uint256 shares,address onBehalf,bytes data)",
                "args": {
                    "marketParams": {
                        "loanToken": market["loanAsset"]["address"],
                        "collateralToken": market["collateralAsset"]["address"],
                        "oracle": market["oracleAddress"],
                        "irm": market["irmAddress"],
                        "lltv": market["lltv"],
                    },
                    "assets": request.get("amountRaw", "0"),
                    "shares": request.get("repayShares", "0"),
                    "onBehalf": user_address,
                    "data": "0x",
                },
            },
            "repayTransaction": repay_transaction,
            "postActionRiskMetrics": post_action_risk_metrics,
            "riskNotes": build_risk_notes(market, "repay")
            + [
                "Repay is a safer first response than new borrowing when a position moves into warning or critical territory.",
                "After the transaction confirms, re-run alert-check before assuming the risk level has improved enough.",
            ],
        }
    )
    return 0


def add_collateral_plan_command(args: argparse.Namespace) -> int:
    loan_token = resolve_loan_token(args.loan_token)
    user_address = validate_address(args.from_address, "from-address")
    markets = fetch_markets(loan_token)
    user_positions = fetch_user_positions(user_address, loan_token)

    if args.market_key or args.collateral_token:
        market = resolve_market(markets=markets, market_key=args.market_key, collateral_token=args.collateral_token)
    else:
        selected_position = resolve_user_position(
            positions=user_positions,
            market_key=args.market_key,
            collateral_token=args.collateral_token,
        )
        market = selected_position["market"]

    amount_raw = int(parse_units(args.amount, int(market["collateralAsset"]["decimals"])))

    morpho_address = market["morphoBlueAddress"]
    current_balance = erc20_balance_of(args.rpc_url, market["collateralAsset"]["address"], user_address)
    current_allowance = erc20_allowance(args.rpc_url, market["collateralAsset"]["address"], user_address, morpho_address)
    current_position = morpho_position(args.rpc_url, morpho_address, market["uniqueKey"], user_address)

    matching_position = find_position_for_market(user_positions, market["uniqueKey"])
    graph_state = matching_position["state"] if matching_position is not None else {}
    health_factor = matching_position["healthFactor"] if matching_position is not None else None
    price_variation = matching_position["priceVariationToLiquidationPrice"] if matching_position is not None else None

    has_sufficient_balance = current_balance >= amount_raw
    needs_approval = current_allowance < amount_raw

    approval: dict[str, str] | None = None
    approval_transaction: dict[str, Any] | None = None
    if needs_approval:
        approval = {
            "spender": morpho_address,
            "token": market["collateralAsset"]["address"],
            "amount": str(amount_raw),
        }
        approval_transaction = build_approve_transaction(market["collateralAsset"]["address"], morpho_address, str(amount_raw))

    add_collateral_transaction = build_supply_collateral_transaction(market, str(amount_raw), user_address)
    estimated_added_collateral_usd = estimate_collateral_value_usd(
        market=market,
        graph_state=graph_state,
        collateral_assets_raw=amount_raw,
    )
    post_action_risk_metrics = None
    if matching_position is not None and estimated_added_collateral_usd is not None:
        post_action_risk_metrics = compute_risk_metrics(
            market=market,
            graph_state=graph_state,
            health_factor=health_factor,
            price_variation_to_liquidation_price=price_variation,
            projected_additional_collateral_usd=estimated_added_collateral_usd,
        )

    bankr_steps: list[tuple[str, dict[str, Any]]] = []
    if approval_transaction is not None:
        bankr_steps.append(
            (
                f"Approve {market['collateralAsset']['symbol']} for Morpho Blue collateral",
                approval_transaction,
            )
        )
    bankr_steps.append(
        (
            f"Add {args.amount} {market['collateralAsset']['symbol']} collateral to Morpho {market['title']}",
            add_collateral_transaction,
        )
    )

    print_json(
        {
            "command": "add-collateral-plan",
            "userAddress": user_address,
            "market": market,
            "graphState": graph_state,
            "liveState": {
                "rpcUrl": args.rpc_url,
                "currentTokenBalance": str(current_balance),
                "currentAllowance": str(current_allowance),
                "currentPosition": current_position,
            },
            "collateralRequest": {
                "amount": args.amount,
                "amountRaw": str(amount_raw),
                "collateralToken": market["collateralAsset"]["symbol"],
                "estimatedAddedCollateralUsd": estimated_added_collateral_usd,
            },
            "executionReadiness": {
                "hasSufficientBalance": has_sufficient_balance,
                "needsApproval": needs_approval,
                "readyToExecute": has_sufficient_balance,
            },
            "approval": approval,
            "bankrReady": {
                "endpoint": "POST /agent/submit",
                "steps": build_bankr_steps(bankr_steps),
            },
            "addCollateralCall": {
                "chainId": BASE_CHAIN_ID,
                "to": morpho_address,
                "function": "supplyCollateral((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv),uint256 assets,address onBehalf,bytes data)",
                "args": {
                    "marketParams": {
                        "loanToken": market["loanAsset"]["address"],
                        "collateralToken": market["collateralAsset"]["address"],
                        "oracle": market["oracleAddress"],
                        "irm": market["irmAddress"],
                        "lltv": market["lltv"],
                    },
                    "assets": str(amount_raw),
                    "onBehalf": user_address,
                    "data": "0x",
                },
            },
            "addCollateralTransaction": add_collateral_transaction,
            "postActionRiskMetrics": post_action_risk_metrics,
            "riskNotes": build_risk_notes(market, "add-collateral")
            + [
                "Adding collateral is usually safer than increasing borrow when the position is already under pressure.",
                "After the transaction confirms, re-run alert-check before assuming the liquidation buffer is wide enough.",
            ],
        }
    )
    return 0


def borrow_plan_command(args: argparse.Namespace) -> int:
    loan_token = resolve_loan_token(args.loan_token)
    user_address = validate_address(args.from_address, "from-address")
    positions = fetch_user_positions(user_address, loan_token)
    selected_position = resolve_user_position(
        positions=positions,
        market_key=args.market_key,
        collateral_token=args.collateral_token,
    )

    market = selected_position["market"]
    graph_state = selected_position["state"]
    collateral_usd = float(graph_state.get("collateralUsd") or 0)
    if collateral_usd <= 0:
        raise ValueError("No posted collateral was found for this wallet and market. Borrow planning requires an active collateral position.")

    amount_raw = parse_units(args.amount, int(market["loanAsset"]["decimals"]))
    requested_borrow_usd = float(args.amount)
    risk_metrics = compute_risk_metrics(
        market=market,
        graph_state=graph_state,
        health_factor=selected_position["healthFactor"],
        price_variation_to_liquidation_price=selected_position["priceVariationToLiquidationPrice"],
        projected_additional_borrow_usd=requested_borrow_usd,
    )

    projected_ltv_percent = risk_metrics["projectedLtvPercent"]
    max_ltv_percent = risk_metrics["maxLtvPercent"]
    recommended_ltv_percent = risk_metrics["recommendedMaxLtvPercent"]
    protocol_allows = projected_ltv_percent is not None and projected_ltv_percent < max_ltv_percent
    recommended_allows = projected_ltv_percent is not None and projected_ltv_percent <= recommended_ltv_percent

    print_json(
        {
            "command": "borrow-plan",
            "manualDecisionRequired": True,
            "executionPolicy": "manual-confirmation-required",
            "userAddress": user_address,
            "market": market,
            "graphState": graph_state,
            "healthFactor": selected_position["healthFactor"],
            "priceVariationToLiquidationPrice": selected_position["priceVariationToLiquidationPrice"],
            "borrowRequest": {
                "amount": args.amount,
                "amountRaw": amount_raw,
                "loanToken": market["loanAsset"]["symbol"],
                "assumption": "Borrowed fxUSD is treated as approximately 1 USD per unit for quick LTV planning.",
            },
            "riskMetrics": risk_metrics,
            "guardrails": {
                "protocolWouldAllowByLtv": protocol_allows,
                "recommendedByBuffer": recommended_allows,
                "recommendedAction": (
                    "Proceed only if you explicitly accept borrow risk and the projected LTV stays below the recommended buffer."
                    if recommended_allows
                    else "Do not auto-execute. Reduce borrow size, add collateral, or choose a safer market."
                ),
            },
            "borrowCall": {
                "chainId": BASE_CHAIN_ID,
                "to": market["morphoBlueAddress"],
                "function": "borrow((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv),uint256 assets,uint256 shares,address onBehalf,address receiver)",
                "args": {
                    "marketParams": {
                        "loanToken": market["loanAsset"]["address"],
                        "collateralToken": market["collateralAsset"]["address"],
                        "oracle": market["oracleAddress"],
                        "irm": market["irmAddress"],
                        "lltv": market["lltv"],
                    },
                    "assets": amount_raw,
                    "shares": "0",
                    "onBehalf": user_address,
                    "receiver": user_address,
                },
            },
            "borrowTransaction": build_borrow_transaction(market, amount_raw, user_address, user_address),
            "riskNotes": build_risk_notes(market, "borrow")
            + [
                "Borrowing should remain a user decision, not a default automation path.",
                "Track currentLtvPercent, recommendedMaxLtvPercent, healthFactor, and priceVariationToLiquidationPrice before every borrow.",
                "If projectedLtvPercent approaches the market LLTV, repay or add collateral before conditions worsen.",
            ],
        }
    )
    return 0


def suggest_borrow_size_command(args: argparse.Namespace) -> int:
    loan_token = resolve_loan_token(args.loan_token)
    user_address = validate_address(args.from_address, "from-address")
    positions = fetch_user_positions(user_address, loan_token)
    selected_position = resolve_user_position(
        positions=positions,
        market_key=args.market_key,
        collateral_token=args.collateral_token,
    )

    market = selected_position["market"]
    graph_state = selected_position["state"]
    collateral_usd = float(graph_state.get("collateralUsd") or 0)
    if collateral_usd <= 0:
        raise ValueError("No posted collateral was found for this wallet and market. Borrow sizing requires an active collateral position.")

    risk_metrics = compute_risk_metrics(
        market=market,
        graph_state=graph_state,
        health_factor=selected_position["healthFactor"],
        price_variation_to_liquidation_price=selected_position["priceVariationToLiquidationPrice"],
    )
    loan_decimals = int(market["loanAsset"]["decimals"])

    protocol_max_borrow_usd = risk_metrics["protocolHeadroomUsd"] or 0
    recommended_max_borrow_usd = risk_metrics["recommendedHeadroomUsd"] or 0
    risk_adjusted_max_borrow_usd = risk_metrics["riskAdjustedHeadroomUsd"] or 0

    risk_class = market["collateralRiskClass"]
    if risk_class == "altcoin-collateral":
        profile = "conservative-altcoin"
        suggested_borrow_usd = risk_adjusted_max_borrow_usd
        rationale = "Altcoin collateral can gap down quickly, so use the tighter risk-adjusted ceiling."
    elif risk_class == "bluechip-collateral":
        profile = "standard-bluechip"
        suggested_borrow_usd = recommended_max_borrow_usd
        rationale = "Blue-chip collateral still needs buffer, but can use the standard recommended ceiling."
    else:
        profile = "stable-collateral"
        suggested_borrow_usd = min(recommended_max_borrow_usd, risk_adjusted_max_borrow_usd)
        rationale = "Stable or correlated collateral can use a slightly higher ceiling, but still should not target protocol max."

    suggested_borrow_amount = format(Decimal(str(suggested_borrow_usd)).normalize(), "f")
    suggested_borrow_raw = parse_units(suggested_borrow_amount, loan_decimals) if suggested_borrow_usd > 0 else "0"

    print_json(
        {
            "command": "suggest-borrow-size",
            "userAddress": user_address,
            "market": market,
            "graphState": graph_state,
            "healthFactor": selected_position["healthFactor"],
            "priceVariationToLiquidationPrice": selected_position["priceVariationToLiquidationPrice"],
            "riskProfile": profile,
            "rationale": rationale,
            "riskMetrics": risk_metrics,
            "borrowSizing": {
                "protocolMaxAdditionalBorrowUsd": round(protocol_max_borrow_usd, 6),
                "recommendedMaxAdditionalBorrowUsd": round(recommended_max_borrow_usd, 6),
                "riskAdjustedMaxAdditionalBorrowUsd": round(risk_adjusted_max_borrow_usd, 6),
                "suggestedAdditionalBorrowUsd": round(suggested_borrow_usd, 6),
                "suggestedAdditionalBorrowAmount": suggested_borrow_amount,
                "suggestedAdditionalBorrowRaw": suggested_borrow_raw,
                "loanToken": market["loanAsset"]["symbol"],
            },
            "quickGuidance": [
                "Protocol max is not the target; use the suggestedAdditionalBorrowUsd output as the safer ceiling.",
                "If currentLtvPercent is already above recommendedMaxLtvPercent, suggestedAdditionalBorrowUsd should be treated as zero.",
                "Re-run this check before every borrow because collateral value and market parameters can move.",
            ],
        }
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Live Morpho market discovery and execution planning for the fxusd skill.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    discover_parser = subparsers.add_parser("discover", help="List live Morpho Blue markets for a loan token")
    discover_parser.add_argument("--loan-token", default="fxUSD", help="Loan token symbol or address. Default: %(default)s")
    discover_parser.set_defaults(handler=discover_command)

    recommend_parser = subparsers.add_parser("recommend", help="Rank Morpho supply markets for a loan token")
    recommend_parser.add_argument("--loan-token", default="fxUSD", help="Loan token symbol or address. Default: %(default)s")
    recommend_parser.add_argument("--limit", type=int, default=5, help="Number of results to return")
    recommend_parser.set_defaults(handler=recommend_command)

    position_parser = subparsers.add_parser("position-reads", help="Read current Morpho positions for a wallet")
    position_parser.add_argument("--rpc-url", default=BASE_RPC_URL, help="Base RPC URL. Default: %(default)s")
    position_parser.add_argument("--loan-token", default="fxUSD", help="Loan token symbol or address. Default: %(default)s")
    position_parser.add_argument("--from-address", required=True, help="Wallet address to inspect")
    position_parser.set_defaults(handler=position_reads_command)

    risk_parser = subparsers.add_parser("risk-check", help="Quick LTV and liquidation buffer check for Morpho positions")
    risk_parser.add_argument("--loan-token", default="fxUSD", help="Loan token symbol or address. Default: %(default)s")
    risk_parser.add_argument("--from-address", required=True, help="Wallet address to inspect")
    risk_parser.add_argument("--market-key", help="Exact Morpho market unique key")
    risk_parser.add_argument("--collateral-token", help="Collateral token symbol or address, for example wstETH")
    risk_parser.set_defaults(handler=risk_check_command)

    alert_parser = subparsers.add_parser(
        "alert-check",
        help="Evaluate Morpho positions against warning and critical risk thresholds for monitoring",
    )
    alert_parser.add_argument("--loan-token", default="fxUSD", help="Loan token symbol or address. Default: %(default)s")
    alert_parser.add_argument("--from-address", required=True, help="Wallet address to inspect")
    alert_parser.add_argument("--market-key", help="Exact Morpho market unique key")
    alert_parser.add_argument("--collateral-token", help="Collateral token symbol or address, for example BNKR")
    alert_parser.add_argument("--warning-health-factor", type=float, default=1.5, help="Warn when health factor is at or below this threshold")
    alert_parser.add_argument("--critical-health-factor", type=float, default=1.2, help="Critical alert when health factor is at or below this threshold")
    alert_parser.add_argument(
        "--warning-liquidation-distance-percent",
        type=float,
        default=30.0,
        help="Warn when estimated liquidation distance percent is at or below this threshold",
    )
    alert_parser.add_argument(
        "--critical-liquidation-distance-percent",
        type=float,
        default=12.0,
        help="Critical alert when estimated liquidation distance percent is at or below this threshold",
    )
    alert_parser.add_argument(
        "--warning-buffer-to-lltv-percent",
        type=float,
        default=12.0,
        help="Warn when the current buffer to LLTV percent is at or below this threshold",
    )
    alert_parser.add_argument(
        "--critical-buffer-to-lltv-percent",
        type=float,
        default=5.0,
        help="Critical alert when the current buffer to LLTV percent is at or below this threshold",
    )
    alert_parser.add_argument(
        "--fail-on",
        choices=["warning", "critical"],
        help="Return exit code 2 when the highest alert level meets or exceeds this severity",
    )
    alert_parser.set_defaults(handler=alert_check_command)

    repay_parser = subparsers.add_parser(
        "repay-plan",
        help="Build an execution-ready Morpho repay plan to reduce borrow risk",
    )
    repay_parser.add_argument("--rpc-url", default=BASE_RPC_URL, help="Base RPC URL. Default: %(default)s")
    repay_parser.add_argument("--loan-token", default="fxUSD", help="Loan token symbol or address. Default: %(default)s")
    repay_parser.add_argument("--from-address", required=True, help="Wallet address that owns the debt position")
    repay_parser.add_argument("--market-key", help="Exact Morpho market unique key")
    repay_parser.add_argument("--collateral-token", help="Collateral token symbol or address, for example BNKR")
    repay_amount_group = repay_parser.add_mutually_exclusive_group(required=True)
    repay_amount_group.add_argument("--amount", help="Human-readable asset amount to repay")
    repay_amount_group.add_argument("--fraction", help="Fraction of current borrow shares to repay, for example 0.5 or 1")
    repay_parser.set_defaults(handler=repay_plan_command)

    collateral_parser = subparsers.add_parser(
        "add-collateral-plan",
        help="Build an execution-ready Morpho collateral top-up plan",
    )
    collateral_parser.add_argument("--rpc-url", default=BASE_RPC_URL, help="Base RPC URL. Default: %(default)s")
    collateral_parser.add_argument("--loan-token", default="fxUSD", help="Loan token symbol or address. Default: %(default)s")
    collateral_parser.add_argument("--from-address", required=True, help="Wallet address that will add collateral")
    collateral_parser.add_argument("--market-key", help="Exact Morpho market unique key")
    collateral_parser.add_argument("--collateral-token", help="Collateral token symbol or address, for example BNKR")
    collateral_parser.add_argument("--amount", required=True, help="Human-readable collateral amount to add")
    collateral_parser.set_defaults(handler=add_collateral_plan_command)

    suggest_parser = subparsers.add_parser(
        "suggest-borrow-size",
        help="Suggest a safer maximum additional borrow size using collateral-aware buffers",
    )
    suggest_parser.add_argument("--loan-token", default="fxUSD", help="Loan token symbol or address. Default: %(default)s")
    suggest_parser.add_argument("--from-address", required=True, help="Wallet address that owns the collateral position")
    suggest_parser.add_argument("--market-key", help="Exact Morpho market unique key")
    suggest_parser.add_argument("--collateral-token", help="Collateral token symbol or address, for example BNKR")
    suggest_parser.set_defaults(handler=suggest_borrow_size_command)

    supply_parser = subparsers.add_parser("supply-plan", help="Build an execution-ready Morpho supply plan")
    supply_parser.add_argument("--rpc-url", default=BASE_RPC_URL, help="Base RPC URL. Default: %(default)s")
    supply_parser.add_argument("--loan-token", default="fxUSD", help="Loan token symbol or address. Default: %(default)s")
    supply_parser.add_argument("--from-address", required=True, help="Wallet address that will supply assets")
    supply_parser.add_argument("--amount", required=True, help="Human-readable amount to supply")
    supply_parser.add_argument("--market-key", help="Exact Morpho market unique key")
    supply_parser.add_argument("--collateral-token", help="Collateral token symbol or address, for example wstETH")
    supply_parser.set_defaults(handler=supply_plan_command)

    withdraw_parser = subparsers.add_parser("withdraw-plan", help="Build an execution-ready Morpho withdraw plan")
    withdraw_parser.add_argument("--rpc-url", default=BASE_RPC_URL, help="Base RPC URL. Default: %(default)s")
    withdraw_parser.add_argument("--loan-token", default="fxUSD", help="Loan token symbol or address. Default: %(default)s")
    withdraw_parser.add_argument("--from-address", required=True, help="Wallet address that owns the position")
    withdraw_parser.add_argument("--market-key", help="Exact Morpho market unique key")
    withdraw_parser.add_argument("--collateral-token", help="Collateral token symbol or address, for example wstETH")
    withdraw_parser.add_argument("--fraction", default="1", help="Fraction of supply shares to withdraw. Default: %(default)s")
    withdraw_parser.set_defaults(handler=withdraw_plan_command)

    borrow_parser = subparsers.add_parser("borrow-plan", help="Build a manual-decision Morpho borrow plan with LTV checks")
    borrow_parser.add_argument("--loan-token", default="fxUSD", help="Loan token symbol or address. Default: %(default)s")
    borrow_parser.add_argument("--from-address", required=True, help="Wallet address that owns the collateral position")
    borrow_parser.add_argument("--market-key", help="Exact Morpho market unique key")
    borrow_parser.add_argument("--collateral-token", help="Collateral token symbol or address, for example wstETH")
    borrow_parser.add_argument("--amount", required=True, help="Human-readable amount to borrow")
    borrow_parser.set_defaults(handler=borrow_plan_command)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return args.handler(args)
    except ValueError as error:
        print(json.dumps({"error": str(error)}, indent=2), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
