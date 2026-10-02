// Reviewed fallback providers from CLI 4.7.2's SDK configuration.
// New providers require review; normal CLI history requests do not use this policy.
const GRAPH_ORIGIN = "https://gateway-arbitrum.network.thegraph.com";
const PROXY_ORIGIN = "https://subgraph-proxy-server-xf2uthetka-as.a.run.app";
const PUBLIC_PATHS = new Map([
  ["https://api.goldsky.com", /^\/api\/public\/[A-Za-z0-9_-]+\/subgraphs\/[A-Za-z0-9_./-]+\/gn$/],
  ["https://api.subgraph.ormilabs.com", /^\/api\/public\/[A-Za-z0-9_-]+\/subgraphs\/[A-Za-z0-9_./-]+\/gn$/],
  ["https://telos.api.ormilabs.com", /^\/api\/public\/[A-Za-z0-9_-]+\/subgraphs\/[A-Za-z0-9_./-]+\/gn$/],
  ["https://api.studio.thegraph.com", /^\/query\/\d+\/[A-Za-z0-9_./-]+$/],
  ["https://graph-node.thundercore.com", /^\/subgraphs\/name\/[A-Za-z0-9_/-]+$/],
  ["https://sushi.laconic.com", /^\/subgraphs\/name\/[A-Za-z0-9_/-]+$/],
  ["https://subgraph.laconic.com", /^\/subgraphs\/name\/[A-Za-z0-9_/-]+$/],
]);

// Additional public URLs from `steer subgraphs` 4.7.2, checked 2026-09-21.
// Exact entries avoid expanding the policy to arbitrary paths on these hosts.
const PUBLIC_URLS = new Set([
  "https://subgraph-prod.goerli.horiza.io/subgraphs/name/retro-arbitrum-one-uniswap-v3",
  "https://squid.subsquid.io/arthswap-v3-astar-squid/v/v1/graphql",
  "https://squid.subsquid.io/arthswap-v3-zkevm-squid/v/v1/graphql",
  "https://analytics-subgraph.hydrex.fi/",
  "https://subgraphs.steer.finance/subgraphs/name/uniswap-v3-bittensor/graphql",
  "https://graph.hyperlock.finance/subgraphs/name/hyperlock/v3-subgraph-mainnet",
  "https://api.thegraph.com/subgraphs/name/thenaursa/thena-fusion",
  "https://thegraph.coredao.org/subgraphs/name/glyph/algebra",
  "https://subgraph.evmos.org/subgraphs/name/forge-subgraph",
  "https://kava-graph-node.metavault.trade/subgraphs/name/kinetixfi/v3-subgraph",
  "https://subgraph-api.mantle.xyz/subgraphs/name/crust-v3-subgraph",
  "https://subgraph-api.mantle.xyz/subgraphs/name/fusionx/exchange-v3",
  "https://metisapi.0xgraph.xyz/subgraphs/name/cryptoalgebra/analytics",
  "https://subgraph.steer.finance/maia-dao/subgraphs/name/maia-dao/uniswap-v3",
  "https://graph.beamswap.io/subgraphs/name/beamswap/beamswap-amm-v3-temp",
  "https://index-api.onfinality.io/sq/PolEpie/silverswap-liquidity-nibiru",
  "https://subgraph.steer.finance/quickswap-x1-testnet/subgraphs/name/quickswap-univ3",
  "https://api.thegraph.com/subgraphs/name/ruvlol/univ3-test",
  "https://api.studio.thegraph.com/query/44554/quickswap-v3-02/0.0.7?source=quickswap",
  "https://subgraph.sailor.finance/subgraphs/name/sailor",
  "https://api.0xgraph.xyz/api/public/28820bd2-ad8b-4d40-a142-ce8d7c786f66/subgraphs/spookyswap/v3/v0.0.1/gn",
  "https://equalizer-backend.duckdns.org/graphql",
  "https://api.telos.0xgraph.xyz/api/public/f59149ee-c99a-41d0-afe4-1c86170a98b0/subgraphs/swapsicle/analytics/prod/gn",
  "https://graph.zklink.io/subgraphs/name/novaswap",
]);

function unsupported() {
  return new Error("SUBGRAPH_ENDPOINT_UNSUPPORTED: fallback endpoint does not match the approved provider policy.");
}

export function selectProtocolEndpoint(entries, { chain, protocol }) {
  const matches = entries.filter((entry) => entry?.type === "protocol"
    && entry.chain?.alias === chain && entry.protocol?.alias === protocol);
  if (matches.length !== 1 || typeof matches[0].url !== "string") {
    throw new Error("SUBGRAPH_ENDPOINT_AMBIGUOUS: expected one protocol endpoint for the requested chain and protocol.");
  }
  return matches[0].url;
}

export function resolveFallbackEndpoint(rawUrl, key) {
  let url;
  try {
    if (typeof rawUrl !== "string" || /[\s\\]/.test(rawUrl)) throw unsupported();
    url = new URL(rawUrl);
  } catch {
    throw unsupported();
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw unsupported();
  }
  if (PUBLIC_URLS.has(url.href)) {
    return { url: url.href, headers: { "content-type": "application/json" } };
  }
  if (url.search) throw unsupported();
  let contentType = "application/json";
  if (url.origin === GRAPH_ORIGIN) {
    const match = /^\/api\/([^/]*)\/(subgraphs|deployments)\/id\/([A-Za-z0-9]+)$/.exec(url.pathname);
    if (!match || typeof key !== "string" || !key || key === "." || key === "..") throw unsupported();
    let embedded;
    try { embedded = decodeURIComponent(match[1]); } catch { throw unsupported(); }
    if (embedded && embedded !== key) throw unsupported();
    url.pathname = `/api/${encodeURIComponent(key)}/${match[2]}/id/${match[3]}`;
  } else if (url.origin === PROXY_ORIGIN) {
    if (!/^\/gateway-arbitrum\/[A-Za-z0-9]+$/.test(url.pathname)) throw unsupported();
    contentType = "text/plain;charset=UTF-8";
  } else {
    const path = PUBLIC_PATHS.get(url.origin);
    if (!path?.test(url.pathname)) throw unsupported();
  }
  return { url: url.href, headers: { "content-type": contentType } };
}

export async function requestFallbackHistory(rawUrl, key, body, fetchImpl = fetch) {
  const destination = resolveFallbackEndpoint(rawUrl, key);
  let status;
  try {
    const response = await fetchImpl(destination.url, {
      method: "POST",
      headers: destination.headers,
      body: JSON.stringify(body),
      redirect: "error",
    });
    if (!response.ok) {
      if (Number.isInteger(response.status) && response.status >= 100 && response.status <= 599) status = response.status;
      throw new Error();
    }
    return await response.json();
  } catch {
    // Transport errors can include the credential-bearing URL.
    throw new Error(`SUBGRAPH_REQUEST_FAILED: compatibility history request failed${status ? ` (HTTP ${status})` : ""}.`);
  }
}
