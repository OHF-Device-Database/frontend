import { describe, test } from "vitest";

import { baseLocale, locales } from "../src/paraglide/runtime.js";
import { localeFromParam, localeStaticPaths } from "../src/utilities/locale";

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
