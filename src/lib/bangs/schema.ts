import { z } from "zod";

/** Validate a search shortcut from stored or imported data. */
export const bangSchema = z.looseObject({
  ad: z.string().optional(),
  d: z.string().min(1),
  s: z.string().min(1),
  u: z.string().min(1),
});

/** Validate a map of search shortcuts. */
export const bangMapSchema = z.record(z.string(), bangSchema);

/** Recover valid shortcuts from a stored map without discarding their neighbors. */
export const storedBangMapSchema = z
  .record(z.string(), z.unknown())
  .transform((map) => {
    const entries: [string, z.infer<typeof bangSchema>][] = [];

    for (const [key, value] of Object.entries(map)) {
      if (
        ["__proto__", "prototype", "constructor"].includes(key.toLowerCase())
      ) {
        continue;
      }

      const bang = bangSchema.safeParse(value);

      if (bang.success) {
        entries.push([key, bang.data]);
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

  return bangMapSchema.parse(value);
};

/** Recover valid entries from a JSON map saved in browser storage.
 * @param raw - Serialized shortcut map.
 * @returns The valid entries from the stored map.
 */
export const parseStoredBangMap = (raw: string) => {
  const value: unknown = JSON.parse(raw);

  return storedBangMapSchema.parse(value);
};
