// Turns the design handoff's light and dark drawing pairs into one file that
// follows the page's theme.
//
// The handoff exports every static drawing twice, `name-light.svg` and
// `name-dark.svg`, with the same shapes and the colours swapped. This script
// merges each pair into `name.svg`: the line colour becomes `currentColor` and
// the other colours become `--illustration-*` custom properties, defined per
// theme in `src/styles/illustrations.css`. Each property falls back to its
// light value, so a file opened on its own still draws.
//
// To take a new export, drop the pairs into `src/assets/illustrations/` and run
//
//   node ./scripts/convert-illustrations.mjs
//
// Pairs it cannot merge are left as they are and listed. Pass `--check` to see
// what would happen without writing anything.

import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(
	new URL("../src/assets/illustrations/", import.meta.url),
);
const check = process.argv.includes("--check");

// light value | dark value, as the handoff writes them, to what replaces both
const colours = new Map(
	Object.entries({
		"none|none": "none",
		// lines
		"#1b1916|#e9e6df": "currentColor",
		// faces, filled with the page colour so lines behind them stay hidden
		"#f6f5f3|#0f0f0f": "var(--illustration-paper, #f6f5f3)",
		// quiet details
		"#cfcac1|#3f3c38": "var(--illustration-mute, #cfcac1)",
		"#c4bfb5|#3f3c38": "var(--illustration-mute, #c4bfb5)",
		"#2f86ff|#2f86ff": "var(--illustration-accent, #2f86ff)",
		// glass and screens, and the faint lines drawn on them
		"rgba(255,255,255,.72)|rgba(255,255,255,.5)":
			"var(--illustration-glass, rgba(255,255,255,.72))",
		"rgba(27,25,22,.4)|rgba(233,230,223,.45)":
			"var(--illustration-line-soft, rgba(27,25,22,.4))",
	}),
);

const paint = /\b(fill|stroke|stop-color)="([^"]*)"/g;

// the handoff's own style block styles every path on the page once the file
// is inlined, so its rules move onto a wrapping group
const looseStyle =
	"<style>path,ellipse{stroke-width:1px;vector-effect:non-scaling-stroke;stroke-linejoin:round}path.ln2{stroke-width:2.2px}</style>";
const scopedStyle =
	"<style>.illustration path,.illustration ellipse{stroke-width:1px;vector-effect:non-scaling-stroke;stroke-linejoin:round}.illustration path.ln2{stroke-width:2.2px}</style>";
// a square in the page colour behind the drawing
const backdrop = /<rect width="480" height="480" fill="[^"]*"\/>/;

async function* walk(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(path);
		else yield path;
	}
}

function merge(light, dark) {
	if (light.includes("<style>") && !light.includes(looseStyle)) {
		return { reason: "it carries its own styles" };
	}
	const lightPaints = [...light.matchAll(paint)];
	const darkPaints = [...dark.matchAll(paint)];
	const shape = (svg) => svg.replace(paint, '$1=""');
	if (
		lightPaints.length !== darkPaints.length ||
		shape(light) !== shape(dark)
	) {
		return { reason: "the two files differ in more than colour" };
	}

	const unknown = new Set();
	let index = 0;
	let merged = light.replace(paint, (_, attribute, value) => {
		const key = `${value}|${darkPaints[index++][2]}`.toLowerCase();
		const replacement = colours.get(key);
		if (replacement === undefined) unknown.add(key);
		return `${attribute}="${replacement}"`;
	});
	if (unknown.size > 0) {
		return { reason: `unknown colours ${[...unknown].join(", ")}` };
	}

	merged = merged.replace(backdrop, "");
	if (merged.includes(looseStyle)) {
		merged = merged
			.replace(looseStyle, "")
			.replace(/^(<svg[^>]*>)/, `$1${scopedStyle}<g class="illustration">`)
			.replace(/<\/svg>\s*$/, "</g></svg>");
	}
	return { merged: `${merged.trimEnd()}\n` };
}

const done = [];
const left = [];
for await (const lightPath of walk(root)) {
	if (!lightPath.endsWith("-light.svg")) continue;
	const base = lightPath.slice(0, -"-light.svg".length);
	const darkPath = `${base}-dark.svg`;
	const name = relative(root, base);

	let dark;
	try {
		dark = await readFile(darkPath, "utf8");
	} catch {
		left.push(`${name}: no dark file`);
		continue;
	}
	const { merged, reason } = merge(await readFile(lightPath, "utf8"), dark);
	if (merged === undefined) {
		left.push(`${name}: ${reason}`);
		continue;
	}
	if (!check) {
		await writeFile(`${base}.svg`, merged);
		await rm(lightPath);
		await rm(darkPath);
	}
	done.push(name);
}

console.log(`${check ? "would merge" : "merged"} ${done.length} pairs`);
if (left.length > 0) {
	console.log(`left ${left.length} pairs as they are:`);
	for (const line of left.sort()) console.log(`  ${line}`);
}
