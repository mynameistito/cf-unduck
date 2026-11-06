import { z } from "zod";

import { EXTENSION_STATUS } from "./extension-protocol";
import type { ExtensionPreferences } from "./extension-protocol";
import { normalizeWebUrl } from "./redirect";
import { isReservedShortcut } from "./shortcut";

const webUrl = z.string().refine((value) => normalizeWebUrl(value) !== null);

const shortcut = z
  .string()
  .trim()
  .min(1)
  .toLowerCase()
  .refine((key) => !isReservedShortcut(key));

const preferencesSchema = z.object({
  customBangs: z.record(
    shortcut,
    z.object({
      d: webUrl,
      s: z.string().min(1),
      u: webUrl,
      ad: webUrl.optional(),
    })
  ),
  defaultBangShortcut: shortcut,
  historyEnabled: z.boolean(),
  soundEnabled: z.boolean(),
});

/** Parse untrusted messages at the extension storage boundary.
 * @param value - Untrusted stored or received value.
 * @returns Validated preferences, or null for invalid input.
 */
export const parseExtensionPreferences = (
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- This is the I/O parser; Zod establishes the preferences contract below.
  value: unknown
): ExtensionPreferences | null => {
  const parsed = preferencesSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
};

export const extensionResponseSchema = z.object({ ok: z.boolean() });

export const extensionStatusSchema = extensionResponseSchema.extend({
  type: z.literal(EXTENSION_STATUS),
});
