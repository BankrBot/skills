// BankrNS contract addresses (Base mainnet) and the minimal ABIs this skill needs.
// Source of truth: deployments/base.json in https://github.com/0xleventis/bankr-name-service
import { createPublicClient, fallback, http, parseAbi } from "viem";
import { base } from "viem/chains";

export const CHAIN_ID = 8453;

export const CONTRACTS = {
  registry: "0x261E0B1D1FcE91F068982A687fef84AE24302661",
  registrar: "0x1159CeB0DA0c1E4b3459abC2778310A1F06424F6",
  controller: "0x1C8b3a9062a8Aae65105519B394d7ec73C108ee9",
  resolver: "0x611C05015D3bcB34a8242420f46159BA6A8644C7",
  universalResolver: "0xc21096Ce632428BB6d028fb8512583eB52f46301",
};

/** The official $BNS token on Base. Always refer to it by this address, never by ticker alone. */
export const BNS_TOKEN = {
  address: "0x3A23C04dc7b5b6859B68050dB2fcDfFd30793Ba3",
  name: "BankrNS",
  symbol: "BNS",
  decimals: 18,
};

export const erc20Abi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

export const MIN_COMMITMENT_AGE = 60; // seconds, immutable on-chain
export const MAX_COMMITMENT_AGE = 24 * 60 * 60;
export const YEAR = 365 * 24 * 60 * 60;
export const GRACE_PERIOD = 90 * 24 * 60 * 60;
export const COIN_TYPE_DEFAULT = 2n ** 31n; // ENSIP-19: resolves on Base + every EVM chain
export const TWITTER_KEY = "com.twitter";
export const WEBSITE = "https://bankrns.store";

const REGISTRATION =
  "(string label, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, bool reverseRecord, bytes32 referrer)";

export const controllerAbi = parseAbi([
  `function makeCommitment(${REGISTRATION} registration) pure returns (bytes32)`,
  `function register(${REGISTRATION} registration) payable`,
  "function commit(bytes32 commitment)",
  "function commitments(bytes32 commitment) view returns (uint256)",
  "function rentPrice(string label, uint256 duration) view returns ((uint256 base, uint256 premium))",
  "function available(string label) view returns (bool)",
  "function valid(string label) pure returns (bool)",
  "function reserved(bytes32 labelhash) view returns (bool)",
  "function renew(string label, uint256 duration, bytes32 referrer) payable",
]);

export const registrarAbi = parseAbi([
  "function nameExpires(uint256 id) view returns (uint256)",
  "function ownerOf(uint256 id) view returns (address)",
]);

export const resolverAbi = parseAbi([
  "function setAddr(bytes32 node, address a)",
  "function setAddr(bytes32 node, uint256 coinType, bytes addressBytes)",
  "function setText(bytes32 node, string key, string value)",
]);

export const universalAbi = parseAbi([
  "function resolve(string name) view returns (address)",
  "function reverse(address addr) view returns (string)",
  "function text(string name, string key) view returns (string)",
]);

// Free public Base RPCs rate-limit bursts ("over rate limit"), so without BASE_RPC_URL we fail over
// across several of them, with retries and backoff. With BASE_RPC_URL set, only that endpoint is used.
export const PUBLIC_BASE_RPCS = [
  "https://base-rpc.publicnode.com",
  "https://base.drpc.org",
  "https://mainnet.base.org",
  "https://1rpc.io/base",
];
const rpc = (url) => http(url, { batch: true, retryCount: 3, retryDelay: 400 });

export const publicClient = createPublicClient({
  chain: base,
  transport: process.env.BASE_RPC_URL ? rpc(process.env.BASE_RPC_URL) : fallback(PUBLIC_BASE_RPCS.map(rpc)),
});
