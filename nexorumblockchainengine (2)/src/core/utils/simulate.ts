/**
 * Deterministic pseudo-random helpers used to produce believable "simulated"
 * blockchain data when a plugin has no live RPC connection available.
 * Nothing here is cryptographically secure — it exists purely for demo /
 * offline-friendly UX, never for real address or key generation.
 */

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function hashStringToInt(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
}

/** mulberry32 PRNG — fast, deterministic, good enough for demo data */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRandom(seedInput: string): number {
  return mulberry32(hashStringToInt(seedInput))();
}

/** Stable "balance-like" decimal string derived from an address, in [0, max) */
export function seededBalance(address: string, max = 25): string {
  const rand = mulberry32(hashStringToInt(address.toLowerCase()));
  const value = rand() * max;
  return value.toFixed(6);
}

function randomHex(seedInput: string, length: number): string {
  const rand = mulberry32(hashStringToInt(seedInput) ^ hashStringToInt(String(Date.now())));
  let hex = '';
  for (let i = 0; i < length; i++) {
    hex += Math.floor(rand() * 16).toString(16);
  }
  return hex;
}

export function fakeTxHash(seedInput: string): string {
  return '0x' + randomHex(seedInput, 64);
}

export function fakeContractAddress(seedInput: string): string {
  return '0x' + randomHex(seedInput, 40);
}

export function fakeBase58Address(seedInput: string, length = 44): string {
  const rand = mulberry32(hashStringToInt(seedInput));
  let out = '';
  for (let i = 0; i < length; i++) {
    out += BASE58_ALPHABET[Math.floor(rand() * BASE58_ALPHABET.length)];
  }
  return out;
}
