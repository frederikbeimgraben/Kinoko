import { Directive, afterRenderEffect, computed, input, signal } from '@angular/core';

/** The `view-transition-name` for the shared element `key`, as a valid CSS name. */
export function sharedElementName(key: string): string {
  return `shared-${key.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

/** The `view-transition-class` of each shared element; `_route-motion.scss` times its group. */
const SHARED_CLASS = 'shared';

let source: HTMLElement | null = null;
// The source keeps its name until the target is on the page.
let named: HTMLElement | null = null;
const target = signal<string | null>(null);

function unname(element: HTMLElement): void {
  element.style.removeProperty('view-transition-name');
  element.style.removeProperty('view-transition-class');
}

/** Gives `element` the shared name of `key` for the next route change only, for example
 * the tapped species thumb. The element with `appSharedElement` and the same key is the target. */
export function shareOnNextRoute(element: HTMLElement, key: string): void {
  const name = sharedElementName(key);
  if (named !== null) unname(named);
  source = element;
  named = element;
  element.style.setProperty('view-transition-name', name);
  element.style.setProperty('view-transition-class', SHARED_CLASS);
  target.set(name);
}

/** Connects the pending shared element to a route transition. The source loses its name
 * after the DOM update, so the new page has the name only one time. */
export function attachSharedElement(transition: ViewTransition, skipped: boolean): void {
  const element = source;
  source = null;
  if (element === null) return;
  const clearSource = (): void => {
    unname(element);
  };
  const clearTarget = (): void => {
    target.set(null);
  };
  if (skipped) {
    clearSource();
    clearTarget();
    return;
  }
  void transition.updateCallbackDone.then(clearSource, clearSource);
  void transition.finished.then(clearTarget, clearTarget);
}

/** Removes the name from the source. Two elements with one name stop the transition,
 * and on the wide layout the list with the source stays on the page. */
function releaseSource(): void {
  if (named !== null) unname(named);
  named = null;
}

/** The target of a shared-element move, for example the hero of the species page. */
@Directive({
  selector: '[appSharedElement]',
  host: {
    '[style.view-transition-name]': 'name()',
    '[style.view-transition-class]': 'name() === null ? null : sharedClass',
  },
})
export class SharedElementDirective {
  readonly appSharedElement = input.required<string>();

  protected readonly sharedClass = SHARED_CLASS;

  protected readonly name = computed(() => {
    const name = sharedElementName(this.appSharedElement());
    return target() === name ? name : null;
  });

  constructor() {
    // The target renders in the update of the transition, after the capture of the old page.
    afterRenderEffect({
      write: () => {
        if (this.name() !== null) releaseSource();
      },
    });
  }
}
