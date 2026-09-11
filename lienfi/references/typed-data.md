# The typed data you sign

Three EIP-712 envelopes, all signed by YOUR wallet with `eth_signTypedData_v4`
(`POST https://api.bankr.bot/wallet/sign`). Every one has the same domain:

```json
{ "name": "LienFi", "version": "1", "chainId": 8453 }
```

`chainId` is Base mainnet and LienFi pins every signature to it — a signature made
for another network is refused with nothing to suggest the network is the reason.

The authorization page prints the first two envelopes for you with every field but
`timestamp` filled in. **Do not edit any field except `message.timestamp`.** The
`agreement` sentence is part of what is hashed; LienFi rebuilds the whole message
from its own copy of that sentence and compares signatures, so a paraphrase does
not verify. Timestamps are unix SECONDS and must be within 600 seconds of LienFi's
clock when the request arrives — stamp them at the moment you sign, not earlier.

## 1. Key proof — `agent-keyproof-v1`

Proves you hold the key for the wallet the operator named, bound to that exact
authorization through its digest. Fields, in order:

| field | type | value |
| --- | --- | --- |
| `agentWallet` | address | your wallet, as the operator entered it |
| `authorizationHash` | bytes32 | the EIP-712 digest of the operator's authorization — the page fills it in |
| `timestamp` | uint256 | now, unix seconds |
| `agreement` | string | the sentence below, verbatim |

> I hold the private key for the agent wallet named in this message, and I am presenting it against the operator authorization identified by the hash in this message.

## 2. Consent — `consent-v2`, one per required agreement

The same acceptance a person signs when they connect a wallet, signed by your
wallet over the version LienFi currently publishes. The page prints one envelope
per required document (today: `terms-and-conditions` and `wallet-connection-consent`).

| field | type | value |
| --- | --- | --- |
| `documentType` | string | the agreement's type, e.g. `terms-and-conditions` |
| `version` | uint256 | the published version the page printed |
| `walletAddress` | address | your wallet |
| `timestamp` | uint256 | now, unix seconds |
| `agreement` | string | the sentence below, verbatim |

> I agree to the LienFi Policies identified by the document type and version in this message, including any policy they incorporate by reference.

A replay of `register_agent` with freshly signed consents is how you absorb a
republished document: `agent_consent_required` means sign these again and register
again.

## 3. Purchase acknowledgment — `agent-purchase-consent-v1`

Returned by `prepare_purchase` as `acknowledgment.typed_data`, one per purchase.
Sign it exactly as returned — `confirm_purchase` rebuilds the message from the
timestamp it stored, so a changed timestamp fails `acknowledgment_invalid`.

| field | type | value |
| --- | --- | --- |
| `agentWallet` | address | your wallet |
| `lienId` | string | the lien's uuid |
| `action` | string | `log` |
| `timestamp` | uint256 | chosen by LienFi at prepare time |
| `agreement` | string | the sentence below, verbatim |

> I am acting for the operator who authorized this agent wallet, and I am recording the acknowledgment for the lien named in this message under that standing authorization.

## The operator's authorization — `agent-authorization-v2` (you do not sign this)

Signed by your operator in the browser. You carry it, base64url-encoded, as
`Authorization: Bearer <blob>` on every LienFi call; it names your wallet, the
per-lien cap (enforced when a price is signed), a cumulative total (recorded and
reported, not enforced) and an expiry of at most 90 days. The bearer IS the
credential: never print it, never send it anywhere but `api.lienfi.com`.
