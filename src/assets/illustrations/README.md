# Illustrations

The drawings from the design handoff, sorted by where they are used. File names
are the ones the handoff uses, so a drawing is easy to find there again.

## One file for both themes

The handoff exports each static drawing twice, light and dark. Here each pair
is merged into one `name.svg` that follows the page's theme:

- lines use `currentColor`, so set `color` on the drawing or a parent
- everything else reads the `--illustration-*` properties from
  [`src/styles/illustrations.css`](../../styles/illustrations.css)

This works when the drawing is inlined, which is what an Astro SVG import does.
Loaded with `<img>` or as a CSS background it cannot see the page's colours and
falls back to the light values.

Where there is a `name-animated.svg` it carries its own styles and motion, and
follows the system theme.

## Taking a new export

Drop the `-light.svg` and `-dark.svg` pairs into the right folder and run

```
node ./scripts/convert-illustrations.mjs
```

It merges every pair it understands and lists the ones it leaves alone. Add
`--check` to see the result without writing.

## Categories

`categories/<category>/` holds four devices for each of the 18 categories. The
file named after the category alone is its main device.

```
categories/lighting/
  lighting.svg            lighting-animated.svg
  lighting-lamp.svg       lighting-lamp-animated.svg
  lighting-pendant.svg    lighting-pendant-animated.svg
  lighting-strip.svg      lighting-strip-animated.svg
```

## Pages

- `how-it-works/` has the house, the wall switch and the contribute drop.
- `editorial/` has the speakers and the voice speaker. `editorial/cards/` has
  the earlier card versions in five colours.
- `contributors/` has the rolodex.
- `about/parts/` has the device parts that orbit the text.

## Still in pairs

- The editorial speakers carry their own styles for each theme.
- The editorial cards differ between themes in more than colour.

## Left out

The handoff marks the earlier device cards and UI component drawings as
outdated and not for new work, so they are not here.
