# BankrNS addresses and calls (Base, chain id 8453)

All contracts are verified on Basescan. Source code and tests: https://github.com/0xleventis/bankr-name-service

## Contracts

| Contract | Address | Role |
|---|---|---|
| RegistrarController | `0x1C8b3a9062a8Aae65105519B394d7ec73C108ee9` | **The only write target**: `commit`, `register`, `renew` |
| UniversalResolver | `0xc21096Ce632428BB6d028fb8512583eB52f46301` | Read helper: `resolve`, `reverse`, `text`, `resolveCoin` |
| BaseRegistrar (ERC-721) | `0x1159CeB0DA0c1E4b3459abC2778310A1F06424F6` | Name NFTs: `ownerOf(id)`, `nameExpires(id)` with `id = uint256(keccak256(label))` |
| BNSRegistry | `0x261E0B1D1FcE91F068982A687fef84AE24302661` | ENS-compatible registry (EIP-137) |
| PublicResolver | `0x611C05015D3bcB34a8242420f46159BA6A8644C7` | Default resolver: address, text and name records |
| ReverseRegistrar | `0x49e07c6a5675aa001F4dA8dDb7974e3cB6E77A42` | Primary names (`addr.reverse`) |

## Official token

| Token | Address | Decimals | Supply |
|---|---|---|---|
| $BNS (BankrNS) | `0x3A23C04dc7b5b6859B68050dB2fcDfFd30793Ba3` | 18 | 100,000,000,000 |

## Reads (UniversalResolver)

- **`resolve(string name) → address`**
  - Returns `address(0)` for unregistered, **expired** or unset names.
  - Expired `.bankr` names (and their subnames) never resolve.
- **`reverse(address) → string`**
  - The primary name, **forward-verified**: it's returned only if the name resolves back to the same address.
- **`resolveCoin(string name, uint256 coinType) → bytes`**
  - Per-chain address (ENSIP-9/11). Base is `2147492101`, and EVM chains fall back to the ENSIP-19 default
    address.
- **`text(string name, string key) → string`**
  - Keys such as `com.twitter`, `avatar` and `url`.

## Writes (RegistrarController)

```solidity
struct Registration {
  string label; address owner; uint256 duration; bytes32 secret;
  address resolver; bytes[] data; bool reverseRecord; bytes32 referrer;
}
function makeCommitment(Registration) pure returns (bytes32);
function commit(bytes32 commitment);                          // step 1, 0 ETH
function register(Registration) payable;                      // step 2, >= 60s and < 24h after commit
function renew(string label, uint256 duration, bytes32 referrer) payable;
function rentPrice(string label, uint256 duration) view returns ((uint256 base, uint256 premium));
function available(string label) view returns (bool);
```

- **`register`:**
  - Charges `base + premium` in ETH and refunds any excess to the sender.
  - `data` holds resolver calls (`setAddr`, `setText`) that are checked on-chain to target only the new name.
- **`renew`:** charges `base` only.
- **Label rules:** `a–z 0–9 -`, 3–63 characters, no leading or trailing hyphen, and no `xx--`.
- **Durations:** minimum 28 days. Names expire into a 90-day grace period in which only renewal is possible.
