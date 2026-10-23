// @ts-check
import netlify from "@astrojs/netlify";
import node from "@astrojs/node";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { defineConfig, envField, memoryCache } from "astro/config";

// Netlify sets NETLIFY=true in its builds. Everywhere else (dev, Docker) we
// run the standalone Node server.
const adapter = process.env.NETLIFY ? netlify() : node({ mode: "standalone" });

const prefixedLocales = [
	"ar",
	"bg",
	"ca",
	"cs",
	"da",
	"de",
	"el",
	"es",
	"fi",
	"fr",
	"he",
	"hu",
	"it",
	"ja",
	"ko",
	"lt",
	"lv",
	"nb",
	"nl",
	"pl",
	"pt-BR",
	"pt-PT",
	"ru",
	"sk",
	"sl",
	"sr",
	"sv",
	"uk",
	"zh-CN",
	"zh-TW",
];

// https://astro.build/config
export default defineConfig({
	// `localizeHref()` emits links without a trailing slash; `/about/` redirects to `/about`.
	trailingSlash: "never",
	// Astro 7 defaults to "jsx" whitespace rules, which drop the space between
	// text and a link on the next line. Keep the old behavior.
	compressHTML: true,
	build: {
		// External stylesheets persist correctly across ClientRouter navigations.
		inlineStylesheets: "never",
		// Write prerendered pages as `about.html`, with `about/index.html` Netlify
		// would redirect every `/about` link to `/about/`.
		format: "file",
	},
	env: {
		schema: {
			// access: "secret" keeps the value out of the build output; it is read
			// from process.env when the server starts, so one image works per environment.
			API_AUTHORITY: envField.string({
				context: "server",
				access: "secret",
				default: "http://localhost:3000",
			}),
			// for csr fetches
			CSR_API_AUTHORITY: envField.string({
				context: "server",
				access: "secret",
				default: "http://localhost:3000",
			}),
			// Preview edition is no-indexed by default. Set NOINDEX=false in the runtime
			// environment for a real production deploy. Like API_AUTHORITY it is not baked
			// into the image: server-rendered responses consume it at request time,
			// prerendered pages leave indexing to robots.txt (see Layout.astro).
			NOINDEX: envField.boolean({
				context: "server",
				access: "secret",
				optional: true,
				default: true,
			}),
			GITHUB_OAUTH_CLIENT_ID: envField.string({
				context: "server",
				access: "secret",
				optional: true,
				default: "",
			}),
			GITHUB_OAUTH_CLIENT_SECRET: envField.string({
				context: "server",
				access: "secret",
				optional: true,
				default: "",
			}),
		},
	},
	adapter,
	vite: {
		plugins: [
			paraglideVitePlugin({
				project: "./project.inlang",
				outdir: "./src/paraglide",
				strategy: ["url", "baseLocale"],
				// `:path*`, not `:path?`: paraglide fills an empty `?` param as `/nl/`,
				// which `trailingSlash: "never"` rejects; `*` drops it, giving `/nl`.
				urlPatterns: [
					{
						pattern: ":protocol://:domain(.*)::port?/:path(.*)*",
						localized: [
							...prefixedLocales.map(
								(locale) =>
									/** @type {[string, string]} */ ([
										locale,
										`:protocol://:domain(.*)::port?/${locale}/:path(.*)*`,
									]),
							),
							/** @type {[string, string]} */ ([
								"en",
								":protocol://:domain(.*)::port?/:path(.*)*",
							]),
						],
					},
				],
			}),
		],
	},
	cache: {
		provider: memoryCache(),
	},
});
