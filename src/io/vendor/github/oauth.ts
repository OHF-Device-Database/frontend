import { z } from "astro/zod";
import type { AstroCookies, AstroCookieSetOptions } from "astro";

import {
	authorizeUrl,
	basicAuthorization,
	OAuthError,
	requestToken as oauthRequestToken,
	readableCookieOptions,
	secretCookieOptions,
} from "../../oauth";
import { GITHUB_ROUTE_BASE } from "./routes";
import { GITHUB_COOKIE_TOKEN, GITHUB_COOKIE_USER } from "./session";
import type { OAuthToken } from "../../oauth";

// browser can issue api requests once authenticated
// it can't authenticate on it's own, necessitating server-side support

const AUTHORIZE_ENDPOINT = "https://github.com/login/oauth/authorize";
const TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
const API_ENDPOINT = "https://api.github.com";

/** for csrf state + the page to return to */
export const GITHUB_COOKIE_OAUTH_HELLO = "github-oauth-hello";
/** for refresh token */
export const GITHUB_COOKIE_REFRESH = "github-refresh";

/** scoped to segment containing all other github-related routes so that only those can access cookie value  */
export const GITHUB_OAUTH_COOKIE_PATH = GITHUB_ROUTE_BASE;

/** `public_repo` is enough to fork, write contents and open pull requests on public repositories */
export const GITHUB_OAUTH_SCOPE = "public_repo";

/** required for server-side requests, as github rejects requests without proided user-agent */
const USER_AGENT = "device-database-frontend";

const STATE_TTL_SECONDS = 600;
const EXCHANGE_TIMEOUT_MS = 8000;

/**
 * account name is not a credential and can be kept around long after the token died
 * chrome caps maximum lifetime to 400 days (https://developer.chrome.com/blog/cookie-max-age-expires/), so use that
 */
const TTL_USER_SECONDS = 400 * 24 * 60 * 60;

/** only reached if token expiration is ever turned off, where `expires_in` is absent */
const TTL_TOKEN_FALLBACK_SECONDS = 8 * 60 * 60;

/**
 * github normally returns the ttl of their refresh token, fallback for when it doesn't.
 * they should generally last 6 months
 */
const REFRESH_FALLBACK_TTL_SECONDS = 180 * 24 * 60 * 60;

export type GithubOAuthToken = OAuthToken & {
	scope: string;
	expiresIn: number;
};

type AppRevocation = {
	clientId: string;
	clientSecret: string;
	accessToken: string;
};

const requestToken = async (
	body: Record<string, string>,
): Promise<GithubOAuthToken> => {
	const token = await oauthRequestToken(TOKEN_ENDPOINT, body, {
		userAgent: USER_AGENT,
		timeoutMs: EXCHANGE_TIMEOUT_MS,
	});

	return {
		...token,
		scope: token.scope ?? GITHUB_OAUTH_SCOPE,
		// `expires_in` is there while token expiration is enabled, which it is
		expiresIn: token.expiresIn ?? TTL_TOKEN_FALLBACK_SECONDS,
	};
};

/**
 * - `token` revokes exactly the one token passed in
 * - `grant` revokes the authorization, so the next sign-in asks for consent again
 *
 * https://docs.github.com/en/rest/apps/oauth-applications?apiVersion=2022-11-28
 */
const revokeResource = async (
	resource: "token" | "grant",
	params: AppRevocation,
): Promise<void> => {
	const endpoint = `${API_ENDPOINT}/applications/${encodeURIComponent(params.clientId)}/${resource}`;

	const response = await fetch(endpoint, {
		method: "DELETE",
		headers: {
			accept: "application/vnd.github+json",
			authorization: basicAuthorization(params.clientId, params.clientSecret),
			"content-type": "application/json",
			"user-agent": USER_AGENT,
		},
		body: JSON.stringify({ access_token: params.accessToken }),
		signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
	});

	if (response.status !== 204 && response.status !== 404) {
		throw new OAuthError(
			"revoke_failed",
			`github answered <${response.status}>`,
		);
	}
};

const GitHubUser = z.object({ login: z.string().min(1) });

export class GitHubOAuth {
	static readonly authorize = {
		url: (params: {
			clientId: string;
			redirectUri: string;
			state: string;
		}): string =>
			authorizeUrl({
				endpoint: AUTHORIZE_ENDPOINT,
				scope: GITHUB_OAUTH_SCOPE,
				...params,
			}),

		cookieOptions: (url: URL): AstroCookieSetOptions =>
			secretCookieOptions(url, GITHUB_OAUTH_COOKIE_PATH, STATE_TTL_SECONDS),
	};

	/** the token endpoint, and what becomes of what it hands out */
	static readonly token = {
		exchange: (params: {
			clientId: string;
			clientSecret: string;
			code: string;
			redirectUri: string;
		}): Promise<GithubOAuthToken> =>
			requestToken({
				client_id: params.clientId,
				client_secret: params.clientSecret,
				code: params.code,
				redirect_uri: params.redirectUri,
			}),

		refresh: (params: {
			clientId: string;
			clientSecret: string;
			refreshToken: string;
		}): Promise<GithubOAuthToken> =>
			requestToken({
				client_id: params.clientId,
				client_secret: params.clientSecret,
				grant_type: "refresh_token",
				refresh_token: params.refreshToken,
			}),

		/** for signing out: this one token stops working, the authorization stands */
		revoke: (params: AppRevocation): Promise<void> =>
			revokeResource("token", params),

		/** the token as the browser half expects to find it in the cookie */
		cookieValue: (token: GithubOAuthToken) => ({
			token: token.accessToken,
			scope: token.scope,
			// absolute and from the server's clock; a browser that is minutes off
			// renews minutes early or late, which the refresh route absorbs
			expiresAt: Date.now() + token.expiresIn * 1000,
		}),
	};

	/** the grant as a resource of its own, outliving every token issued under it */
	static readonly authorization = {
		/** for disconnecting: the authorization goes, and every token issued under it with it */
		revoke: (params: AppRevocation): Promise<void> =>
			revokeResource("grant", params),
	};

	static readonly session = {
		/** writes what a sign-in or a refresh produced */
		write: (
			value: {
				url: URL;
				token: GithubOAuthToken;
				login: string;
			},
			cookies: AstroCookies,
		): void => {
			cookies.set(
				GITHUB_COOKIE_USER,
				value.login,
				readableCookieOptions(value.url, TTL_USER_SECONDS),
			);

			// `Max-Age` tracks the token's own lifetime, cookie disappears exactly when the token stops working
			cookies.set(
				GITHUB_COOKIE_TOKEN,
				GitHubOAuth.token.cookieValue(value.token),
				readableCookieOptions(value.url, value.token.expiresIn),
			);

			if (value.token.refreshToken) {
				cookies.set(
					GITHUB_COOKIE_REFRESH,
					value.token.refreshToken,
					secretCookieOptions(
						value.url,
						GITHUB_OAUTH_COOKIE_PATH,
						value.token.refreshTokenExpiresIn ?? REFRESH_FALLBACK_TTL_SECONDS,
					),
				);
			}
		},

		/** drops the whole session, account name included */
		clear: (cookies: AstroCookies): void => {
			cookies.delete(GITHUB_COOKIE_TOKEN, { path: "/" });
			cookies.delete(GITHUB_COOKIE_REFRESH, { path: GITHUB_OAUTH_COOKIE_PATH });
			cookies.delete(GITHUB_COOKIE_USER, { path: "/" });
		},
	};

	static async fetchLogin(accessToken: string): Promise<string> {
		const response = await fetch(`${API_ENDPOINT}/user`, {
			headers: {
				accept: "application/vnd.github+json",
				authorization: `Bearer ${accessToken}`,
				"user-agent": USER_AGENT,
				"cache-control": "no-store",
			},
			signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
		});

		if (!response.ok) {
			throw new OAuthError(
				"user_lookup_failed",
				`github answered <${response.status}>`,
			);
		}

		const parsed = GitHubUser.safeParse(await response.json());
		if (!parsed.success) {
			throw new OAuthError("user_lookup_failed", "unexpected user response");
		}

		return parsed.data.login;
	}
}
