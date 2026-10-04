# Booking themes

A booking theme restyles the pages a business's customers book appointments on: the service page (calendar and times), **Your details**, **You're booked**, and the change-or-cancel pages. Open times, rules, holds, payments and emails always stay in Octabiz. A theme only changes how the pages look.

There are two levels:

| Level | What you ship | Example |
| --- | --- | --- |
| **1 · Tokens only** | One `theme.json` with colours, fonts and corners. Every built-in page uses them. | [Clay Studio](../examples/booking-theme-clay-studio) |
| **2 · Your own pages** | `theme.json` plus your own HTML for any of the pages. Pages you don't replace use the built-in ones, in your tokens. | [Flow Yoga](../examples/booking-template-flow-yoga) |

The full contract also lives at [octabiz.ai/developers/docs/booking-themes](https://octabiz.ai/developers/docs/booking-themes), and you can try any `theme.json` in the [theme playground](https://octabiz.ai/developers/booking-theme-playground).

## theme.json

```json
{
  "$schema": "https://octabiz.ai/schemas/booking-theme.v1.json",
  "name": "Clay Studio",
  "version": "1.0.0",
  "extends": "studio",
  "accent": "#a94a22",
  "tokens": { "page": "linear-gradient(170deg,#f6efe6,#efe4d6)", "surface": "#fffaf4", "ink": "#2b211b", "cta": "#2b211b", "onCta": "#fffaf4" },
  "fonts": { "heading": "Fraunces", "body": "DM Sans" },
  "corners": "soft",
  "settings": [
    { "id": "accent", "type": "color", "label": "Accent", "default": "#a94a22", "maps": "accent" },
    { "id": "shape", "type": "select", "label": "Corners", "options": ["square", "soft", "round", "circle"], "default": "soft", "maps": "corners" }
  ]
}
```

| Key | Required | What it does |
| --- | --- | --- |
| `name` | yes | Shown in the developer portal and to businesses |
| `version` | yes | `1.0.0` style. Every update must be higher than the live one |
| `extends` | no | Built-in preset to start from: `octabiz` (default), `clean`, `studio` or `night` |
| `accent` | no | Shortcut: sets `primary`, picks white or near-black `onPrimary`, and mixes `soft` from it |
| `tokens` | no | Any of the tokens below. Later keys win over the preset, key by key |
| `fonts` | no | `heading` and `body`: a Google Fonts family name. Uploaded fonts go in `fonts.files` with a `license` |
| `corners` | no | `square`, `soft`, `round`, `circle`, or an object with all five corners in px |
| `dark` | no | `true` for dark themes (used for the market preview and email header) |
| `pages` | no | Level 2: `{ "service": "booking/service.html" }` and so on |
| `settings` | no | Knobs a business sees when it installs your theme |

### Tokens

Each token becomes a CSS variable on the booking page, so built-in pages and your own pages read the same values.

| Token | CSS variable | Used for |
| --- | --- | --- |
| `page` | `--bk-page` | Page background. A colour or a gradient |
| `surface` | `--bk-surface` | The booking card and inputs |
| `ink` | `--bk-ink` | Main text |
| `muted` | `--bk-muted` | Secondary text and icons |
| `line` | `--bk-line` | Borders and dividers |
| `primary` / `onPrimary` | `--bk-primary` / `--bk-on-primary` | Open days, the selected day, time buttons, **Next**, links |
| `soft` | `--bk-soft` | Open-day fill, tips, hover |
| `cta` / `onCta` | `--bk-cta` / `--bk-on-cta` | **Book it**, **Change time**, **Book a new time** |
| `shadow` | `--bk-shadow` | Card shadow (`none` is fine) |
| `fonts.heading` / `fonts.body` | `--bk-head` / `--bk-body` | Headings / everything else |
| `corners.card` · `control` · `button` · `day` · `area` | `--bk-r` · `--bk-r-sm` · `--bk-r-btn` · `--bk-r-day` · `--bk-r-area` | Every rounded thing on every page |

Colours can be hex, `rgb()`, `hsl()` or `oklch()`.

| Corner set | card | control | button | day | area |
| --- | --- | --- | --- | --- | --- |
| square | 0 | 0 | 0 | 0 | 0 |
| soft | 14px | 10px | 10px | 10px | 10px |
| round | 28px | 14px | 999px | 999px | 14px |
| circle | 40px | 999px | 999px | 999px | 24px |

### Settings

`maps` says where a value goes: `accent`, `corners`, `fonts.heading`, `fonts.body` or `tokens.<key>`. Types are `color`, `select` and `font`. Keys you write out in `tokens` win over `accent`, so an accent setting does nothing if you also set `tokens.primary` or `tokens.soft`. `validate.mjs` warns about that. (Clay Studio leaves them out on purpose.)

### Which value wins

1. The Octabiz preset (`extends` picks it).
2. Your theme, with the business's settings.
3. The business's per-service look (accent, corners, fonts, logo) in **Bookings → Services → Look & messages**.

## Readability (required)

| Pair | Needs |
| --- | --- |
| `onPrimary` on `primary` | 4.5:1 |
| `onCta` on `cta` | 4.5:1 |
| `ink` on `surface` | 4.5:1 |
| `muted` on `surface` | 4.5:1 |
| `primary` on `soft` (open-day numbers) | 3:1 |

Every `settings` default is checked too, because that's what a business gets on install.

## Level 2: your own pages

Put page templates in `booking/`. Each one replaces one built-in page:

| Key | Route | Data the page can print |
| --- | --- | --- |
| `hub` | `/book` | `org`, `services` |
| `service` | `/book/:service` | `org`, `service`, `timezone`, `error` |
| `details` | `/book/:service/details` | `org`, `service`, `hold`, `questions`, `timezone` |
| `confirmed` | `/book/:service/confirmed` | `org`, `appointment`, `confirmationMessage`, `calendarLinks` |
| `manage` | `/book/manage/:token` | `org`, `appointment`, `canChange`, `cutoffText` |
| `change` | `/book/manage/:token/change` | `org`, `appointment`, `timezone` |
| `cancel` | `/book/manage/:token/cancel` | `org`, `appointment`, `cancellationMessage`, `refundText` |

`service` has `id`, `name`, `description`, `highlights` (a list), `durationMin`, `location.label`, `price`, `priceText` (for example `$25` or `Free`), `host.name` and `cutoffText`. `org` has `name`, `initial`, `phone`, `termsUrl` and `privacyUrl`.

Templates use the same language as landing page templates: `{{ service.name }}` prints a value (always HTML-escaped) and `{{#each service.highlights}}…{{ this }}…{{/each}}` repeats a list. The page renders inside the booking root, so `var(--bk-*)` works in your CSS.

### Behaviour: window.octabizBooking

Put code in a `.js` file in your package and load it with `<script src="booking/service.js"></script>`. Inline scripts, `on…=` attributes, other sites and your own network requests are blocked. Your page talks to Octabiz only through the SDK:

| Call | Does |
| --- | --- |
| `getMonth(serviceId, 'YYYY-MM', tz)` | `[{ date, open }]`: days with open times |
| `getSlots(serviceId, 'YYYY-MM-DD', tz)` | `[{ start, end }]` (ISO, UTC): open times for a day |
| `hold(serviceId, start)` | Holds a time for 10 minutes → `{ holdId, expiresAt }` |
| `create(holdId, guest, answers)` | Books it, or returns a checkout URL for paid services |
| `reschedule(token, start)` / `cancel(token, note?)` | Manage actions |
| `setTimezone(tz)` · `formatTime(iso)` · `formatDay(iso)` | Time zone and labels in the customer's locale |
| `navigate(step, params)` | Moves to another page with the right URL, e.g. `navigate('details', { hold })` |
| `on(event, fn)` | `'slot:selected'`, `'booked'`, `'rescheduled'`, `'cancelled'`. Analytics only |

Errors come back as `{ code, message }`, and `message` is already a plain sentence for the customer, for example *"10:00am on Tue, Oct 6 was just booked by someone else. Pick another time."* Show it as it is.

**Never work out open times yourself.** Notice periods, working hours, days off, other calendars and holds are applied on the server.

### Required on your pages

Review sends a page back without these. `validate.mjs` checks for them:

| Element | Pages |
| --- | --- |
| `<select data-bk="timezone"></select>`: Octabiz fills in every time zone | `service`, `change` |
| `{{ service.cutoffText }}` (or `{{ cutoffText }}` on `manage`) | `service`, `details`, `manage` |
| `<p data-bk="terms"></p>`: the Terms and Privacy line | `details` |
| `<p data-bk="powered-by"></p>`: Octabiz fills it, or hides it on plans that remove it | every page |

Also keep tap targets at least 44px tall on phones, and use the corner tokens for every `border-radius` (only `0` can be a literal), so a business's corner choice still applies.

## Develop, check and package

```bash
node tools/preview.mjs examples/booking-theme-clay-studio     # → http://localhost:4300
node tools/validate.mjs examples/booking-theme-clay-studio
node tools/pack.mjs examples/booking-theme-clay-studio        # → dist/…-1.0.0.booking-theme.json
node tools/pack.mjs examples/booking-template-flow-yoga       # → dist/…-1.0.0.zip (theme.json + booking/ + assets/)
```

The preview shows every screen (service page, time picked, details, booked, manage, and the "time just taken" error), with the theme's settings in the top bar. For Level 2 pages it runs your page against a mock `window.octabizBooking` with sample open times. Add `?error=taken` to see how your page handles `SLOT_TAKEN`, and `?bar=0` to hide the top bar for screenshots.

In the developer portal choose **New app → Booking theme**, upload the `.booking-theme.json` (Level 1) or the `.zip` (Level 2), and the same checks run again.
