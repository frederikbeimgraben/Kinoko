import { DestroyRef, computed, effect, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { plainTextStorage, withStorageSync } from '../state';

export type ThemeChoice = 'hell' | 'dunkel' | 'system';
export type EffectiveTheme = 'hell' | 'dunkel';

interface ThemeState {
  choice: ThemeChoice;
  systemDark: boolean;
}

const STORAGE_KEY = 'pilzkarte.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** The ui kit expects `data-theme="light|dark"` on `<html>`. */
const AS_ATTRIBUTE: Record<EffectiveTheme, string> = { hell: 'light', dunkel: 'dark' };

/** `--bg` of each theme: the header and the tab bar touch the system bars. */
const SYSTEM_BAR: Record<EffectiveTheme, string> = { hell: '#f6faf4', dunkel: '#111411' };

function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'hell' || value === 'dunkel' || value === 'system';
}

/** The theme that shows for a choice and the dark setting of the operating system. */
export function effectiveTheme(choice: ThemeChoice, systemDark: boolean): EffectiveTheme {
  if (choice === 'system') return systemDark ? 'dunkel' : 'hell';
  return choice;
}

function meta(name: string): HTMLMetaElement {
  const found = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (found !== null) return found;
  const created = document.createElement('meta');
  created.name = name;
  document.head.append(created);
  return created;
}

function paint(theme: EffectiveTheme): void {
  document.documentElement.setAttribute('data-theme', AS_ATTRIBUTE[theme]);
  // A `theme-color` with a `media` query wins over ours, so only one tag stays.
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((tag) => {
    tag.remove();
  });
  meta('theme-color').setAttribute('content', SYSTEM_BAR[theme]);
  meta('color-scheme').setAttribute('content', AS_ATTRIBUTE[theme]);
}

/** Light, dark or system. Under "system" the app follows the operating system live. */
export const ThemeStore = signalStore(
  { providedIn: 'root' },
  withState<ThemeState>({ choice: 'system', systemDark: false }),
  withStorageSync<ThemeState, ThemeChoice>({
    key: STORAGE_KEY,
    select: (state) => state.choice,
    restore: (stored) => (isThemeChoice(stored) ? { choice: stored } : null),
    storage: plainTextStorage(),
  }),
  withComputed(({ choice, systemDark }) => ({
    /** The theme that shows. */
    effective: computed(() => effectiveTheme(choice(), systemDark())),
  })),
  withMethods((store) => ({
    setChoice(choice: ThemeChoice): void {
      patchState(store, { choice });
    },
  })),
  withHooks({
    onInit(store) {
      const medium = matchMedia(DARK_QUERY);
      patchState(store, { systemDark: medium.matches });
      const follow = (event: MediaQueryListEvent): void => {
        patchState(store, { systemDark: event.matches });
      };
      medium.addEventListener('change', follow);
      inject(DestroyRef).onDestroy(() => {
        medium.removeEventListener('change', follow);
      });
      // The first frame must not show the wrong theme, so paint once before the effect runs.
      paint(store.effective());
      effect(() => {
        paint(store.effective());
      });
    },
  }),
);

/** The instance type of {@link ThemeStore}. */
export type ThemeStore = InstanceType<typeof ThemeStore>;
