const STORAGE_KEY = 'primordium.device';

/** Die Kennung dieses Geräts. Sie liegt bei jedem Auftrag der Warteschlange. */
export function deviceId(): string {
  try {
    const known = localStorage.getItem(STORAGE_KEY);
    if (known !== null && known !== '') return known;
    const fresh = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}
