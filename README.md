# cf-unduck

Fast DuckDuckGo bang redirects on Cloudflare Workers. React + Vite + TanStack Router SPA served as static assets.

Live: https://search.mynameistito.com

## Credit

Remade from [taciturnaxolotl/unduckified](https://github.com/taciturnaxolotl/unduckified), itself a fork of [t3dotgg/unduck](https://github.com/t3dotgg/unduck).

- turnaxolot1's hosted version: [s.dunkirk.sh](https://s.dunkirk.sh)
- Theo's hosted original: [unduck.link](https://unduck.link)

## Quick Start

Add as custom search engine in your browser:

```
https://search.mynameistito.com?q=%s
```

Then `!gh react` → GitHub search for "react". No bang → falls back to DuckDuckGo (configurable in settings).

## How is it that much faster?

DuckDuckGo redirects through their own server hop. cf-unduck skips that:

- **First hit**: Worker resolves the bang at the edge and 302s straight to the target. Cookieless redirects are cached at the edge (`s-maxage=86400`), so repeat queries with the same `q` are pure cache hits.
- **Subsequent hits**: SPA is cached locally, so redirects happen on-device with no round-trip.

Users with custom prefs (`udprefs` cookie) get private, no-store responses so settings never leak across the edge cache.

## Features

- Bangs (DuckDuckGo + [Kagi](https://github.com/kagisearch/bangs/)), hashmapped for O(1) lookup
- Edge-cached server-side redirects on first hit, on-device after
- Search suggestions endpoint (`/suggest`) proxying DuckDuckGo with edge cache
- [OpenSearch](https://developer.mozilla.org/en-US/docs/Web/XML/Guides/OpenSearch) support (browser auto-discovery)
- PWA / installable
- Settings: default bang, custom bangs, history toggle — synced via `udprefs` cookie so server redirects honor them
- Empty-query bang → base site (e.g. `!g` → google.com)
- Suffix bangs (`ghr! user/repo` → that GitHub repo)
- Quick settings (`!settings` or `!`)
- Local search history (off by default, clearable)
- Dark mode, sound effects (respects `prefers-reduced-motion`), text animations
- Local font file (no Google Fonts)
- Auto-updating bangs file via fetch script

## Search Suggestions

Firefox has a dedicated suggestions URL field. Use the built-in proxy (cached at the edge):

```
https://search.mynameistito.com/suggest?q=%s
```

Or point straight at an upstream:

```
https://duckduckgo.com/ac/?q=%s&type=list
https://www.google.com/complete/search?client=chrome&q=%s
```

## Self-hosting

Prereqs: [Bun](https://bun.com) and a Cloudflare account. Alchemy stores local credentials in its `default` profile; CI uses the Cloudflare secrets described below.

1. **Clone & install**

   ```bash
   git clone https://github.com/mynameistito/cf-unduck
   cd cf-unduck
   bun install
   ```

2. **Edit `src/site.config.ts`** — set your domain, repo, and footer credit:

   ```ts
   export const SITE = {
     name: "my-search",
     domain: "search.yourdomain.com",
     githubUser: "your-username",
     repo: "cf-unduck",
     author: { name: "your-name", url: "https://yourdomain.com" },
   } as const;
   ```

3. **Edit `alchemy.run.ts`** — change `APP_NAME` if you are deploying a fork under a different Worker name. The production domain comes from `src/site.config.ts`; preview stages use isolated `workers.dev` names.

4. **(Optional) Refresh bangs**

   ```bash
   bun run fetch-bangs
   ```

5. **Connect Alchemy to Cloudflare**

   ```bash
   bunx alchemy profile edit --add Cloudflare
   ```

6. **Dev**

   ```bash
   bun run dev
   ```

7. **Deploy**
   ```bash
   bun run deploy
   ```

## CI deployments

`.github/workflows/deploy.yml` uses the latest pinned release of [`mynameistito/alchemy-deploy`](https://github.com/mynameistito/alchemy-deploy) after the `CI` workflow succeeds. It deploys `prod` from `main`, creates `pr-<number>` preview stages, and destroys previews when pull requests close.

Configure these repository secrets before enabling production deployments:

- `CLOUDFLARE_API_TOKEN` — a narrowly scoped token for the account
- `CLOUDFLARE_ACCOUNT_ID` — the Cloudflare account that owns the Worker

The first local production deployment uses the new Alchemy state store and creates the deleted Worker from scratch. Subsequent deployments are handled by the workflow.

## Stack

React 19 + Vite + TanStack Router SPA, served as static assets by an Alchemy-managed Cloudflare Worker that also handles redirects and `/suggest`. Tailwind v4. Ultracite (Biome) for lint/format. Bun test runner.

## Scripts

- `bun run dev` — Alchemy local development with Vite HMR
- `bun run build` — build + typecheck (`tsc`)
- `bun run plan` — preview the Alchemy infrastructure diff
- `bun run deploy` — build and deploy with Alchemy
- `bun run destroy` — destroy the selected Alchemy stage
- `bun run fetch-bangs` — refresh bangs list
- `bun run check` / `fix` — Ultracite lint
- `bun test` — Bun test runner

## License

[MIT](LICENSE)
