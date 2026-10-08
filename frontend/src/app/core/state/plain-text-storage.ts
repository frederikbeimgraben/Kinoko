/** Keeps a string as bare text, so that `withStorageSync` reads the values of older builds. */
export function plainTextStorage(base: () => Storage = () => localStorage): () => Storage {
  return () => {
    const storage = base();
    return {
      get length() {
        return storage.length;
      },
      key: (index: number) => storage.key(index),
      clear: () => {
        storage.clear();
      },
      getItem: (key: string) => {
        const raw = storage.getItem(key);
        return raw === null ? null : JSON.stringify(raw);
      },
      setItem: (key: string, value: string) => {
        const parsed: unknown = JSON.parse(value);
        storage.setItem(key, typeof parsed === 'string' ? parsed : value);
      },
      removeItem: (key: string) => {
        storage.removeItem(key);
      },
    };
  };
}
