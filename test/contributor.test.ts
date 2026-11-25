import { describe, test } from "vitest";

import {
	getContributors,
	getContributorsSample,
	IoContributor,
} from "../src/io/contributor";

describe("IoContributor", () => {
	test("needs no more than a name and a count", (t) => {
		t.expect(
			IoContributor.parse({ name: "Alan Doe", contributions: 0 }),
		).toEqual({ name: "Alan Doe", contributions: 0 });
	});

	test("keeps the location, the picture and the page", (t) => {
		const contributor = {
			name: "Alan Doe",
			location: "Amsterdam, The Netherlands",
			avatar: "https://example.com/alan.png",
			url: "https://example.com/alan",
			contributions: 11,
		};
		t.expect(IoContributor.parse(contributor)).toEqual(contributor);
	});

	test("rejects a page or a picture that is not on the web", (t) => {
		const base = { name: "Alan Doe", contributions: 1 };
		for (const url of ["javascript:alert(1)", "data:text/html,x", "/alan"]) {
			t.expect(IoContributor.safeParse({ ...base, url }).success).toBe(false);
			t.expect(IoContributor.safeParse({ ...base, avatar: url }).success).toBe(
				false,
			);
		}
	});

	test("rejects a missing name and a count that is no count", (t) => {
		t.expect(
			IoContributor.safeParse({ name: "", contributions: 1 }).success,
		).toBe(false);
		for (const contributions of [-1, 1.5, "3"]) {
			t.expect(
				IoContributor.safeParse({ name: "Alan Doe", contributions }).success,
			).toBe(false);
		}
	});
});

describe("getContributors", () => {
	test("has nobody while there is no endpoint", async (t) => {
		t.expect(await getContributors()).toEqual({ contributors: [] });
	});
});

describe("getContributorsSample", () => {
	test("has sample people of every kind the list shows", async (t) => {
		const { contributors } = await getContributorsSample();

		t.expect(contributors.length).toBeGreaterThan(10);
		const has = (key: "location" | "avatar" | "url", present: boolean) =>
			contributors.some(
				(contributor) => (typeof contributor[key] !== "undefined") === present,
			);
		for (const key of ["location", "avatar", "url"] as const) {
			t.expect(has(key, true)).toBe(true);
			t.expect(has(key, false)).toBe(true);
		}
		// one for the singular, one that needs a thousands separator
		t.expect(
			contributors.some(({ contributions }) => contributions === 1),
		).toBe(true);
		t.expect(
			contributors.some(({ contributions }) => contributions >= 1000),
		).toBe(true);
	});
});
