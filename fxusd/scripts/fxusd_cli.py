#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from typing import Any


DEFAULT_BASE_URL = "http://localhost:3000"


@dataclass(frozen=True)
class Token:
    symbol: str
    address: str
    decimals: int


TOKEN_REGISTRY = {
    "fxUSD": Token("fxUSD", "0x55380fe7a1910dff29a47b622057ab4139da42c5", 18),
    "USDC": Token("USDC", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 6),
    "WETH": Token("WETH", "0x4200000000000000000000000000000000000006", 18),
    "fxSAVE": Token("fxSAVE", "0x273f20fa9fbe803e5d6959add9582dac240ec3be", 18),
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


def http_post_json(base_url: str, path: str, payload: dict[str, Any]) -> tuple[int, Any]:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url=f"{base_url.rstrip('/')}{path}",
        data=body,
        headers={"content-type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8")
        try:
            return error.code, json.loads(raw)
        except json.JSONDecodeError:
            return error.code, {"error": raw}


def resolve_token(args: argparse.Namespace, prefix: str) -> Token:
    preset_value = getattr(args, f"{prefix}_token", None)
    custom_address = getattr(args, f"{prefix}_address", None)
    custom_symbol = getattr(args, f"{prefix}_symbol", None)
    custom_decimals = getattr(args, f"{prefix}_decimals", None)

    if preset_value and preset_value != "custom":
        return TOKEN_REGISTRY[preset_value]

    if not custom_address or not custom_symbol or custom_decimals is None:
        raise ValueError(
            f"Custom {prefix} token requires --{prefix}-address, --{prefix}-symbol, and --{prefix}-decimals."
        )

    return Token(custom_symbol, custom_address, int(custom_decimals))


def print_json(payload: Any) -> None:
    print(json.dumps(payload, indent=2, sort_keys=True))


def mint_command(args: argparse.Namespace) -> int:
    source_token = resolve_token(args, "source")
    bundle_payload = {
        "amount": args.amount,
        "direction": "mint",
        "fromAddress": args.from_address,
        "receiver": args.receiver or args.from_address,
        "sourceTokenAddress": source_token.address,
        "sourceTokenSymbol": source_token.symbol,
        "sourceTokenDecimals": source_token.decimals,
    }
    approval_payload = {
        "amount": parse_units(args.amount, source_token.decimals),
        "fromAddress": args.from_address,
        "tokenAddress": source_token.address,
    }

    bundle_status, bundle_response = http_post_json(args.base_url, "/api/fxsave/fxsave-bundle", bundle_payload)
    approval_status, approval_response = http_post_json(
        args.base_url, "/api/fxsave/fxsave-approve", approval_payload
    )

    result = {
        "command": "mint",
        "baseUrl": args.base_url,
        "sourceToken": asdict(source_token),
        "bundleRequest": bundle_payload,
        "approvalRequest": approval_payload,
        "bundleStatus": bundle_status,
        "bundleResponse": bundle_response,
        "approvalStatus": approval_status,
        "approvalResponse": approval_response,
    }
    print_json(result)
    return 0 if bundle_status == 200 and approval_status == 200 else 1


def redeem_command(args: argparse.Namespace) -> int:
    source_token = TOKEN_REGISTRY["fxSAVE"]
    target_token = resolve_token(args, "target")
    bundle_payload = {
        "amount": args.amount,
        "direction": "redeem",
        "fromAddress": args.from_address,
        "receiver": args.receiver or args.from_address,
        "targetTokenAddress": target_token.address,
        "targetTokenSymbol": target_token.symbol,
        "targetTokenDecimals": target_token.decimals,
    }
    approval_payload = {
        "amount": parse_units(args.amount, source_token.decimals),
        "fromAddress": args.from_address,
        "tokenAddress": source_token.address,
    }

    bundle_status, bundle_response = http_post_json(args.base_url, "/api/fxsave/fxsave-bundle", bundle_payload)
    approval_status, approval_response = http_post_json(
        args.base_url, "/api/fxsave/fxsave-approve", approval_payload
    )

    result = {
        "command": "redeem",
        "baseUrl": args.base_url,
        "sourceToken": asdict(source_token),
        "targetToken": asdict(target_token),
        "bundleRequest": bundle_payload,
        "approvalRequest": approval_payload,
        "bundleStatus": bundle_status,
        "bundleResponse": bundle_response,
        "approvalStatus": approval_status,
        "approvalResponse": approval_response,
    }
    print_json(result)
    return 0 if bundle_status == 200 and approval_status == 200 else 1


def approval_command(args: argparse.Namespace) -> int:
    token = resolve_token(args, "approval")
    payload = {
        "amount": parse_units(args.amount, token.decimals),
        "fromAddress": args.from_address,
        "tokenAddress": token.address,
    }
    status, response = http_post_json(args.base_url, "/api/fxsave/fxsave-approve", payload)
    result = {
        "command": "approval",
        "baseUrl": args.base_url,
        "token": asdict(token),
        "request": payload,
        "status": status,
        "response": response,
    }
    print_json(result)
    return 0 if status == 200 else 1


def add_common_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="App base URL. Default: %(default)s")
    parser.add_argument("--from-address", required=True, help="Connected wallet address")
    parser.add_argument("--receiver", help="Receiver address. Defaults to from-address")
    parser.add_argument("--amount", required=True, help="Human-readable token amount, for example 1 or 0.5")


def add_token_arguments(parser: argparse.ArgumentParser, prefix: str, include_fxsave: bool = False) -> None:
    preset_choices = ["fxUSD", "USDC", "WETH", "custom"]
    if include_fxsave:
        preset_choices.insert(0, "fxSAVE")

    parser.add_argument(
        f"--{prefix}-token",
        choices=preset_choices,
        default=preset_choices[0],
        help=f"Preset {prefix} token symbol or custom",
    )
    parser.add_argument(f"--{prefix}-address", help=f"Custom {prefix} token address")
    parser.add_argument(f"--{prefix}-symbol", help=f"Custom {prefix} token symbol")
    parser.add_argument(f"--{prefix}-decimals", type=int, help=f"Custom {prefix} token decimals")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="CLI helper for the fxUSD skill over the fxSAVE Enso website APIs.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    mint_parser = subparsers.add_parser("mint", help="Preview mint bundle and approval plan")
    add_common_arguments(mint_parser)
    add_token_arguments(mint_parser, "source")
    mint_parser.set_defaults(handler=mint_command)

    redeem_parser = subparsers.add_parser("redeem", help="Preview redeem bundle and approval plan")
    add_common_arguments(redeem_parser)
    add_token_arguments(redeem_parser, "target")
    redeem_parser.set_defaults(handler=redeem_command)

    approval_parser = subparsers.add_parser("approval", help="Build approval payload only")
    add_common_arguments(approval_parser)
    approval_parser.add_argument(
        "--token",
        choices=["fxSAVE", "fxUSD", "USDC", "WETH", "custom"],
        default="fxSAVE",
        help="Preset token symbol or custom",
    )
    approval_parser.add_argument("--approval-address", help="Custom token address")
    approval_parser.add_argument("--approval-symbol", help="Custom token symbol")
    approval_parser.add_argument("--approval-decimals", type=int, help="Custom token decimals")
    approval_parser.set_defaults(approval_token=None)
    approval_parser.add_argument(
        "--approval-token",
        dest="approval_token",
        choices=["fxSAVE", "fxUSD", "USDC", "WETH", "custom"],
        help=argparse.SUPPRESS,
    )
    approval_parser.set_defaults(handler=approval_command)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if getattr(args, "command", None) == "approval":
        args.approval_token = args.approval_token or args.token

    try:
        return args.handler(args)
    except ValueError as error:
        print(json.dumps({"error": str(error)}, indent=2), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
