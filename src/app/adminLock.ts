/**
 * The admin panel's lock: the secret tap run on the title helmet, the passcode check, and whether the panel is open
 * for this session. Nothing is stored: a reload locks it again. The code is compared as a salted SHA-256 (data/admin.ts),
 * computed here in plain TypeScript so it works on any page (crypto.subtle needs a secure context) and synchronously.
 */
import { ADMIN } from '../data/admin';

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/** SHA-256 of a text (UTF-8), as 64 lower-case hex digits (FIPS 180-4). */
export function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const bitLength = bytes.length * 8;
  // Message, a 1 bit, zeros, then the 64-bit length: a whole number of 64-byte blocks.
  const total = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(total);
  data.set(bytes);
  data[bytes.length] = 0x80;
  const view = new DataView(data.buffer);
  view.setUint32(total - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(total - 4, bitLength >>> 0);

  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let block = 0; block < total; block += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(block + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    let f = h[5];
    let g = h[6];
    let hh = h[7];
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += hh;
  }
  let out = '';
  for (let i = 0; i < 8; i++) out += h[i].toString(16).padStart(8, '0');
  return out;
}

/** The hash a typed code is compared by: salted, trimmed and in lower case. */
export function codeHash(code: string, salt: string = ADMIN.passcode.salt): string {
  return sha256Hex(salt + code.trim().toLowerCase());
}

export class AdminLock {
  private open = false;
  private run = 0;
  private lastTap = -Infinity;

  /**
   * `hash` = the hash a code must match (default: the data's). Tests and the ?debug=1 hook give a different one, so
   * the real code never has to be written anywhere. `now` = a millisecond clock.
   */
  constructor(
    private hash: string = ADMIN.passcode.sha256,
    private readonly now: () => number = () => performance.now(),
  ) {}

  get unlocked(): boolean {
    return this.open;
  }

  /**
   * One tap on the title helmet. Returns true on the last tap of a quick run (ADMIN.taps taps, each within
   * ADMIN.tapGapMs of the one before), and starts counting afresh; a slow tap starts a new run.
   */
  tap(): boolean {
    const t = this.now();
    this.run = t - this.lastTap <= ADMIN.tapGapMs ? this.run + 1 : 1;
    this.lastTap = t;
    if (this.run < ADMIN.taps) return false;
    this.run = 0;
    this.lastTap = -Infinity;
    return true;
  }

  /** Check a typed code. A match unlocks the panel for this session; anything else changes nothing. */
  submit(code: string): boolean {
    if (typeof code !== 'string' || code.length === 0 || code.length > ADMIN.maxCodeLength) return false;
    if (codeHash(code) !== this.hash) return false;
    this.open = true;
    return true;
  }

  /** Lock the panel again (the admin button goes away). */
  lock(): void {
    this.open = false;
  }

  /** Compare against another hash from now on (tests and the ?debug=1 hook only). */
  useHash(hash: string): void {
    this.hash = hash.toLowerCase();
  }
}
