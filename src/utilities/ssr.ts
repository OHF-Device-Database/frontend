import { render } from "@lit-labs/ssr";
import { collectResultSync } from "@lit-labs/ssr/lib/render-result.js";
import type { TemplateResult } from "lit";

// server only, in an island it would pull the whole renderer into the bundle
if (!import.meta.env.SSR) {
	throw new Error("utilities/ssr is server only");
}

// comments lit emits for hydration, plus the `<?>` it leaves after a trailing
// binding, nothing hydrates this output so they're only noise
const MARKERS = /<!--\/?lit-[^>]*-->|<\?>/g;

/** lit template as plain html, for astro `set:html` */
export const renderToHtml = (template: TemplateResult): string =>
	collectResultSync(render(template)).replaceAll(MARKERS, "");
