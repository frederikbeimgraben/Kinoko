/** A streaming SHA-256 per FIPS 180-4. SubtleCrypto hashes only a whole buffer,
 * so a file of many gigabytes needs this incremental form. */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
]);

const INITIAL = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

const BLOCK = 64;

/** The rotation to the right of a 32-bit word. */
function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

/** The hash state. The class changes its own buffers in place: a copy per block would be too slow for gigabytes. */
export class Sha256 {
  private readonly state = new Uint32Array(INITIAL);
  private readonly words = new Uint32Array(64);
  private readonly pending = new Uint8Array(BLOCK);
  private held = 0;
  private length = 0;
  private done = false;

  /** Adds bytes to the hash. Call it as often as necessary, then call {@link hex} once. */
  update(bytes: Uint8Array): this {
    if (this.done) throw new Error('sha256_finished');
    this.length += bytes.length;
    let at = 0;
    if (this.held > 0) {
      const take = Math.min(BLOCK - this.held, bytes.length);
      this.pending.set(bytes.subarray(0, take), this.held);
      this.held += take;
      at = take;
      if (this.held < BLOCK) return this;
      this.block(this.pending, 0);
      this.held = 0;
    }
    for (; at + BLOCK <= bytes.length; at += BLOCK) this.block(bytes, at);
    this.pending.set(bytes.subarray(at), 0);
    this.held = bytes.length - at;
    return this;
  }

  /** Ends the hash and gives the digest as 64 lower-case hex characters. */
  hex(): string {
    if (!this.done) this.finish();
    return Array.from(this.state, (word) => word.toString(16).padStart(8, '0')).join('');
  }

  private finish(): void {
    const bits = this.length * 8;
    const tail = new Uint8Array(this.held < 56 ? BLOCK : BLOCK * 2);
    tail.set(this.pending.subarray(0, this.held));
    tail[this.held] = 0x80;
    const view = new DataView(tail.buffer);
    // The length is a 64-bit big-endian count of bits. A file stays below 2^53 bits.
    view.setUint32(tail.length - 8, Math.floor(bits / 0x100000000));
    view.setUint32(tail.length - 4, bits >>> 0);
    for (let at = 0; at < tail.length; at += BLOCK) this.block(tail, at);
    this.done = true;
  }

  private block(bytes: Uint8Array, at: number): void {
    const w = this.words;
    for (let i = 0; i < 16; i += 1) {
      const p = at + i * 4;
      w[i] = (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3];
    }
    for (let i = 16; i < 64; i += 1) {
      const a = w[i - 15];
      const b = w[i - 2];
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    const s = this.state;
    let [a, b, c, d, e, f, g, h] = [s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7]];
    for (let i = 0; i < 64; i += 1) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    s[0] += a;
    s[1] += b;
    s[2] += c;
    s[3] += d;
    s[4] += e;
    s[5] += f;
    s[6] += g;
    s[7] += h;
  }
}

/** The SHA-256 of a whole buffer, for small inputs and tests. */
export function sha256Hex(bytes: Uint8Array): string {
  return new Sha256().update(bytes).hex();
}
