import { describe, test, vi } from "vitest";

import { FEATURES } from "../src/types/feature";
import {
	feature,
	FEATURE_COOKIE,
	FEATURE_PARAM,
	featureDataset,
	featureEnable,
	featureParamApply,
	featureParamEnabled,
	featureParamUrl,
	featureParseEnabled,
	features,
	featureSerializeEnabled,
	featuresReset,
	featuresSet,
} from "../src/utilities/feature";
import { scopeFeature } from "../src/utilities/scope";
import type { FeatureName, FeatureState } from "../src/types/feature";
import type { FeatureCookieJarWritable } from "../src/utilities/feature";

// the real registry can be empty, so the tests bring their own features
vi.mock("../src/types/feature", () => {
	const FEATURES = {
		one: { label: "one", description: "first test feature" },
		two: { label: "two", description: "second test feature" },
	};
	const FEATURE_NAMES = Object.keys(FEATURES);

	return {
		FEATURES,
		FEATURE_NAMES,
		isFeatureName: (value: unknown) =>
			(FEATURE_NAMES as unknown[]).includes(value),
	};
});

const names = Object.keys(FEATURES) as [FeatureName, ...FeatureName[]];
const [name] = names;

const stateWith = (enabled: Iterable<FeatureName>) => {
	const on = new Set(enabled);

	return Object.fromEntries(names.map((n) => [n, on.has(n)])) as FeatureState;
};

const allOff = stateWith([]);

/** read-only half, stand in for `Astro.cookies` */
const jar = (value: string) => ({
	get: (key: string) => (key === FEATURE_COOKIE ? { value } : undefined),
});

type SetOptions = Parameters<FeatureCookieJarWritable["set"]>[2];

/** stand in for `Astro` */
const target = (initial?: string, protocol = "https:") => {
	let value = initial;
	const writes: SetOptions[] = [];
	let deletes = 0;

	return {
		cookies: {
			get: (key: string) =>
				key === FEATURE_COOKIE && typeof value !== "undefined"
					? { value }
					: undefined,
			set: (key: string, next: string, options: SetOptions) => {
				if (key === FEATURE_COOKIE) {
					value = next;
					writes.push(options);
				}
			},
			delete: (key: string) => {
				if (key === FEATURE_COOKIE) {
					value = undefined;
					deletes += 1;
				}
			},
		},
		url: { protocol },
		stored: () => value,
		writes,
		deletes: () => deletes,
	};
};

/** stand in for `Astro` on a server-rendered page, whose url can be questioned */
const request = (href: string, initial?: string) => {
	const url = new URL(href);

	return { ...target(initial, url.protocol), url };
};

/** `?feature=a&feature=b` for the given names */
const query = (...values: string[]): URLSearchParams =>
	new URLSearchParams(values.map((value) => [FEATURE_PARAM, value]));

describe("featureParseEnabled", () => {
	test("an empty cookie enables nothing", (t) => {
		t.expect(featureParseEnabled("")).toEqual(new Set());
	});

	test("names what the cookie lists", (t) => {
		t.expect(featureParseEnabled(name)).toEqual(new Set([name]));
	});

	test("drops names that are not features", (t) => {
		t.expect(featureParseEnabled("gone|also-gone")).toEqual(new Set());
		t.expect(featureParseEnabled(`gone|${String(name)}`)).toEqual(
			new Set([name]),
		);
	});
});

describe("featureSerializeEnabled", () => {
	test("nothing enabled is an empty cookie", (t) => {
		t.expect(featureSerializeEnabled(new Set())).toBe("");
	});

	test("round-trips every feature", (t) => {
		const all = new Set(names);

		t.expect(featureParseEnabled(featureSerializeEnabled(all))).toEqual(all);
	});
});

describe("features", () => {
	test("answers for every feature in the registry, not just the listed ones", (t) => {
		t.expect(Object.keys(features(jar(name))).toSorted()).toEqual(
			[...names].toSorted(),
		);
	});

	test("sources from a cookie jar", (t) => {
		t.expect(features(jar(name))).toEqual(stateWith([name]));
		t.expect(feature(name, jar(name))).toBe(true);
	});

	test("without a jar and without a document everything is off", (t) => {
		t.expect(features()).toEqual(allOff);
	});

	test("a jar without our cookie leaves everything off", (t) => {
		t.expect(features({ get: () => undefined })).toEqual(allOff);
	});
});

describe("featureDataset", () => {
	test("one data attribute per feature", (t) => {
		const attributes = featureDataset(stateWith([name]));

		t.expect(Object.keys(attributes)).toHaveLength(names.length);
		t.expect(attributes[`data-feature-${String(name)}`]).toBe("on");
	});

	test("an unlisted feature reads as off", (t) => {
		t.expect(featureDataset(allOff)[`data-feature-${String(name)}`]).toBe(
			"off",
		);
	});
});

describe("featureEnable", () => {
	test("writes through the jar and answers with the new state", (t) => {
		const astro = target();

		t.expect(featureEnable(name, true, astro)).toEqual(stateWith([name]));
		t.expect(featureParseEnabled(astro.stored() ?? "")).toEqual(
			new Set([name]),
		);
	});

	test("sources the current set from the same jar it writes to", (t) => {
		const astro = target(featureSerializeEnabled(new Set(names)));
		const remaining = new Set(names);
		remaining.delete(name);

		featureEnable(name, false, astro);

		t.expect(featureParseEnabled(astro.stored() ?? "")).toEqual(remaining);
	});

	test("enabling twice is idempotent", (t) => {
		const astro = target();
		featureEnable(name, true, astro);
		const second = featureEnable(name, true, astro);

		t.expect(second).toEqual(stateWith([name]));
		t.expect(featureParseEnabled(astro.stored() ?? "")).toEqual(
			new Set([name]),
		);
	});

	test("turning the last feature off drops the cookie instead of blanking it", (t) => {
		const astro = target(name);

		t.expect(featureEnable(name, false, astro)).toEqual(allOff);
		t.expect(astro.stored()).toBeUndefined();
		t.expect(astro.deletes()).toBe(1);
	});

	test("the cookie outlives the request and stays on top-level navigations", (t) => {
		const astro = target();
		featureEnable(name, true, astro);

		t.expect(astro.writes.at(0)).toMatchObject({
			path: "/",
			sameSite: "lax",
		});
		t.expect(astro.writes.at(0)?.maxAge).toBeGreaterThan(0);
	});

	test("secure follows the scheme, so local http dev still gets the cookie", (t) => {
		const secure = target(undefined, "https:");
		const plain = target(undefined, "http:");

		featureEnable(name, true, secure);
		featureEnable(name, true, plain);

		t.expect(secure.writes.at(0)?.secure).toBe(true);
		t.expect(plain.writes.at(0)?.secure).toBe(false);
	});

	test("refuses to guess a sink when there is no document and no jar", (t) => {
		t.expect(() => featureEnable(name, true)).toThrowError(
			"cookie jar needed in ssr context",
		);
	});
});

describe("featuresReset", () => {
	test("deletes the cookie and turns everything off", (t) => {
		const astro = target(featureSerializeEnabled(new Set(names)));

		t.expect(featuresReset(astro)).toEqual(allOff);
		t.expect(astro.stored()).toBeUndefined();
		t.expect(astro.deletes()).toBe(1);
	});
});

describe("featuresSet", () => {
	test("replaces the set rather than merging into it", (t) => {
		const astro = target(featureSerializeEnabled(new Set(names)));

		t.expect(featuresSet(new Set(), astro)).toEqual(allOff);
		t.expect(astro.stored()).toBeUndefined();
	});
});

describe("featureParamEnabled", () => {
	test("a url that does not ask leaves the cookie in charge", (t) => {
		t.expect(featureParamEnabled(new URLSearchParams())).toBeUndefined();
		t.expect(
			featureParamEnabled(new URLSearchParams("something=else")),
		).toBeUndefined();
	});

	test("names what the query lists", (t) => {
		t.expect(featureParamEnabled(query(name))).toEqual(new Set([name]));
	});

	test("asking for nothing is an ask, not a shrug", (t) => {
		t.expect(featureParamEnabled(query(""))).toEqual(new Set());
	});

	test("drops names that are not features", (t) => {
		t.expect(featureParamEnabled(query("gone", name))).toEqual(new Set([name]));
	});
});

describe("featureParamUrl", () => {
	test("spells out every enabled name", (t) => {
		const url = new URL(featureParamUrl("https://example.com/a", names));

		t.expect(url.searchParams.getAll(FEATURE_PARAM)).toEqual([...names]);
	});

	test("leaves the rest of the url alone", (t) => {
		const url = new URL(
			featureParamUrl("https://example.com/a?q=1#top", [name]),
		);

		t.expect(url.pathname).toBe("/a");
		t.expect(url.searchParams.get("q")).toBe("1");
		t.expect(url.hash).toBe("#top");
	});

	test("replaces whatever the url already asked for", (t) => {
		const before = featureParamUrl("https://example.com/", names);
		const after = new URL(featureParamUrl(before, []));

		t.expect(featureParamEnabled(after.searchParams)).toEqual(new Set());
	});

	test("round-trips through featureParamEnabled", (t) => {
		const url = new URL(featureParamUrl("https://example.com/", [name]));

		t.expect(featureParamEnabled(url.searchParams)).toEqual(new Set([name]));
	});
});

describe("featureParamApply", () => {
	test("without a query the cookie decides, and nothing is written", (t) => {
		const astro = request(
			"https://example.com/",
			featureSerializeEnabled(new Set([name])),
		);
		featureParamApply(astro);

		t.expect(features(astro.cookies)).toEqual(stateWith([name]));
		t.expect(astro.writes).toHaveLength(0);
		t.expect(astro.deletes()).toBe(0);
	});

	test("a query outranks the cookie", (t) => {
		const astro = request(
			`https://example.com/?${FEATURE_PARAM}=`,
			featureSerializeEnabled(new Set([name])),
		);
		featureParamApply(astro);

		t.expect(features(astro.cookies)).toEqual(allOff);
	});

	test("writes back, so the state survives a navigation that drops the query", (t) => {
		const astro = request(
			`https://example.com/?${FEATURE_PARAM}=${String(name)}`,
		);
		featureParamApply(astro);

		t.expect(features(astro.cookies)).toEqual(stateWith([name]));
		t.expect(featureParseEnabled(astro.stored() ?? "")).toEqual(
			new Set([name]),
		);
	});

	test("an empty ask drops the cookie rather than blanking it", (t) => {
		const astro = request(
			`https://example.com/?${FEATURE_PARAM}=`,
			featureSerializeEnabled(new Set([name])),
		);
		featureParamApply(astro);

		t.expect(astro.stored()).toBeUndefined();
		t.expect(astro.deletes()).toBe(1);
	});

	test("a link built by the menu is understood by the server", (t) => {
		const astro = request(
			featureParamUrl("https://example.com/some/page", [name]),
		);
		featureParamApply(astro);

		t.expect(features(astro.cookies)).toEqual(stateWith([name]));
		t.expect(feature(name, astro.cookies)).toBe(true);
	});
});

describe("render context propagation", () => {
	test("a bare read finds the request being rendered", async (t) => {
		const astro = request(
			"https://example.com/",
			featureSerializeEnabled(new Set([name])),
		);

		// awaits inside, the way a render does, to show the scope outlives them
		const state = await scopeFeature.run(astro.cookies, async () => {
			await Promise.resolve();

			return features();
		});

		t.expect(state).toEqual(stateWith([name]));
		t.expect(feature(name)).toBe(false);
	});

	test("concurrent renders do not see each other", async (t) => {
		const one = request(
			"https://example.com/",
			featureSerializeEnabled(new Set()),
		);
		const two = request(
			"https://example.com/",
			featureSerializeEnabled(new Set([name])),
		);

		const read = (astro: ReturnType<typeof request>) =>
			scopeFeature.run(astro.cookies, async () => {
				await new Promise((resolve) => setTimeout(resolve, 1));

				return features();
			});

		t.expect(await Promise.all([read(one), read(two)])).toEqual([
			allOff,
			stateWith([name]),
		]);
	});
});
