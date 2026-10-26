import { afterEach, beforeEach, describe, test, vi } from "vitest";

import { GitHubOperation } from "../src/io/vendor/github/operations";

describe("signing out", () => {
	let expired: string[];

	beforeEach(() => {
		expired = [];

		vi.stubGlobal("document", {
			get cookie() {
				return "github-user=octocat";
			},
			set cookie(value: string) {
				expired.push(value.slice(0, value.indexOf("=")));
			},
		});
		vi.stubGlobal("window", {
			location: { protocol: "https:" },
			dispatchEvent: vi.fn(),
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	test("forgets the session once the server confirms", async (t) => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
		);

		t.expect(await GitHubOperation.signOut()).toBe(true);
		t.expect(expired).toEqual(["github-user", "github-token"]);
	});

	test("keeps the session when the server can't be reached", async (t) => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => Promise.reject(new TypeError("offline"))),
		);

		t.expect(await GitHubOperation.signOut()).toBe(false);
		t.expect(expired).toEqual([]);
	});

	test("keeps the session when the server fails", async (t) => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => Promise.resolve(new Response(null, { status: 500 }))),
		);

		t.expect(await GitHubOperation.signOut()).toBe(false);
		t.expect(expired).toEqual([]);
	});
});
