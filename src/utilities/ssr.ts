import { render } from "@lit-labs/ssr";
import { collectResultSync } from "@lit-labs/ssr/lib/render-result.js";
import type { TemplateResult } from "lit";

/**
 * lit template as html, for astro `set:html`, server only
 *
 * keeps lit's hydration comments, nothing hydrates them, they're inert
 */
export const renderToHtml = (template: TemplateResult): string =>
	collectResultSync(render(template));
