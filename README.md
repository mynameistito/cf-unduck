# cf-unduck

Fast DuckDuckGo bang redirects on Cloudflare Workers. React + Vite + TanStack Router SPA served as static assets.

Live: https://search.mynameistito.com

## Credit

Remade from [unduckified](https://github.com/taciturnaxolotl/unduckified) by Kieran Klukas, itself a fork of [t3dotgg/unduck](https://github.com/t3dotgg/unduck) by Theo. Theo's hosted original: [unduck.link](https://unduck.link).

## Quick Start

Add as custom search engine in your browser:

```
https://search.mynameistito.com?q=%s
```

Then `!gh react` → GitHub search for "react". No bang → falls back to DuckDuckGo (configurable in settings).

## How is it that much faster?

DuckDuckGo does redirects server-side; their DNS isn't always great. cf-unduck does it all client-side. After the first visit, JS is cached and your device handles redirects — no server round-trip.

## Features

- Bangs (DuckDuckGo + [Kagi](https://github.com/kagisearch/bangs/))
- Dark mode
- Settings: search history toggle, default bang, custom bangs
- Search counter
- [OpenSearch](https://developer.mozilla.org/en-US/docs/Web/XML/Guides/OpenSearch) support
- Local search history (off by default, clearable)
- Sound effects (respects `prefers-reduced-motion`)
- Text animations
- Hashmapped bangs for fast lookup
- Local font file (no Google Fonts)
- Empty-query bang → base site (e.g. `!g` → google.com)
- Suffix bangs (`ghr! user/repo` → that GitHub repo)
- Quick settings (`!settings` or `!`)
- Custom local bangs
- Auto-updating bangs file via fetch script

## Search Suggestions

Firefox has a dedicated suggestions URL field. Other browsers usually don't — pick one of these as your suggestions source:

```
https://duckduckgo.com/ac/?q=%s&type=list
```

```
https://www.google.com/complete/search?client=chrome&q=%s
```

## Self-hosting

Prereqs: [Bun](https://bun.com), Cloudflare account, `wrangler` logged in (`bun x wrangler login`).

1. **Clone & install**
   ```bash
   git clone https://github.com/mynameistito/cf-unduck
   cd cf-unduck
   bun install
   ```

2. **Edit `src/site.config.ts`** — set your domain, site name, and GitHub username:
   ```ts
   export const SITE = {
     name: "my-search",
     domain: "search.yourdomain.com",
     githubUser: "your-username",
   } as const;
   ```

3. **Edit `wrangler.jsonc`** — change `name` and route `pattern` to your domain (or remove `routes` to use default `*.workers.dev` URL):
   ```jsonc
   {
     "name": "your-worker-name",
     "routes": [
       { "pattern": "search.yourdomain.com", "custom_domain": true }
     ]
   }
   ```

4. **(Optional) Refresh bangs**
   ```bash
   bun run fetch-bangs
   ```

5. **Dev**
   ```bash
   bun run dev
   ```

6. **Deploy**
   ```bash
   bun run deploy
   ```

## Scripts

- `bun run dev` — Vite dev server
- `bun run build` — build + typecheck
- `bun run deploy` — build + `wrangler deploy`
- `bun run fetch-bangs` — refresh bangs list
- `bun run check` / `fix` — Ultracite lint
- `bun test` — Bun test runner

## License

MIT
