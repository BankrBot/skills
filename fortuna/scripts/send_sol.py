#!/usr/bin/env python3
"""
Fallback script for sending SOL to the FORTUNA treasury.

Only needed if your agent does not already have Solana transfer capabilities.
Requires SOLANA_PRIVATE_KEY environment variable and the solana + solders packages.
"""

import os
import sys

TREASURY = "BzHharnq5sa7TUWPSG1TysjwxuBVJchoU8CGRDmbLcfW"
TICKET_PRICE_SOL = 0.1
LAMPORTS_PER_SOL = 1_000_000_000


def main():
    # Parse arguments
    if len(sys.argv) < 2:
        print("Usage: send_sol.py <amount_in_sol>")
        print()
        print("Examples:")
        print("  send_sol.py 0.1     # 1 ticket")
        print("  send_sol.py 0.5     # 5 tickets")
        print("  send_sol.py 1.0     # 10 tickets")
        sys.exit(1)

    try:
        amount_sol = float(sys.argv[1])
    except ValueError:
        print(f"ERROR: Invalid amount: {sys.argv[1]}")
        sys.exit(1)

    if amount_sol < TICKET_PRICE_SOL:
        print(f"ERROR: Minimum amount is {TICKET_PRICE_SOL} SOL (1 ticket)")
        sys.exit(1)

    # Check for private key
    private_key = os.environ.get("SOLANA_PRIVATE_KEY")
    if not private_key:
        print("ERROR: SOLANA_PRIVATE_KEY environment variable not set")
        print("Set it to your base58-encoded private key")
        sys.exit(1)

    # Import Solana libraries
    try:
        from solana.rpc.api import Client
        from solana.transaction import Transaction
        from solders.keypair import Keypair
        from solders.pubkey import Pubkey
        from solders.system_program import TransferParams, transfer
    except ImportError:
        print("ERROR: Required packages not installed")
        print("Run: pip install solana solders")
        sys.exit(1)

    # Load keypair
    try:
        sender = Keypair.from_base58_string(private_key)
    except Exception as e:
        print(f"ERROR: Invalid private key: {e}")
        sys.exit(1)

    rpc_url = os.environ.get("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
    client = Client(rpc_url)

    # Check balance
    try:
        balance_resp = client.get_balance(sender.pubkey())
        balance_lamports = balance_resp.value
        balance_sol = balance_lamports / LAMPORTS_PER_SOL
    except Exception as e:
        print(f"ERROR: Failed to check balance: {e}")
        sys.exit(1)

    # Account for transaction fee (~0.000005 SOL)
    required_sol = amount_sol + 0.00001
    if balance_sol < required_sol:
        print(f"ERROR: Insufficient balance")
        print(f"  Balance:  {balance_sol:.6f} SOL")
        print(f"  Required: {required_sol:.6f} SOL")
        sys.exit(1)

    lamports = int(amount_sol * LAMPORTS_PER_SOL)
    tickets = int(amount_sol / TICKET_PRICE_SOL)

    print(f"Sending {amount_sol} SOL to FORTUNA treasury (~{tickets} tickets)...")

    # Build and send transaction
    try:
        ix = transfer(TransferParams(
            from_pubkey=sender.pubkey(),
            to_pubkey=Pubkey.from_string(TREASURY),
            lamports=lamports,
        ))

        txn = Transaction().add(ix)
        resp = client.send_transaction(txn, sender)
        sig = str(resp.value)

        print(f"Transaction sent: {sig}")
        print(f"Tickets: ~{tickets}")
        print(f"Amount: {amount_sol} SOL")
        print(f"Verify: https://solscan.io/tx/{sig}")
    except Exception as e:
        print(f"ERROR: Transaction failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
