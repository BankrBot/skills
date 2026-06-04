---
name: katch
description: Create, fund, monitor, and retrieve deliverables for Katch missions from Bankr agents. Use when the user wants to create paid photo or video collection missions, turn natural-language collection intent into a Katch draft, preview mission shape, fund a draft through the Bankr Wallet API, confirm publication status, or fetch accepted media deliverables. Uses the katch-mission-sdk package plus Bankr wallet signing and transaction submission.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🎯",
        "homepage": "https://katch.fyi",
        "requires": { "bins": ["node", "npm", "npx", "curl", "jq", "bankr"] },
      },
  }
---

# Katch Missions

Create paid Katch missions that ask real people to capture original photo or video evidence. Bankr agents use Katch for tasks such as "get a video of this venue", "collect photos of product displays", or "verify an event is happening", then fund the mission from the Bankr wallet and retrieve accepted deliverables.

Katch mission creation is a two-phase flow:

1. **Draft and preview** through `katch-mission-sdk`.
2. **Fund exactly the returned transaction** through Bankr Wallet API, then confirm the draft.

Do not hand-encode Katch funding calldata. The Katch API returns a short-lived, wallet-bound authorization; changing `to`, `data`, `value`, sender, reward amount, token, target count, nonce, deadline, creator, or signature breaks funding.

## When To Use

Use this skill when the user wants to:

- Create a paid mission for original photo or video collection.
- Generate a mission draft from natural language.
- Preview whether a mission shape is valid before funding.
- Fund a Katch mission using a Bankr wallet.
- Check whether a draft is pending funding, in review, published, rejected, or ready for deliverables.
- Fetch accepted media, verification notes, GPS metadata, and expiring media links after the mission is complete.

## Prerequisites

### Bankr API Key

The Bankr API key must have Wallet API write access because Katch needs both message signing and transaction submission:

```bash
bankr login email user@example.com
bankr login email user@example.com --code 123456 --accept-terms --key-name "Katch Mission Agent" --read-write
```

Set the key for scripts and SDK examples:

```bash
export BANKR_API_KEY=bk_...
```

Check wallet identity:

```bash
curl -sS https://api.bankr.bot/wallet/me \
  -H "X-API-Key: ${BANKR_API_KEY}" | jq
```

### Katch SDK

Install globally for CLI workflows:

```bash
npm install -g katch-mission-sdk
katch --help
```

Or use `npx` without global install:

```bash
npx -p katch-mission-sdk katch --help
```

### Bankr signer command

The CLI signs Katch API requests with `KATCH_SIGNER_COMMAND`. This skill includes `scripts/bankr-signer.mjs`, which signs only Katch request messages through Bankr `POST /wallet/sign`.

```bash
export KATCH_SIGNER_ADDRESS=0xYourBankrWallet
export KATCH_SIGNER_COMMAND="$PWD/katch/scripts/bankr-signer.mjs"
```

If creating a mission for a separate smart-account creator, set `KATCH_WALLET_ADDRESS` to that creator wallet and use a Katch-authorized Bankr signer as `KATCH_SIGNER_ADDRESS`.

## Mission Shape

Katch accepts this agent-friendly draft shape:

```json
{
  "missionType": "place_video",
  "title": "Film the storefront at Celeste",
  "description": "Capture a short original video showing the venue entrance, signage, and street context.",
  "mediaType": "video",
  "reward": { "token": "USDC", "amount": 10 },
  "targetCount": 1,
  "verification": {
    "accept": [
      "Video clearly shows the requested place or object",
      "Submission appears original and recently captured",
      "Required context is visible enough for review"
    ],
    "reject": [
      "Screenshots, stock media, or reused social posts",
      "Wrong place, object, or event",
      "Readable private information is visible"
    ]
  },
  "location": {
    "placeLabel": "Celeste, San Francisco",
    "visibility": { "center": { "lat": 37.7970183, "lng": -122.4348726 }, "radiusMeters": 80000 },
    "submission": { "center": { "lat": 37.7970183, "lng": -122.4348726 }, "radiusMeters": 120 }
  }
}
```

Supported mission types:

| Type | Media | Use For |
|---|---|---|
| `place_video` | video | A specific venue or location. Usually needs `location.submission`. |
| `object_photo` | photo | A visible object, sign, package, display, or place photo. Use this for "photo of a place"; there is no `place_photo`. |
| `egocentric_action_video` | video | A first-person action or task. |
| `retail_photo` | photo | Store shelf, product, menu, receipt-adjacent, or retail evidence. Avoid private data. |
| `event_video` | video | Time-bound gathering, event, or scene. |

Rewards must use `KATCH` or `USDC`. `reward.amount` is per accepted submission; total budget is `reward.amount * targetCount`.

## CLI Workflow

### 1. Generate or write mission JSON

For natural language generation, set `OPENAI_API_KEY` and provide coordinates for GPS-gated place missions. The generator does not geocode or invent lat/lng.

```bash
katch mission generate \
  --intent "Take a 15 second video of the Celeste wine bar storefront in San Francisco" \
  --mission-type place_video \
  --place-label "Celeste, 2165 Union St, San Francisco, CA" \
  --lat 37.7970183 \
  --lng -122.4348726 \
  --reward-token USDC \
  --reward-amount 10 > mission.json
```

### 2. Preview shape

Preview catches invalid types, unsafe missions, bad reward tokens, and shape suggestions before funding:

```bash
katch mission preview mission.json
```

Treat the normalized preview as the mission contract. Show the user material changes before creating or funding.

### 3. Create draft

Use a stable idempotency key. Retrying the same mission with the same key returns the existing draft; changing the mission with the same key returns an idempotency conflict.

```bash
katch mission create-draft mission.json --idempotency-key celeste-video-2026-05-29
```

For a single JSON-first path:

```bash
katch mission launch --mission mission.json > launch.json
```

The launch response includes the `draftId`, `fundingQuote`, exact funding transaction, authorization expiry, and the confirm command.

### 4. Fund with Bankr

Katch missions fund on World Chain (`chainId: 480`). Bankr submit must send the approval transaction first when allowance is unknown or too low, then send the Katch funding transaction exactly as returned. If the active Bankr wallet/key cannot submit on World Chain, stop after draft creation and hand the returned funding transaction to a wallet or treasury that can send on `chainId: 480`.

Use the included helper to convert the launch JSON into Bankr submit payloads:

```bash
scripts/bankr-funding-plan.mjs launch.json > bankr-plan.json
```

If you already checked allowance, pass it in base units:

```bash
scripts/bankr-funding-plan.mjs launch.json --allowance 0 > bankr-plan.json
```

Submit the approval if `approval.required` is `true` or `"unknown"`:

```bash
jq '.approval.submit' bankr-plan.json > approval-submit.json
curl -sS -X POST https://api.bankr.bot/wallet/submit \
  -H "X-API-Key: ${BANKR_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @approval-submit.json | jq
```

Then submit the Katch funding transaction:

```bash
jq '.funding.submit' bankr-plan.json > funding-submit.json
curl -sS -X POST https://api.bankr.bot/wallet/submit \
  -H "X-API-Key: ${BANKR_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @funding-submit.json | jq
```

The funding payload shape is:

```json
{
  "transaction": {
    "to": "0xMissionFactory",
    "chainId": 480,
    "value": "0",
    "data": "0x..."
  },
  "description": "Fund Katch mission with exact authorized calldata",
  "waitForConfirmation": true
}
```

### 5. Confirm and monitor

After the Bankr funding transaction is mined:

```bash
katch mission confirm draft_mabc1234_deadbeef
katch mission doctor draft_mabc1234_deadbeef
```

Useful next actions:

| `nextAction` | Meaning |
|---|---|
| `send_create_funded_mission_transaction` | Draft exists and needs funding. |
| `wait_for_funding_confirmation` | Funding was submitted; confirm or wait for indexing. |
| `wait_for_katch_review` | Katch is reviewing before publication. |
| `owner_lock_required` | Operator action required before publication. |
| `published` | Mission is live and can receive submissions. |
| `rejected` | Mission cannot continue as-is. Read `rejectionReason`. |

### 6. Fetch deliverables

When submissions are accepted:

```bash
katch mission deliverables draft_mabc1234_deadbeef --markdown
```

Deliverables include submission IDs, media URLs, expiry timestamps, verification notes, and GPS metadata. Media URLs are temporary; store durable references or reports before they expire.

## TypeScript SDK Workflow

Use this path when building a Bankr-native agent or service:

```ts
import {
  KatchMissionClient
} from "katch-mission-sdk";

const bankrWalletAddress = "0xBankrWalletAddress";
const signer = {
  address: bankrWalletAddress,
  async signMessage(input: string | { message: string }) {
    const message = typeof input === "string" ? input : input.message;
    const response = await fetch("https://api.bankr.bot/wallet/sign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.BANKR_API_KEY!
      },
      body: JSON.stringify({ signatureType: "personal_sign", message })
    });
    const body = await response.json();
    if (!response.ok || !body.success || !body.signature) {
      throw new Error(`Bankr signing failed: ${JSON.stringify(body)}`);
    }
    return body.signature;
  }
} as const;

const client = new KatchMissionClient({ signer });

const preview = await client.previewMission(mission);
if (preview.shapeReview?.fit === "poor") {
  throw new Error(`Revise mission before funding: ${JSON.stringify(preview.shapeReview.suggestions)}`);
}

const draft = await client.createDraft(mission, {
  idempotencyKey: "celeste-video-2026-05-29"
});

// Submit draft.fundingQuote.calldata through Bankr /wallet/submit, after token approval if needed.
// Use the CLI launch response or scripts/bankr-funding-plan.mjs for ready-to-submit payloads.
const funded = await client.confirmFunding(draft.draftId);
console.log(funded.nextAction);
```

Katch API authentication signs plain request messages, so the Bankr signer uses `signatureType: "personal_sign"`.

## Safety Rules

- Preview before creating or funding unless the user explicitly asks for a low-level draft call.
- Never fund a mission that requests secrets, IDs, medical data, financial data, private addresses, faces of bystanders, or readable private customer information.
- Do not use unsupported reward tokens. Use only `KATCH` or `USDC`.
- For place missions, ask for exact coordinates or use a trusted geocoder outside this skill; do not invent lat/lng.
- Check `authorization.expiresAt` before submitting through Bankr. If expiry is close, recreate or refetch the draft.
- Use exact-budget approvals by default. Unlimited approvals are convenient but increase spender risk.
- Confirm funding after Bankr returns a transaction hash. Do not assume a draft is published immediately after funding.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Read-only API key` from Bankr | Create or switch to a Bankr key with Wallet API write access. |
| `missing_idempotency_key` | Pass `--idempotency-key` or use `mission launch`, which manages the guided flow. |
| `idempotency_conflict` | Reuse the original mission for that key or choose a new key. |
| `unsupported reward token` | Change `reward.token` to `KATCH` or `USDC`. |
| `place_video missions require lat/lng` | Add `--lat`, `--lng`, and `--place-label`, or write `location.submission` manually. |
| Allowance too low | Submit the approval transaction before the Katch funding transaction. |
| Authorization expired | Rerun `katch mission launch` and submit the fresh returned transaction. |
| Unsure next step | Run `katch mission doctor <draftId> --skip-deliverables`. |

## Resources

- Katch SDK package: `katch-mission-sdk`
- Katch API base: `https://api.katch.fyi/api`
- Bankr API base: `https://api.bankr.bot`
- Funding chain: World Chain (`chainId: 480`)
