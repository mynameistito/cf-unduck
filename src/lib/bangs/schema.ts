import { z } from "zod";

import { normalizeWebUrl } from "../redirect";

/** Validate a search shortcut from stored or imported data. */
const bangSchema = z.looseObject({
  ad: z.string().optional(),
  d: z.string().min(1),
  s: z.string().min(1),
  u: z.string().min(1),
});

/** Validate a map of search shortcuts. */
export const bangMapSchema = z.record(z.string(), bangSchema);

const webDestination = z
  .string()
  .min(1)
  .refine((value) => normalizeWebUrl(value) !== null);

/** Check whether a shortcut is reserved for object internals.
 * @param shortcut - Shortcut to check.
 * @returns Whether the shortcut is reserved.
 */
export const isReservedShortcut = (shortcut: string): boolean =>
  ["__proto__", "prototype", "constructor"].includes(shortcut.toLowerCase());

/** Validate a custom shortcut whose destinations must be HTTP(S) URLs. */
export const customBangSchema = bangSchema.extend({
  ad: webDestination.optional(),
  d: webDestination,
  u: webDestination,
});

/** Validate a map of custom shortcuts. */
export const customBangMapSchema = z.record(
  z
    .string()
    .trim()
    .min(1)
    .toLowerCase()
    .refine((shortcut) => !isReservedShortcut(shortcut)),
  customBangSchema
);

/** Recover valid shortcuts from a stored map without discarding their neighbors. */
export const storedBangMapSchema = z
  .record(z.string(), z.unknown())
  .transform((map) => {
    const entries: [string, z.infer<typeof bangSchema>][] = [];

    for (const [key, value] of Object.entries(map)) {
      const shortcut = key.trim().toLowerCase();

      if (shortcut === "" || isReservedShortcut(shortcut)) {
        continue;
      }

      const bang = customBangSchema.safeParse(value);

      if (bang.success) {
        entries.push([shortcut, bang.data]);
      }
    }

    return Object.fromEntries(entries);
  });

/** Parse a JSON shortcut map.
 * @param raw - Serialized shortcut map.
 * @returns The validated shortcut map.
 */
export const parseBangMap = (raw: string) => {
  const value: unknown = JSON.parse(raw);

  return customBangMapSchema.parse(value);
};

/** Recover valid entries from a JSON map saved in browser storage.
 * @param raw - Serialized shortcut map.
 * @returns The valid entries from the stored map.
 */
export const parseStoredBangMap = (raw: string) => {
  const value: unknown = JSON.parse(raw);

  return storedBangMapSchema.parse(value);
};
