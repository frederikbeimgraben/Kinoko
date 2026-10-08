/** SSO answers that mean the session has ended. */
const FINAL_ERRORS: readonly string[] = [
  'login_required',
  'interaction_required',
  'consent_required',
  'account_selection_required',
  'invalid_grant',
];

/** Tells if the SSO rejected the session. Any other failure is a network failure. */
export function finalAnswer(failure: unknown): boolean {
  if (typeof failure !== 'object' || failure === null) return false;
  const code = (failure as { error?: unknown }).error;
  return typeof code === 'string' && FINAL_ERRORS.includes(code);
}

/** Retries after a network failure when the app becomes visible again. */
export class ViewRetry {
  private waiting = false;

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
