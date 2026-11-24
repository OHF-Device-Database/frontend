import { GitHubOperation } from "../vendor/github/operations";
import { GITHUB_EVENT_SESSION, GitHubSession } from "../vendor/github/session";
import type { AuthProviderId } from "./providers";

/** what the browser can do with a provider's session */
export interface AuthSession {
	/** the signed-in account, `undefined` when signed out */
	login: () => string | undefined;
	/** ends the session in this browser */
	signOut: () => Promise<boolean>;
	/** revokes this app's access to the account everywhere */
	disconnect: () => Promise<boolean>;
	/** fired on `window` when the session changes */
	event: string;
}

export const AUTH_SESSIONS: Record<AuthProviderId, AuthSession> = {
	github: {
		login: () => GitHubSession.login(),
		signOut: () => GitHubOperation.signOut(),
		disconnect: () => GitHubOperation.revoke(),
		event: GITHUB_EVENT_SESSION,
	},
};

export const isAuthProviderId = (value: unknown): value is AuthProviderId =>
	typeof value === "string" && Object.hasOwn(AUTH_SESSIONS, value);

/** the first provider with a session. one account at a time for now */
export const activeSession = ():
	{ id: AuthProviderId; login: string; session: AuthSession } | undefined => {
	for (const [id, session] of Object.entries(AUTH_SESSIONS)) {
		const login = session.login();
		if (isAuthProviderId(id) && typeof login !== "undefined") {
			return { id, login, session };
		}
	}

	return undefined;
};
