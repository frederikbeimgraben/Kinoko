import { createHash } from 'node:crypto';
import { Sha256, sha256Hex } from './sha256';

const text = (value: string): Uint8Array => new TextEncoder().encode(value);

/** The test vectors of FIPS 180-4 and NIST CSRC. */
const VECTORS: readonly [string, string][] = [
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  [
    'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  ],
  [
    'abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu',
    'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1',
  ],
];

describe('Sha256', () => {
  it.each(VECTORS)('hashes %j to the known digest', (input, digest) => {
    expect(sha256Hex(text(input))).toBe(digest);
  });

  it('hashes one million times "a" in uneven parts', () => {
    const hash = new Sha256();
    const part = new Uint8Array(997).fill(0x61);
    let left = 1_000_000;
    while (left > 0) {
      const size = Math.min(part.length, left);
      hash.update(part.subarray(0, size));
      left -= size;
    }

    expect(hash.hex()).toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
  });

  it('gives the same digest for each split of the input', () => {
    const bytes = Uint8Array.from({ length: 1000 }, (_, at) => (at * 31 + 7) & 0xff);
    const whole = createHash('sha256').update(bytes).digest('hex');

    for (const cut of [1, 55, 56, 63, 64, 65, 127, 128, 500, 999]) {
      const hash = new Sha256().update(bytes.subarray(0, cut)).update(bytes.subarray(cut));
      expect(hash.hex()).toBe(whole);
    }
  });

  it('hashes the lengths around the padding edge like node', () => {
    for (const size of [55, 56, 57, 63, 64, 65, 119, 120]) {
      const bytes = new Uint8Array(size).fill(size);
      expect(sha256Hex(bytes)).toBe(createHash('sha256').update(bytes).digest('hex'));
    }
  });

  it('refuses more bytes after the digest', () => {
    const hash = new Sha256().update(text('abc'));
    hash.hex();

    expect(() => hash.update(text('d'))).toThrow('sha256_finished');
    expect(hash.hex()).toBe(VECTORS[1][1]);
  });
});
