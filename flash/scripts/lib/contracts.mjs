import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/** known-contracts.json: the single source of every address this skill touches. */
export const K = JSON.parse(readFileSync(join(here, '..', '..', 'known-contracts.json'), 'utf8'));

export const DYNAMIC_FEE = 0x800000;
export const NATIVE = '0x0000000000000000000000000000000000000000';
/** Base mainnet's per-transaction gas cap. */
export const BASE_TX_GAS_CAP = 16_777_216n;
/** The app's slippage on every trade (5%). */
export const DEFAULT_SLIPPAGE_BPS = 500;
