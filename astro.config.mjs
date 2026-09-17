// @ts-check
import netlify from "@astrojs/netlify";
import node from "@astrojs/node";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { defineConfig, envField, memoryCache } from "astro/config";

// Switch the deploy target with DEPLOY_TARGET. Defaults to "netlify" so the
// existing Netlify build is unaffected; the Docker image sets "node".
const isNodeTarget = process.env.DEPLOY_TARGET === "node";
const adapter = isNodeTarget ? node({ mode: "standalone" }) : netlify();

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
	build: {
		// External stylesheets persist correctly across ClientRouter navigations.
		inlineStylesheets: "never",
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
		},
	},
	adapter,
	vite: {
		plugins: [
			paraglideVitePlugin({
				project: "./project.inlang",
				outdir: "./src/paraglide",
				// `globalVariable` is only consulted at build time, where the prerender
				// middleware stores the route's locale with `setLocale()` (middleware.ts)
				strategy: ["url", "globalVariable", "baseLocale"],
				urlPatterns: [
					{
						pattern: ":protocol://:domain(.*)::port?/:path(.*)?",
						localized: [
							...prefixedLocales.map(
								(locale) =>
									/** @type {[string, string]} */ ([
										locale,
										`:protocol://:domain(.*)::port?/${locale}/:path(.*)?`,
									]),
							),
							/** @type {[string, string]} */ ([
								"en",
								":protocol://:domain(.*)::port?/:path(.*)?",
							]),
						],
					},
				],
			}),
		],
		// The Docker image ships dist/ without node_modules, so the node build
		// must bundle every dependency into the server output.
		ssr: isNodeTarget ? { noExternal: true } : {},
	},
	experimental: {
		cache: {
			provider: memoryCache(),
		},
	},
});
