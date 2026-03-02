# Foundry Wallet Setup Guide

This guide covers setting up a wallet for use with the swap execution workflows.

## Install Foundry

```bash
# Install foundryup (downloads and runs installer script)
curl -L https://foundry.paradigm.xyz | bash

# Install foundry tools (cast, forge, anvil)
foundryup

# Verify installation
cast --version
```

> **Note:** Piping a URL to bash is standard practice for Foundry but carries supply chain risk.

---

## Option A: Encrypted Keystore (Recommended)

The most secure method for automation. Your private key is encrypted with a password.

### Step 1: Import Private Key

```bash
cast wallet import mykey --interactive
```

You'll be prompted to:
1. Enter your private key (starts with `0x`)
2. Set an encryption password

The keystore is saved to `~/.foundry/keystores/mykey`

### Step 2: Create Password File

For automation, store the password in a file:

```bash
# Create password file securely (prompts without echoing to terminal)
read -s -p "Password: " pw && echo "$pw" > ~/.foundry/.password && chmod 600 ~/.foundry/.password
```

> **Security note:** This stores the keystore password as plaintext on disk. While `chmod 600` restricts access to the file owner, any process running as your user, malware, or backup tools could read it. **Use this for development/testing only.** For production with significant funds, use a hardware wallet (Ledger/Trezor) or interactive password entry.

### Step 3: Verify Setup

```bash
# List keystores
cast wallet list

# Get address from keystore
cast wallet address --account mykey --password-file ~/.foundry/.password
```

### Step 4: Test Transaction (Dry Run)

```bash
# Simulate a transaction (doesn't broadcast)
cast call \
  --rpc-url https://rpc.ankr.com/eth \
  0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  "balanceOf(address)(uint256)" \
  $(cast wallet address --account mykey --password-file ~/.foundry/.password)
```

### Using with swap execution

```bash
cast send \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --account mykey \
  --password-file ~/.foundry/.password \
  --gas-limit 350000 \
  --value 10000000000000000 \
  0x6131B5fae19EA4f9D964eAc0408E4408b66337b5 \
  0x...calldata...
```

---

## Option B: Environment Variable (NOT RECOMMENDED for production)

Simple but **least secure**. The key is stored in plaintext in your shell environment.

### Setup

**Recommended: Encrypted Keystore** — See Option A above. If you must use an environment variable:

```bash
# Set in current session only — do NOT persist to ~/.bashrc or ~/.zshrc
read -s -p "Enter private key: " PRIVATE_KEY && export PRIVATE_KEY
```

**NEVER add private keys to shell profile files (`~/.bashrc`, `~/.zshrc`, `~/.profile`).** These files are persisted on disk, may be backed up, committed to version control, or read by other processes.

**NEVER echo, print, log, or display any private key value, even in error messages or debug output.**

### Using with swap execution

```bash
cast send \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY \
  --gas-limit 350000 \
  --value 10000000000000000 \
  0x6131B5fae19EA4f9D964eAc0408E4408b66337b5 \
  0x...calldata...
```

### Security Warnings

> **This method exposes your private key in multiple ways:**
> - **Process listings** (`ps aux`) — command-line arguments are world-readable on most systems
> - **Shell history** (`~/.bash_history`, `~/.zsh_history`) — the export command is recorded
> - **Environment inheritance** — child processes and crash dumps may contain the key
> - **CI/CD logs** — if used in pipelines, the key may appear in build logs

- Never commit `.bashrc` or `.zshrc` to git
- Use a dedicated wallet with **limited funds** for testing only
- **Use keystore or hardware wallet for any significant funds**

---

## Option C: Ledger Hardware Wallet

Most secure. Private key never leaves the device.

### Prerequisites

1. Ledger device connected via USB
2. Ledger Live closed (releases USB connection)
3. Ethereum app open on Ledger

### Using with swap execution

```bash
cast send \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --ledger \
  --gas-limit 350000 \
  --value 10000000000000000 \
  0x6131B5fae19EA4f9D964eAc0408E4408b66337b5 \
  0x...calldata...
```

You'll need to physically confirm the transaction on the Ledger device.

### Specify HD Path (Optional)

```bash
# Default path: m/44'/60'/0'/0/0
# Use different account:
cast send --ledger --mnemonic-index 1 ...
```

---

## Option D: Trezor Hardware Wallet

Similar to Ledger, private key stays on device.

### Prerequisites

1. Trezor device connected
2. Trezor Suite closed
3. Passphrase set up (if using)

### Using with swap execution

```bash
cast send \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --trezor \
  --gas-limit 350000 \
  --value 10000000000000000 \
  0x6131B5fae19EA4f9D964eAc0408E4408b66337b5 \
  0x...calldata...
```

---

## Managing Multiple Wallets

### Create Multiple Keystores

```bash
cast wallet import trading --interactive    # Trading wallet
cast wallet import testing --interactive    # Test wallet
cast wallet import mainwallet --interactive # Main wallet
```

### List All Keystores

```bash
cast wallet list
```

Output:
```
trading (0x1234...abcd)
testing (0x5678...efgh)
mainwallet (0x9abc...ijkl)
```

### Use Specific Keystore

```bash
cast send --account trading --password-file ~/.foundry/.password ...
cast send --account testing --password-file ~/.foundry/.password ...
```

---

## Security Best Practices

| Practice | Why |
|----------|-----|
| Use keystore, not env var | Encrypted at rest |
| `chmod 600` password file | Only owner can read |
| Separate wallets for testing | Limit exposure |
| Hardware wallet for large amounts | Key never exposed |
| Don't commit secrets to git | Add to `.gitignore` |

### Recommended .gitignore

```
# Foundry secrets
.password
*.keystore
.env
.env.*
```

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| `No keystore found` | Run `cast wallet import NAME --interactive` |
| `Invalid password` | Check password file contents, no trailing newline |
| `Ledger not found` | Close Ledger Live, reconnect device |
| `Insufficient funds` | Check balance with `cast balance ADDRESS --rpc-url URL` |
| `Nonce too low` | Pending tx exists, wait or speed up |

### Check Balance

```bash
cast balance 0xYourAddress --rpc-url https://rpc.ankr.com/eth
```

### Check Pending Transactions

```bash
cast tx 0xTxHash --rpc-url https://rpc.ankr.com/eth
```
