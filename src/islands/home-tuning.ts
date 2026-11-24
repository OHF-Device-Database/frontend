import { FEATURE_NAMES } from "../types/feature.js";
import { featureParamUrl, features } from "../utilities/feature.js";
import { HOME_MOTION } from "../utilities/home-motion.js";
import {
	HOME_KNOB_NAMES,
	HOME_KNOBS,
	homeMotionToParams,
} from "../utilities/home-tuning.js";
import type { HomeMotion } from "../utilities/home-motion.js";

/*
 * Temporary: a panel of sliders for the landing page's opening spin, there
 * while the spin is tuned and only with the `motion` feature on. Letting go
 * of a slider plays the opening again. The address carries the settings, so
 * a reload keeps them and a link shares them.
 */

/** how long a button says what happened */
const FEEDBACK_MS = 2000;

type Options = {
	/** the live settings. the sliders write into them */
	motion: HomeMotion;
	replay: () => void;
	/** takes the panel away again */
	signal: AbortSignal;
};

const button = (label: string): HTMLButtonElement => {
	const element = document.createElement("button");
	element.type = "button";
	element.className = "debug-action";
	element.textContent = label;
	return element;
};

export const mountHomeTuning = ({ motion, replay, signal }: Options): void => {
	const panel = document.createElement("details");
	panel.className = "home-tuning debug-panel";
	panel.open = true;
	const summary = document.createElement("summary");
	summary.textContent = "Opening spin";
	const body = document.createElement("div");
	body.className = "home-tuning-body";
	const foot = document.createElement("div");
	foot.className = "home-tuning-foot";

	/** keeps the address in step with the sliders */
	const save = (): void => {
		const url = new URL(window.location.href);
		homeMotionToParams(motion, url.searchParams);
		window.history.replaceState(window.history.state, "", url);
	};

	const show: (() => void)[] = [];
	for (const name of HOME_KNOB_NAMES) {
		const knob = HOME_KNOBS[name];
		const row = document.createElement("label");
		row.className = "home-tuning-row";
		const label = document.createElement("span");
		label.textContent = knob.label;
		const output = document.createElement("output");
		const input = document.createElement("input");
		input.type = "range";
		input.min = String(knob.min);
		input.max = String(knob.max);
		input.step = String(knob.step);
		const update = (): void => {
			input.value = String(motion[name]);
			output.textContent = knob.text(motion[name]);
		};
		show.push(update);
		update();
		input.addEventListener(
			"input",
			() => {
				motion[name] = input.valueAsNumber;
				output.textContent = knob.text(motion[name]);
			},
			{ signal },
		);
		input.addEventListener(
			"change",
			() => {
				save();
				replay();
			},
			{ signal },
		);
		row.append(label, output, input);
		body.append(row);
	}

	const again = button("Replay");
	again.addEventListener("click", replay, { signal });

	const reset = button("Reset");
	reset.addEventListener(
		"click",
		() => {
			Object.assign(motion, HOME_MOTION);
			for (const update of show) {
				update();
			}
			save();
			replay();
		},
		{ signal },
	);

	const copy = button("Copy link");
	let feedback = 0;
	copy.addEventListener(
		"click",
		() => {
			// with the feature in it, so the link opens the panel for anyone
			const link = featureParamUrl(
				window.location.href,
				FEATURE_NAMES.filter((name) => features()[name]),
			);
			const say = (text: string): void => {
				copy.textContent = text;
				window.clearTimeout(feedback);
				feedback = window.setTimeout(() => {
					copy.textContent = "Copy link";
				}, FEEDBACK_MS);
			};
			navigator.clipboard.writeText(link).then(
				() => {
					say("Link copied");
				},
				() => {
					say("Could not copy");
				},
			);
		},
		{ signal },
	);

	foot.append(again, reset, copy);
	panel.append(summary, body, foot);
	document.body.append(panel);

	signal.addEventListener(
		"abort",
		() => {
			window.clearTimeout(feedback);
			panel.remove();
		},
		{ once: true },
	);
};
