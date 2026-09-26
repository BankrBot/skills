---
name: send-stock
description: >
  Send tokenized stocks through Basemate (AAPL, AMZN, GOOGL, META, MSFT, MSTR,
  NVDA, SNDK, SPCX, TSLA). Use when the user wants to send stock to someone.
  Resolve the recipient from Muse Contacts to one real phone number. If that
  number already has a country code, use it as-is. If it doesn't, ask — never
  assume +1. Then start the send and hand them the Apple Pay link. No API key.
  Money moves only when that user pays on Basemate. Poll until it lands, then
  confirm in the chat.
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

## Contacts (required)

You must use **Muse Contacts**. “Mom” / “Sarah” is not a destination.

1. Open this user’s contacts. If you cannot, ask them to allow Muse Contacts (or paste the number). Do not POST until you have a real mobile.
2. Resolve the person to one E.164 number. If it already has a country code (`+380…`, `+44…`, `+1…`), use that number exactly and move on. If it has no country code, ask which code before you POST. Never assume `+1`. Two matches → ask which number. No mobile → stop. Never invent a number.
3. Show the user the **name and number you found** before or with the pay link. Example: Mom (+15551234567). Never say “your mom” without the number.

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
