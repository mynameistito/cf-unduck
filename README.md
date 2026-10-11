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

- **Server redirect**: The Worker resolves the bang and returns a 302 to the destination. Redirects without custom preferences are cacheable for up to a day (`s-maxage=86400`).
- **Custom preferences**: When a `udprefs` cookie is present, redirects are private and not stored in shared caches.
- **Client redirect**: The cached SPA also resolves bangs in the browser, avoiding a server round-trip when it is already loaded.

The `udprefs` cookie carries the default bang and custom bangs needed by server-side redirects; other settings remain in browser storage.

## Features

- Bangs (DuckDuckGo + [Kagi](https://github.com/kagisearch/bangs/)), hashmapped for O(1) lookup
- Server-side redirects with shared-cache support, plus client-side resolution when the SPA is loaded
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

React 19 + Vite + TanStack Router SPA, served as static assets by an Alchemy-managed Cloudflare Worker that also handles redirects and `/suggest`. Tailwind v4. Ultracite (Biome) for lint/format. Bun test runner.

## Scripts

- `bun run dev` — Alchemy local development with Vite HMR
- `bun run build` — build + typecheck (`tsc`)
- `bun run plan` — preview the Alchemy infrastructure diff
- `bun run deploy` — build and deploy with Alchemy
- `bun run destroy` — destroy the selected Alchemy stage
- `bun run fetch-bangs` — refresh bangs list
- `bun run check` — Ultracite lint and format checks
- `bun run fix` — apply automatic lint and format fixes
- `bun test` — Bun test runner

## License

[MIT](LICENSE)
