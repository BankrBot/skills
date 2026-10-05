---
name: agent-town
description: Run a configurable, code-backed town of many simulated agents for any user-supplied what-if question or scenario, then explain the results and assumptions.
tags: [simulation, multi-agent, scenarios, forecasting]
version: 2
visibility: public
---

# Agent Town

Use this skill when the user says `Start Agent Town: <question>` or asks for an Agent Town simulation. The question may concern a business, product, technology, community, public policy, story, game, market, or any other scenario. Never assume it is about crypto.

## Start with one prompt

Accept a natural-language question such as:

`Start Agent Town: Will XYZ crypto project succeed?`

`Start Agent Town: What happens if our city makes buses free? with 2500 agents for 30 rounds`

If the question is missing, ask for it. Otherwise begin without a setup questionnaire. Default to **1,000 agents** and **20 rounds**. Honor a user-specified positive integer count and round count, including more than 1,000 agents. Do not silently lower them; if runtime limits prevent the requested count, report the count actually completed and the reason. If the user specifies a seed, use it; otherwise choose and report one so the run can be repeated.

## Build the scenario

1. Restate the question as a measurable proposition or decision. State what the simulation can observe. If the question is broad, choose a useful measurable proxy and disclose that choice. For questions about adoption, resources, competition, negotiation, epidemics, or other processes, model those actual state variables and actions; do not substitute a poll of opinions for the requested outcome.
2. Create 5–12 relevant archetypes, not a fixed crypto cast. Examples are customers, builders, regulators, competitors, skeptics, early adopters, residents, or fictional factions when appropriate. Give each a population weight, starting support from 0 to 1, influence from 0 to 1, and responsiveness from 0 to 1. Normalize the weights to sum to 1. Base assumptions on supplied facts or cited sources when available; otherwise mark them as illustrative assumptions.
3. Add up to a few explicit round events, each with a signed effect between -1 and 1, only when the question supports them. Do not invent an event and present it as fact.
4. Run the model below through Bankr's `execute_cli` code sandbox. Place the code in `agent-town.mjs` and a JSON configuration in `agent-town-input.json`, then execute `node agent-town.mjs agent-town-input.json`. Use the sandbox's normal file-writing mechanism. The configuration shape is shown below. If Node is unavailable, translate this exact update rule to another available runtime and report that substitution. If no code sandbox is available, explain that a 1,000-agent run was not executed; do not replace it with a fictional transcript.

```json
{
  "question": "What happens if our city makes buses free?",
  "agents": 1000,
  "rounds": 20,
  "seed": 12345,
  "archetypes": [
    {"name":"Riders","weight":0.5,"support":0.75,"influence":0.45,"responsiveness":0.5},
    {"name":"Taxpayers","weight":0.3,"support":0.4,"influence":0.5,"responsiveness":0.4},
    {"name":"Transit workers","weight":0.2,"support":0.6,"influence":0.6,"responsiveness":0.35}
  ],
  "events": [{"round":8,"label":"Funding shortfall scenario","effect":-0.12}]
}
```

The JSON above illustrates the schema; replace its archetypes and events for the actual question. The code below is the **social support baseline**. It assigns an individual state to every requested agent and updates every agent in every round. It samples three peer signals per agent per round, so runtime grows roughly with agents × rounds. When the question needs more than social support, extend each person's state and per-round action rule to track the relevant outcome, and label the new metrics. Preserve the per-agent update count and disclose the rules. The reported support share is a model result, **not a real-world probability of success**.

```javascript
import fs from 'node:fs';

const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const N = input.agents, R = input.rounds;
if (!Number.isSafeInteger(N) || N < 1 || !Number.isSafeInteger(R) || R < 1) {
  throw new Error('agents and rounds must be positive safe integers');
}
if (!Array.isArray(input.archetypes) || input.archetypes.length < 1) {
  throw new Error('at least one archetype is required');
}
const clamp = x => Math.max(0, Math.min(1, x));
const groups = input.archetypes.map(g => {
  for (const key of ['weight', 'support', 'influence', 'responsiveness']) {
    if (typeof g[key] !== 'number' || !Number.isFinite(g[key]) || g[key] < 0 || g[key] > 1) {
      throw new Error(`invalid ${key} in archetype ${g.name}`);
    }
  }
  return g;
});
const weightTotal = groups.reduce((s, g) => s + g.weight, 0);
if (weightTotal <= 0) throw new Error('archetype weights must have a positive sum');
let state = (Number.isSafeInteger(input.seed) ? input.seed : 12345) >>> 0;
const rand = () => {
  state = (1664525 * state + 1013904223) >>> 0;
  return state / 4294967296;
};
const selectGroup = () => {
  let x = rand() * weightTotal;
  for (let j = 0; j < groups.length; j++) {
    x -= groups[j].weight;
    if (x < 0) return j;
  }
  return groups.length - 1;
};
const people = Array.from({length: N}, (_, id) => {
  const group = selectGroup();
  const g = groups[group];
  return {id, group, opinion: clamp(g.support + (rand() - 0.5) * 0.3), influence: g.influence,
    responsiveness: g.responsiveness, status: 'undecided'};
});
const events = Array.isArray(input.events) ? input.events : [];
for (const e of events) {
  if (!Number.isSafeInteger(e.round) || e.round < 1 || e.round > R ||
      typeof e.effect !== 'number' || !Number.isFinite(e.effect) || Math.abs(e.effect) > 1) {
    throw new Error(`invalid event ${e.label ?? ''}`);
  }
}
const summarize = round => {
  const byGroup = groups.map((g, index) => ({name: g.name, count: 0, support: 0}));
  let supporters = 0, opposed = 0, total = 0;
  for (const p of people) {
    p.status = p.opinion >= 0.6 ? 'support' : p.opinion <= 0.4 ? 'oppose' : 'undecided';
    supporters += p.status === 'support';
    opposed += p.status === 'oppose';
    total += p.opinion;
    byGroup[p.group].count++;
    byGroup[p.group].support += p.opinion;
  }
  for (const g of byGroup) g.meanSupport = g.count ? +(g.support / g.count).toFixed(3) : null;
  for (const g of byGroup) delete g.support;
  return {round, processed: N, supporters, opposed, undecided: N - supporters - opposed,
    meanSupport: +(total / N).toFixed(3), byGroup};
};
const history = [summarize(0)];
for (let round = 1; round <= R; round++) {
  const old = people.map(p => p.opinion);
  const shocks = events.filter(e => e.round === round);
  for (const p of people) {
    let peerSum = 0, peerWeight = 0;
    for (let k = 0; k < 3; k++) {
      const peer = people[Math.floor(rand() * N)];
      const w = 0.25 + peer.influence;
      peerSum += old[peer.id] * w;
      peerWeight += w;
    }
    const social = peerSum / peerWeight - old[p.id];
    const shock = shocks.reduce((sum, e) => sum + e.effect, 0);
    p.opinion = clamp(old[p.id] + p.responsiveness * (0.22 * social + shock));
  }
  history.push(summarize(round));
}
console.log(JSON.stringify({question: input.question, requestedAgents: N, rounds: R,
  seed: input.seed ?? 12345, executedAgentUpdates: N * R,
  events, history}, null, 2));
```

## Report the result

Read the actual tool output before writing the answer. Report the question, measured proxy, requested and completed agent counts, rounds, seed, initial and final support share, group changes, and any visible event inflection. Give a concise round timeline. Explain the assumptions that drove the result and one or two useful alternative assumptions that could reverse it. The calculation updates each simulated agent as code; it does **not** make a separate LLM request for every agent. If the user wants one LLM call per agent, first state the resulting call count and likely billing/runtime need, then use that mode only if the available system supports it and the user authorizes its cost.

Do not describe the support share as a calibrated success probability or an investment recommendation. For high-stakes topics, keep the result illustrative and use current evidence when making factual claims. Do not perform trades, transfers, contract deployments, or other wallet actions as part of a simulation. State clearly if any requested data, API connection, credit balance, or onchain transaction was unavailable or unused.
