const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** The rendered focus targets in the section. The scrim is outside it, and a modal hides the grip. */
export function focusTargets(section: Element | null, hideGrip: boolean): HTMLElement[] {
  if (section === null) return [];
  return Array.from(section.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) =>
      el.tabIndex >= 0 &&
      el.closest('[inert]') === null &&
      !(hideGrip && el.classList.contains('sheet__handle')) &&
      (!('checkVisibility' in el) || el.checkVisibility()),
  );
}

/** The element that gets the focus when Tab leaves the trap at an end, or null inside the order. */
export function wrapTarget(
  targets: readonly HTMLElement[],
  active: Element | null,
  back: boolean,
): HTMLElement | null {
  if (targets.length === 0) return null;
  const first = targets[0];
  const last = targets[targets.length - 1];
  const outside = !targets.some((target) => target === active);
  if (back && (active === first || outside)) return last;
  if (!back && active === last) return first;
  return null;
}
