# Browser extension

The optional Manifest V3 extension for Chrome and Edge resolves bangs on your device using the same resolver as the website. The full bundled dictionary ships inside the extension; searches do not fetch a dictionary or visit Unduck when history is disabled.

## Install locally

1. Run `bun install`, then `bun run build:extension`.
2. Open `chrome://extensions` (or `edge://extensions`) and enable Developer mode.
3. Choose **Load unpacked** and select the generated `dist-extension` folder.
4. The extension opens the site's settings. Your existing custom bangs, default bang, history preference, and sound preference are copied to extension storage on this device.
5. In the address bar, type `!`, press Space, then enter your query: `!gpt hello` or `hello` for your default engine. Press Enter. The first `!` activates the extension; the second bang is part of the query.

Click the extension toolbar icon to return to site settings. Changes on the site sync automatically while it is open. This is site-to-extension caching on the same browser profile, not account or cross-device sync. The site remains fully usable without installing the extension. Your existing default search engine is unchanged.

The cached preferences survive browser and extension service worker restarts. The extension only runs a content script on the configured site, and only asks for `storage` permission. It does not read other websites or upload your searches. Malformed settings leave the last working snapshot intact. Sound is cached as a preference; direct extension searches do not play the site's sound effects.

When search history is enabled, searches navigate through the site so the existing history and counter continue to work. Direct extension searches do not currently increment the site's search counter. Unknown bangs, empty queries, and `!settings` also fall back to the site. Removing the extension returns you to normal site searches.

The dictionary updates when you rebuild/update the extension; custom bangs update from site settings. This initial package is for local installation, not yet published in a browser store. Firefox and Safari packaging are not included.

## Self-hosting and tests

The production origin defaults to `src/site.config.ts`. To target another origin, set `EXTENSION_SITE_URL` before building. HTTPS is required except for local development. Each build trusts exactly one origin, preventing another site's settings from replacing your cache.

Run `bun run build`, `bun test`, and `bun run test:extension` to verify the app, resolver, and real Chromium extension sync/persistence. The extension tests build against `http://127.0.0.1:4173`; run `bun run build:extension` afterwards to restore the production-targeted package.
