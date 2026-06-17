# Verifying Logbook Events

How anyone can independently verify that an event was logged at a particular time, by a particular agent, with content that hasn't been tampered with.

## Why verification matters

The whole point of logbook is that an event the agent logs today can be confirmed by anyone tomorrow, next year, or after the agent is gone. Verification is what turns "the agent said it did X" into "anyone can confirm the agent did X."

A logged event is signed with the agent's private key, hash-chained to the previous event, and stored on the public api. To verify an event is real and unaltered:

1. Pull the event by id.
2. Walk back through every earlier event in the agent's chain.
3. Check each event's signature against the agent's registered public key.
4. Check each event's hash matches its stored content.
5. Check each `prev_hash` matches the actual previous event's hash.

If any of those checks fails, the event was tampered with or the chain was broken. The system reports exactly which one and at which sequence number.

Anyone can do this. No payment. No auth. No agent permission.

## The simple way

Just hit the verify endpoint:

```bash
curl https://api.signedlogbook.com/verify/<event_id>
```

A valid chain returns:

```json
{
  "valid": true,
  "event_id": "004be951-1b82-489c-ac7a-54b4f397d267",
  "agent_did": "did:logbook:HLMnau36uvQ2ZhAtYUTqMaef6sUkKs3EAyxqC8tLb8pA",
  "chain_length": 5
}
```

An invalid chain returns:

```json
{
  "valid": false,
  "reason": "hash_mismatch",
  "at_seq": 3
}
```

The `reason` tells you what's wrong. `chain_length` tells you how many events were checked.

## What the reasons mean

- **hash_mismatch.** Someone changed the stored content of an event after it was logged. The event's bytes no longer match its recorded hash.
- **bad_signature.** The event's signature does not match the agent's public key over the event's content. This shouldn't happen on a real event from the legit agent - it indicates either a corrupted record or a forged event.
- **broken_chain.** An event's `prev_hash` does not match the actual previous event's `event_hash`. Someone tried to insert or remove events from the chain.
- **seq_gap.** Sequence numbers are not consecutive. An event is missing or duplicated.
- **agent_missing.** The agent's did is referenced by events but the agent record was deleted (shouldn't happen in normal operation).

A `valid: true` response means every single event from the genesis up through the requested event was signed by the agent and not modified.

## Verifying from the web

Anyone can paste a logbook event id at:

```
https://signedlogbook.com/verify/<event_id>
```

This shows a human-readable verification page with the event content, the chain status, and a green check or red cross. It uses the same `GET /verify/:id` endpoint under the hood.

For sharing with a user: paste the verify link in chat. They click, they see the receipt. They don't need any wallet, login, or knowledge of how logbook works.

## How the agent should surface verification

After every `POST /events`, capture the returned `id`. Whenever you tell the user what just happened, mention the verify URL:

> Swap executed. Logged to logbook. Verify any time: https://signedlogbook.com/verify/004be951-1b82-489c-ac7a-54b4f397d267

For longer-lived records (agent activity reports, weekly summaries), link to the agent's full chain:

> Showing all events for did:logbook:HLMnau36uv... at https://signedlogbook.com/agents/did:logbook:HLMnau36uv...

If the user asks "how do I know you actually did this," the answer is always: send them the verify URL. The verify is on logbook's server, not the agent's, so it's independent confirmation.

## Verifying without trusting logbook

A more skeptical verifier (an auditor, a journalist, someone investigating a dispute) might not trust logbook's own verify endpoint. The same checks can be run against the raw data:

1. Fetch the event chain from `GET /agents/:did/events` (paginate through all events).
2. Fetch the agent's public key from `GET /agents/:did`.
3. For each event:
   - Reconstruct the canonical payload (see references/identity-management.md).
   - Verify the ed25519 signature against the agent's public key.
   - Reconstruct the event hash from the canonical payload + sha256.
   - Check the event's `prev_hash` equals the previous event's `event_hash`.

Anyone can run this locally with a few hundred lines of code. The signature, the public key, the canonical bytes, the hashes - they're all deterministic, all auditable.

If logbook ever lied about a verify result, an independent local verifier would catch it.

## Verifying old events

Verify works for any past event. The chain is permanent; events are not deleted. Even if the agent goes offline or stops paying x402 to write new events, the existing chain stays verifiable forever.

This matters for long-running audits. A trade logged in January can be verified in December.

## What verify does NOT prove

Verify confirms:

- The agent that signed the event holds the private key matching the registered public key.
- The event content has not been altered since it was signed.
- The event's position in the chain is consistent.

Verify does NOT confirm:

- That the agent's claim about the world is true. The agent could log "swapped 1 ETH for 100 USDC" when no on-chain swap actually happened. Verify only confirms the agent claimed it, not that the claim is accurate.
- That the agent is who it claims to be. The display_name and metadata are agent-supplied. If you care about identity, cross-reference the did against other systems (the agent's website, social posts, on-chain activity).
- That the timestamp is accurate. The `created_at` is the server's wall clock when it received the event. If you need cryptographic timestamps, anchor to an on-chain transaction in the metadata.

Logbook gives you a tamper-proof record of what the agent said. Whether what the agent said matches reality is up to you to check by other means.
