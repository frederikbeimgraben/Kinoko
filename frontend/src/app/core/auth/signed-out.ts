/** Ein Abmelden gilt für den Tab, sonst holte die stille Erneuerung die Sitzung zurück. */
const KEY = 'pilzkarte.abgemeldet';

/** Sagt, ob dieser Tab abgemeldet wurde. */
export function signedOutHere(): boolean {
  try {
    return sessionStorage.getItem(KEY) === 'ja';
  } catch {
    // Gesperrter Speicher heißt: der Tab weiß nichts von einem Abmelden.
    return false;
  }
}

/** Merkt das Abmelden für diesen Tab, oder nimmt die Merkung zurück. */
export function rememberSignOut(signedOut: boolean): void {
  try {
    if (signedOut) sessionStorage.setItem(KEY, 'ja');
    else sessionStorage.removeItem(KEY);
  } catch {
    // Ohne Speicher gilt das Abmelden nur für diese Seite.
  }
}
