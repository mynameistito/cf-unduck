/** Normalize a shortcut for storage and lookup.
 * @param shortcut - Shortcut supplied by a user or stored preferences.
 * @returns The trimmed, lowercase shortcut.
 */
export const normalizeShortcut = (shortcut: string): string =>
  shortcut.trim().toLowerCase();

/** Check whether a shortcut is reserved for object internals.
 * @param shortcut - Shortcut to check.
 * @returns Whether the shortcut is reserved.
 */
export const isReservedShortcut = (shortcut: string): boolean =>
  ["__proto__", "prototype", "constructor"].includes(
    normalizeShortcut(shortcut)
  );
