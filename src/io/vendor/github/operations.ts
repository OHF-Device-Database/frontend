import {
	GITHUB_AUTHORIZATION_PATH,
	GITHUB_REFRESH_PATH,
	GITHUB_SIGN_OUT_PATH,
} from "./routes";
import { GitHubSession } from "./session";
import type { GitHubToken } from "./session";

export type GitHubRenewal =
	| { status: "renewed"; token: GitHubToken }
	/** the refresh token is gone or was revoked, new new sign-in required */
	| { status: "signed-out" }
	| { status: "unavailable" };

const requestRenewal = async (stale?: string): Promise<GitHubRenewal> => {
	// another request may have renewed while this one waited
	const current = GitHubSession.token.read();
	if (current && current.token !== stale) {
		return { status: "renewed", token: current };
	}

	let response: Response;
	try {
		response = await fetch(GITHUB_REFRESH_PATH, {
			method: "POST",
			headers: { accept: "application/json" },
		});
	} catch {
		return { status: "unavailable" };
	}

	if (response.status === 401) {
		// the refresh token is dead, so the name is no longer the name of anyone
		// signed in: greeting a visitor who cannot act would only mislead
		GitHubSession.forget();
		return { status: "signed-out" };
	}

	if (!response.ok) {
		return { status: "unavailable" };
	}

	// obtain renewed token from cookie that was set through fetch above
	const renewed = GitHubSession.token.read();
	if (!renewed) {
		return { status: "unavailable" };
	}

	GitHubSession.announce();

	return { status: "renewed", token: renewed };
};

let collapsed: Promise<GitHubRenewal> | undefined;

export class GitHubOperation {
	/**
	 * trades the refresh token for a new access token.
	 * access tokens are short-lived, so operations need to be able to deal with expiry.
	 *
	 * safe to call concurrently, calls are collapsed
	 *
	 * {@link GitHubSession.token.read} will return refreshed access token upon successful renewal
	 */
	static renew(stale?: string): Promise<GitHubRenewal> {
		collapsed ??= requestRenewal(stale).finally(() => {
			collapsed = undefined;
		});

		return collapsed;
	}

	/**
	 * `false` if the server could not be reached or refused: the http-only refresh
	 * cookie may still be there, so the session is left as it was
	 */
	static async signOut(): Promise<boolean> {
		let response: Response;
		try {
			// survives the navigation when sign-out is the last thing a page does
			// the token cookie stays until the request is done, the server needs it to revoke
			response = await fetch(GITHUB_SIGN_OUT_PATH, {
				method: "POST",
				keepalive: true,
			});
		} catch {
			return false;
		}

		if (!response.ok) {
			return false;
		}

		GitHubSession.forget();

		return true;
	}

	static async revoke(): Promise<boolean> {
		let response: Response;
		try {
			response = await fetch(GITHUB_AUTHORIZATION_PATH, {
				method: "DELETE",
				headers: { accept: "application/json" },
			});
		} catch {
			return false;
		}

		if (!response.ok) {
			return false;
		}

		GitHubSession.forget();

		return true;
	}
}
