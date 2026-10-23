import { z } from "astro/zod";
import type { AstroCookieSetOptions } from "astro";

// provider-agnostic half of the oauth 2.0 authorization code flow

export class OAuthError extends Error {
	constructor(
		public code: string,
		public description?: string | undefined,
	) {
		super(
			typeof description !== "undefined" ? `${code}: ${description}` : code,
		);
		Object.setPrototypeOf(this, OAuthError.prototype);
	}
}

/** the pending authorization: single-use csrf state / the page to return to */
export const OAuthState = z.object({
	state: z.string().min(1),
	returnTo: z.string().startsWith("/"),
});
export type OAuthState = z.infer<typeof OAuthState>;

const hasControlCharacter = (value: string): boolean =>
	[...value].some((character) => {
		const code = character.codePointAt(0) ?? 0;

		return code < 0x20 || code === 0x7f;
	});

/**
 * accepts same-origin paths only
 *
 * `//evil.example` and `https://evil.example` would turn the callback into an open redirect
 */
export const safeReturnTo = (value: string | null | undefined): string => {
	if (!value || !value.startsWith("/")) {
		return "/";
	}

	// `//host` and `/\host` are protocol-relative; control characters can smuggle a header break
	if (
		value.startsWith("//") ||
		value.startsWith("/\\") ||
		hasControlCharacter(value)
	) {
		return "/";
	}

	// a fragment belongs to the browser, not to the `Location` header
	return value.split("#")[0] ?? "/";
};

export const returnToRedirect = (returnTo: string): Response =>
	new Response(null, {
		status: 302,
		headers: {
			location: returnTo,
			// carries Set-Cookie with the token; a cached copy would hand it to the next visitor
			"cache-control": "no-store",
		},
	});

const sharedCookieOptions = (url: URL) => ({
	// `strict` would prevent the cookie from being sent right after access token exchange
	sameSite: "lax" as const,
	secure: url.protocol === "https:",
});

/** for cookies that scripts don't need access to  */
export const secretCookieOptions = (
	url: URL,
	path: string,
	maxAge: number,
): AstroCookieSetOptions => ({
	...sharedCookieOptions(url),
	httpOnly: true,
	path,
	maxAge,
});

/** for cookies that scripts need access to */
export const readableCookieOptions = (
	url: URL,
	maxAge: number,
): AstroCookieSetOptions & { maxAge: number } => ({
	...sharedCookieOptions(url),
	httpOnly: false,
	path: "/",
	maxAge,
});

/** client authentication for the endpoints that act as the app rather than as a user */
export const basicAuthorization = (
	clientId: string,
	clientSecret: string,
): string => `Basic ${btoa(`${clientId}:${clientSecret}`)}`;

export const authorizeUrl = (params: {
	endpoint: string;
	clientId: string;
	redirectUri: string;
	scope: string;
	state: string;
}): string => {
	const url = new URL(params.endpoint);
	url.searchParams.set("client_id", params.clientId);
	url.searchParams.set("redirect_uri", params.redirectUri);
	url.searchParams.set("scope", params.scope);
	url.searchParams.set("state", params.state);

	return url.toString();
};

const TokenResponse = z.object({
	access_token: z.string().min(1),
	scope: z.string().optional(),
	expires_in: z.number(),
	refresh_token: z.string().optional(),
	refresh_token_expires_in: z.number().optional(),
});

export type OAuthToken = {
	accessToken: string;
	scope?: string | undefined;
	expiresIn: number | undefined;
	refreshToken?: string | undefined;
	refreshTokenExpiresIn?: number | undefined;
};

/** helper for token endpoint call */
export const requestToken = async (
	endpoint: string,
	body: Record<string, string>,
	options: { userAgent: string; timeoutMs: number },
): Promise<OAuthToken> => {
	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			accept: "application/json",
			"content-type": "application/json",
			"user-agent": options.userAgent,
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(options.timeoutMs),
	});

	if (!response.ok) {
		throw new OAuthError(
			"exchange_failed",
			`the provider answered <${response.status}>`,
		);
	}

	const parsed = TokenResponse.safeParse(await response.json());
	if (!parsed.success) {
		throw new OAuthError("exchange_failed", "unexpected token response");
	}

	return {
		accessToken: parsed.data.access_token,
		scope: parsed.data.scope,
		expiresIn: parsed.data.expires_in,
		refreshToken: parsed.data.refresh_token,
		refreshTokenExpiresIn: parsed.data.refresh_token_expires_in,
	};
};
