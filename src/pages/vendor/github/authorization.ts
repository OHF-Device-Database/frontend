import {
	GITHUB_OAUTH_CLIENT_ID,
	GITHUB_OAUTH_CLIENT_SECRET,
} from "astro:env/server";
import type { APIRoute } from "astro";

import { SESSION_CHANGE_HEADERS } from "../../../io/oauth";
import {
	GITHUB_COOKIE_REFRESH,
	GitHubOAuth,
} from "../../../io/vendor/github/oauth";
import {
	GITHUB_COOKIE_TOKEN,
	GITHUB_COOKIE_USER,
	GitHubSession,
} from "../../../io/vendor/github/session";
import type { GithubOAuthToken } from "../../../io/vendor/github/oauth";

export const prerender = false;

/** crafts uncached response with empty body and provided status code  */
const status = (code: number, headers: Record<string, string> = {}): Response =>
	new Response(null, {
		status: code,
		headers: { "cache-control": "no-store", ...headers },
	});

/**
 * access token to revoke with.
 * usually the one in cookie, refreshed one if it has expired
 */
const revocableToken = async (
	cookie: string | undefined,
	refreshToken: string | undefined,
	clientId: string,
	clientSecret: string,
): Promise<
	{ accessToken: string; renewed?: GithubOAuthToken | undefined } | undefined
> => {
	const current = GitHubSession.token.deserialize(cookie);
	if (typeof current !== "undefined") {
		return { accessToken: current.token };
	}

	if (!refreshToken) {
		return undefined;
	}

	const renewed = await GitHubOAuth.token.refresh({
		clientId,
		clientSecret,
		refreshToken,
	});

	return { accessToken: renewed.accessToken, renewed };
};

/**
 * undoes app authorization grant
 *
 * needs client secret, therefor happens on server
 *
 * `204` on success, `503` if github could not be reached, `500` if grant revocation fails
 */
export const DELETE: APIRoute = async ({ cookies, url }) => {
	if (!GITHUB_OAUTH_CLIENT_ID || !GITHUB_OAUTH_CLIENT_SECRET) {
		return status(503);
	}

	let revocable: Awaited<ReturnType<typeof revocableToken>>;
	try {
		revocable = await revocableToken(
			cookies.get(GITHUB_COOKIE_TOKEN)?.value,
			cookies.get(GITHUB_COOKIE_REFRESH)?.value,
			GITHUB_OAUTH_CLIENT_ID,
			GITHUB_OAUTH_CLIENT_SECRET,
		);
	} catch (error) {
		// timeout or outage, the grant may well still stand
		if (!GitHubOAuth.token.isRefreshRejected(error)) {
			return status(503);
		}

		// the refresh token was spent or revoked: there is no grant left to
		// address, and holding on to dead credentials helps nobody
		GitHubOAuth.session.clear(cookies);

		return status(204, SESSION_CHANGE_HEADERS);
	}

	if (typeof revocable === "undefined") {
		GitHubOAuth.session.clear(cookies);

		return status(204, SESSION_CHANGE_HEADERS);
	}

	try {
		await GitHubOAuth.authorization.revoke({
			clientId: GITHUB_OAUTH_CLIENT_ID,
			clientSecret: GITHUB_OAUTH_CLIENT_SECRET,
			accessToken: revocable.accessToken,
		});
	} catch {
		// the refresh above used up the old refresh token, keep the new one
		const login = cookies.get(GITHUB_COOKIE_USER)?.value;
		if (
			typeof revocable.renewed !== "undefined" &&
			typeof login !== "undefined"
		) {
			GitHubOAuth.session.write(
				{ url, token: revocable.renewed, login },
				cookies,
			);
		}

		return status(500);
	}

	GitHubOAuth.session.clear(cookies);

	return status(204, SESSION_CHANGE_HEADERS);
};
