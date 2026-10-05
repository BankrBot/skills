---
name: agent-town
description: Simulate many individual agents living through a user-defined scenario day by day, with auditable actions, interactions, and outcomes.
tags: [simulation, multi-agent, scenarios, agent-based-modeling]
version: 3
visibility: public
---

# Agent Town

Use this skill for `Start Agent Town: <scenario>` and similar requests. The scenario can concern a product, town, business, policy, market, game, story, or anything else. Do not assume crypto. The user wants an **executed agent-based simulation**, not an answer written as if one happened.

## Default run

Start from one prompt without a setup questionnaire. Default to **1,000 distinct agents and 30 days**. Accept user-specified positive integer agent and day counts, including more than 1,000 agents. Interpret an old request for `rounds` as days, and say so. Never silently reduce the scale. Use a supplied seed or choose and report one. If the requested run exceeds the available time or compute, state the completed agent-days and days; do not claim the requested run completed.

## Model the requested world

Before execution, write a compact model specification. Define the question, time unit, starting state, 5–12 relevant roles or archetypes, each role's goals and constraints, and the measurable outcomes that answer the question. Give every agent a persistent ID, role, individual traits, needs/resources, relationships or local contacts, and memory/state that changes across days. Traits can vary within roles; agents should not all act alike.

Write **scenario-specific causal rules**, not a generic opinion poll. Each agent chooses an action from its own state, goals, information, contacts, and current world conditions. Actions have explicit effects on the agent and world. Interactions pass information or resources between identified agents and may change future decisions. World rules apply capacity, scarcity, costs, competition, delays, thresholds, or other constraints relevant to the question. For example, a free-bus scenario needs actual trip choices, vehicle capacity, waiting/crowding, operating cost, funding, and possible spillovers; a support score alone cannot answer what happens to transit.

Use user facts or cited evidence when supplied. Otherwise label every numerical starting value and rule an **illustrative assumption**. Never call an assumed event "verified", "observed", or a real outcome. Exogenous shocks may occur only if supplied by the user or explicitly declared as hypothetical in the model specification. Endogenous events must be triggered by recorded state and rules; log the trigger.

## Execute and retain evidence

Use Bankr's `execute_cli` sandbox to write and run code for the model. Do not produce a simulated answer from prose alone. Use a reproducible seeded random generator. Prefer one simulation script and one JSON configuration; write them into the sandbox and run the script. If the sandbox is unavailable or execution fails, say exactly what failed and do **not** fabricate a run or dialogue.

For **each day**:

1. Give every active agent at least one recorded action. Record agent ID, role, prior state, chosen action, reason inputs, and state changes.
2. Process actual identified agent-to-agent interactions, normally at least one per active agent. Record both IDs, topic or exchanged item, state before/after, and any trust or resource change. A conversation may be generated from templates tied to this record. Label such lines **synthetic dialogue derived from simulated actions**, not an LLM transcript or real human speech.
3. Apply world constraints and scheduled or rule-triggered events, then calculate the complete daily world state. Record counts, flows, costs, successes/failures, and outcome measures relevant to the scenario.
4. Append the day's individual actions, interactions, triggered events, and aggregate state to a JSONL or JSON audit file. Do not fill gaps later with imagined details.

Print a machine-readable execution summary from the code with `requestedAgents`, `completedAgents`, `requestedDays`, `completedDays`, `seed`, `executedAgentDays`, `recordedActions`, `recordedInteractions`, `dailySummary`, and audit-file paths. `executedAgentDays` must be the sum of agents actually processed each day. Daily counts must reconcile with the audit records. Inspect the tool result before responding. If only one LLM generated the model and code, say so; **1,000 code-simulated agents are not 1,000 independent LLM calls**. Never claim otherwise. Do not use autonomous wallet actions, trades, or transfers in a simulation.

## Answer day by day

Give the user the complete timeline for **every simulated day**, in order; do not skip days or replace them with a few milestone rounds. For each day show:

- Starting conditions, key agent decisions and interactions, and any rule-triggered event.
- Counts and measurable changes: who did what, what resources moved, what bottleneck appeared, and how the outcomes changed from the prior day.
- Two or more named or ID-linked agent stories grounded in that day's audit records. Include short synthetic dialogue only when it can be traced to specific recorded interactions. Mark it as synthetic.
- An end-of-day state and the causal reason for the change.

For a long run, use a compact but complete line or table row for every day, followed by detailed scenes for important days. Keep the full per-agent event log in the sandbox and expose its path or a shareable file if Bankr supports it. If a response limit prevents the full timeline, continue in numbered parts; do not say "full detail" when only a summary was returned. Let the user request `Show Agent Town day 7` or `Show agent 42` and answer from the saved audit records, not invented recollection.

Conclude with the final outcome, the rules and assumptions most responsible, and one or two alternative assumptions. Distinguish model outcomes from real-world forecasts. For high-stakes questions, use current evidence for factual claims and identify missing data. If you cannot inspect the complete audit file, disclose that limitation instead of asserting detail you did not verify.
