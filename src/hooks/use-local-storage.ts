import { useCallback, useRef, useSyncExternalStore } from "react";
import { storage } from "@/lib/storage";

export function useLocalStorage<T>(
  key: string,
  initial: T,
  parse: (raw: string) => T = (raw) => JSON.parse(raw) as T,
  serialize: (value: T) => string = (value) => JSON.stringify(value)
): [T, (value: T) => void] {
  const cacheRef = useRef<{ raw: string | null; value: T } | null>(null);

  const subscribe = useCallback(
    (listener: () => void) => storage.subscribe(key, listener),
    [key]
  );

  const getSnapshot = useCallback((): T => {
    const raw = storage.get(key);
    const cached = cacheRef.current;
    if (cached && cached.raw === raw) {
      return cached.value;
    }
    let value: T = initial;
    if (raw !== null) {
      try {
        value = parse(raw);
      } catch {
        value = initial;
      }
    }
    cacheRef.current = { raw, value };
    return value;
  }, [key, initial, parse]);

  const getServerSnapshot = useCallback((): T => initial, [initial]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const update = useCallback(
    (next: T) => {
      storage.set(key, serialize(next));
    },
    [key, serialize]
  );

  return [value, update];
}

const stringParse = (raw: string) => raw;
const stringSerialize = (v: string) => v;

export function useLocalStorageString(
  key: string,
  initial: string
): [string, (value: string) => void] {
  return useLocalStorage<string>(key, initial, stringParse, stringSerialize);
}

const boolParse = (raw: string) => raw === "true";
const boolSerialize = (v: boolean) => (v ? "true" : "false");

export function useLocalStorageBool(
  key: string,
  initial: boolean
): [boolean, (value: boolean) => void] {
  return useLocalStorage<boolean>(key, initial, boolParse, boolSerialize);
}
