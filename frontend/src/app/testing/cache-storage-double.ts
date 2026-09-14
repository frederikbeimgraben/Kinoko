/** Ein Cache Storage im Speicher. jsdom bringt keinen mit. */
class CacheDouble {
  private readonly entries = new Map<string, Response>();

  match(url: string): Promise<Response | undefined> {
    return Promise.resolve(this.entries.get(url));
  }

  put(url: string, reply: Response): Promise<void> {
    this.entries.set(url, reply);
    return Promise.resolve();
  }

  keys(): Promise<readonly string[]> {
    return Promise.resolve([...this.entries.keys()]);
  }
}

/** Die Speicher der Seite, als Attrappe für `caches`. */
export class CacheStorageDouble {
  private readonly stores = new Map<string, CacheDouble>();

  open(name: string): Promise<CacheDouble> {
    let store = this.stores.get(name);
    if (!store) {
      store = new CacheDouble();
      this.stores.set(name, store);
    }
    return Promise.resolve(store);
  }

  has(name: string): Promise<boolean> {
    return Promise.resolve(this.stores.has(name));
  }

  keys(): Promise<readonly string[]> {
    return Promise.resolve([...this.stores.keys()]);
  }

  delete(name: string): Promise<boolean> {
    return Promise.resolve(this.stores.delete(name));
  }

  async match(url: string): Promise<Response | undefined> {
    for (const store of this.stores.values()) {
      const hit = await store.match(url);
      if (hit) return hit;
    }
    return undefined;
  }
}

/** Legt die Attrappe auf `caches` und gibt sie zurück. */
export function stubCaches(): CacheStorageDouble {
  const storage = new CacheStorageDouble();
  vi.stubGlobal('caches', storage);
  return storage;
}
