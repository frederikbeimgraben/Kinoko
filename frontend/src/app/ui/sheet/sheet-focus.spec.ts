import { focusTargets, wrapTarget } from './sheet-focus';

function section(html: string): HTMLElement {
  const root = document.createElement('section');
  root.innerHTML = html;
  return root;
}

describe('sheet focus', () => {
  it('skips inert parts, the hidden grip and the elements with tabindex -1', () => {
    const root = section(`
      <button class="sheet__handle">grip</button>
      <div inert><button>inert</button></div>
      <button tabindex="-1">skipped</button>
      <button>close</button>
    `);

    expect(focusTargets(root, true).map((el) => el.textContent)).toEqual(['close']);
    expect(focusTargets(root, false).map((el) => el.textContent)).toEqual(['grip', 'close']);
    expect(focusTargets(null, false)).toEqual([]);
  });

  it('wraps at both ends and from outside the order', () => {
    const [first, middle, last] = ['a', 'b', 'c'].map(() => document.createElement('button'));
    const targets = [first, middle, last];

    expect(wrapTarget(targets, first, true)).toBe(last);
    expect(wrapTarget(targets, last, false)).toBe(first);
    expect(wrapTarget(targets, document.body, true)).toBe(last);
    expect(wrapTarget(targets, middle, false)).toBeNull();
    expect(wrapTarget(targets, middle, true)).toBeNull();
    expect(wrapTarget([], first, true)).toBeNull();
  });
});
