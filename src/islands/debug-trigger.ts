import {
	FEATURE_PARAM,
	featureDatasetApply,
	featureParamEnabled,
	featuresSet,
} from "../utilities/feature.js";

/** taps needed to open the debug menu */
export const TAP_GESTURE_COUNT = 10;

/** a longer gap than this starts the count over, so only a deliberate burst counts */
export const TAP_GESTURE_RESET_MS = 400;

/** counts fast consecutive taps */
const tapGesture = (
	count: number = TAP_GESTURE_COUNT,
	resetMs: number = TAP_GESTURE_RESET_MS,
) => {
	let taps = 0;
	let previous: number | undefined;

	const reset = (): void => {
		taps = 0;
		previous = undefined;
	};

	return {
		tap: (at: number) => {
			const consecutive =
				typeof previous !== "undefined" && at - previous <= resetMs;
			taps = consecutive ? taps + 1 : 1;
			previous = at;

			if (taps < count) {
				return false;
			}

			reset();
			return true;
		},
		reset,
	};
};

const gesture = tapGesture();
let opening = false;

const open = async (): Promise<void> => {
	if (opening) {
		return;
	}

	opening = true;
	try {
		const { openDebugMenu } = await import("./debug-menu.js");
		openDebugMenu();
	} finally {
		opening = false;
	}
};

const onPointerDown = (event: PointerEvent): void => {
	if (
		event.target instanceof Element &&
		event.target.closest("debug-menu") !== null
	) {
		gesture.reset();
		return;
	}

	if (gesture.tap(event.timeStamp)) {
		void open();
	}
};

/** sources and removes enablement overrides from url and adds `<html data-feature-*>` for prerendered pages */
const apply = (): void => {
	const url = new URL(window.location.href);
	const override = featureParamEnabled(url.searchParams);
	if (typeof override !== "undefined") {
		featuresSet(override);

		// removes enablement overrides
		url.searchParams.delete(FEATURE_PARAM);
		window.history.replaceState(window.history.state, "", url);
		return;
	}

	featureDatasetApply();
};

apply();

document.addEventListener("astro:after-swap", apply);
document.addEventListener("pointerdown", onPointerDown, {
	capture: true,
	passive: true,
});
