// eslint-disable-next-line @typescript-eslint/no-unused-vars -- false positive, referenced in comment
import type { AsyncLocalStorage } from "node:async_hooks";

import { FEATURE_NAMES, isFeatureName } from "../types/feature";
import type { FeatureName, FeatureState } from "../types/feature";

export const FEATURE_COOKIE = "device-database.features";

/** spells the enabled set out in a url, so a state can be linked to */
export const FEATURE_PARAM = "feature";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const COOKIE_PATH = "/";

/** fired on `window` after a flag changed, so client features can re-render */
export const FEATURE_EVENT = "device-database:features";

const SEPARATOR = "|";

export type FeatureCookieJar = {
	get: (key: string) => { value: string } | undefined;
};

/** attributes of the cookie */
type FeatureCookieOptions = {
	path: string;
	maxAge: number;
	sameSite: "lax";
	secure: boolean;
};

export type FeatureCookieJarWritable = FeatureCookieJar & {
	set: (key: string, value: string, options: FeatureCookieOptions) => void;
	delete: (key: string, options: { path: string }) => void;
};

/** also needs the url because `secure` has to follow the scheme */
export type FeatureTarget = {
	cookies: FeatureCookieJarWritable;
	url: { protocol: string };
};

export type FeatureRequest = {
	cookies: FeatureCookieJarWritable;
	url: URL;
};

/**
 * astro global is only available in `.astro` files and middlewares.
 * page rendering happens in middleware callback chain
 * → introduce global thunk that is set with {@link featureRenderInstall} in ssr context
 *
 * thunk is eventually populated with help of {@link AsyncLocalStorage}
 */
let renderer: (() => FeatureCookieJar | undefined) | undefined;
/** allows setting {@link renderer}   */
export const featureRenderInstall = (
	resolve: () => FeatureCookieJar | undefined,
) => {
	renderer = resolve;
};

const fromDocument = (): string | undefined => {
	if (typeof document === "undefined") {
		return undefined;
	}

	for (const pair of document.cookie.split(";")) {
		const separator = pair.indexOf("=");
		if (
			separator === -1 ||
			pair.slice(0, separator).trim() !== FEATURE_COOKIE
		) {
			continue;
		}

		const raw = pair.slice(separator + 1).trim();
		try {
			return decodeURIComponent(raw);
		} catch {
			// a hand-edited cookie can be invalid percent-encoding
			return raw;
		}
	}

	return undefined;
};

const cookieValue = (jar?: FeatureCookieJar): string | undefined =>
	typeof jar === "undefined" ? fromDocument() : jar.get(FEATURE_COOKIE)?.value;

/** unknown names are dropped, so a cookie outliving a removed flag is harmless */
export const featureParseEnabled = (value: string): Set<FeatureName> => {
	const enabled: Set<FeatureName> = new Set();
	for (const name of value.split(SEPARATOR)) {
		if (!isFeatureName(name)) {
			continue;
		}

		enabled.add(name);
	}

	return enabled;
};

export const featureSerializeEnabled = (enabled: Set<FeatureName>) =>
	[...enabled].join(SEPARATOR);

// no return type, lint calls the assertion unnecessary while the registry is empty
const featureStateOf = (enabled: Set<FeatureName>) =>
	Object.fromEntries(
		FEATURE_NAMES.map((name) => [name, enabled.has(name)] as const),
	) as FeatureState;

/** what the cookie carries, empty when it is absent or unreadable */
const enabledOf = (jar?: FeatureCookieJar): Set<FeatureName> => {
	const value = cookieValue(jar);

	return typeof value !== "undefined" ? featureParseEnabled(value) : new Set();
};

/** `data-feature-*` attributes for css queries */
export const featureDataset = (state: FeatureState): Record<string, string> =>
	Object.fromEntries(
		FEATURE_NAMES.map(
			(name) =>
				[`data-feature-${String(name)}`, state[name] ? "on" : "off"] as const,
		),
	);

/** applies data-feature-*` attributes for css queries in csr context */
export const featureDatasetApply = (state: FeatureState = features()) => {
	for (const [attribute, value] of Object.entries(featureDataset(state))) {
		document.documentElement.setAttribute(attribute, value);
	}
};

const cookieOptions = (url: { protocol: string }): FeatureCookieOptions => ({
	path: COOKIE_PATH,
	maxAge: COOKIE_MAX_AGE_SECONDS,
	sameSite: "lax",
	secure: url.protocol === "https:",
});

const serializeCookie = (
	value: string,
	options: FeatureCookieOptions,
): string =>
	[
		`${FEATURE_COOKIE}=${encodeURIComponent(value)}`,
		`path=${options.path}`,
		`Max-Age=${options.maxAge}`,
		`SameSite=${options.sameSite}`,
		...(options.secure ? ["Secure"] : []),
	].join("; ");

const writeCookie = (value: string, target?: FeatureTarget): void => {
	if (typeof target !== "undefined") {
		if (value.length === 0) {
			target.cookies.delete(FEATURE_COOKIE, { path: COOKIE_PATH });
		} else {
			target.cookies.set(FEATURE_COOKIE, value, cookieOptions(target.url));
		}

		return;
	}

	if (typeof document === "undefined") {
		throw new Error("cookie jar needed in ssr context");
	}

	const options = cookieOptions(window.location);
	document.cookie = serializeCookie(
		value,
		value.length === 0 ? { ...options, maxAge: 0 } : options,
	);
};

const announce = (state: FeatureState): FeatureState => {
	if (typeof document === "undefined") {
		return state;
	}

	featureDatasetApply(state);

	window.dispatchEvent(
		new CustomEvent<FeatureState>(FEATURE_EVENT, { detail: state }),
	);

	return state;
};

/** persists the whole set and announces it */
export const featuresSet = (
	enabled: Set<FeatureName>,
	target?: FeatureTarget,
): FeatureState => {
	writeCookie(featureSerializeEnabled(enabled), target);

	return announce(featureStateOf(enabled));
};

/** persists enablement and announces it */
export const featureEnable = (
	name: FeatureName,
	enabled: boolean,
	target?: FeatureTarget,
): FeatureState => {
	const next = enabledOf(target?.cookies);

	if (enabled) {
		next.add(name);
	} else {
		next.delete(name);
	}

	return featuresSet(next, target);
};

/** drops the cookie, turning every feature off */
export const featuresReset = (target?: FeatureTarget): FeatureState =>
	featuresSet(new Set(), target);

/** what an enablement url asks for */
export const featureParamEnabled = (
	params: URLSearchParams,
): Set<FeatureName> | undefined => {
	if (!params.has(FEATURE_PARAM)) {
		return undefined;
	}

	const enabled: Set<FeatureName> = new Set();
	for (const name of params.getAll(FEATURE_PARAM)) {
		if (!isFeatureName(name)) {
			continue;
		}

		enabled.add(name);
	}

	return enabled;
};

/** all enabled features */
export const features = (jar?: FeatureCookieJar): FeatureState =>
	featureStateOf(enabledOf(jar ?? renderer?.()));

/** enablement state of single feature */
export const feature = (name: FeatureName, jar?: FeatureCookieJar): boolean =>
	features(jar)[name];

/** builds enablement url */
export const featureParamUrl = (
	url: URL | string,
	enabled: Iterable<FeatureName>,
): string => {
	const next = new URL(url);
	next.searchParams.delete(FEATURE_PARAM);

	const names = [...enabled];
	for (const name of names) {
		next.searchParams.append(FEATURE_PARAM, name);
	}

	if (names.length === 0) {
		// empty feature parameter indicates that all features should be disabled
		next.searchParams.append(FEATURE_PARAM, "");
	}

	return next.toString();
};

/** applies feature override requested in `?feature=` enablement url */
export const featureParamApply = (request: FeatureRequest): void => {
	const asked = featureParamEnabled(request.url.searchParams);
	if (typeof asked === "undefined") {
		return;
	}

	featuresSet(asked, request);
};

declare global {
	interface WindowEventMap {
		[FEATURE_EVENT]: CustomEvent<FeatureState>;
	}
}
