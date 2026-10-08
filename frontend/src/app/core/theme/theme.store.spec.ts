import { TestBed } from '@angular/core/testing';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { ThemeStore, effectiveTheme } from './theme.store';

type Listener = (event: MediaQueryListEvent) => void;

let listener: Listener | null = null;
let systemDark = false;

function mediaMock(): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: systemDark,
        media: query,
        addEventListener: (_: string, handler: Listener) => {
          listener = handler;
        },
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

/** A new store for each test: the store reads the choice when it starts. */
function store(): ThemeStore {
  TestBed.resetTestingModule();
  const theme = TestBed.inject(ThemeStore);
  TestBed.tick();
  return theme;
}

describe('effectiveTheme', () => {
  it('follows the system only under "system"', () => {
    expect(effectiveTheme('system', true)).toBe('dunkel');
    expect(effectiveTheme('system', false)).toBe('hell');
    expect(effectiveTheme('hell', true)).toBe('hell');
    expect(effectiveTheme('dunkel', false)).toBe('dunkel');
  });
});

describe('ThemeStore', () => {
  beforeEach(() => {
    listener = null;
    systemDark = false;
    mediaMock();
    localStorage.removeItem('pilzkarte.theme');
    document.documentElement.removeAttribute('data-theme');
  });

  it('follows the system at the start', () => {
    systemDark = true;
    const theme = store();

    expect(theme.choice()).toBe('system');
    expect(theme.effective()).toBe('dunkel');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('paints the page before the first tick', () => {
    systemDark = true;
    TestBed.resetTestingModule();
    TestBed.inject(ThemeStore);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('accepts a fixed choice and keeps it as bare text', () => {
    const theme = store();

    theme.setChoice('dunkel');
    TestBed.tick();

    expect(theme.effective()).toBe('dunkel');
    expect(localStorage.getItem('pilzkarte.theme')).toBe('dunkel');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('follows a change of the operating system under "system"', () => {
    const theme = store();

    listener?.({ matches: true } as MediaQueryListEvent);
    TestBed.tick();

    expect(theme.effective()).toBe('dunkel');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('keeps a fixed choice when the system changes', () => {
    const theme = store();
    theme.setChoice('hell');

    listener?.({ matches: true } as MediaQueryListEvent);

    expect(theme.effective()).toBe('hell');
  });

  it('reads the saved choice at the start', () => {
    localStorage.setItem('pilzkarte.theme', 'dunkel');

    expect(store().choice()).toBe('dunkel');
  });

  it('ignores a saved value that is not a choice', () => {
    localStorage.setItem('pilzkarte.theme', 'purple');

    expect(store().choice()).toBe('system');
  });

  it('works without storage', () => {
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    const theme = store();
    theme.setChoice('hell');
    TestBed.tick();

    expect(theme.choice()).toBe('hell');
    read.mockRestore();
    write.mockRestore();
  });

  it('paints the system bars in the theme that shows', () => {
    const theme = store();
    theme.setChoice('dunkel');
    TestBed.tick();

    const metas = document.head.querySelectorAll('meta[name="theme-color"]');
    expect(metas.length).toBe(1);
    expect(metas[0].getAttribute('content')).toBe('#111411');
    expect(metas[0].hasAttribute('media')).toBe(false);
    expect(document.head.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('dark');

    theme.setChoice('hell');
    TestBed.tick();

    expect(document.head.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#f6faf4');
    expect(document.head.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('light');
  });

  it('derives the theme from a patched state', () => {
    const theme = store();

    patchState(unprotected(theme), { choice: 'system', systemDark: true });

    expect(theme.effective()).toBe('dunkel');
  });
});
