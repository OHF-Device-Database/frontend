import {
	GITHUB_OAUTH_CLIENT_ID,
	GITHUB_OAUTH_CLIENT_SECRET,
} from "astro:env/server";
import type { APIRoute } from "astro";

import {
	GITHUB_COOKIE_REFRESH,
	GitHubOAuth,
} from "../../../io/vendor/github/oauth";
import {
	GITHUB_COOKIE_TOKEN,
	GitHubSession,
} from "../../../io/vendor/github/session";

export const prerender = false;

/** crafts uncached response with empty body and provided status code  */
const status = (code: number): Response =>
	new Response(null, {
		status: code,
		headers: { "cache-control": "no-store" },
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
): Promise<string | undefined> => {
	const current = GitHubSession.token.deserialize(cookie);
	if (typeof current !== "undefined") {
		return current.token;
	}

	if (!refreshToken) {
		return undefined;
	}

	const renewed = await GitHubOAuth.token.refresh({
		clientId,
		clientSecret,
		refreshToken,
	});

	return renewed.accessToken;
};

/**
 * undoes app authorization grant
 *
 * needs client secret, therefor happens on server
 *
 * `204` on success, 500 if grant revocation fails
 */
export const DELETE: APIRoute = async ({ cookies }) => {
	if (!GITHUB_OAUTH_CLIENT_ID || !GITHUB_OAUTH_CLIENT_SECRET) {
		return status(503);
	}

	let accessToken: string | undefined;
	try {
		accessToken = await revocableToken(
			cookies.get(GITHUB_COOKIE_TOKEN)?.value,
			cookies.get(GITHUB_COOKIE_REFRESH)?.value,
			GITHUB_OAUTH_CLIENT_ID,
			GITHUB_OAUTH_CLIENT_SECRET,
		);
	} catch {
		// the refresh token was spent or revoked: there is no grant left to
		// address, and holding on to dead credentials helps nobody
		GitHubOAuth.session.clear(cookies);

		return status(204);
	}

	if (!accessToken) {
		GitHubOAuth.session.clear(cookies);

		return status(204);
	}

	try {
		await GitHubOAuth.authorization.revoke({
			clientId: GITHUB_OAUTH_CLIENT_ID,
			clientSecret: GITHUB_OAUTH_CLIENT_SECRET,
			accessToken,
		});
	} catch {
		return status(500);
	}

	GitHubOAuth.session.clear(cookies);

	return status(204);
};
