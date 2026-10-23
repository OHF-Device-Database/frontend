import {
	GITHUB_OAUTH_CLIENT_ID,
	GITHUB_OAUTH_CLIENT_SECRET,
} from "astro:env/server";
import type { APIRoute } from "astro";

import { SESSION_CHANGE_HEADERS } from "../../../io/oauth";
import { GitHubOAuth } from "../../../io/vendor/github/oauth";
import {
	GITHUB_COOKIE_TOKEN,
	GitHubSession,
} from "../../../io/vendor/github/session";

export const prerender = false;

/** ends the current session */
export const POST: APIRoute = async ({ cookies }) => {
	const token = GitHubSession.token.deserialize(
		cookies.get(GITHUB_COOKIE_TOKEN)?.value,
	);

	// don't revoke when token is expired / absent
	if (
		typeof token !== "undefined" &&
		typeof GITHUB_OAUTH_CLIENT_ID !== "undefined" &&
		typeof GITHUB_OAUTH_CLIENT_SECRET !== "undefined"
	) {
		try {
			await GitHubOAuth.token.revoke({
				clientId: GITHUB_OAUTH_CLIENT_ID,
				clientSecret: GITHUB_OAUTH_CLIENT_SECRET,
				accessToken: token.token,
			});
		} catch {
			// revocation failed, still terminate session
		}
	}

	GitHubOAuth.session.clear(cookies);

	return new Response(null, {
		status: 204,
		headers: { "cache-control": "no-store", ...SESSION_CHANGE_HEADERS },
	});
};
