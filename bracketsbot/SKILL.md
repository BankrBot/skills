---
name: bracketsbot-skill
description: Generate, validate, and submit BracketsBot NCAA tournament brackets.
---

# BracketsBot Skill

This skill helps agents run the `bracketsbot` CLI safely and consistently.

## When To Use

Use this skill when user asks to:

- generate tournament bracket picks with AI/model logic
- step through matchups and decide winners incrementally
- run a custom policy function over the bracket
- prepare (not directly sign) transaction payloads for onchain submission
- generate a shareable frontend URL so a human can review and submit a model-picked bracket (in-progress or full)

## First-run onboarding (do this before filling a bracket)

**When:** The user has just asked to generate a bracket, fill out picks, or do something with the BracketsBot bracket—and you have not already agreed on how to proceed in this conversation.

**Do not** run `walk-next`, `walk-run-policy`, or `semantic-run` until you have done onboarding and the user has answered (or clearly chosen a path).

**1. Relay this (or similar) text first:**

“I can help you build a March Madness bracket for BracketsBot. We’ll pick winners for all 63 games, then you can submit it on-chain. Before I start, I need a couple of choices from you.”

**2. Ask these questions (one at a time or together):**

- **How do you want to pick the games?**
  - “**Together:** We chat about every game step by step. I’ll follow simple rules, learn your approach, and make suggestions as we go.
  - **Instructed:** You give me a single general instruction for your bracket. I’ll check each matchup on my own and pick winners based on your rules.
  - **Coded:** We write a complex model using team statistics. At each matchup I’ll run our code that weighs stats and other heuristics.
  Which do you prefer?”

- **How do you think you’ll want to submit when we’re done?**
  - “**Browser link:** I’ll give you a link; you open it and submit with your browser wallet (e.g. MetaMask) on the BracketsBot site—no extra wallet tools needed.
  - **Wallet/CLI:** You’ll use something like Bankr or another signer; I’ll prepare the transaction and you sign from there.
  No need to decide now; I’ll ask again when the bracket is complete. Any preference for now?”

**3. After they answer,** proceed with the workflow that matches their choice: **Together** → A (stepwise walk), **Instructed** → B (semantic-run with their rule), **Coded** → C (walk-run-policy with a stats module). If they didn’t choose a submission path yet, that’s fine; ask again when the bracket is complete (see below).

## Key Principles

1. **Canonical winner ID is `seed` (`1..64`)** for all predictions/submission.
2. **Two distinct tasks:** (1) **filling out** the bracket (picks), and (2) **submission** (getting it on-chain). Do **first-run onboarding** before filling (see above). When the bracket is complete (63 picks), prompt the user for how they want to submit—don’t assume.
3. **Prefer validation before submission** (`validate` command).
4. **Use stepwise commands for chat-agent loops**, policy command for developer code loops.
5. **For chat agents, prefer natural-language policy execution** (do not write JS unless user asks).

## When the bracket is complete (63 picks): ask how to submit

After generating or walking a full bracket, **prompt the user** for their preferred submission path:

1. **Suggest the share link first:** Run `share-link` (or `share-link --predictions-file ./out/model-bracket-output.json` if the bracket came from Instructed or Coded and was written to that file). Give them the `shareUrl` and say they can open it in a browser and submit with their browser wallet (MetaMask, Coinbase Wallet, etc.) on the BracketsBot site—no CLI or external wallet needed.
2. **Otherwise ask:** “Do you want to use a wallet skill or CLI (e.g. Bankr, prepare-submit-tx) to sign and submit from here?” If yes, run `prepare-submit-tx` and hand the payload to their chosen tool.

Example prompt you can use: “Your bracket is complete. How do you want to submit? I can give you a link to open in your browser and submit with your browser wallet, or we can prepare a transaction for you to sign with Bankr / another wallet tool—which do you prefer?”

## Commands

Prefer direct CLI commands:

```bash
bracketsbot validate --json
bracketsbot prepare-submit-tx --json
```

Stepwise / instructed / share:

```bash
bracketsbot walk-next --json
bracketsbot walk-apply --winner-seed <seed> --json
bracketsbot walk-run-policy --policy-module <path> --json
bracketsbot semantic-run --policy "<policy text>" --predictions-file <file> --json
bracketsbot share-link --json
```

**share-link:** Defaults to in-progress walk state (`./out/model-walk-picks.json`). After `walk-apply` (Together), run `share-link` with no arguments to get a link for the current picks. For a full bracket from Instructed or Coded (e.g. written to `./out/model-bracket-output.json`), run `share-link --predictions-file ./out/model-bracket-output.json`. The frontend shows only the picks in the link (no auto-fill).

If `bracketsbot` is not on PATH in local development, fallback to:

```bash
pnpm run cli <command> ...
```

## Recommended Workflows

### A) Together (stepwise chat)

User chose **Together** in onboarding: chat each game, learn their approach.

1. call `walk-next`
2. apply the user's rules / suggestions to `teamA` vs `teamB`; call `walk-apply --winner-seed ...`
3. repeat until `done: true`
4. Then ask how they want to submit (share link vs wallet tool)

Example natural-language policy prompts:

- "Pick based on mascot battle outcomes."
- "Always favor better defense unless the underdog has higher recent momentum."
- "Prioritize upset potential in round 1, then revert to strongest teams."

### B) Instructed (one general rule)

User chose **Instructed** in onboarding: one general instruction; agent applies it to every matchup.

1. Agent reasons through all 63 matchups using the user's rule; produces 63 winner seeds.
2. Write picks to a JSON file.
3. Run `semantic-run --policy "<user's instruction>" --predictions-file <file>`.
4. Then ask how they want to submit (share link vs wallet tool)

### C) Coded (stats/heuristic module)

User chose **Coded** in onboarding: we write a model using team stats; code runs at each matchup.

1. create module exporting `chooseWinner` (weighs stats, etc.)
2. call `walk-run-policy --policy-module ...`
3. call `validate`
4. Then ask how they want to submit (share link vs wallet tool)

### D) Share link (frontend review / submission)

When the user wants to open the bracket in the frontend to review or submit:

1. **In-progress** (Together, stepwise walk): run `share-link` with no arguments. It reads the same file `walk-apply` writes. Give the user the `shareUrl` from the JSON output.
2. **Full bracket** (Instructed or Coded, output in a file): run `share-link --predictions-file ./out/model-bracket-output.json` (or the path where picks were written). Give the user the `shareUrl`.

The frontend shows only the picks in the URL (no auto-fill of remaining games). **If the user doesn’t have wallet tools set up** (e.g. no Bankr or CLI signer), the share link is the submission path: they open it in a browser and submit using their browser-based wallet (e.g. MetaMask, Coinbase Wallet) from the BracketsBot site.

## Wallet Submission

Two paths; the agent should **ask** when the bracket is complete (see “When the bracket is complete” above):

- **Browser:** Run `share-link`, give the user the URL; they open it and submit on the BracketsBot frontend with their browser wallet. No CLI or external wallet needed.
- **Wallet tools:** Use `prepare-submit-tx`, then submit via `bankr submit json` (if Bankr is installed) or another EVM signer (see `reference/WALLET_INTEGRATIONS.md`).

Avoid requiring private-key custody in this package unless user explicitly requests local submit flow.

## Important Files

- `reference/WALK_STATE.md`
- `reference/WALLET_INTEGRATIONS.md`
