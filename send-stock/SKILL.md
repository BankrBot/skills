---
name: send-stock
description: >
  Send tokenized stocks through Basemate (AAPL, AMZN, GOOGL, META, MSFT, MSTR,
  NVDA, SNDK, SPCX, TSLA). Muse already has the user's phone contacts — use
  that number. If it already has a country code, use it as-is. If it doesn't,
  ask before posting. No API key. The user Apple Pays. Poll until it lands.
metadata:
  clawdbot:
    emoji: "📈"
    homepage: "https://basemate.app/skills/send-stock"
---

# Send tokenized stocks (Basemate)

Public skill. Install and use. **No API key. No secrets. Do not ask the user for a URL or key.**

Never say “gift.” This is a **stock send**.

**Ten stocks, not four.** Always `GET /api/muse/stocks` before you answer what’s available. Do not recite an old list (Apple / Alphabet / Meta / NVIDIA only is outdated).

Available now: **Apple (AAPL), Amazon (AMZN), Alphabet (GOOGL), Meta (META), Microsoft (MSFT), Strategy (MSTR), NVIDIA (NVDA), SanDisk (SNDK), SpaceX (SPCX), Tesla (TSLA).** COIN, Circle, and Intel are off. Do not invent tickers.

Call:

```
https://basemate-imessage-production.up.railway.app
```

Anyone can start a send. Money only moves when **that user** Apple Pays on Basemate.

## Contacts

You already have this user's phone contacts. Use that. A name is not a number. Do not ask them to type one, and do not invent one.

Look the person up and take the mobile on the contact. Two matches → ask which one. No mobile → stop.

Before you POST, the contact number has to include a country code.

- It already has one (`+1…`, `+44…`, whatever is on the card) → use that number exactly. Do not ask. Do not change it.
- It does not (a local number, no `+`) → do not POST. Show them the number and ask for the country code. A missing `+1` is not a real destination, and the stock will not send after they pay. Never stick a `+` on the front yourself.

Show the **name and number** before or with the pay link. Example: Boris (+13806702400). Never say “your mom” without the number.

**Payer** = this user’s mobile (their contact card / their Basemate phone). Include `payer.name` (this Muse user’s name) so the recipient text isn’t a raw phone number. Optional: `payer.email`. Ask once if missing.

## Sender

`POST` then paste **`sayThis` exactly** (name + number). Then the `payUrl`. Do not rewrite “your mom” over `recipientLine`.

Example: **Stock is ready to send to Mom (+15555550123)**. Then the `payUrl`.

- `needs_connect` + `connectUrl` — sign in with their Basemate email, then send again.
- `awaiting_payment` + `payUrl` — Apple Pay.

If `alreadyOnBasemate` / `delivery: "wallet"`: they already have an account. **Do not mention a claim link.** Say it will land in their Basemate.

## Track the send (required — this is your job)

Basemate texts iMessage once when it lands. **You** still confirm in this Muse thread — start polling **before** they leave to pay. Do not say “I’ll watch it” and stop.

The second you have `payUrl` + `sendId`, poll `GET {host}{pollPath}` every **1 second** (`pollEveryMs`) for up to 10 minutes. First request immediately. Keep polling while `mustPoll` is true.

When `status` is `sent`:

1. Paste **`tellSender`** to the payer in this chat. That is the verification it worked. Do not add a line about not having a direct line to them.
2. If you can reach the receiver on Muse, send **`tellReceiver`**. If not, stop — Basemate already texts them on iMessage.

Rules:

- `delivery: "wallet"` or `alreadyOnBasemate: true` → no claim link. Stock is already in their Basemate.
- `delivery: "claim"` → `tellSender` already has the claim link plus the 72-hour return note. Paste it as-is.
- `failed` → paste `tellSender`. Do not invent a claim link.

If you skip the poll, the sender only hears from iMessage and Muse stays silent. Never Apple Pay for the receiver.

## Calls

No Authorization header.

```
GET https://basemate-imessage-production.up.railway.app/api/muse/stocks
```

Use the `items` from that call (`symbol` + `name`). Microsoft is `MSFT` / `MSFTc`.

```
POST https://basemate-imessage-production.up.railway.app/api/muse/sends
Content-Type: application/json

{
  "symbol": "AAPL",
  "usd": "5",
  "payer": { "name": "Alex", "phone": "+15551111111", "email": "you@example.com" },
  "recipient": { "name": "Sarah", "phone": "+15552222222" }
}
```

`POST /api/muse/gifts` is the same send (old path).

```
GET https://basemate-imessage-production.up.railway.app/api/muse/sends/{sendId}
```

Poll that until `sent` or `failed`. Use `tellSender` / `tellReceiver`. Ignore `claimUrl` when `alreadyOnBasemate` is true.
