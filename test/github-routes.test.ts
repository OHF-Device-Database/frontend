import { afterEach, describe, test, vi } from "vitest";
import type { APIContext } from "astro";

import { DELETE as revokeAuthorization } from "../src/pages/vendor/github/authorization";
import { GET as callback } from "../src/pages/vendor/github/callback";
import { POST as refresh } from "../src/pages/vendor/github/refresh";
import { POST as signOut } from "../src/pages/vendor/github/sign-out";

const env = vi.hoisted(() => ({ clientId: "Iv1.abc", clientSecret: "s3cret" }));

vi.mock("astro:env/server", () => ({
	get GITHUB_OAUTH_CLIENT_ID() {
		return env.clientId;
	},
	get GITHUB_OAUTH_CLIENT_SECRET() {
		return env.clientSecret;
	},
}));

const STATE = "a-state";

const context = (
	cookies: Record<string, unknown>,
	url = "https://example.com/",
): APIContext => {
	const jar = { ...cookies };

	return {
		url: new URL(url),
		cookies: {
			get: (name: string) => {
				if (!(name in jar)) {
					return undefined;
				}

				const value = jar[name];

				return {
					value: typeof value === "string" ? value : JSON.stringify(value),
					json: () => value,
				};
			},
			set: (name: string, value: unknown) => {
				jar[name] = value;
			},
			delete: (name: string) => {
				delete jar[name];
			},
		},
	} as unknown as APIContext;
};

const githubAnswers = (...responses: (() => Response)[]) => {
	const queue = [...responses];
	vi.stubGlobal(
		"fetch",
		vi.fn(() =>
			Promise.resolve(queue.shift()?.() ?? new Response(null, { status: 500 })),
		),
	);
};

const tokenResponse = () =>
	Response.json({
		access_token: "ghu_x",
		scope: "public_repo",
		expires_in: 28_800,
		refresh_token: "ghr_x",
		refresh_token_expires_in: 15_897_600,
	});

const liveToken = JSON.stringify({
	token: "ghu_x",
	scope: "public_repo",
	expiresAt: Date.now() + 3_600_000,
});

const clearsCache = (response: Response): boolean =>
	response.headers.get("clear-site-data") === '"cache"';

describe("clearing the browser cache when the session changes", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	test("on sign-in", async (t) => {
		githubAnswers(tokenResponse, () => Response.json({ login: "octocat" }));

		const response = await callback(
			context(
				{ "github-oauth-hello": { state: STATE, returnTo: "/browse" } },
				`https://example.com/vendor/github/callback?code=c&state=${STATE}`,
			),
		);

		t.expect(response.status).toBe(302);
		t.expect(clearsCache(response)).toBe(true);
	});

	test("not on a failed sign-in", async (t) => {
		const response = await callback(
			context(
				{ "github-oauth-hello": { state: STATE, returnTo: "/browse" } },
				"https://example.com/vendor/github/callback?code=c&state=other",
			),
		);

		t.expect(response.status).toBe(400);
		t.expect(response.headers.has("clear-site-data")).toBe(false);
	});

	test("on sign-out", async (t) => {
		githubAnswers(() => new Response(null, { status: 204 }));

		const response = await signOut(context({ "github-token": liveToken }));

		t.expect(clearsCache(response)).toBe(true);
	});

	test("on disconnect", async (t) => {
		githubAnswers(() => new Response(null, { status: 204 }));

		const response = await revokeAuthorization(
			context({ "github-token": liveToken }),
		);

		t.expect(response.status).toBe(204);
		t.expect(clearsCache(response)).toBe(true);
	});

	test("not when disconnecting fails and the session stays", async (t) => {
		githubAnswers(() => new Response(null, { status: 500 }));

		const response = await revokeAuthorization(
			context({ "github-token": liveToken }),
		);

		t.expect(response.status).toBe(500);
		t.expect(response.headers.has("clear-site-data")).toBe(false);
	});

	test("when a failed refresh ends the session", async (t) => {
		githubAnswers(() => Response.json({ error: "bad_refresh_token" }));

		const response = await refresh(
			context({ "github-refresh": "ghr_x", "github-user": "octocat" }),
		);

		t.expect(response.status).toBe(401);
		t.expect(clearsCache(response)).toBe(true);
	});

	test("not when a refresh keeps the same account", async (t) => {
		githubAnswers(tokenResponse);

		const response = await refresh(
			context({ "github-refresh": "ghr_x", "github-user": "octocat" }),
		);

		t.expect(response.status).toBe(204);
		t.expect(response.headers.has("clear-site-data")).toBe(false);
	});
});

describe("without an oauth app configured", () => {
	afterEach(() => {
		env.clientId = "Iv1.abc";
		env.clientSecret = "s3cret";
		vi.unstubAllGlobals();
	});

	const unconfigure = () => {
		// the env schema defaults to an empty string, not `undefined`
		env.clientId = "";
		env.clientSecret = "";

		const fetched = vi.fn();
		vi.stubGlobal("fetch", fetched);

		return fetched;
	};

	test("refresh answers 503 without calling github", async (t) => {
		const fetched = unconfigure();

		const response = await refresh(
			context({ "github-refresh": "ghr_x", "github-user": "octocat" }),
		);

		t.expect(response.status).toBe(503);
		t.expect(fetched).not.toHaveBeenCalled();
	});

	test("sign-out still ends the session without calling github", async (t) => {
		const fetched = unconfigure();

		const response = await signOut(context({ "github-token": liveToken }));

		t.expect(response.status).toBe(204);
		t.expect(fetched).not.toHaveBeenCalled();
	});
});

describe("declining on github", () => {
	test("leads back to the page sign-in started from", async (t) => {
		const response = await callback(
			context(
				{ "github-oauth-hello": { state: STATE, returnTo: "/browse" } },
				`https://example.com/vendor/github/callback?error=access_denied&state=${STATE}`,
			),
		);

		t.expect(response.status).toBe(400);
		const body = await response.text();
		t.expect(body).toContain("GitHub access was not granted.");
		t.expect(body).toContain('href="/browse"');
	});
});
