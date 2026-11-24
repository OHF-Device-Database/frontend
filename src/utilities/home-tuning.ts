import { HOME_MOTION } from "./home-motion";
import { keysOf } from "./record";
import type { HomeMotion } from "./home-motion";

/*
 * Temporary: the sliders for the landing page's opening spin while it is
 * tuned, and how their settings travel in the address. Shown with the
 * `motion` feature on. See `src/islands/home-tuning.ts`.
 */

export type HomeKnob = {
	label: string;
	min: number;
	max: number;
	step: number;
	/** how a value reads next to its slider */
	text: (value: number) => string;
};

const seconds = (value: number): string => `${value.toFixed(2)} s`;
const share = (value: number): string => `${Math.round(value * 100)}%`;

export const HOME_KNOBS: Record<keyof HomeMotion, HomeKnob> = {
	spin: { label: "Spin time", min: 0.4, max: 4, step: 0.1, text: seconds },
	stagger: {
		label: "Delay between reels",
		min: 0,
		max: 0.6,
		step: 0.02,
		text: seconds,
	},
	speed: {
		label: "Start speed",
		min: 0.5,
		max: 8,
		step: 0.1,
		text: (value) => `${value.toFixed(1)} screens a second`,
	},
	tilt: { label: "Camera tilt", min: 0, max: 1, step: 0.05, text: share },
	curve: { label: "Drum curve", min: 0, max: 1, step: 0.05, text: share },
	blur: { label: "Blur", min: 0, max: 1, step: 0.05, text: share },
};

export const HOME_KNOB_NAMES: readonly (keyof HomeMotion)[] =
	keysOf(HOME_KNOBS);

/** the settings an address asks for. anything missing or unreadable is the design's */
export const homeMotionFromParams = (params: URLSearchParams): HomeMotion => {
	const motion = { ...HOME_MOTION };
	for (const name of HOME_KNOB_NAMES) {
		const raw = params.get(name);
		const value = raw === null || raw.trim() === "" ? Number.NaN : Number(raw);
		if (!Number.isFinite(value)) {
			continue;
		}
		const { min, max } = HOME_KNOBS[name];
		motion[name] = Math.min(max, Math.max(min, value));
	}
	return motion;
};

/** writes the settings into an address, leaving out the ones the design has */
export const homeMotionToParams = (
	motion: HomeMotion,
	params: URLSearchParams,
): void => {
	for (const name of HOME_KNOB_NAMES) {
		const value = Number(motion[name].toFixed(2));
		if (value === HOME_MOTION[name]) {
			params.delete(name);
		} else {
			params.set(name, String(value));
		}
	}
};
