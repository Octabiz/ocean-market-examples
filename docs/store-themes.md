# Store themes

A store theme sets the look of a business's **booking site and online store**: colours, fonts and corner radius. It's a single `theme.json`. A theme changes design tokens only. It can't add pages, scripts or permissions, which is why reviews are quick.

## theme.json

```json
{
  "type": "store_theme",
  "name": "Harbor Linen",
  "version": "2.0.0",
  "colors": {
    "background": "#FAF7F2",
    "surface": "#E8DCC8",
    "text": "#1F2A2E",
    "muted": "#4A555C",
    "accent": "#1F5F6B",
    "on_accent": "#FFFFFF",
    "border": "#C9B89C"
  },
  "fonts": {
    "heading": { "family": "Playfair Display", "weight": 600 },
    "body": { "family": "Inter", "weight": 400 }
  },
  "radius": 10
}
```

| Token | Required | Where it shows |
| --- | --- | --- |
| `colors.background` | yes | The page background |
| `colors.surface` | yes | Cards, panels and form areas |
| `colors.text` | yes | Body text and headings |
| `colors.muted` | yes | Secondary text: prices, captions, hints |
| `colors.accent` | yes | Buttons, links and highlights (the store's primary colour) |
| `colors.on_accent` | yes | Text on accent-coloured buttons |
| `colors.border` | no | Dividers and outlines |
| `fonts.heading` / `fonts.body` | yes | `family` plus `weight` (100–900 in steps of 100) |
| `radius` | yes | Corner radius in px, 0–48 (a number, `"12"` or `"12px"`) |

- Colours must be hex: `#1F5F6B` or `#FFF`.
- **Fonts:** Inter, Sora, Manrope, DM Sans, Lora, Playfair Display, Poppins, Work Sans, Source Serif 4 and Nunito Sans. Octabiz loads them for the store.
- `version` is optional in the file. The developer portal asks for it when you upload.

## Readability (required)

Every pair must reach a WCAG AA contrast of **4.5:1**:

| Pair | Harbor Linen |
| --- | --- |
| text on background | 13.8:1 |
| text on surface | 10.8:1 |
| on_accent on accent | 7.2:1 |
| muted on surface | 5.6:1 |

`node tools/validate.mjs` computes these for you.

## How businesses use it

A business picks the theme in Ocean Market and applies it to its store. That replaces the store's colours, fonts and radius, and Octabiz keeps the previous look so the business can switch back. The store renders with `--store-primary` (accent), `--store-secondary` (surface), `--store-bg`, `--store-text`, `--store-font`, `--store-heading-font` and `--store-radius`.

## Preview

```bash
node tools/preview.mjs examples/store-theme-harbor-linen
```

This shows the theme on a sample store: header, hero, product cards, a booking form, buttons and every token.
