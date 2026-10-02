// Bankr API helpers. The Wallet API calls (whoami / submit) use the installing user's own
// BANKR_API_KEY — never hardcode a key here, and never accept one pasted into chat.
// The address lookup is Bankr's public endpoint and needs no key.
import { getAddress } from "viem";

const BANKR_API_URL = process.env.BANKR_API_URL || "https://api.bankr.bot";

export function requireBankrApiKey() {
  if (!process.env.BANKR_API_KEY) {
    throw new Error(
      "BANKR_API_KEY isn't set. Run `bankr login` and export BANKR_API_KEY (or use --build-only inside bankrbot).",
    );
  }
}

/** Bankr account info: EVM wallet address + linked X handle (if any). */
export async function bankrWhoami() {
  requireBankrApiKey();
  const res = await fetch(`${BANKR_API_URL}/wallet/me`, { headers: { "X-API-Key": process.env.BANKR_API_KEY } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Bankr /wallet/me failed (${res.status}): ${JSON.stringify(body)}`);
  const address = body.wallets?.find((w) => w.chain === "evm")?.address;
  if (!address) throw new Error("This Bankr account has no EVM wallet — run `bankr login` to provision one.");
  const twitter = body.socialAccounts?.find((s) => s.platform === "twitter")?.username;
  return { address: getAddress(address), twitter: twitter || undefined };
}

/** Submits {to, data, value, chainId} from the user's Bankr wallet and waits for confirmation. */
export async function submitTxBankr({ to, data, value = 0n, chainId, description }) {
  requireBankrApiKey();
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${BANKR_API_URL}/wallet/submit`, {
        method: "POST",
        headers: { "X-API-Key": process.env.BANKR_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction: { to, data, value: value.toString(), chainId },
          description,
          waitForConfirmation: true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Bankr /wallet/submit failed (${res.status}): ${JSON.stringify(body)}`);
      // Documented statuses: success | reverted | pending. Callers re-confirm the receipt on-chain.
      if (body.success === false || body.status === "reverted") {
        // A reverted transaction must not be retried blindly.
        throw Object.assign(new Error(`Transaction failed on-chain: ${JSON.stringify(body)}`), { fatal: true });
      }
      return body;
    } catch (err) {
      lastErr = err;
      if (err.fatal) break;
      if (attempt < 3) {
        console.error(`  retrying submit (attempt ${attempt} failed: ${err.message})`);
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }
  throw lastErr;
}

const handleCache = new Map();

/** X handle -> Bankr wallet address (public endpoint), or null if the handle has no Bankr wallet. */
export async function bankrWalletOfHandle(handle) {
  const key = handle.replace(/^@/, "").toLowerCase();
  if (!handleCache.has(key)) {
    const res = await fetch(`${BANKR_API_URL}/addresses/resolve?value=${encodeURIComponent(key)}&type=twitter`);
    const body = res.ok ? await res.json().catch(() => null) : null;
    handleCache.set(key, body?.resolved && body.address ? getAddress(body.address) : null);
  }
  return handleCache.get(key);
}
