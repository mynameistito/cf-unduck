import { useRef, useSyncExternalStore } from "react";

import { storage } from "@/lib/storage";

/** Subscribe to a persisted value.
 * @typeParam T - Stored value type.
 * @param key - Storage key.
 * @param initial - Fallback value.
 * @param parse - Parse the stored text.
 * @param serialize - Serialize a value for storage.
 * @returns The current value and its update function.
 */
export const useLocalStorage = <T>(
  key: string,
  initial: T,
  parse: (raw: string) => T,
  serialize: (value: T) => string
): [T, (value: T) => void] => {
  const cacheRef = useRef<{ raw: string | null; value: T } | null>(null);

  const subscribe = (listener: () => void) => storage.subscribe(key, listener);

  const getSnapshot = (): T => {
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
  };

  const getServerSnapshot = (): T => initial;

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const update = (next: T): void => {
    storage.set(key, serialize(next));
  };

  return [value, update];
};

const stringParse = (raw: string) => raw;
const stringSerialize = (v: string) => v;

/** Subscribe to a persisted string.
 * @param key - Storage key.
 * @param initial - Fallback value.
 * @returns The current value and its update function.
 */
export const useLocalStorageString = (
  key: string,
  initial: string
): [string, (value: string) => void] =>
  useLocalStorage<string>(key, initial, stringParse, stringSerialize);

const boolParse = (raw: string) => raw === "true";
const boolSerialize = (v: boolean) => (v ? "true" : "false");

/** Subscribe to a persisted boolean.
 * @param key - Storage key.
 * @param initial - Fallback value.
 * @returns The current value and its update function.
 */
export const useLocalStorageBool = (
  key: string,
  initial: boolean
): [boolean, (value: boolean) => void] =>
  useLocalStorage<boolean>(key, initial, boolParse, boolSerialize);
