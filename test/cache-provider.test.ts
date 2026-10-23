import { createContext } from "astro/middleware";
import { describe, expect, test, vi } from "vitest";
import type { APIContext, CacheOptions } from "astro";

import {
	applyCacheHeaders,
	AstroCache,
} from "../node_modules/astro/dist/core/cache/runtime/cache.js";
import cacheProvider from "../src/io/cache-provider";
import { cache } from "../src/middleware/cache";
import { FEATURE_COOKIE, featureParamApply } from "../src/utilities/feature";

vi.mock("astro:middleware", () => import("astro/middleware"));

const render = async ({
	headers,
	query = "",
	options = { maxAge: 60 },
	page = () => new Response("page"),
}: {
	headers?: HeadersInit;
	query?: string;
	options?: CacheOptions | false;
	page?: (context: APIContext) => Response;
} = {}) => {
	const request = new Request(`https://example.com/surveys${query}`, {
		...(headers ? { headers } : {}),
	});
	const context = createContext({ request, defaultLocale: "en" });
	context.cache = new AstroCache(cacheProvider(undefined));
	const response = await cache(context, () => {
		context.cache.set(options);
		return Promise.resolve(page(context));
	});
	if (!(response instanceof Response)) {
		throw new Error("Cache middleware must return a response");
	}
	// Exercise Astro's real post-middleware header application.
	applyCacheHeaders(context.cache, response, request);
	return { context, response };
};

describe("CDN cache headers", () => {
	test("preserves anonymous TTLs, validators, tags and preview cache keys", async (t) => {
		const { response } = await render({
			options: {
				maxAge: 60,
				swr: 30,
				tags: ["surveys"],
				etag: '"version"',
				lastModified: new Date("2026-01-01T00:00:00Z"),
			},
		});
		t.expect(response.headers.get("cache-control")).toBe(
			"public, max-age=60, stale-while-revalidate=30",
		);
		t.expect(response.headers.get("netlify-vary")).toBe(
			"query, header=Cookie|Authorization",
		);
		t.expect(response.headers.get("cache-tag")).toBe("surveys");
		t.expect(response.headers.get("etag")).toBe('"version"');
		t.expect(response.headers.get("last-modified")).toBe(
			"Thu, 01 Jan 2026 00:00:00 GMT",
		);
	});

	test.each([undefined, 0, -1])(
		"does not cache a TTL of %s",
		async (maxAge) => {
			const { response } = await render({
				options: {
					tags: ["surveys"],
					...(maxAge === undefined ? {} : { maxAge }),
				},
			});
			expect(response.headers.get("cache-control")).toBe("no-store");
		},
	);

	test("leaves anonymous pages without cache options unchanged", async (t) => {
		const { response } = await render({ options: {} });
		t.expect(response.headers.has("cache-control")).toBe(false);
	});
});

describe("cache bypass middleware", () => {
	test.each([
		{ headers: { Cookie: `${FEATURE_COOKIE}=foo` } },
		{ headers: { Cookie: `${FEATURE_COOKIE}=` } },
		{ headers: { Cookie: "github_oauth=example" } },
		{ headers: { Cookie: "unknown_login_cookie=example" } },
		{ headers: { Cookie: "" } },
		{ headers: { Authorization: "Bearer example" } },
		{ headers: { Authorization: "" } },
		{ query: "?feature=foo" },
		{ query: "?feature=" },
	])("bypasses personalized requests: %j", async (input) => {
		for (const options of [{ maxAge: 60 }, {}]) {
			const { response } = await render({ ...input, options });
			expect(response.headers.get("cache-control")).toBe("private, no-store");
		}
	});

	test.each([undefined, "public, max-age=60", "no-cache"])(
		"bypasses raw Set-Cookie regardless of Cache-Control: %s",
		async (cacheControl) => {
			const { response } = await render({
				page: () =>
					new Response(null, {
						status: 302,
						headers: {
							"Set-Cookie": "login=example; Path=/; HttpOnly",
							Location: "/",
							...(cacheControl ? { "Cache-Control": cacheControl } : {}),
						},
					}),
			});
			expect(response.headers.get("cache-control")).toBe("private, no-store");
			expect(response.status).toBe(302);
			expect(response.headers.has("set-cookie")).toBe(true);
		},
	);

	test.each(["set", "delete"] as const)(
		"bypasses buffered cookies.%s without consuming outgoing cookies",
		async (operation) => {
			const { context, response } = await render({
				page: (context) => {
					if (operation === "set") {
						context.cookies.set("login", "example", { path: "/" });
					} else {
						context.cookies.delete("login", { path: "/" });
					}
					context.cache.set({ maxAge: 3600 });
					return new Response("page");
				},
			});
			expect(response.headers.get("cache-control")).toBe("private, no-store");
			expect([...context.cookies.headers()]).toHaveLength(1);
			expect([...context.cookies.headers()][0]).toContain("login=");
		},
	);

	test("feature query changes retain outgoing cookies and no-store", async (t) => {
		const { context, response } = await render({
			query: "?feature=",
			page: (context) => {
				featureParamApply(context);
				return new Response("page");
			},
		});
		t.expect(response.headers.get("cache-control")).toBe("private, no-store");
		t.expect([...context.cookies.headers()][0]).toContain(`${FEATURE_COOKIE}=`);
	});

	test("does not treat reading cookies as setting them", async (t) => {
		const { response } = await render({
			page: (context) => {
				context.cookies.get("login");
				return new Response("page");
			},
		});
		t.expect(response.headers.get("cache-control")).toBe("public, max-age=60");
	});

	test("skips prerender request headers", async (t) => {
		const request = new Request("https://example.com/about");
		const context = createContext({ request, defaultLocale: "en" });
		context.isPrerendered = true;
		Object.defineProperty(request, "headers", {
			get() {
				throw new Error("Prerender headers must not be read");
			},
		});
		const response = new Response("static");
		t.expect(await cache(context, () => Promise.resolve(response))).toBe(
			response,
		);
	});

	test("propagates downstream errors", async (t) => {
		await t
			.expect(
				render({
					page: () => {
						throw new Error("render failed");
					},
				}),
			)
			.rejects.toThrow("render failed");
	});
});
