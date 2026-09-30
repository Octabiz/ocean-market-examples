# Landing page templates

A template is a set of **sections**: HTML, CSS and settings. A business installs it from Ocean Market and adds the sections to its landing pages in the page builder, where it edits every setting. You write the sections once; each business makes them its own.

## Package layout

```
manifest.json
sections/
  hero.html          the section's markup, with {{ placeholders }}
  hero.css           styles for every screen size
  hero.mobile.css    styles for phones (wrapped in @media (max-width: 640px) for you)
images/
  hero.svg           ≤ 500 KB each: png, jpg, gif, webp, svg, avif
```

## manifest.json

```json
{
  "type": "landing_template",
  "name": "Bright Clinic",
  "version": "2.0.0",
  "sections": [
    {
      "key": "hero",
      "name": "Hero with headline, booking button and photo",
      "template": "sections/hero.html",
      "styles": "sections/hero.css",
      "mobile_styles": "sections/hero.mobile.css",
      "settings": [
        { "key": "title", "type": "text", "label": "Headline", "default": "Book your check-up in two minutes" },
        { "key": "image", "type": "image", "label": "Photo", "default": "images/hero.svg" }
      ]
    }
  ]
}
```

| Field | Rules |
| --- | --- |
| `type` | Must be `"landing_template"`. |
| `version` | Semver: `1.0.0`. Each new submission needs a higher number. |
| `sections[].key` | 1–40 letters, digits, `_` or `-`, unique. It must stay unique after `-` becomes `_`. |
| `sections[].name` | What businesses see in the page builder's section picker. |
| `settings[].type` | `text`, `image`, `colour`, `link` or `list`. |
| `settings[].label` | The label businesses see. Write it for them. |
| `settings[].default` | Text for every type except `list`, which takes a list: of strings, or of objects with the same fields. |

## What businesses see in the page builder

Each setting becomes a field, in the order you list them, labelled with your `label`:

| Type | Field |
| --- | --- |
| `text` | A text box. It becomes multi-line when the default is long. |
| `image` | Upload a picture, or paste a web address. Shows a preview. |
| `colour` | A colour picker and a hex box. |
| `link` | A web address or `#section` link. |
| `list` | A list editor: add, remove and reorder items; object items are edited field by field. |

## Template syntax

Deliberately small. There is no logic, so a section is always safe to render.

```html
<h1>{{ title }}</h1>                                   <!-- a setting, HTML-escaped -->
<p>{{ contact.phone }}</p>                              <!-- dotted paths work -->

<ul>
  {{#each services}}                                   <!-- repeat once per list item (max 100) -->
    <li>{{ @number }}. {{ name }} — {{ price }}</li>   <!-- the item's fields are in scope -->
  {{/each}}
</ul>

{{#each badges}}<span>{{ this }}</span>{{/each}}        <!-- a list of plain strings -->
```

- Every value is HTML-escaped. There are no conditions, no expressions and no nested `{{#each}}`.
- Outer settings are reachable inside a repeat (`{{ business_name }}`).
- A missing value renders as an empty string.

## Images

- Put images in the package and reference them with a **path relative to the package root**, with no `./`: `src="images/hero.svg"`.
- The best approach is to make the image a setting (`"type": "image", "default": "images/hero.svg"`) and write `src="{{ image }}"`. Businesses can then swap the picture.
- CSS `url()` is removed by the safety filter, so use `<img>` instead of background images. Give every image an `alt`, ideally as a setting too.

## Styling

- **Prefix your class names** (`bc-` in Bright Clinic). Section CSS is added to the whole page, not scoped to the section.
- **Follow the business's brand.** The page sets these variables as HSL triples: `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--accent`, `--accent-foreground`, `--background`, `--foreground`. Use them with a fallback: `hsl(var(--primary, 164 80% 27%))`.
- **Repeat shared styles in each section** (Bright Clinic puts its base styles at the top of every CSS file), because a business can remove any section. When a section overrides a shared class, make the selector more specific (`.bc-contact .bc-btn`), so the next section's copy of the base rule doesn't win.
- **Every section needs a phone layout:** a `mobile_styles` file, or an `@media (max-width: …)` rule.

## What the safety filter blocks

The upload check fails if the filter would change your HTML or CSS:

- No `<script>`, `<iframe>`, `<object>`, `<embed>`, `<base>` or `<link>`, and no `on…=` attributes. That includes text that merely looks like one, such as ` one=`.
- Nothing may load from outside Octabiz domains: `src`, `srcset`, `poster`, `action`…
- No `javascript:` URLs.
- No `<style>` tags inside the HTML; CSS goes in the section's CSS file.
- In CSS: no `url()`, `@import`, `@charset`, `expression()`, `behavior:` or `-moz-binding`.

## Preview and check

```bash
node tools/preview.mjs examples/landing-template-bright-clinic --primary=#7C3AED
node tools/validate.mjs examples/landing-template-bright-clinic
```

The preview renders every section with its defaults, the way the page builder does. `--primary` shows the page in another brand colour.
