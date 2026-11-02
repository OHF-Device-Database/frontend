import { afterEach, describe, test, vi } from "vitest";

import { safeReturnTo } from "../src/io/oauth";
import { GitHubOAuth } from "../src/io/vendor/github/oauth";
import { GitHubSession } from "../src/io/vendor/github/session";

describe("safeReturnTo", () => {
	test("keeps a same-origin path", (t) => {
		t.expect(safeReturnTo("/devices/42?tab=specs")).toBe(
			"/devices/42?tab=specs",
		);
	});

	test("falls back without a value", (t) => {
		t.expect(safeReturnTo(null)).toBe("/");
		t.expect(safeReturnTo("")).toBe("/");
	});

	test("rejects absolute and protocol-relative targets", (t) => {
		t.expect(safeReturnTo("https://evil.example/x")).toBe("/");
		t.expect(safeReturnTo("//evil.example/x")).toBe("/");
		t.expect(safeReturnTo("/\\evil.example/x")).toBe("/");
	});

	test("rejects control characters", (t) => {
		t.expect(safeReturnTo("/about\r\nset-cookie: a=b")).toBe("/");
	});

	test("drops an existing fragment", (t) => {
		t.expect(safeReturnTo("/about#anything")).toBe("/about");
	});
});

describe("github token cookie", () => {
	const issued = {
		accessToken: "ghu_x",
		scope: "public_repo",
		expiresIn: 28_800,
	};

	test("round-trips what the callback writes", (t) => {
		const value = JSON.stringify(GitHubOAuth.token.cookieValue(issued));

		t.expect(GitHubSession.token.deserialize(value)).toMatchObject({
			token: "ghu_x",
			scope: "public_repo",
		});
	});

	test("turns expires-in into an absolute deadline", (t) => {
		const value = GitHubOAuth.token.cookieValue(issued);

		t.expect(value.expiresAt).toBeGreaterThan(Date.now());
		t.expect(value.expiresAt).toBeLessThanOrEqual(Date.now() + 28_800_000);
	});

	test("ignores an expired token", (t) => {
		const value = JSON.stringify({ ...issued, token: "ghu_x", expiresAt: 500 });

		t.expect(GitHubSession.token.deserialize(value, 1000)).toBeUndefined();
	});

	test("treats a token that is about to expire as expired", (t) => {
		const now = 1_000_000;
		const value = JSON.stringify({
			token: "ghu_x",
			scope: "public_repo",
			expiresAt: now + 30_000,
		});

		t.expect(GitHubSession.token.deserialize(value, now)).toBeUndefined();
	});

	test("ignores a malformed or truncated cookie", (t) => {
		t.expect(GitHubSession.token.deserialize(undefined)).toBeUndefined();
		t.expect(GitHubSession.token.deserialize("not json")).toBeUndefined();
		t.expect(
			GitHubSession.token.deserialize('{"token":"ghu_x"}'),
		).toBeUndefined();
	});
});

describe("revoking app credentials", () => {
	const grant = {
		clientId: "Iv1.abc",
		clientSecret: "s3cret",
		accessToken: "ghu_x",
	};

	const answer = (status: number) => {
		const fetched = vi.fn(() =>
			Promise.resolve(new Response(null, { status })),
		);
		vi.stubGlobal("fetch", fetched);

		return fetched;
	};

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	test("authenticates as the app, not as the user", async (t) => {
		const fetched = answer(204);

		await GitHubOAuth.authorization.revoke(grant);

		const [url, init] = fetched.mock.calls[0] as unknown as [
			string,
			RequestInit,
		];
		const headers = init.headers as Record<string, string>;

		t.expect(url).toBe("https://api.github.com/applications/Iv1.abc/grant");
		t.expect(init.method).toBe("DELETE");
		t.expect(headers.authorization).toBe(`Basic ${btoa("Iv1.abc:s3cret")}`);
		t.expect(init.body).toBe('{"access_token":"ghu_x"}');
	});

	test("takes an already revoked grant for done", async (t) => {
		answer(404);

		await t
			.expect(GitHubOAuth.authorization.revoke(grant))
			.resolves.toBeUndefined();
	});

	test("signing out revokes the one token, not the grant", async (t) => {
		const fetched = answer(204);

		await GitHubOAuth.token.revoke(grant);

		const [url] = fetched.mock.calls[0] as unknown as [string, RequestInit];

		t.expect(url).toBe("https://api.github.com/applications/Iv1.abc/token");
	});

	test("throws when the grant may still stand", async (t) => {
		answer(500);

		await t
			.expect(GitHubOAuth.authorization.revoke(grant))
			.rejects.toThrow("revoke_failed");
	});
});
