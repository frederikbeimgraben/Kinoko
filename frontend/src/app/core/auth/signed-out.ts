/** A sign-out applies to the tab. This stops the silent renewal from restoring the session. */
const KEY = 'pilzkarte.abgemeldet';

export function signedOutHere(): boolean {
  try {
    return sessionStorage.getItem(KEY) === 'ja';
  } catch {
    // Blocked storage means that the tab has no sign-out record.
    return false;
  }
}

/** Records or clears the sign-out for this tab. */
export function rememberSignOut(signedOut: boolean): void {
  try {
    if (signedOut) sessionStorage.setItem(KEY, 'ja');
    else sessionStorage.removeItem(KEY);
  } catch {
    // Without storage, the sign-out applies only to this page.
  }
}
