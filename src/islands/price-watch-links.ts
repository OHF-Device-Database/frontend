import { html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { defineElementOnce } from "../utilities/define-element.js";
import * as presentation from "../utilities/presentation";
import { PresentationRenderPresetRoleIcon } from "../utilities/presentation/preset.js";
import {
	guessPriceWatchCountry,
	PRICE_WATCH_STORAGE_KEY,
} from "../utilities/price-watch-country.js";

export interface PriceWatchLink {
	name: string;
	domain: string;
	href: string;
}

const ext = presentation.render(
	presentation.generic("open"),
	PresentationRenderPresetRoleIcon.withSize(14),
);

const read = () => {
	try {
		return localStorage.getItem(PRICE_WATCH_STORAGE_KEY) ?? undefined;
	} catch {
		return undefined;
	}
};

const write = (country: string) => {
	try {
		localStorage.setItem(PRICE_WATCH_STORAGE_KEY, country);
	} catch {
		// storage is unavailable (private mode, blocked site data)
	}
};

const guess = () => {
	try {
		return guessPriceWatchCountry(
			Intl.DateTimeFormat().resolvedOptions().timeZone,
		);
	} catch {
		return undefined;
	}
};

/**
 * renders the links of the country picked in the server-rendered select it wraps,
 * lit appends its output after the existing children so the select stays in place
 */
export class PriceWatchLinks extends LitElement {
	@property({ type: Object }) links: Record<string, PriceWatchLink[]> = {};

	@state() private _country: string | undefined;

	constructor() {
		super();
		// change bubbles up from the wrapped select
		this.addEventListener("change", this._onChange);
	}

	protected override createRenderRoot(): HTMLElement {
		return this;
	}

	override connectedCallback(): void {
		super.connectedCallback();

		// a stored country that is no longer supported falls back to the guess
		const country = [read(), guess()].find(
			(candidate) =>
				typeof candidate !== "undefined" &&
				Object.hasOwn(this.links, candidate),
		);
		const select = this.querySelector("select");
		if (typeof country !== "undefined" && select !== null) {
			select.value = country;
			this._country = country;
		}
	}

	private _onChange = (e: Event): void => {
		if (!(e.target instanceof HTMLSelectElement)) {
			return;
		}
		this._country = e.target.value;
		write(this._country);
	};

	override render() {
		const links =
			typeof this._country !== "undefined"
				? this.links[this._country]
				: undefined;
		if (typeof links === "undefined") {
			return nothing;
		}

		return html`
			<ul class="price-watch-list">
				${links.map(
					(link) => html`
						<li>
							<a
								class="price-watch-link"
								href=${link.href}
								target="_blank"
								rel="noopener noreferrer nofollow"
							>
								<span class="price-watch-link-name">${link.name}</span>
								<span class="price-watch-link-domain">${link.domain}</span>
								<span class="price-watch-link-icon">${unsafeHTML(ext)}</span>
							</a>
						</li>
					`,
				)}
			</ul>
		`;
	}
}

defineElementOnce("price-watch-links", PriceWatchLinks);

declare global {
	interface HTMLElementTagNameMap {
		"price-watch-links": PriceWatchLinks;
	}
}
