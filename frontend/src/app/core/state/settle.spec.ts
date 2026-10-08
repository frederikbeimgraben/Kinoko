import { EMPTY, of, throwError } from 'rxjs';
import { confirmed, settle } from './settle';

describe('settle', () => {
  it('gives the answer of the request', async () => {
    await expect(settle(of(4))).resolves.toBe(4);
  });

  it('gives null for a failure', async () => {
    await expect(settle(throwError(() => new Error('down')))).resolves.toBeNull();
  });
});

describe('confirmed', () => {
  it('makes an answer without a body true', async () => {
    await expect(settle(confirmed(of(null)))).resolves.toBe(true);
    await expect(settle(confirmed(EMPTY))).resolves.toBe(true);
  });
});
