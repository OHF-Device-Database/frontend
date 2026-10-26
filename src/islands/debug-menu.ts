import { html, LitElement, nothing } from "lit";
import { state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
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
import type { FeatureName, FeatureState } from "../types/feature.js";

/** how long the share popover stays up */
const SHARE_FEEDBACK_MS = 2000;

type ShareResult = "copied" | "failed";

const SHARE_MESSAGE: Record<ShareResult, string> = {
	copied: "Link copied",
	failed: "Could not copy",
};

export class DebugMenu extends LitElement {
	@state() private _features: FeatureState = features();
	/** outcome of the last share, said by the popover */
	@state() private _shareResult: ShareResult | undefined;

	private _shareTimer: number | undefined;
	private _shareButton: Ref<HTMLButtonElement> = createRef();
	private _feedback: Ref<HTMLElement> = createRef();

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
		this._onFeatures();
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		window.removeEventListener(FEATURE_EVENT, this._onFeatures);
		window.clearTimeout(this._shareTimer);
		this._shareTimer = undefined;
	}

	/** the names the cookie carries */
	private get _enabled(): FeatureName[] {
		return FEATURE_NAMES.filter((name) => this._features[name]);
	}

	private _toggle(name: FeatureName): void {
		this._features = featureEnable(name, !this._features[name]);
	}

	private _reset = (): void => {
		this._features = featuresReset();
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
		const enabled = this._enabled;
		// link that carries enablement state for sharing
		const link = featureParamUrl(window.location.href, enabled);

		return html`
			<div class="debug-panel">
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
					<button
						type="button"
						class="debug-action"
						?disabled=${enabled.length === 0}
						@click=${this._reset}
					>
						Reset
					</button>
				</footer>
			</div>
		`;
	}
}

defineElementOnce("debug-menu", DebugMenu);

declare global {
	interface HTMLElementTagNameMap {
		"debug-menu": DebugMenu;
	}
}
