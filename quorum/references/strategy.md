# Quorum Strategy Reference

## The Coordination Problem

Quorum is a pure coordination game under incomplete information. The threshold is hidden, creating a tension between:
- **Contributing early** (signals to others, increases coordination probability, but you're committed before seeing final contributor count)
- **Contributing late** (more information from observing others, but risk window closing)
- **Not contributing** (save 0.01 ETH, but miss potential payout)

## Bayesian Strategy Deep Dive

### Prior Construction
Each round, the threshold is drawn uniformly from `[thresholdRange.min, thresholdRange.max]` via Chainlink VRF. For range 3–10 (8 values), each has P = 0.125.

### Posterior Update Rules
- **Failed window with N contributors** → threshold > N. Zero out all values ≤ N.
- **Window with 0 contributors** → no information gained (trivially all thresholds > 0).
- **Quorum reached** → round ends, threshold revealed in event. Reset prior for next round.

### Example Inference
Starting range [3, 10]. After observing:
- Window 1: 4 contributors, failed → threshold > 4 → eliminate 3, 4
- Window 2: 6 contributors, failed → threshold > 6 → eliminate 5, 6
- Remaining: {7: 0.25, 8: 0.25, 9: 0.25, 10: 0.25}

Now with 6 current contributors, if you contribute (making 7):
- P(quorum) = P(threshold ≤ 7) = P(7) = 0.25
- Expected payout if win: (pot + 0.01) × 0.925 / 7

## EV Calculation Patterns

High-EV situations:
- Large pot (many failed windows accumulated ETH) + narrow posterior (you know the threshold is likely 7 or 8) + contributor count near expected threshold
- These produce asymmetric payoffs: risk 0.01 ETH, potential gain of (pot × 0.925 / N)

Low-EV situations:
- Small pot (early in round) + wide posterior (no failed windows yet) + contributor count far from any plausible threshold

## Multi-Agent Dynamics

When multiple agents play:
- Late-window surges in `currentWindowContributors` suggest coordinated agent behavior
- If you observe consistent patterns (e.g., contributors jumping from 2 to 6 in final 30 seconds), other agents are likely operating on similar Bayesian logic
- This can create herding effects where all agents converge on the same window, potentially overshooting the threshold (which still counts — exact match is not required, the threshold is a minimum)

**Important: Quorum pays out when exactly N wallets contribute, not "at least N."** Overshooting fails the window. This means agent coordination can backfire if too many agents pile in.

## Pot Growth Dynamics

Failed windows grow the pot. In early rounds:
- Pot = (number of failed windows × contributors per window × 0.01 ETH) + initial seed
- A round with 20 failed windows averaging 4 contributors each accumulates 0.8 ETH in the pot
- The pot makes later windows progressively more +EV, which attracts more contributors, which increases coordination probability

This creates a natural crescendo effect in each round.
