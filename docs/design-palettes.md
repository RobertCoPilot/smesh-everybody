# Design Palettes

This repo keeps two agent-readable design documents from VoltAgent/getdesign, but the app-facing names avoid vendor labels.

## Palette 1: Clay League

- `DESIGN.md` — active default design document.
- `DESIGN.clay.md` — archived copy of the default document.
- Feel: warm ivory, clay-court orange, sunlit sport energy, tighter geometry.

## Palette 2: Electric League

- `DESIGN.electric.md` — second design document.
- Source command used:

```bash
npx getdesign@latest add minimax
```

- Feel: bright white canvas, electric blue, small hits of pink, pill controls, rounded product-card rhythm, soft purple-tinted shadows.

## Runtime switch

The UI has a bottom-right theme toggle button:

- `Clay` switches to Clay League.
- `Electric` switches to Electric League.

Implementation:

- `src/components/DesignThemeToggle.tsx` stores the selected palette in `localStorage`.
- The selected palette is applied on `<html>` through `data-design-theme="clay|electric"`.
- Palette CSS overrides live in `src/app/globals.css`.

## Anti-slop guardrails

- No public UI labels should use the external source names.
- Avoid decorative gradient text. Use solid text color, type scale, and weight instead.
- Avoid purple-gradient defaults unless they are explicitly part of Electric League product-card accents.
- Avoid pure black overlays. Use tinted dark surfaces such as `#1f1f1f`, `#181e25`, or `#081226`.
- Avoid thick side or top accent borders on rounded cards. Prefer full rings, background tints, badges, or icon wells.
