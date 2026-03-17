#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.error
import urllib.request
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any


API_BASE = "https://api.hydrex.fi/strategies"
BASE_RPC_URL = os.environ.get("BASE_RPC_URL", "https://mainnet.base.org")
USER_AGENT = "fxusd-hydrex/0.1 (+https://github.com/huwangtao123/fxsave-dapp)"
DEPOSIT_GUARD = "0x9A0EBEc47c85fD30F1fdc90F57d2b178e84DC8d8"
VAULT_DEPLOYER = "0x7d11De61c219b70428Bb3199F0DD88bA9E76bfEE"
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
    "BNKR": Token("BNKR", "0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b", 18),
    "HYDX": Token("HYDX", "0x00000e7efa313F4E11Bfff432471eD9423AC6B30", 18),
}
TOKEN_BY_ADDRESS = {token.address.lower(): token for token in TOKEN_REGISTRY.values()}
KNOWN_STABLE_SYMBOLS = {
    "FXUSD",
    "USDC",
    "USDT",
    "DAI",
    "USDS",
    "USDE",
    "USD+",
    "FRAX",
    "PYUSD",
    "SUSDE",
}


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


def request_json(url: str) -> Any:
    last_error: Exception | None = None
    for delay in (0.0, 0.5, 1.0):
        if delay:
            time.sleep(delay)
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code != 429:
                raise
    if last_error is not None:
        raise last_error
    raise ValueError("Unexpected request failure.")


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


def validate_address(value: str, field_name: str) -> str:
    if not ADDRESS_RE.match(value):
        raise ValueError(f"Invalid {field_name}: {value}")
    return value


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


def resolve_deposit_token(value: str | None) -> str | None:
    if not value:
        return None

    preset = TOKEN_REGISTRY.get(value)
    if preset:
        return preset.address

    return value


def pad_hex(value: str) -> str:
    return value[2:].lower().rjust(64, "0")


def encode_uint256(value: int | str) -> str:
    return hex(int(value))[2:].rjust(64, "0")


def encode_call(selector: str, words: list[str]) -> str:
    return f"{selector}{''.join(words)}"


def build_approve_transaction(token: str, spender: str, amount: str) -> dict[str, Any]:
    data = encode_call("0x095ea7b3", [pad_hex(spender), encode_uint256(amount)])
    return {
        "to": token,
        "chainId": 8453,
        "value": "0",
        "data": data,
    }


def build_hydrex_deposit_transaction(
    vault: str,
    token: str,
    amount: str,
    user_address: str,
) -> dict[str, Any]:
    data = encode_call(
        "0x5d123e3f",
        [
            pad_hex(vault),
            pad_hex(VAULT_DEPLOYER),
            pad_hex(token),
            encode_uint256(amount),
            encode_uint256(0),
            pad_hex(user_address),
        ],
    )
    return {
        "to": DEPOSIT_GUARD,
        "chainId": 8453,
        "value": "0",
        "data": data,
    }


def build_hydrex_withdraw_transaction(
    vault: str,
    shares: str,
    user_address: str,
) -> dict[str, Any]:
    data = encode_call(
        "0x1a0e8cdf",
        [
            pad_hex(vault),
            pad_hex(VAULT_DEPLOYER),
            encode_uint256(shares),
            pad_hex(user_address),
            encode_uint256(0),
            encode_uint256(0),
        ],
    )
    return {
        "to": DEPOSIT_GUARD,
        "chainId": 8453,
        "value": "0",
        "data": data,
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


def erc20_balance_of(rpc_url: str, contract: str, owner: str) -> int:
    data = f"0x70a08231{pad_hex(owner)}"
    return int(rpc_call(rpc_url, contract, data), 16)


def erc20_allowance(rpc_url: str, contract: str, owner: str, spender: str) -> int:
    data = f"0xdd62ed3e{pad_hex(owner)}{pad_hex(spender)}"
    return int(rpc_call(rpc_url, contract, data), 16)


def erc20_total_supply(rpc_url: str, contract: str) -> int:
    data = "0x18160ddd"
    return int(rpc_call(rpc_url, contract, data), 16)


def build_live_share_state(rpc_url: str, vault: str, user_address: str) -> dict[str, str]:
    balance = erc20_balance_of(rpc_url, vault, user_address)
    allowance = erc20_allowance(rpc_url, vault, user_address, DEPOSIT_GUARD)
    total_supply = erc20_total_supply(rpc_url, vault)
    return {
        "rpcUrl": rpc_url,
        "currentLpShares": str(balance),
        "currentAllowance": str(allowance),
        "currentTotalSupply": str(total_supply),
    }


def fetch_strategies(deposit_token: str | None = None) -> list[dict[str, Any]]:
    query = {"strategist": "ichi"}
    if deposit_token:
        query["depositTokens"] = deposit_token

    url = f"{API_BASE}?{urllib.parse.urlencode(query)}"
    payload = request_json(url)
    if not isinstance(payload, list):
        raise ValueError("Unexpected Hydrex API response.")
    return payload


def infer_pair_symbol(title: str | None, deposit_symbol: str | None) -> str | None:
    if not title or "/" not in title:
        return None

    left, right = [part.strip() for part in title.split("/", 1)]
    if deposit_symbol and left.upper() == deposit_symbol.upper():
        return right
    if deposit_symbol and right.upper() == deposit_symbol.upper():
        return left
    return right


def classify_farming_type(
    *,
    title: str | None,
    deposit_symbol: str | None,
    tags: list[Any],
) -> tuple[str, str | None, str]:
    pair_symbol = infer_pair_symbol(title, deposit_symbol)
    normalized_pair = pair_symbol.upper() if pair_symbol else None
    normalized_tags = {str(tag).lower() for tag in tags}

    if (
        "stable" in normalized_tags
        or "correlated" in normalized_tags
        or (normalized_pair is not None and normalized_pair in KNOWN_STABLE_SYMBOLS)
    ):
        return (
            "stablecoin-farming",
            pair_symbol,
            "Counter-asset is stable or highly correlated, so pair volatility risk is lower.",
        )

    return (
        "crypto-farming",
        pair_symbol,
        "Counter-asset is crypto or non-correlated, so pair volatility and withdrawal-shape risk are higher.",
    )


def normalize_strategy(strategy: dict[str, Any]) -> dict[str, Any]:
    deposit_address = str(strategy.get("depositToken", ""))
    token = TOKEN_BY_ADDRESS.get(deposit_address.lower())
    title = strategy.get("title")
    tags = strategy.get("tags", [])
    farming_type, pair_symbol, farming_reason = classify_farming_type(
        title=title,
        deposit_symbol=token.symbol if token else None,
        tags=tags,
    )
    return {
        "address": strategy.get("address"),
        "title": title,
        "depositToken": deposit_address,
        "depositTokenSymbol": token.symbol if token else deposit_address,
        "depositTokenDecimals": token.decimals if token else None,
        "pairTokenSymbol": pair_symbol,
        "farmingType": farming_type,
        "farmingRiskSummary": farming_reason,
        "childApr": strategy.get("childApr"),
        "tvlUsd": strategy.get("tvlUsd"),
        "riskLevel": strategy.get("riskLevel"),
        "riskDescription": strategy.get("riskDescription"),
        "tags": tags,
        "website": strategy.get("website"),
        "type": strategy.get("type"),
    }


def rank_strategy(strategy: dict[str, Any]) -> tuple[float, list[str]]:
    apr = float(strategy.get("childApr") or 0)
    tvl = float(strategy.get("tvlUsd") or 0)
    risk_level = float(strategy.get("riskLevel") or 10)
    tags = {str(tag).lower() for tag in strategy.get("tags", [])}

    score = 0.0
    reasons: list[str] = []

    score += min(apr, 40)
    if apr > 0:
        reasons.append(f"APR {apr:.2f}%")

    if tvl > 0:
        tvl_component = min(math.log10(tvl + 1) * 8, 28)
        score += tvl_component
        reasons.append(f"TVL ${tvl:,.2f}")

    stable_bonus = 0
    if "safe" in tags:
        stable_bonus += 10
    if "stable" in tags:
        stable_bonus += 8
    if "correlated" in tags:
        stable_bonus += 6
    if stable_bonus:
        score += stable_bonus
        reasons.append("stable/correlated setup")

    if strategy.get("farmingType") == "stablecoin-farming":
        score += 6
        reasons.append("stablecoin farming bonus")
    else:
        score -= 6
        reasons.append("crypto farming penalty")

    if "exotic" in tags:
        score -= 10
        reasons.append("exotic pair penalty")

    score -= risk_level * 5
    reasons.append(f"risk level {risk_level:g}")

    if tvl < 1000:
        score -= 8
        reasons.append("low TVL penalty")

    return score, reasons


def resolve_strategy(
    strategies: list[dict[str, Any]],
    *,
    vault_address: str | None,
    vault_title: str | None,
) -> dict[str, Any]:
    if not vault_address and not vault_title:
        raise ValueError("Provide --vault-address or --vault-title.")

    matches: list[dict[str, Any]] = []
    for strategy in strategies:
        address_match = vault_address and str(strategy.get("address", "")).lower() == vault_address.lower()
        title_match = vault_title and str(strategy.get("title", "")).lower() == vault_title.lower()
        if address_match or title_match:
            matches.append(strategy)

    if not matches:
        raise ValueError("No matching Hydrex strategy found.")
    if len(matches) > 1:
        raise ValueError("Multiple strategies matched. Use the vault address for an exact match.")
    return matches[0]


def build_risk_notes(strategy: dict[str, Any]) -> list[str]:
    notes = [
        "Single-sided entry does not guarantee single-token exit.",
        "Hydrex vault withdrawals can return a mixed token composition.",
        "APR and TVL are live estimates and can change quickly.",
    ]
    if strategy.get("farmingType") == "stablecoin-farming":
        notes.append("This is stablecoin farming, so pair volatility risk is lower than crypto-farming vaults.")
    else:
        notes.append("This is crypto farming, so pair volatility and withdrawal-shape risk are materially higher.")
    risk_description = strategy.get("riskDescription")
    if isinstance(risk_description, str) and risk_description:
        notes.append(risk_description)
    return notes


def print_json(payload: Any) -> None:
    print(json.dumps(payload, indent=2, sort_keys=True))


def recommend_strategies(strategies: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ranked: list[dict[str, Any]] = []
    for strategy in strategies:
        entry = normalize_strategy(strategy)
        score, reasons = rank_strategy(entry)
        entry["score"] = round(score, 2)
        entry["reasons"] = reasons
        ranked.append(entry)
    ranked.sort(key=lambda item: item["score"], reverse=True)
    return ranked


def discover_command(args: argparse.Namespace) -> int:
    strategies = fetch_strategies(resolve_deposit_token(args.deposit_token))
    normalized = [normalize_strategy(strategy) for strategy in strategies]
    summary = {
        "stablecoinFarming": sum(1 for strategy in normalized if strategy["farmingType"] == "stablecoin-farming"),
        "cryptoFarming": sum(1 for strategy in normalized if strategy["farmingType"] == "crypto-farming"),
    }
    print_json(
        {
            "command": "discover",
            "count": len(normalized),
            "depositTokenFilter": args.deposit_token,
            "summary": summary,
            "strategies": normalized,
        }
    )
    return 0


def recommend_command(args: argparse.Namespace) -> int:
    strategies = fetch_strategies(resolve_deposit_token(args.deposit_token))
    normalized = recommend_strategies(strategies)
    print_json(
        {
            "command": "recommend",
            "depositTokenFilter": args.deposit_token,
            "top": normalized[: args.limit],
        }
    )
    return 0


def deposit_plan_command(args: argparse.Namespace) -> int:
    strategies = fetch_strategies(resolve_deposit_token(args.deposit_token))
    selection_mode = "exact"
    selection_reasons: list[str] = []
    if args.vault_address or args.vault_title:
        strategy = normalize_strategy(
            resolve_strategy(strategies, vault_address=args.vault_address, vault_title=args.vault_title)
        )
    else:
        if not args.deposit_token:
            raise ValueError("Provide --deposit-token when auto-selecting the best vault.")
        ranked = recommend_strategies(strategies)
        if not ranked:
            raise ValueError("No Hydrex strategies found for the requested token.")
        strategy = ranked[0]
        selection_mode = "recommended"
        selection_reasons = strategy.get("reasons", [])

    decimals = strategy["depositTokenDecimals"]
    if decimals is None and args.token_decimals is None:
        raise ValueError("Token decimals were unknown. Supply --token-decimals.")
    resolved_decimals = decimals if decimals is not None else args.token_decimals
    amount_raw = parse_units(args.amount, resolved_decimals)
    user_address = validate_address(args.from_address, "from-address")
    live_balance = erc20_balance_of(args.rpc_url, strategy["depositToken"], user_address)
    live_allowance = erc20_allowance(args.rpc_url, strategy["depositToken"], user_address, DEPOSIT_GUARD)
    needs_approval = live_allowance < int(amount_raw)
    has_sufficient_balance = live_balance >= int(amount_raw)
    approval: dict[str, str] | None = None
    approval_transaction: dict[str, Any] | None = None
    if needs_approval:
        approval = {
            "spender": DEPOSIT_GUARD,
            "token": strategy["depositToken"],
            "amount": amount_raw,
        }
        approval_transaction = build_approve_transaction(strategy["depositToken"], DEPOSIT_GUARD, amount_raw)

    deposit_transaction = build_hydrex_deposit_transaction(
        strategy["address"],
        strategy["depositToken"],
        amount_raw,
        user_address,
    )
    bankr_steps: list[tuple[str, dict[str, Any]]] = []
    if approval_transaction is not None:
        bankr_steps.append(
            (
                f"Approve {strategy['depositTokenSymbol']} for Hydrex Deposit Guard",
                approval_transaction,
            )
        )
    bankr_steps.append(
        (
            f"Deposit {args.amount} {strategy['depositTokenSymbol']} into Hydrex {strategy['title']}",
            deposit_transaction,
        )
    )

    print_json(
        {
            "command": "deposit-plan",
            "selectionMode": selection_mode,
            "selectionReasons": selection_reasons,
            "userAddress": user_address,
            "strategy": strategy,
            "liveState": {
                "rpcUrl": args.rpc_url,
                "currentTokenBalance": str(live_balance),
                "currentAllowance": str(live_allowance),
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
            "depositCall": {
                "chainId": 8453,
                "to": DEPOSIT_GUARD,
                "function": "forwardDepositToICHIVault(address vault, address vaultDeployer, address token, uint256 amount, uint256 minimumShares, address userAddress)",
                "args": {
                    "vault": strategy["address"],
                    "vaultDeployer": VAULT_DEPLOYER,
                    "token": strategy["depositToken"],
                    "amount": amount_raw,
                    "minimumShares": "0",
                    "userAddress": user_address,
                },
            },
            "depositTransaction": deposit_transaction,
            "riskNotes": build_risk_notes(strategy),
        }
    )
    return 0


def withdraw_plan_command(args: argparse.Namespace) -> int:
    strategies = fetch_strategies(resolve_deposit_token(args.deposit_token))
    strategy = normalize_strategy(
        resolve_strategy(strategies, vault_address=args.vault_address, vault_title=args.vault_title)
    )
    user_address = validate_address(args.from_address, "from-address")
    live_state = build_live_share_state(args.rpc_url, strategy["address"], user_address)

    share_plan: dict[str, Any]
    shares_raw: str
    if args.shares:
        shares_raw = args.shares
        share_plan = {"mode": "shares", "shares": args.shares}
    elif args.fraction:
        numerator, denominator = fraction_to_parts(args.fraction)
        computed_shares = (int(live_state["currentLpShares"]) * numerator) // denominator
        shares_raw = str(computed_shares)
        share_plan = {
            "mode": "fraction",
            "fraction": parse_fraction(args.fraction),
            "currentLpShares": live_state["currentLpShares"],
            "computedShares": shares_raw,
            "instruction": "Computed from the live LP share balance on Base.",
        }
    else:
        raise ValueError("Provide --shares or --fraction.")

    if int(shares_raw) <= 0:
        raise ValueError("No withdrawable LP shares were found for this wallet and vault.")

    approval: dict[str, str] | None = None
    approval_transaction: dict[str, Any] | None = None
    if int(live_state["currentAllowance"]) < int(shares_raw):
        approval = {
            "spender": DEPOSIT_GUARD,
            "token": strategy["address"],
            "amount": shares_raw,
        }
        approval_transaction = build_approve_transaction(strategy["address"], DEPOSIT_GUARD, shares_raw)

    withdraw_transaction = build_hydrex_withdraw_transaction(strategy["address"], shares_raw, user_address)
    bankr_steps: list[tuple[str, dict[str, Any]]] = []
    if approval_transaction is not None:
        bankr_steps.append(
            (
                f"Approve Hydrex vault shares for {strategy['title']} withdrawal",
                approval_transaction,
            )
        )
    bankr_steps.append(
        (
            f"Withdraw from Hydrex {strategy['title']}",
            withdraw_transaction,
        )
    )

    print_json(
        {
            "command": "withdraw-plan",
            "userAddress": user_address,
            "strategy": strategy,
            "liveState": live_state,
            "sharePlan": share_plan,
            "reads": [
                {
                    "contract": strategy["address"],
                    "function": "balanceOf(address)",
                    "args": [user_address],
                    "purpose": "Get current LP share balance",
                },
                {
                    "contract": strategy["address"],
                    "function": "allowance(address,address)",
                    "args": [user_address, DEPOSIT_GUARD],
                    "purpose": "Check LP token allowance",
                },
            ],
            "approval": approval,
            "bankrReady": {
                "endpoint": "POST /agent/submit",
                "steps": build_bankr_steps(bankr_steps),
            },
            "withdrawCall": {
                "chainId": 8453,
                "to": DEPOSIT_GUARD,
                "function": "forwardWithdrawFromICHIVault(address vault, address vaultDeployer, uint256 shares, address userAddress, uint256 minAmount0, uint256 minAmount1)",
                "args": {
                    "vault": strategy["address"],
                    "vaultDeployer": VAULT_DEPLOYER,
                    "shares": shares_raw,
                    "userAddress": user_address,
                    "minAmount0": "0",
                    "minAmount1": "0",
                },
            },
            "withdrawTransaction": withdraw_transaction,
            "riskNotes": build_risk_notes(strategy),
        }
    )
    return 0


def position_reads_command(args: argparse.Namespace) -> int:
    strategies = fetch_strategies(resolve_deposit_token(args.deposit_token))
    strategy = normalize_strategy(
        resolve_strategy(strategies, vault_address=args.vault_address, vault_title=args.vault_title)
    )
    user_address = validate_address(args.from_address, "from-address")
    live_state = build_live_share_state(args.rpc_url, strategy["address"], user_address)

    print_json(
        {
            "command": "position-reads",
            "userAddress": user_address,
            "strategy": strategy,
            "liveState": live_state,
            "reads": [
                {
                    "contract": strategy["address"],
                    "function": "balanceOf(address)",
                    "args": [user_address],
                    "purpose": "Current LP share balance",
                },
                {
                    "contract": strategy["address"],
                    "function": "allowance(address,address)",
                    "args": [user_address, DEPOSIT_GUARD],
                    "purpose": "Current LP token allowance to Deposit Guard",
                },
                {
                    "contract": strategy["address"],
                    "function": "totalSupply()",
                    "args": [],
                    "purpose": "Vault share supply context",
                },
            ],
            "riskNotes": build_risk_notes(strategy),
        }
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Live Hydrex vault discovery and execution planning for the fxusd skill.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    discover_parser = subparsers.add_parser("discover", help="List live Hydrex single-sided strategies")
    discover_parser.add_argument("--deposit-token", help="Token symbol or address filter, for example fxUSD")
    discover_parser.set_defaults(handler=discover_command)

    recommend_parser = subparsers.add_parser("recommend", help="Rank Hydrex strategies for a deposit token")
    recommend_parser.add_argument("--deposit-token", required=True, help="Token symbol or address, for example fxUSD")
    recommend_parser.add_argument("--limit", type=int, default=5, help="Number of results to return")
    recommend_parser.set_defaults(handler=recommend_command)

    deposit_parser = subparsers.add_parser("deposit-plan", help="Build a Hydrex deposit execution plan")
    deposit_parser.add_argument("--from-address", required=True, help="User wallet address on Base")
    deposit_parser.add_argument("--amount", required=True, help="Human-readable deposit amount")
    deposit_parser.add_argument("--deposit-token", help="Optional live API token filter, for example fxUSD")
    deposit_parser.add_argument("--vault-address", help="Exact vault address")
    deposit_parser.add_argument("--vault-title", help="Exact vault title, for example fxUSD/USDC")
    deposit_parser.add_argument("--token-decimals", type=int, help="Override decimals if token metadata is unknown")
    deposit_parser.add_argument("--rpc-url", default=BASE_RPC_URL, help="Base RPC URL for live token balance and allowance reads")
    deposit_parser.set_defaults(handler=deposit_plan_command)

    withdraw_parser = subparsers.add_parser("withdraw-plan", help="Build a Hydrex withdrawal execution plan")
    withdraw_parser.add_argument("--from-address", required=True, help="User wallet address on Base")
    withdraw_parser.add_argument("--deposit-token", help="Optional live API token filter, for example fxUSD")
    withdraw_parser.add_argument("--vault-address", help="Exact vault address")
    withdraw_parser.add_argument("--vault-title", help="Exact vault title, for example fxUSD/USDC")
    withdraw_parser.add_argument("--shares", help="Raw LP shares to withdraw")
    withdraw_parser.add_argument("--fraction", help="Fraction of current LP shares to withdraw, for example 0.5")
    withdraw_parser.add_argument("--rpc-url", default=BASE_RPC_URL, help="Base RPC URL for live LP share reads")
    withdraw_parser.set_defaults(handler=withdraw_plan_command)

    position_parser = subparsers.add_parser("position-reads", help="Build the read plan for a Hydrex position")
    position_parser.add_argument("--from-address", required=True, help="User wallet address on Base")
    position_parser.add_argument("--deposit-token", help="Optional live API token filter, for example fxUSD")
    position_parser.add_argument("--vault-address", help="Exact vault address")
    position_parser.add_argument("--vault-title", help="Exact vault title, for example fxUSD/USDC")
    position_parser.add_argument("--rpc-url", default=BASE_RPC_URL, help="Base RPC URL for live LP share reads")
    position_parser.set_defaults(handler=position_reads_command)

    return parser


def main(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.handler(args)
    except Exception as error:
        print_json({"error": str(error)})
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
