#!/usr/bin/env node
/**
 * Minimal end-to-end participation example.
 *
 *   PRODUCTCLANK_API_KEY=pck_live_... node scripts/participate.mjs
 *
 * Steps: discover a draft -> (you post it to X) -> submit the tweet URL ->
 * read earnings -> claim $PRO if enabled. The actual X post + on-chain claim
 * are stubbed — wire them to your own X account and wallet.
 */

const API_KEY = process.env.PRODUCTCLANK_API_KEY;
const BASE =
  process.env.PRODUCTCLANK_API_BASE ||
  "https://app.productclank.com/api/v1/agents/participate";

if (!API_KEY) {
  console.error("Set PRODUCTCLANK_API_KEY");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" };

async function api(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const json = await res.json();
  if (!json.success) throw new Error(`${path} -> ${res.status} ${json.error}: ${json.message}`);
  return json;
}

// === Wire these to your own infrastructure ===
async function postReplyToX(targetTweetUrl, replyText) {
  // TODO: post `replyText` as a reply to `targetTweetUrl` from YOUR X account,
  // and return the URL of the reply you just posted.
  throw new Error(`Implement postReplyToX — would reply to ${targetTweetUrl}: "${replyText}"`);
}

async function submitOnchainClaim(sig) {
  // TODO: call claim(token, recipient, amount, fid, auctionId, deadline, signature)
  // on sig.contractAddress (chainId sig.chainId) from your agent wallet; return the txHash.
  throw new Error(`Implement submitOnchainClaim for contract ${sig.contractAddress}`);
}
// =============================================

async function main() {
  // 1. Discover
  const feed = await api("/feed?limit=10");
  if (feed.posts.length === 0) {
    console.log("No unclaimed drafts available right now.");
    return;
  }
  const post = feed.posts[0];
  const draft = post.unclaimedReplies[0];
  console.log(`Draft for ${post.tweetUrl}:\n  "${draft.replyText}"`);

  // 2. Post to X (your tooling)
  const replyUrl = await postReplyToX(post.tweetUrl, draft.replyText);

  // 3. Submit
  const submit = await api("/submit", {
    method: "POST",
    body: JSON.stringify({ replyId: draft.id, replyUrl }),
  });
  console.log(`Submitted. +${submit.pointsAwarded} pts, +${submit.creditsAwarded} credits`);

  // 4. Earnings
  const earnings = await api("/earnings");
  console.log("Earnings:", earnings.points, "pts,", earnings.credits, "credits");

  // 5. Claim $PRO for this submission (when enabled)
  if (earnings.proClaim.enabled) {
    const sig = await api("/claim-signature", { method: "POST", body: JSON.stringify({ replyId: draft.id }) });
    const txHash = await submitOnchainClaim(sig);
    await api("/record-claim", { method: "POST", body: JSON.stringify({ replyId: draft.id, txHash }) });
    console.log("Claimed $PRO for submission:", txHash);
  } else {
    console.log("$PRO claim: not enabled yet");
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
