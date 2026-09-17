import { describe, test } from "vitest";

import { m } from "../src/paraglide/messages.js";
import { baseLocale, getLocale, locales } from "../src/paraglide/runtime.js";
import {
	localeFromParam,
	localeStaticPaths,
	localeStorage,
} from "../src/utilities/locale";

describe("localeFromParam", () => {
	test("missing param is the base locale", (t) => {
		t.expect(localeFromParam(undefined)).toBe(baseLocale);
	});

	test("accepts a locale prefix", (t) => {
		t.expect(localeFromParam("de")).toBe("de");
		t.expect(localeFromParam("pt-BR")).toBe("pt-BR");
	});

	test("rejects the base locale as a prefix", (t) => {
		t.expect(localeFromParam(baseLocale)).toBeUndefined();
	});

	test("rejects segments that aren't locales", (t) => {
		t.expect(localeFromParam("foo")).toBeUndefined();
		t.expect(localeFromParam("de/nonexistent")).toBeUndefined();
		t.expect(localeFromParam("DE")).toBeUndefined();
	});
});

describe("localeStaticPaths", () => {
	test("emits every locale once, the base locale unprefixed", (t) => {
		const paths = localeStaticPaths();

		t.expect(paths).toHaveLength(locales.length);
		t.expect(
			paths.filter(({ params }) => typeof params.locale === "undefined"),
		).toHaveLength(1);
		t.expect(
			paths.map(({ params }) => params.locale ?? baseLocale).toSorted(),
		).toEqual([...locales].toSorted());
	});
});

// guards the Paraglide internals the build-time middleware relies on.
// if an upgrade changes them, prerendered pages would otherwise silently
// render in the base locale
describe("localeStorage", () => {
	test("returns the same storage on repeated calls", (t) => {
		t.expect(localeStorage()).toBe(localeStorage());
	});

	test("scopes getLocale() to the seeded locale", (t) => {
		t.expect(localeStorage().run({ locale: "de" }, () => getLocale())).toBe(
			"de",
		);
		t.expect(localeStorage().run({ locale: "fr" }, () => getLocale())).toBe(
			"fr",
		);
	});

	test("scopes messages to the seeded locale", (t) => {
		t.expect(localeStorage().run({ locale: "de" }, () => m.about_title())).toBe(
			"Über",
		);
		t.expect(
			localeStorage().run({ locale: baseLocale }, () => m.about_title()),
		).toBe("About");
	});
});
