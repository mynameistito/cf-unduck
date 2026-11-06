import type { ExtensionPreferences } from "../src/lib/extension-protocol";
import { resolveBangRedirect } from "../src/lib/redirect";
import type { BangMap } from "../src/lib/types";

/** Resolve locally unless the site is needed for settings, unknown bangs, or history.
 * @param query - Search query.
 * @param preferences - Saved extension preferences.
 * @param bangs - Available shortcuts.
 * @param siteOrigin - Origin of the settings site.
 * @returns The destination URL.
 */
export const resolveExtensionNavigation = (
  query: string,
  preferences: ExtensionPreferences,
  bangs: BangMap,
  siteOrigin: string
): string => {
  const result = resolveBangRedirect({ ...preferences, bangs, query });

  return result.kind === "redirect" && !preferences.historyEnabled
    ? result.url
    : `${siteOrigin}/?q=${encodeURIComponent(query)}`;
};
