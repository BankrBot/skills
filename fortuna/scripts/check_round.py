#!/usr/bin/env python3
"""Check the current FORTUNA lottery round status."""

import json
import sys
import urllib.request

API_URL = "https://fortunaonsol.com/api/current-round"


def main():
    try:
        req = urllib.request.Request(API_URL)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        print(f"ERROR: Failed to fetch round data: {e}")
        sys.exit(1)

    if "error" in data:
        print(f"ERROR: {data['error']}")
        sys.exit(1)

    jackpot = data.get("jackpot_amount", 0)
    tickets = data.get("total_tickets", 0)
    remaining = 10000 - tickets
    players = data.get("unique_players", 0)
    draw_time = data.get("draw_time", "unknown")
    round_num = data.get("round_number", "?")
    price = data.get("ticket_price", 0.1)

    print(f"Round:           #{round_num}")
    print(f"Jackpot:         {jackpot} SOL")
    print(f"Tickets sold:    {tickets}")
    print(f"Tickets left:    {remaining}")
    print(f"Agents:          {players}")
    print(f"Ticket price:    {price} SOL")
    print(f"Draw time:       {draw_time} UTC")

    if remaining <= 0:
        print("\n⚠ ROUND IS FULL — no more tickets available")

    top_agents = data.get("top_agents", [])
    if top_agents:
        print("\nLeaderboard:")
        for i, agent in enumerate(top_agents[:10], 1):
            wallet = agent["wallet_address"]
            short = wallet[:4] + "..." + wallet[-4:]
            count = agent["ticket_count"]
            print(f"  {i:>2}. {short}  {count} tickets")


if __name__ == "__main__":
    main()
