import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encodeFunctionData, getAddress, parseEther, toHex, zeroAddress } from "viem";

const BITS_PER_TEAM = 7n;
const TEAMS_PER_SLOT = 36;
const TOTAL_GAMES = 63;

const bracketsBotAbi = [
  {
    type: "function",
    name: "submitPackedPredictionEth",
    inputs: [
      { name: "slot1", type: "uint256", internalType: "uint256" },
      { name: "slot2", type: "uint256", internalType: "uint256" },
      { name: "referrer", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const predictionFile =
  process.env.PREDICTION_OUTPUT_FILE ??
  path.resolve(scriptDir, "../out/model-bracket-output.json");
const chainId = Number(process.env.CHAIN_ID ?? 8453);
const entryFeeEth = process.env.ENTRY_FEE_ETH ?? "0.005";
const referrer = process.env.REFERRER ?? zeroAddress;
const deployArtifactPath =
  process.env.DEPLOY_ARTIFACT ??
  path.resolve(
    scriptDir,
    `../../contracts/broadcast/Deploy2026.sol/${chainId}/run-latest.json`,
  );
const deploymentRegistryPath = path.resolve(
  scriptDir,
  "../../contracts/deployments/2026.json",
);

const packPrediction = (winners) => {
  if (winners.length !== TOTAL_GAMES) {
    throw new Error(`Expected ${TOTAL_GAMES} predictions, got ${winners.length}`);
  }

  let slot1 = 0n;
  let slot2 = 0n;

  for (let i = 0; i < winners.length; i += 1) {
    const pick = Number(winners[i]);
    if (!Number.isInteger(pick) || pick < 1 || pick > 64) {
      throw new Error(`Invalid team number at position ${i}: ${pick}`);
    }

    if (i < TEAMS_PER_SLOT) {
      slot1 |= BigInt(pick) << BigInt(i) * BITS_PER_TEAM;
    } else {
      slot2 |= BigInt(pick) << BigInt(i - TEAMS_PER_SLOT) * BITS_PER_TEAM;
    }
  }

  return { slot1, slot2 };
};

// Known mainnet deployment — used as fallback when running standalone (no monorepo).
const KNOWN_DEPLOYMENTS = {
  8453: "0x8d9a08b06a64be28a3a7b5e5b820561a1876b655",
};

const getContractAddress = async () => {
  if (process.env.CONTRACT_ADDRESS) {
    return getAddress(process.env.CONTRACT_ADDRESS);
  }

  // Try monorepo deployment registry
  try {
    const deploymentRegistryRaw = await fs.readFile(deploymentRegistryPath, "utf8");
    const deploymentRegistry = JSON.parse(deploymentRegistryRaw);
    const sharedAddress = deploymentRegistry?.[String(chainId)]?.basedketball?.address
      ?? deploymentRegistry?.[String(chainId)]?.bracketsbot?.address;
    if (sharedAddress) {
      return getAddress(sharedAddress);
    }
  } catch {
    // Not in monorepo — fall through
  }

  // Try broadcast artifacts
  try {
    const raw = await fs.readFile(deployArtifactPath, "utf8");
    const deploy = JSON.parse(raw);
    const createTx = deploy.transactions?.find(
      (tx) =>
        tx.transactionType === "CREATE" &&
        (tx.contractName === "BracketsBot" || tx.contractName === "Basedketball" || tx.contractName === "BracketBuster"),
    );
    if (createTx?.contractAddress) {
      return getAddress(createTx.contractAddress);
    }
  } catch {
    // No broadcast artifacts — fall through
  }

  // Fall back to known deployment for this chain
  if (KNOWN_DEPLOYMENTS[chainId]) {
    return getAddress(KNOWN_DEPLOYMENTS[chainId]);
  }

  throw new Error(
    `BracketsBot contract address not found. Set CONTRACT_ADDRESS env var or --contract-address flag.`,
  );
};

const main = async () => {
  const predictionRaw = await fs.readFile(predictionFile, "utf8");
  const predictionPayload = JSON.parse(predictionRaw);
  const predictions = predictionPayload.predictions;
  if (!Array.isArray(predictions)) {
    throw new Error("Prediction file missing `predictions` array");
  }

  const contractAddress = await getContractAddress();
  const { slot1, slot2 } = packPrediction(predictions);
  const value = parseEther(entryFeeEth);
  const data = encodeFunctionData({
    abi: bracketsBotAbi,
    functionName: "submitPackedPredictionEth",
    args: [slot1, slot2, getAddress(referrer)],
  });

  const request = {
    kind: "evm_transaction_request",
    chainId,
    to: contractAddress,
    data,
    value: value.toString(),
    valueHex: toHex(value),
    functionName: "submitPackedPredictionEth",
    args: {
      slot1: slot1.toString(),
      slot2: slot2.toString(),
      referrer: getAddress(referrer),
    },
    source: {
      predictionFile,
      entryFeeEth,
    },
  };

  console.log(JSON.stringify(request, null, 2));

  // Clear draft metadata from the walk state file so a fresh walk can start
  try {
    const walkPicksPath = process.env.PICKS_FILE ??
      path.resolve(scriptDir, "../out/model-walk-picks.json");
    const raw = await fs.readFile(walkPicksPath, "utf8");
    const walkState = JSON.parse(raw);
    if (walkState.draftToken || walkState.draftApiUrl) {
      delete walkState.draftToken;
      delete walkState.draftApiUrl;
      await fs.writeFile(walkPicksPath, JSON.stringify(walkState, null, 2) + "\n", "utf8");
    }
  } catch {
    // Best-effort cleanup
  }
};

main().catch((error) => {
  console.error(`INVALID_INPUT: ${error.message}`);
  process.exit(1);
});
