import { useCallback, useEffect, useState } from "react";
import { storage } from "@/lib/storage";

export function useLocalStorage<T>(
  key: string,
  initial: T,
  parse: (raw: string) => T = (raw) => JSON.parse(raw) as T,
  serialize: (value: T) => string = (value) => JSON.stringify(value)
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    const raw = storage.get(key);
    if (raw !== null) {
      try {
        setValue(parse(raw));
      } catch {
        /* swallow corrupt entry */
      }
    }
  }, [key, parse]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      storage.set(key, serialize(next));
    },
    [key, serialize]
  );

  return [value, update];
}

export function useLocalStorageString(
  key: string,
  initial: string
): [string, (value: string) => void] {
  return useLocalStorage<string>(
    key,
    initial,
    (raw) => raw,
    (v) => v
  );
}
