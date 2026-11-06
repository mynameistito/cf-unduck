# cf-unduck

Fast DuckDuckGo bang redirects on Cloudflare Workers. The React + Vite + TanStack Router app is served as static assets, with a Worker handling redirects and search suggestions.

Live: https://unduck.xyz

## Credit

Remade from [taciturnaxolotl/unduckified](https://github.com/taciturnaxolotl/unduckified), itself a fork of [t3dotgg/unduck](https://github.com/t3dotgg/unduck).

- turnaxolot1's hosted version: [s.dunkirk.sh](https://s.dunkirk.sh)
- Theo's hosted original: [unduck.link](https://unduck.link)

## Quick Start

Add as custom search engine in your browser:

```
https://unduck.xyz?q=%s
```

Then `!gh react` → GitHub search for "react". No bang → falls back to DuckDuckGo (configurable in settings).

## How is it that much faster?

DuckDuckGo's bang redirects add a server hop. cf-unduck resolves bangs directly:

- **Server redirect**: The Worker resolves the bang from its bundled dictionary and returns a 302 without a cache lookup or upstream request. Redirect responses use `no-store` so changes to preferences and destinations take effect on the next request.
- **Custom preferences**: When a `udprefs` cookie is present, redirects are private and not stored in shared caches.
- **Service-worker redirect**: After the first visit, the service worker resolves searches using the precached bang dictionary and preferences mirrored in IndexedDB. It returns a redirect before React loads and can resolve searches offline (the destination still needs a connection). Full custom bangs persist locally, including collections too large for the preferences cookie.
- **App fallback**: History-enabled searches use the cached app to preserve local history recording. Unknown bangs, settings queries, and unavailable browser storage also fall back to the app. If its cache is unavailable, the service worker fetches the app shell from the network so counts and history are still recorded before redirecting.

The `udprefs` cookie carries the default bang and custom bangs needed by server-side redirects; other settings remain in browser storage. Fast-path redirects persist only an aggregate counter, which is added to the existing app search count; they do not store search text. Browser data clearing resets the corresponding local state.

## Features

- Bangs (DuckDuckGo + [Kagi](https://github.com/kagisearch/bangs/)), hashmapped for O(1) lookup
- Server-side redirects from an in-memory dictionary and service-worker redirects before React loads
- Search suggestions endpoint (`/suggest`) proxying Google with a 60-second cache
- [OpenSearch](https://developer.mozilla.org/en-US/docs/Web/XML/Guides/OpenSearch) support (browser auto-discovery)
- PWA / installable
- Settings: default bang and custom bangs are synced via the `udprefs` cookie so server redirects honor them; the history toggle is stored locally
- Empty-query bang → base site (e.g. `!g` → google.com)
- Suffix bangs (`ghr! user/repo` → that GitHub repo)
- Quick settings (`!settings` or `!`)
- Local search history (off by default, clearable)
- Dark mode, sound effects (respects `prefers-reduced-motion`), text animations
- Local font file (no Google Fonts)
- Auto-updating bangs file via fetch script

## Search Suggestions

Firefox has a dedicated suggestions URL field. Use the built-in Google suggestions proxy (cached for 60 seconds):

```
https://unduck.xyz/suggest?q=%s
```

Or point straight at an upstream:

```
https://duckduckgo.com/ac/?q=%s&type=list
https://www.google.com/complete/search?client=chrome&q=%s
```

## Self-hosting

Prerequisites: [Bun](https://bun.com) and a Cloudflare account. Alchemy stores local credentials in its `default` profile; GitHub Actions uses the Cloudflare secrets described in [CI deployments](#ci-deployments).

1. **Clone & install**

   ```bash
   git clone https://github.com/mynameistito/cf-unduck
   cd cf-unduck
   bun install
   ```

2. **Edit `src/site.config.ts`** — set your production domain, repository details, and footer credit:

   ```ts
   export const SITE = {
     name: "my-search",
     domain: "search.yourdomain.com",
     githubUser: "your-username",
     repo: "cf-unduck",
     author: { name: "your-name", url: "https://yourdomain.com" },
   } as const;
   ```

3. **Update deployment names if needed** — if your Worker should have a different name, change `APP_NAME` in `alchemy.run.ts` and `worker-name` in `.github/workflows/deploy.yml`. Change `production-url` in that workflow to your production URL too. The production domain is read from `src/site.config.ts`; pull-request previews use isolated `pr-*` stages.

4. **(Optional) Refresh bangs**

   ```bash
   bun run fetch-bangs
   ```

5. **Connect Alchemy to Cloudflare for local deploys**

   ```bash
   bunx alchemy profile edit --add Cloudflare
   ```

6. **Develop locally**

   ```bash
   bun run dev
   ```

7. **Deploy locally**
   ```bash
   bun run deploy
   ```

## CI deployments

`.github/workflows/ci.yml` runs typechecking, tests, linting, and a build without Cloudflare credentials. The build also uploads the Worker entrypoint and static assets as the `alchemy-worker` artifact. After a successful CI run, `.github/workflows/deploy.yml` uses [`mynameistito/alchemy-deploy`](https://github.com/mynameistito/alchemy-deploy) to deploy that artifact for pull requests or deploy the `prod` stage from `main`. Pull-request preview stages are destroyed when their PRs close.

Configure these repository secrets before enabling production deployments:

- `CLOUDFLARE_API_TOKEN` — a narrowly scoped token for the account
- `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account that owns the Worker

The first local production deployment uses the new Alchemy state store and creates the deleted Worker from scratch. Subsequent deployments are handled by the workflow.

To refresh the bundled bang data locally, run `bun run fetch-bangs`. You can also run the **Refresh bangs** workflow manually from the GitHub Actions tab; it opens a pull request if the generated data changed.

## Stack

React 19 + Vite + TanStack Router SPA, served as static assets by an Alchemy-managed Cloudflare Worker that also handles redirects and `/suggest`. Tailwind v4. Ultracite (Oxlint and Oxfmt) for lint/format. Bun test runner.

## Scripts

- `bun run dev` — Alchemy local development with Vite HMR
- `bun run build` — build + typecheck (`tsrs`)
- `bun run plan` — preview the Alchemy infrastructure diff
- `bun run deploy` — build and deploy with Alchemy
- `bun run destroy` — destroy the selected Alchemy stage
- `bun run fetch-bangs` — refresh bangs list
- `bun run check` — Ultracite lint and format checks
- `bun run fix` — apply automatic lint and format fixes
- `bun test` — Bun test runner
- `bun run test:browser` — Chromium tests against the production build (run `bun run build` and `bun x playwright install chromium` first)

Alchemy beta.85 and the deployment action v4 use Effect 4.1.2 and state-store API v8. Keep deployment workflows disabled until every client sharing the store is upgraded and its state, key, and namespace are verified. This coordinated runtime and action upgrade is an explicit exception to the seven-day release-age policy; unrelated dependencies retain that policy.

Type checking uses `tsrs`. The TypeScript 6 package remains a development dependency because the GitHub, SonarJS, and documentation lint plugins use the TypeScript compiler API.

## License

[MIT](LICENSE)
