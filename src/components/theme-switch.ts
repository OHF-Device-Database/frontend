/**
 * keeps every theme switch on the page (the menu, the footer) in step with the
 * chosen theme. a switch is a radio group inside `[data-theme-switch]` with the
 * values `auto`, `light` and `dark`
 */
type DemoState = {
	getTheme?: () => string;
	setTheme?: (theme: string) => void;
};
const demoState = () =>
	(window as unknown as { DemoState?: DemoState }).DemoState;

const SELECTOR = '[data-theme-switch] input[type="radio"]';

// the page may be cached for everyone, so the chosen theme is filled in here
const sync = () => {
	const theme = demoState()?.getTheme?.() ?? "auto";
	for (const input of document.querySelectorAll<HTMLInputElement>(SELECTOR)) {
		input.checked = input.value === theme;
	}
};

document.addEventListener("change", (event) => {
	const input = event.target;
	if (input instanceof HTMLInputElement && input.matches(SELECTOR)) {
		demoState()?.setTheme?.(input.value);
		sync();
	}
});

document.addEventListener("astro:page-load", sync);
