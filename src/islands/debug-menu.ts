import { html, LitElement, nothing } from "lit";
import { state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import type { Ref } from "lit/directives/ref.js";

import { FEATURE_NAMES, FEATURES } from "../types/feature.js";
import { defineElementOnce } from "../utilities/define-element.js";
import {
	FEATURE_EVENT,
	featureEnable,
	featureParamUrl,
	features,
	featuresReset,
} from "../utilities/feature.js";
import { isAbortError } from "../utilities/is-abort-error.js";
import { generic, render } from "../utilities/presentation/index.js";
import { PresentationRenderPresetRoleIcon } from "../utilities/presentation/preset.js";
import type { FeatureName, FeatureState } from "../types/feature.js";

const closeIcon = render(
	generic("x"),
	PresentationRenderPresetRoleIcon.withSize(18),
);

/** how long the share popover stays up */
const SHARE_FEEDBACK_MS = 2000;

type ShareResult = "copied" | "failed";

const SHARE_MESSAGE: Record<ShareResult, string> = {
	copied: "Link copied",
	failed: "Could not copy",
};

export class DebugMenu extends LitElement {
	@state() private _open = false;
	@state() private _features: FeatureState = features();
	/** a flag changed since this document was rendered*/
	@state() private _dirty = false;
	/** outcome of the last share, said by the popover */
	@state() private _shareResult: ShareResult | undefined;

	private _shareTimer: number | undefined;
	private _shareButton: Ref<HTMLButtonElement> = createRef();
	private _feedback: Ref<HTMLElement> = createRef();

	private _onKey = (e: KeyboardEvent): void => {
		if (e.key === "Escape") {
			this.close();
		}
	};

	private _onFeatures = (): void => {
		this._features = features();
	};

	// opt-out of shadow dom to be able to reference global css classes
	protected override createRenderRoot(): HTMLElement {
		return this;
	}

	override connectedCallback(): void {
		super.connectedCallback();
		window.addEventListener(FEATURE_EVENT, this._onFeatures);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		window.removeEventListener(FEATURE_EVENT, this._onFeatures);
		this._release();
	}

	open(): void {
		if (this._open) {
			return;
		}

		this._open = true;
		this._onFeatures();
		document.body.classList.add("modal-open");
		document.addEventListener("keydown", this._onKey);
	}

	close = (): void => {
		if (!this._open) {
			return;
		}

		this._open = false;
		this._release();
	};

	private _release(): void {
		document.body.classList.remove("modal-open");
		document.removeEventListener("keydown", this._onKey);
		window.clearTimeout(this._shareTimer);
		this._shareTimer = undefined;
		this._shareResult = undefined;
	}

	/** the names the cookie carries */
	private get _enabled(): FeatureName[] {
		return FEATURE_NAMES.filter((name) => this._features[name]);
	}

	private _toggle(name: FeatureName): void {
		this._features = featureEnable(name, !this._features[name]);
		this._dirty = true;
	}

	private _reset = (): void => {
		this._features = featuresReset();
		this._dirty = true;
	};

	private _reload = (): void => {
		window.location.reload();
	};

	private _share = (): void => {
		void this._shareLink(featureParamUrl(window.location.href, this._enabled));
	};

	private async _shareLink(url: string): Promise<void> {
		if (typeof navigator.share === "function") {
			try {
				await navigator.share({ url });
				return;
			} catch (error) {
				if (isAbortError(error)) {
					return;
				}
			}
		}

		try {
			await navigator.clipboard.writeText(url);
			await this._report("copied");
		} catch {
			await this._report("failed");
		}
	}

	private async _report(result: ShareResult): Promise<void> {
		this._shareResult = result;
		await this.updateComplete;

		const popover = this._feedback.value;
		if (typeof popover === "undefined") {
			return;
		}

		window.clearTimeout(this._shareTimer);
		if (!popover.matches(":popover-open")) {
			const source = this._shareButton.value;
			popover.showPopover(
				typeof source !== "undefined" ? { source } : undefined,
			);
		}

		this._shareTimer = window.setTimeout(() => {
			this._shareTimer = undefined;

			const showing = this._feedback.value;
			if (showing?.matches(":popover-open") === true) {
				showing.hidePopover();
			}
		}, SHARE_FEEDBACK_MS);
	}

	private _renderRow(name: FeatureName) {
		const { label, description } = FEATURES[name];

		return html`
			<label class="debug-row">
				<span class="debug-row-main">
					<span class="debug-row-label">${label}</span>
					<span class="debug-row-description">${description}</span>
					<code class="debug-row-name">${name}</code>
				</span>
				<input
					class="debug-switch"
					type="checkbox"
					role="switch"
					.checked=${this._features[name]}
					@change=${() => this._toggle(name)}
				/>
			</label>
		`;
	}

	override render() {
		if (!this._open) {
			return nothing;
		}

		const enabled = this._enabled;
		// link that carries enablement state for sharing
		const link = featureParamUrl(window.location.href, enabled);

		return html`
			<div class="debug-backdrop" role="presentation">
				<div
					class="debug-panel"
					role="dialog"
					aria-modal="true"
					aria-label="Debug menu"
				>
					<header class="debug-head">
						<div class="debug-head-main">
							<h2 class="debug-title">Debug</h2>
						</div>
						<button
							type="button"
							class="debug-close"
							aria-label="Close debug menu"
							@click=${this.close}
						>
							${unsafeHTML(closeIcon)}
						</button>
					</header>

					<div class="debug-body">
						${
							FEATURE_NAMES.length > 0
								? FEATURE_NAMES.map((name) => this._renderRow(name))
								: html`<p class="debug-empty">No features registered.</p>`
						}
					</div>

					<footer class="debug-foot">
						<button
							type="button"
							class="debug-action debug-share"
							title=${link}
							@click=${this._share}
							${ref(this._shareButton)}
						>
							Share
						</button>
						<div
							class="debug-feedback"
							popover="manual"
							role="status"
							${ref(this._feedback)}
						>
							${
								typeof this._shareResult === "undefined"
									? nothing
									: SHARE_MESSAGE[this._shareResult]
							}
						</div>
						<div class="debug-actions">
							${
								this._dirty
									? html`<button
											type="button"
											class="debug-action is-primary"
											@click=${this._reload}
										>
											Reload
										</button>`
									: nothing
							}
							<button
								type="button"
								class="debug-action"
								?disabled=${enabled.length === 0}
								@click=${this._reset}
							>
								Reset
							</button>
						</div>
					</footer>
				</div>
			</div>
		`;
	}
}

defineElementOnce("debug-menu", DebugMenu);

/** mounts the menu on first use, so pages carry no markup for it */
export const openDebugMenu = (): void => {
	const existing = document.querySelector("debug-menu");
	if (existing !== null) {
		existing.open();
		return;
	}

	const menu = document.createElement("debug-menu");
	document.body.append(menu);
	menu.open();
};

declare global {
	interface HTMLElementTagNameMap {
		"debug-menu": DebugMenu;
	}
}
