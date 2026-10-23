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

| Command                    | Action                                                                    |
| :------------------------- | :------------------------------------------------------------------------ |
| `pnpm install`             | Installs dependencies                                                     |
| `pnpm run dev`             | Starts local dev server at `localhost:4321`                               |
| `pnpm run build`           | Build your production site to `./dist/`                                   |
| `pnpm run preview`         | ⚠️ Not supported with the Netlify adapter — use `netlify dev` (see below) |
| `pnpm run astro ...`       | Run CLI commands like `astro add`, `astro check`                          |
| `pnpm run astro -- --help` | Get help using the Astro CLI                                              |

## ⚙️ Configuration

The app is a mix of **prerendered** content pages (about, how it works, editorial stance, imprint — one static file per locale, generated under `src/pages/[...locale]/`) and **server-rendered** pages that depend on the device API or on query parameters (home, browse, device detail, surveys, 404, `robots.txt`). It reads these env vars:

| Variable            | Required | Default                 | Description                                                                                                                 |
| :------------------ | :------- | :---------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| `API_AUTHORITY`     | No       | `http://localhost:3000` | Base URL of the device API. The app fetches `/api/unstable/derived/devices` from here, server-side.                         |
| `CSR_API_AUTHORITY` | No       | `http://localhost:3000` | Base URL of the device API for client-side fetches (search box, filters). Served to the browser by `/config.js` at runtime. |
| `NOINDEX`           | No       | `true`                  | Adds `noindex` for preview deploys. Set to `false` for a real production deploy.                                            |

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

| Setting           | Value        |
| :---------------- | :----------- |
| Build command     | `pnpm build` |
| Publish directory | `dist`       |
| `NODE_VERSION`    | `24`         |

Set `API_AUTHORITY` (and `NOINDEX=false` for production) in the Netlify site's **Environment variables**. Netlify auto-detects pnpm from `pnpm-lock.yaml`. The SSR adapter bundles the server into a Netlify Function and emits `_redirects` automatically at build time.

## 🐳 Deploying as a Docker image

The app can also run as a self-contained Node server via the [`@astrojs/node`](https://docs.astro.build/en/guides/integrations-guide/node/) adapter. This is the default adapter, used for `astro dev`, local builds and the Docker image. Netlify builds switch to the Netlify adapter automatically through the `NETLIFY` environment variable Netlify sets.

```bash
docker build -t device-database-frontend .

# Production run (allow indexing). NOINDEX defaults to true when unset.
docker run -p 4321:4321 \
  -e API_AUTHORITY=https://api.example.com \
  -e NOINDEX=false \
  device-database-frontend
```

**Runtime config.** All app config is runtime-only: the server reads `API_AUTHORITY`, `CSR_API_AUTHORITY` and `NOINDEX` from the environment (`-e`), so a single image serves every environment — nothing is baked in at build time. `NOINDEX` defaults to `true` (no indexing) when unset; a flip takes effect on container restart (plus CDN cache TTL). Two consequences of prerendering: the client-side API authority is served by the `/config.js` endpoint rather than inlined into the HTML, and prerendered pages carry no `robots` meta tag or `X-Robots-Tag` header (they would freeze the build-time value) — `robots.txt`, which is server-rendered, remains the crawl gate for preview deploys.

The server listens on `HOST=0.0.0.0` and `PORT=4321` (both overridable via env vars). The runtime image ships the server output in `dist/` plus a production-only `node_modules`. Astro and the adapter are bundled into `dist/`, so only packages the server imports at runtime belong in `dependencies`; everything else (including `astro` and build tooling) lives in `devDependencies` to keep the image small. Astro's sharp-backed `/_image` endpoint is unavailable in the container (the project doesn't use `astro:assets`, so nothing depends on it — revisit if that changes).

Images are published only when a GitHub Release is published (semver tags; prereleases skip `:latest`): `.github/workflows/deploy.yml` pushes an environment-agnostic image (`NOINDEX` and `API_AUTHORITY` are provided at runtime where the container is deployed; set `NOINDEX=false` for production) to GitHub Container Registry (`ghcr.io/<owner>/<repo>`). Pull requests build the image without pushing, as a validation check.

## ⚡ Caching

The site is server-rendered and meant to sit behind a CDN (Cloudflare in production, Netlify for
deploy previews). The server doesn't cache anything itself, it only sends headers for the CDN.

Pages call `Astro.cache.set()` and [`src/io/cache-provider.ts`](src/io/cache-provider.ts) turns
that into:

- `Cache-Control: public, max-age=<n>`, the TTL for browsers and the CDN alike. The CDN adds
  `Age` on the way through, so browsers count from the original render. It's `no-store` when
  there's no TTL. We don't use `s-maxage`, because Cloudflare turns off stale-while-revalidate
  when it's present.
- `Cache-Tag`, `Last-Modified` and `ETag` when the page provides them.

| Route                | TTL                      |
| :------------------- | :----------------------- |
| `/`                  | from the API's `max-age` |
| `/browse`            | from the API's `max-age` |
| `/devices/:id`       | from the API's `max-age` |
| `/devices/:id` (404) | 60s                      |
| `/surveys`           | 1 day                    |

Pages that don't call `Astro.cache.set()` get no cache headers. Fingerprinted assets under
`/_astro/` are served `immutable` for a year.

SSR requests with any cookie (including feature flags and login cookies), an `Authorization`
header, or `?feature=` always get `Cache-Control: private, no-store`. Responses that set or
delete cookies do too.
Middleware disables Astro's cache headers for these responses so page TTLs cannot override this.
Netlify varies cached pages by query string, `Cookie`, and `Authorization` to keep these requests
away from anonymous cache entries.

> **Cloudflare** doesn't cache HTML by default and doesn't key on cookies, so it needs Cache Rules:
>
> - Bypass the cache when any cookie, an `Authorization` header, or a `feature` query parameter is
>   present. Origin headers can't stop Cloudflare from serving a copy it already has.
> - Otherwise make HTML eligible for cache, use the origin's cache headers, and bypass when there
>   are none.
> - Keep the query string in the cache key.

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
