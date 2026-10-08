/** One step of a motion: the element and the class from `_motion.scss` that animates it. */
export type MotionStep = readonly [Element | null, string];

/** Adds each class and waits for the finite animations of the elements.
 * An endless animation, for example a spinner, does not hold the motion. */
export function playMotion(steps: readonly MotionStep[]): Promise<void> {
  const targets = steps.filter((step): step is readonly [Element, string] => step[0] !== null);
  for (const [element, name] of targets) element.classList.add(name);
  const running = targets.flatMap(([element]) =>
    typeof element.getAnimations === 'function' ? element.getAnimations() : [],
  );
  const finite = running.filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity);
  return Promise.allSettled(finite.map((animation) => animation.finished)).then(() => undefined);
}

/** Removes the classes of an enter motion, so a later leave class has no rival. */
export function clearMotion(steps: readonly MotionStep[]): void {
  for (const [element, name] of steps) element?.classList.remove(name);
}
