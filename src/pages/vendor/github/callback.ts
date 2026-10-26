import {
	GITHUB_OAUTH_CLIENT_ID,
	GITHUB_OAUTH_CLIENT_SECRET,
} from "astro:env/server";
import type { APIRoute, AstroCookies } from "astro";

import { OAuthError, OAuthState, returnToRedirect } from "../../../io/oauth";
import {
	GITHUB_COOKIE_OAUTH_HELLO,
	GITHUB_OAUTH_COOKIE_PATH,
	GitHubOAuth,
} from "../../../io/vendor/github/oauth";
import { GITHUB_CALLBACK_PATH } from "../../../io/vendor/github/routes";

export const prerender = false;

const HTML_ESCAPES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
};

const escapeHtml = (value: string): string =>
	value.replaceAll(
		/[&<>"]/g,
		(character) => HTML_ESCAPES[character] ?? character,
	);

const errorPage = (params: {
	status: number;
	message: string;
	detail?: string | undefined;
	returnTo?: string | undefined;
}): Response => {
	const back = escapeHtml(params.returnTo ?? "/");
	const detail = params.detail
		? `\n\t\t<p><code>${escapeHtml(params.detail)}</code></p>`
		: "";

	const body = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<meta name="robots" content="noindex" />
		<title>Sign-in failed</title>
		<style>
			:root {
				color-scheme: light dark;
			}
			body {
				box-sizing: border-box;
				display: grid;
				align-content: center;
				gap: 1rem;
				margin: 0 auto;
				padding: 2rem;
				max-width: 36rem;
				min-height: 100dvh;
				font-family: system-ui, sans-serif;
				line-height: 1.5;
			}
			h1 {
				margin: 0;
				font-size: 1.5rem;
			}
			p {
				margin: 0;
			}
			code {
				overflow-wrap: anywhere;
			}
			a {
				justify-self: start;
				padding: 0.5rem 1rem;
				border: 1px solid currentcolor;
				border-radius: 0.25rem;
				text-decoration: none;
				color: inherit;
			}
		</style>
	</head>
	<body>
		<h1>GitHub sign-in failed</h1>
		<p>${escapeHtml(params.message)}</p>${detail}
		<a href="${back}">Go back</a>
	</body>
</html>
`;

	return new Response(body, {
		status: params.status,
		headers: {
			"content-type": "text/html; charset=utf-8",
			// the failure belongs to this one attempt, by this one visitor
			"cache-control": "no-store",
		},
	});
};

/** reads and immediately invalidates the clears pending authorization */
const takePending = (cookies: AstroCookies): OAuthState | undefined => {
	const cookie = cookies.get(GITHUB_COOKIE_OAUTH_HELLO);
	cookies.delete(GITHUB_COOKIE_OAUTH_HELLO, { path: GITHUB_OAUTH_COOKIE_PATH });

	if (typeof cookie === "undefined") {
		return undefined;
	}

	try {
		const parsed = OAuthState.safeParse(cookie.json());
		return parsed.success ? parsed.data : undefined;
	} catch {
		return undefined;
	}
};

/** exchanges authorization code for access / refresh token */
export const GET: APIRoute = async ({ cookies, url }) => {
	if (!GITHUB_OAUTH_CLIENT_ID || !GITHUB_OAUTH_CLIENT_SECRET) {
		return errorPage({
			status: 503,
			message: "GitHub sign-in is not configured for this site.",
		});
	}

	const pending = takePending(cookies);

	if (typeof pending === "undefined") {
		return errorPage({
			status: 400,
			message:
				"Sign-in did not start here, or it sat around for too long. Please try again.",
		});
	}

	const fail = (
		status: number,
		message: string,
		code: string,
		description?: string,
	): Response =>
		errorPage({
			status,
			message,
			detail: description ? `${code}: ${description}` : code,
			returnTo: pending.returnTo,
		});

	// csrf state mismatch
	if (url.searchParams.get("state") !== pending.state) {
		return errorPage({
			status: 400,
			message:
				"This sign-in could not be verified as the one that started here. Please try again.",
			returnTo: pending.returnTo,
		});
	}

	// GitHub sends `error=access_denied` when the visitor declines
	// fixed message, the url's `error_description` would let anyone put text on this page
	if (url.searchParams.has("error")) {
		return errorPage({
			status: 400,
			message: "GitHub access was not granted.",
			returnTo: pending.returnTo,
		});
	}

	const code = url.searchParams.get("code");
	if (code === null) {
		return errorPage({
			status: 400,
			message: "GitHub sent no authorization code to sign in with.",
			returnTo: pending.returnTo,
		});
	}

	try {
		const token = await GitHubOAuth.token.exchange({
			clientId: GITHUB_OAUTH_CLIENT_ID,
			clientSecret: GITHUB_OAUTH_CLIENT_SECRET,
			code,
			redirectUri: new URL(GITHUB_CALLBACK_PATH, url).toString(),
		});

		const login = await GitHubOAuth.fetchLogin(token.accessToken);

		GitHubOAuth.session.write({ url, token, login }, cookies);

		return returnToRedirect(pending.returnTo);
	} catch (error) {
		const message = "The sign-in could not be completed.";

		return error instanceof OAuthError
			? fail(500, message, error.code, error.description)
			: fail(500, message, "exchange_failed");
	}
};
