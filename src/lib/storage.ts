/**
 * Storage adapter: the store only talks to this interface, so localStorage can later be swapped for
 * IndexedDB or a server database without touching the UI.
 */
export interface StorageAdapter {
  load(): Promise<unknown | null>;
  save(data: unknown): Promise<void>;
  clear(): Promise<void>;
  /** Optional cross-tab change notification. */
  subscribe?(onExternalChange: (data: unknown | null) => void): () => void;
}

export function localStorageAdapter(key: string): StorageAdapter {
  return {
    async load() {
      if (typeof window === "undefined") return null;
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    },
    async save(data) {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(key, JSON.stringify(data));
    },
    async clear() {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(key);
    },
    subscribe(cb) {
      const onStorage = (e: StorageEvent) => {
        if (e.key !== key) return;
        try {
          cb(e.newValue ? JSON.parse(e.newValue) : null);
        } catch {
          /* ignore malformed external writes */
        }
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
  };
}

/** In-memory adapter (tests, private mode fallback). */
export function memoryAdapter(): StorageAdapter {
  let data: unknown = null;
  return {
    async load() {
      return data;
    },
    async save(d) {
      data = structuredClone(d);
    },
    async clear() {
      data = null;
    },
  };
}
