# Astro Starter Kit: Minimal

```sh
npm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                    | Action                                           |
| :------------------------- | :----------------------------------------------- |
| `pnpm install`             | Installs dependencies                            |
| `pnpm run dev`             | Starts local dev server at `localhost:4321`      |
| `pnpm run build`           | Build your production site to `./dist/`          |
| `pnpm run preview`         | ⚠️ Not supported with the Netlify adapter — use `netlify dev` (see below) |
| `pnpm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `pnpm run astro -- --help` | Get help using the Astro CLI                     |

## ⚙️ Configuration

The app renders **server-side** (`prerender = false`) and proxies requests to a device API. It reads one env var:

| Variable        | Required | Default                 | Description                                                                 |
| :-------------- | :------- | :---------------------- | :-------------------------------------------------------------------------- |
| `API_AUTHORITY` | No       | `http://localhost:3000` | Base URL of the device API. The app fetches `/api/unstable/derived/devices` from here, server-side. |
| `NOINDEX`       | No       | `true`                  | Adds `noindex` for preview deploys. Set to `false` for a real production deploy. |

Create a `.env` for local runs (auto-loaded by Astro and `netlify dev`):

```sh
API_AUTHORITY=https://your-remote-api
```

## 🧪 Local testing

Two levels, depending on what you want to verify:

- **Fast app iteration** — `pnpm dev` starts the Astro dev server at `localhost:4321`. Best for pages/components. Note: sessions use a local dev driver here, not real Netlify Blobs.
- **Netlify parity** — `netlify dev` (Netlify CLI) layers the Netlify environment over the app: runs the SSR as a function, provides a local Netlify Blobs sandbox (so session storage is exercised), applies `_redirects`, and injects env from `netlify.toml`. This is the closest local match to production.

> `astro preview` / `pnpm run preview` does **not** work with the Netlify adapter. Use `netlify dev` instead.

## 🌐 Deploying to Netlify

This project targets **Netlify** via the [`@astrojs/netlify`](https://docs.astro.build/en/guides/integrations-guide/netlify/) SSR adapter. Build settings live in `netlify.toml`:

| Setting           | Value         |
| :---------------- | :------------ |
| Build command     | `pnpm build`  |
| Publish directory | `dist`        |
| `NODE_VERSION`    | `24`          |

Set `API_AUTHORITY` (and `NOINDEX=false` for production) in the Netlify site's **Environment variables**. Netlify auto-detects pnpm from `pnpm-lock.yaml`. The SSR adapter bundles the server into a Netlify Function and emits `_redirects` automatically at build time.

## ⚡ Caching

The site is server-rendered and designed to sit behind a CDN (Cloudflare). Cacheable responses
emit `Cache-Control: public, max-age=0, s-maxage=<n>, stale-while-revalidate=<n>`:

- `max-age=0` — browsers always revalidate, so users never see stale data without a check (that
  check hits the warm edge cache and returns instantly).
- `s-maxage` — the shared/CDN edge TTL. Cloudflare uses this for its edge cache TTL.
- `stale-while-revalidate` — the edge serves stale content instantly while it refreshes in the background.

Per-route TTLs live in [`src/lib/cache.ts`](src/lib/cache.ts) and are applied via `applyCdnCache()`:

| Route          | Fresh (`s-maxage`) | Stale (`swr`) |
| :------------- | :----------------- | :------------ |
| `/browse`      | 60s                | 5min          |
| `/device/:id`  | 5min               | 1h            |
| `/device/:id` (404) | 30s           | 1min          |
| `/api/suggest` | 30s                | 2min          |

The same TTLs also drive Astro's in-process response cache (`Astro.cache.set`), which shields the
upstream API even on edge cache misses. Fingerprinted assets under `/_astro/` are served
`immutable` for a year.

> **Cloudflare:** by default Cloudflare does **not** cache HTML/JSON — only static file extensions.
> To benefit from `s-maxage` on these routes, add a Cache Rule that makes them eligible for cache
> ("Cache Everything"); Cloudflare then honors the origin `s-maxage` for the edge TTL.

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
