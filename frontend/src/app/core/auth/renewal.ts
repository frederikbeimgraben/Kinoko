/** Antworten des SSO, nach denen keine Sitzung mehr steht. */
const FINAL_ERRORS: readonly string[] = [
  'login_required',
  'interaction_required',
  'consent_required',
  'account_selection_required',
  'invalid_grant',
];

/** Sagt, ob das SSO die Sitzung verneint hat. Alles andere ist ein Netzweg. */
export function finalAnswer(failure: unknown): boolean {
  if (typeof failure !== 'object' || failure === null) return false;
  const code = (failure as { error?: unknown }).error;
  return typeof code === 'string' && FINAL_ERRORS.includes(code);
}

/** Der zweite Versuch nach einem Netzfehler, sobald die App wieder sichtbar ist. */
export class ViewRetry {
  private waiting = false;

  /** Legt einen Versuch auf den nächsten Sichtbarkeitswechsel. */
  schedule(again: () => void): void {
    if (this.waiting) return;
    this.waiting = true;
    const onChange = (): void => {
      if (document.visibilityState === 'hidden') return;
      document.removeEventListener('visibilitychange', onChange);
      this.waiting = false;
      again();
    };
    document.addEventListener('visibilitychange', onChange);
  }
}
