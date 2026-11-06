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

/** Parse a JSON shortcut map.
 * @param raw - Serialized shortcut map.
 * @returns The validated shortcut map.
 */
export const parseBangMap = (raw: string) => {
  const value: unknown = JSON.parse(raw);

  return bangMapSchema.parse(value);
};
