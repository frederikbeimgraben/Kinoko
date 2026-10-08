/** A byte-limited cache for raw value tiles: one byte per pixel, 5 to 40 kB per tile. A coloured tile
 * needs four bytes per pixel (256 kB). Thus the cache holds the preloaded adjacent weeks,
 * and a week change needs no network request. */
export class TileCache {
  // A Map keeps the insertion order. The oldest entry is first,
  // so it goes first when the cache reaches the limit.
  private readonly eintraege = new Map<string, ArrayBuffer | null>();
  private used = 0;

  constructor(private readonly bound: number) {}

  /** `undefined` means unknown. `null` means checked and not available. */
  get(url: string): ArrayBuffer | null | undefined {
    const content = this.eintraege.get(url);
    if (content === undefined) return undefined;
    // A hit moves the entry to the end. Otherwise the cache removes
    // the tile under the pointer that the map uses all the time.
    this.eintraege.delete(url);
    this.eintraege.set(url, content);
    return content;
  }

  put(url: string, content: ArrayBuffer | null): void {
    const alt = this.eintraege.get(url);
    if (alt !== undefined) this.used -= alt?.byteLength ?? 0;
    this.eintraege.set(url, content);
    this.used += content?.byteLength ?? 0;
    for (const [oldest, value] of this.eintraege) {
      if (this.used <= this.bound) break;
      if (oldest === url) break;
      this.eintraege.delete(oldest);
      this.used -= value?.byteLength ?? 0;
    }
  }

  get bytes(): number {
    return this.used;
  }

  get anzahl(): number {
    return this.eintraege.size;
  }
}
