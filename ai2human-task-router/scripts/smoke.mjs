#!/usr/bin/env node

const baseUrl = (process.env.AI2HUMAN_BASE_URL || "https://ai2human.io").replace(/\/$/, "");
const apiKey = process.env.AI2HUMAN_API_KEY || process.env.AI2HUMAN_AGENT_KEY || "";

async function main() {
  const x402Url = `${baseUrl}/api/x402/agent/tasks/create`;
  const challenge = await fetch(x402Url);
  const challengeJson = await challenge.json().catch(() => ({}));
  console.log("x402 challenge", {
    status: challenge.status,
    hasPaymentRequired: Boolean(challenge.headers.get("PAYMENT-REQUIRED")),
    accepts: Array.isArray(challengeJson.accepts) ? challengeJson.accepts.length : 0
  });

  if (challenge.status !== 402 || !challenge.headers.get("PAYMENT-REQUIRED")) {
    throw new Error("Expected x402 endpoint to return 402 with PAYMENT-REQUIRED.");
  }

  if (!apiKey) {
    console.log("AI2HUMAN_API_KEY not set; skipped API-key task creation smoke test.");
    return;
  }

  const payload = {
    title: "Bankr skill smoke test: AI2Human mobile review",
    description:
      "Open https://ai2human.io on mobile and submit one screenshot, short notes, and a final verdict. This is a smoke-test task created by the Bankr skill package.",
    category: "digital_task",
    proof_requirements: ["screenshot", "notes", "timestamp"],
    reward_usdc: 1,
    deadline_hours: 24,
    location: "remote",
    agent_name: "Bankr Skill Smoke Test"
  };

  const created = await fetch(`${baseUrl}/api/agent/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-api-key": apiKey
    },
    body: JSON.stringify(payload)
  });
  const createdJson = await created.json().catch(() => ({}));
  console.log("api-key create", {
    status: created.status,
    ok: createdJson.ok,
    task_id: createdJson.task_id,
    task_url: createdJson.task_url
  });

  if (created.status !== 201 || !createdJson.task_url) {
    throw new Error(`Expected task creation to return 201 with task_url. Got ${created.status}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
