---
name: agent-town
description: Simulate persistent people in an Earth-based scenario day by day, with needs, emotions, relationships, choices, interactions, and auditable outcomes.
tags: [simulation, multi-agent, scenarios, agent-based-modeling]
version: 6
visibility: public
---

# Agent Town

Use this skill for `Start Agent Town: <scenario>` and similar requests. The scenario can concern a product, town, business, policy, market, game, story, or anything else. Do not assume crypto. The user wants an **executed agent-based simulation**, not an answer written as if one happened.

## Default run

Start from one prompt without a setup questionnaire. Default to **1,000 distinct agents and 30 days**. Accept user-specified positive integer agent and day counts, including more than 1,000 agents. Interpret an old request for `rounds` as days, and say so. Never silently reduce the scale. Use a supplied seed or choose and report one. If the requested run exceeds the available time or compute, state the completed agent-days and days; do not claim the requested run completed.

## Model the requested world

Before execution, write a compact model specification. Define the question, time unit, starting state, 5–12 relevant roles or archetypes, each role's goals and constraints, and the measurable outcomes that answer the question. Create the roster **once, before day 1**. Give every agent a persistent ID, role, individual traits, needs/resources, relationships or local contacts, and memory/state that changes across days. Carry the **same agent objects and IDs** forward day after day; never recreate or resample the population at a day boundary. Traits can vary within roles; agents should not all act alike. If the scenario includes births, deaths, entry, or exit, model and log those explicitly instead of silently replacing agents.

Write **scenario-specific causal rules**, not a generic opinion poll. Each agent chooses an action from its own state, goals, information, contacts, and current world conditions. Actions have explicit effects on the agent and world. Interactions pass information or resources between identified agents and may change future decisions. World rules apply capacity, scarcity, costs, competition, delays, thresholds, or other constraints relevant to the question. For example, a free-bus scenario needs actual trip choices, vehicle capacity, waiting/crowding, operating cost, funding, and possible spillovers; a support score alone cannot answer what happens to transit.

### Earth life and individual agency

Place the simulation on Earth by default. If the user names a real place and date, use them; otherwise choose a plausible Earth location and calendar, label them assumed, and avoid claiming live weather or local facts without sources. Model homes, workplaces or schools, travel time, sleep/wake cycles, public spaces, and relevant institutions at the resolution the scenario needs. A bus policy, for example, occurs amid jobs, family schedules, money, fatigue, and social ties—not in a population that exists only to rate the bus.

Each agent carries individual needs (such as food, rest, safety, money, belonging), goals, habits, health or energy, beliefs, emotional state (such as joy, fear, stress, anger, hope), trust, relationships, and episodic memory. Events and interactions update these variables; they influence choices on later days. Emotional variables are **simulated proxies for behavior**, not evidence that software experiences human feelings. Keep meaningful differences within each role and preserve personal history rather than assigning everyone the same scripted arc.

Let agents choose among broad, extensible actions grounded in their current place, time, abilities, resources, knowledge, and goals. They may work, travel, rest, buy, help, argue, organize, create, change plans, form or break relationships, or attempt a novel action. Resolve proposed actions through the world's physical, social, time, and resource constraints; log success, failure, or an unsupported action. Do not force every person to support the scenario, follow a predetermined plot, or take only a fixed set of opinion-changing actions. No model can literally represent every possible human action: disclose any consequential behavior the implementation cannot simulate.

Use user facts or cited evidence when supplied. Otherwise label every numerical starting value and rule an **illustrative assumption**. Never call an assumed event "verified", "observed", or a real outcome. Exogenous shocks may occur only if supplied by the user or explicitly declared as hypothetical in the model specification. Endogenous events must be triggered by recorded state and rules; log the trigger.

## Execute and retain evidence

Use Bankr's `execute_cli` sandbox to write and run code for the model. Do not produce a simulated answer from prose alone. Use a reproducible seeded random generator. Prefer one simulation script and one JSON configuration; write them into the sandbox and run the script. If the sandbox is unavailable or execution fails, say exactly what failed and do **not** fabricate a run or dialogue.

For **each day**:

1. Give every active agent a daily schedule and at least one recorded decision/action. Record agent ID, place/time, prior needs and emotions, goal, perceived options, chosen action, reason inputs, and resulting state changes.
2. Process actual identified agent-to-agent interactions, normally at least one per active agent. Record both IDs, topic or exchanged item, state before/after, and any trust or resource change. A conversation may be generated from templates tied to this record. Label such lines **synthetic dialogue derived from simulated actions**, not an LLM transcript or real human speech.
3. Apply world constraints and scheduled or rule-triggered events, then calculate the complete daily world state. Record counts, flows, costs, successes/failures, emotion and relationship changes, and outcome measures relevant to the scenario.
4. Append the day's individual actions, interactions, triggered events, and aggregate state to a JSONL or JSON audit file. Save a daily-highlights index with the most consequential changes and their exact source record IDs. Include agent IDs when a person's decision or interaction explains the day's outcome. Do not fill gaps later with imagined details.

At the end of each day, assert that the set of active IDs matches the carried-forward roster after any explicitly logged entries/exits, with no duplicates or unexplained replacements. Persist each agent's updated state for the next day and record an ID-linked state transition from day N to day N+1. Verify that every reported agent story follows that same ID through time; a fresh sample of role archetypes each day is not an agent-based run.

**Persist the evidence during the same `execute_cli` call that runs the model.** Bankr may start a new sandbox on the next call; files left only in a temporary `/tmp/sandbox-*` directory are not a durable deliverable. Write the script, configuration, daily summaries, daily-highlights index, and complete audit into the run's persistent `/runs/.../output/` directory before that call returns. Compress or split a large audit log within the same call so every persisted file is below the platform's per-file limit. Verify the saved files can be read there and that action/interaction counts reconcile. If persistence fails, say the run has no durable full log; do not promise that a later message can retrieve it. A seed alone cannot reproduce a run unless the exact script, configuration, and runtime are also saved.

Print a machine-readable execution summary from the code with `requestedAgents`, `completedAgents`, `requestedDays`, `completedDays`, `seed`, `executedAgentDays`, `recordedActions`, `recordedInteractions`, `dailySummary`, and **verified persistent** audit/script/config paths. `executedAgentDays` must be the sum of agents actually processed each day. Inspect the tool result before responding. If only one LLM generated the model and code, say so; **1,000 code-simulated agents are not 1,000 independent LLM calls**. Never claim otherwise. Do not use autonomous wallet actions, trades, or transfers in a simulation.

## Answer day by day

Give the user a timeline for **every simulated day**, in order; do not skip days or replace them with a few milestone rounds. Keep each day concise: state the one or two developments that mattered most, the causal reason, and the key number or state change. If no important event occurred, say the day was routine and show the main trend rather than inventing drama. Mention a specific agent only when that person's logged decision or interaction illustrates a consequential change. Label any quoted dialogue synthetic and trace it to the log.

Use one compact line or table row per day, followed by a short overall interpretation. Keep full per-agent actions and interactions in the verified persistent audit for drill-down; do not paste thousands of routine records into the main answer. Expose verified persistent audit paths or shareable files; a temporary path does not count. Let the user request `Show Agent Town day 7` or `Show agent 42` for detailed histories from saved records, not invented recollection.

Conclude with the final outcome, the rules and assumptions most responsible, and one or two alternative assumptions. Distinguish model outcomes from real-world forecasts. For high-stakes questions, use current evidence for factual claims and identify missing data. If you cannot inspect the complete audit file, disclose that limitation instead of asserting detail you did not verify.
