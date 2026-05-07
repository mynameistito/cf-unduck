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

const stringParse = (raw: string) => raw;
const stringSerialize = (v: string) => v;

export function useLocalStorageString(
  key: string,
  initial: string
): [string, (value: string) => void] {
  const parse = useCallback(stringParse, []);
  const serialize = useCallback(stringSerialize, []);
  return useLocalStorage<string>(key, initial, parse, serialize);
}

const boolParse = (raw: string) => raw === "true";
const boolSerialize = (v: boolean) => (v ? "true" : "false");

export function useLocalStorageBool(
  key: string,
  initial: boolean
): [boolean, (value: boolean) => void] {
  const parse = useCallback(boolParse, []);
  const serialize = useCallback(boolSerialize, []);
  return useLocalStorage<boolean>(key, initial, parse, serialize);
}
