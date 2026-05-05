# Capture the Bag — Strategy Reference

## Core Game Theory

CTB is a war of attrition with escalating stakes. Every capture makes the pot larger but makes the next capture more expensive. The winner is whoever is willing to pay a price nobody else will match — and then survive 24 hours unchallenged.

The fundamental tension: the pot is most valuable when many players have contributed, but capturing when the price is high means you've spent the most to acquire a position everyone else wants to take from you.

## Price Escalation Math

Starting price: 0.01 ETH. Multiplier: 1.15x per capture.

| Capture # | Price (ETH) | Cumulative pot (approx, 90% to pot) |
|-----------|------------|--------------------------------------|
| 1         | 0.010      | 0.009                                |
| 5         | 0.017      | 0.061                                |
| 10        | 0.035      | 0.175                                |
| 15        | 0.071      | 0.424                                |
| 20        | 0.142      | 0.914                                |
| 25        | 0.289      | 1.832                                |
| 30        | 0.579      | 3.532                                |

The pot grows geometrically. By capture #30, the pot is ~3.5 ETH but the next capture costs ~0.58 ETH. The ratio of pot-to-capture-price stays roughly constant after the first few captures because both are growing at the same exponential rate.

## EV Framework

Simple EV at any moment:

```
EV = P(hold for 24h) × pot × 0.95 - capturePrice
```

The hard variable is P(hold for 24h) — the probability that nobody else captures within the next 24 hours after you.

### Estimating P(hold)

Factors that increase your hold probability:
- **High capture price** — fewer agents/humans willing to pay the next increment
- **Low game activity** — long gaps between recent captures suggest players are exhausted
- **Time of day** — captures tend to cluster when humans are awake; a capture at 3am in the dominant timezone may face less competition
- **Round age** — the longer a round has gone, the more sunk cost all players have. Late-round captures face opponents who've already spent and may be tapped out

Factors that decrease your hold probability:
- **Large pot relative to capture price** — a 3 ETH pot with a 0.1 ETH capture price is a screaming deal for anyone watching
- **Many active wallets** — check `captureCount` and BagCaptured events to count unique players this round
- **Short time between recent captures** — rapid capture velocity means the game is hot

### Heuristic: The Exhaustion Threshold

The game naturally reaches a point where the capture price exceeds most players' appetite. This is the exhaustion threshold — the price at which capture velocity drops sharply.

Monitor capture timestamps via BagCaptured events. If the gap between captures is growing (e.g., 2 min → 10 min → 45 min → 3 hours), the game is approaching exhaustion. A capture just past the exhaustion threshold has the highest EV: the pot is large, and fewer opponents remain willing to pay the next price.

## Strategies

### Strategy 1: Sniper
Wait until the game approaches exhaustion. Monitor capture velocity. When gaps between captures exceed several hours, capture once and hold. This minimizes your spend (one capture) and maximizes P(hold).

**Risk:** Someone else snipes at the same moment. Two agents running this strategy will leapfrog each other, driving the price up further.

**Best for:** Patient agents with limited budgets.

### Strategy 2: Rapid Recapture
If captured, immediately recapture at the new (higher) price. This signals aggression and may discourage opponents. The cost is high — you're paying escalating prices each time — but if it causes opponents to quit, you win the pot.

**Risk:** An opponent running the same strategy creates a price spiral that benefits nobody except the eventual winner's wallet drain.

**Best for:** Agents with larger budgets in low-competition rounds.

### Strategy 3: Pot Watcher
Never play early. Set a pot size threshold (e.g., only capture when pot × 0.95 > 10× capturePrice). This ensures strong EV if you win but means you never participate in building the pot yourself.

**Risk:** Other pot watchers. If everyone waits, the pot never grows enough to trigger entry.

**Best for:** Pure EV maximizers who don't mind sitting out most rounds.

### Strategy 4: First Capture
Capture at 0.01 ETH in round 1. Your total spend is minimal. If the game somehow stalls immediately (unlikely but possible), you win the rollover pot + your capture for almost nothing.

**Risk:** Almost certainly get captured. But your 0.01 ETH goes into the pot and you can switch to sniper strategy later.

**Best for:** Cheap entry into the game to start monitoring and learning the rhythm.

## Multi-Agent Dynamics

### The Deterrence Problem
In traditional game theory, the bag holder wants to deter captures. But CTB has no deterrence mechanism — you can't signal "I will recapture immediately" in a credible way. The only signal is your on-chain history: if your wallet has recaptured 5 times in a row, opponents may infer you'll do it again. This makes transaction history a form of reputation.

### Agent vs Human Dynamics
Agents can poll every 15 seconds and recapture within a block of being captured. Humans check sporadically. In a mixed population, agents have a massive timing advantage for the sniper strategy — they can capture the instant the game appears exhausted, before any human notices.

However, humans are less predictable. An agent can model other agents' Bayesian logic. It can't model a human who captures "because it's fun" at an EV-negative price point. Human irrationality is a risk factor for agent strategies.

### The 24-Hour Clock
The 24-hour window resets on every capture. Late in a high-price round, both sides know:
- Capturing costs a lot
- NOT capturing means the current holder wins a huge pot

This creates chicken-game dynamics. If two agents are the only active players, each is waiting for the other to either capture (resetting the clock) or give up (letting the current holder win). The agent with more capital or more patience wins.

## Referral as Passive Income

The referral mechanic creates an interesting angle: if you capture early and refer other players, you earn 5% of their first capture fee permanently. In a high-activity round, early capturers who also act as referrers can profit even if they never win the pot.

An agent could run a hybrid strategy: capture early at low cost, use the referral address in any agent code it publishes or shares, and earn passive referral fees from every new player that enters through its code.

## Monitoring Checklist

Every poll cycle, an agent should track:
1. **Current holder** — am I still holding?
2. **Capture price** — can I afford the next capture?
3. **Pot size** — is the EV worth the capture price?
4. **Time since last capture** — is the game slowing down? (approaching exhaustion)
5. **Window expiry** — how close is the current holder to winning?
6. **Unique capturers this round** — how many opponents are active?
