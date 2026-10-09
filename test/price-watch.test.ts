import { describe, test } from "vitest";

import {
	priceWatchCountries,
	priceWatcherDomain,
	priceWatchers,
	priceWatchSearchTerm,
} from "../src/utilities/price-watch";
import {
	guessPriceWatchCountry,
	priceWatchTimeZones,
} from "../src/utilities/price-watch-country";

describe("priceWatchers", () => {
	test("keys are lowercase iso 3166-1 alpha-2 codes", (t) => {
		for (const code of Object.keys(priceWatchers)) {
			t.expect(code).toMatch(/^[a-z]{2}$/);
		}
	});

	test("every template stays on the watcher's host and contains the term", (t) => {
		const term = "Philips Hue/White A19 & co";

		for (const watchers of Object.values(priceWatchers)) {
			for (const watcher of watchers) {
				const url = watcher.template(term);

				t.expect(url.protocol).toBe("https:");
				// search may live on a subdomain, like search.kakaku.com
				t.expect(url.hostname).toMatch(
					new RegExp(
						`(^|\\.)${priceWatcherDomain(watcher).replaceAll(".", "\\.")}$`,
					),
				);
				// some sites want a slug, so compare word by word, ignoring case
				const decoded = decodeURIComponent(url.href).toLowerCase();
				for (const word of term.toLowerCase().split(" ")) {
					t.expect(decoded).toContain(word);
				}
			}
		}
	});

	test("query templates encode the term as a parameter", (t) => {
		t.expect(priceWatchers.at[0].template("Hue A19").href).toBe(
			"https://geizhals.at/?fs=Hue+A19",
		);
	});

	test("path templates encode the term as a single segment", (t) => {
		t.expect(priceWatchers.fi[0].template("Hue/A19").href).toBe(
			"https://hintaseuranta.fi/haku/Hue%2FA19",
		);
		t.expect(priceWatchers.pl[0].template("Hue A19").href).toBe(
			"https://www.ceneo.pl/Inteligentny_dom;szukaj-Hue%20A19",
		);
		t.expect(priceWatchers.au[0].template("Hue A19").href).toBe(
			"https://www.getprice.com.au/search/hue-a19",
		);
	});
});

describe("guessPriceWatchCountry", () => {
	test("maps time zones of supported countries", (t) => {
		t.expect(guessPriceWatchCountry("Europe/Vienna")).toBe("at");
		t.expect(guessPriceWatchCountry("America/Toronto")).toBe("ca");
		t.expect(guessPriceWatchCountry("Atlantic/Canary")).toBe("es");
	});

	test("lists only zones the runtime knows, each once", (t) => {
		const zones = Object.values(priceWatchTimeZones).flat();
		t.expect(new Set(zones).size).toBe(zones.length);
		for (const zone of zones) {
			t.expect(
				() => new Intl.DateTimeFormat("en", { timeZone: zone }),
			).not.toThrow();
		}
	});

	test("yields no guess for unsupported or hardened zones", (t) => {
		t.expect(guessPriceWatchCountry("UTC")).toBeUndefined();
		t.expect(guessPriceWatchCountry("America/New_York")).toBeUndefined();
	});
});

describe("priceWatchSearchTerm", () => {
	test("prefers the model over the model id", (t) => {
		t.expect(
			priceWatchSearchTerm({
				manufacturer: "Philips",
				model: "Hue White A19",
				modelId: "LWA001",
			}),
		).toBe("Philips Hue White A19");
	});

	test("falls back to the model id", (t) => {
		t.expect(
			priceWatchSearchTerm({ manufacturer: "Philips", modelId: "LWA001" }),
		).toBe("Philips LWA001");
	});
});

describe("priceWatchCountries", () => {
	test("localizes and sorts countries by name", (t) => {
		const countries = priceWatchCountries("de");
		const names = countries.map(({ name }) => name);

		t.expect(countries.find(({ code }) => code === "de")?.name).toBe(
			"Deutschland",
		);
		t.expect(names).toEqual(names.toSorted((a, b) => a.localeCompare(b, "de")));
	});

	test("sorts watchers alphabetically within a country", (t) => {
		const nl = priceWatchCountries("en").find(({ code }) => code === "nl");

		t.expect(nl?.watchers.map(({ name }) => name)).toEqual([
			"Beslist",
			"Tweakers Pricewatch",
		]);
	});
});
