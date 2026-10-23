# Booking themes

A booking theme restyles the pages a business's customers book appointments on: the service page (calendar and times), **Your details**, **You're booked**, and the change-or-cancel pages. Open times, rules, holds, payments and emails always stay in Octabiz. A theme only changes how the pages look.

There are two levels, and three extras you can add to either:

| Level | What you ship | Example |
| --- | --- | --- |
| **1 · Tokens only** | One `theme.json` with colours, fonts and corners. Every built-in page uses them. | [Clay Studio](../examples/booking-theme-clay-studio) |
| **2 · Your own pages** | `theme.json` plus your own HTML for any of the pages. Pages you don't replace use the built-in ones, in your tokens. | [Flow Yoga](../examples/booking-template-flow-yoga) |
| + **One-page booking** | A `book` page: description, times, the customer's details and payment on one screen | [Northline Coaching](../examples/booking-template-northline-one-page) |
| + **Custom fields** | `fields`: questions customers answer when they book, checked by Octabiz | [Paws & Suds](../examples/booking-fields-paws-grooming) |
| + **New service kinds** | `serviceKinds`: a kind of booking Octabiz doesn't have yet, with its own setup, pricing and page | [Bayline Kayaks](../examples/booking-kind-bayline-rentals) |

> **Where each extra stands.**
> * **Custom fields** are live. A business can turn your questions off, or make them optional, per service.
> * **`book` and your own `service` page** are accepted on upload and show on the business's booking page. A service paid when booking goes to Stripe's checkout from your page. A group session opens on your page too, and picking a session holds one seat for 10 minutes.
> * **`serviceKinds`** are accepted when `capacity.mode` is `units` (rentals), and show on the business's booking page. A kind paid when booking (`pricing.upfront`) goes to Stripe's checkout too, for the total its quote shows. `one` and `seats` kinds come later.
> `preview.mjs` and `validate.mjs` support all of it today.

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
| `fonts` | no | `heading` and `body`: a Google Fonts family name. Uploaded fonts go in `fonts.files` with a `license`, as a file in your package (`assets/…`) or a `https://fonts.gstatic.com/` link. Other hosts are refused, because they would see every customer who loads the page |
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
| `confirmed` | `/book/manage/:token?booked=1` | `org`, `service`, `appointment`, `confirmationMessage` |
| `manage` | `/book/manage/:token` | `org`, `service`, `appointment`, `canChange`, `cutoffText` |
| `change` | `/book/manage/:token`, changing the time | `org`, `service`, `appointment`, `canChange`, `timezone` |
| `cancel` | `/book/manage/:token`, cancelling | `org`, `service`, `appointment`, `canChange`, `cancellationMessage`, `refundText` |

On the booking's own pages, `appointment` has `serviceName`, `hostName`, `start` and `end` (ISO, UTC), `timezone`, `dayText` (`Mon, Nov 2`) and `timeText` (`10:00am – 11:30am`) in the booking's time zone, `location.label` (the service's place) and `status`. Nothing about the customer reaches these pages: no name, email or address. `canChange` is false inside the cancellation window, when changes are by phone. `confirmationMessage` is the business's own note (or empty), and `refundText` says what goes back to the customer's card (or is empty when nothing was paid). Put `<div data-bk="add-to-calendar"></div>` on `confirmed` for Google, Outlook and Apple calendar buttons; your page can't open those itself. Adding guests stays on the built-in page.

`service` has `id`, `name`, `description`, `highlights` (a list), `durationMin`, `location.label`, `price`, `priceText` (for example `$25` or `Free`), `host.name` and `cutoffText`. `org` has `name`, `initial`, `phone`, `termsUrl` and `privacyUrl`.

Templates use the same language as landing page templates: `{{ service.name }}` prints a value (always HTML-escaped) and `{{#each service.highlights}}…{{ this }}…{{/each}}` repeats a list. The page renders inside the booking root, so `var(--bk-*)` works in your CSS.

### Behaviour: window.octabizBooking

Put code in a `.js` file in your package and load it with `<script src="booking/service.js"></script>`. Inline scripts, `on…=` attributes, other sites and your own network requests are blocked. Your page talks to Octabiz only through the SDK:

| Call | Does |
| --- | --- |
| `getMonth(serviceId, 'YYYY-MM', tz)` | `[{ date, open }]`: days with open times |
| `getSlots(serviceId, 'YYYY-MM-DD', tz)` | `[{ start, end }]` (ISO, UTC): open times for a day. For a group session each slot also has `spotsLeft`, counting seats other people are holding as taken |
| `hold(serviceId, start)` | Holds a time for 10 minutes → `{ holdId, expiresAt }` |
| `create(holdId, guest, answers)` | Books it, or returns a checkout URL for paid services |
| `reschedule(start)` / `cancel(note?)` | On `change` and `cancel`: moves the booking to a time from `getSlots`, or cancels it. Your page never gets the booking's token, so there's none to pass (the older `reschedule(token, start)` and `cancel(token, note)` still work and ignore it). Refused with `TOO_LATE` inside the cancellation window |
| `setTimezone(tz)` · `formatTime(iso)` · `formatDay(iso)` | Time zone and labels in the customer's locale |
| `navigate(step, params)` | Moves to another page, e.g. `navigate('details', { hold })`, or `navigate('change')`, `navigate('cancel')` and `navigate('manage')` on the booking's own pages |
| `on(event, fn)` | `'slot:selected'`, `'booked'`, `'rescheduled'`, `'cancelled'` (analytics only), and `'fields:change'` when the customer edits the details form |

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

## One-page booking: the `book` page (preview)

Set `"pages": { "book": "booking/book.html" }` and customers do everything on `/book/:service`: read about the service, pick a time, fill in their details and pay. Nothing navigates until they're booked. A theme with `book` doesn't use `service` or `details`; `validate.mjs` warns if you set them as well.

Page data: `org`, `service`, `fields`, `timezone`, `error`. On top of the Level 2 service data, `service` has `cover` (`{ url, alt }` or `null`), `price.upfront` (paid when booking) and, for a [new service kind](#new-service-kinds-preview), `kind`.

Octabiz fills these elements for you, in your tokens:

| Element | What appears |
| --- | --- |
| `<div data-bk="description"></div>` | The business's formatted description: paragraphs, bold, lists and links, cleaned by Octabiz. Template values are always escaped, so this is the only way to show formatting |
| `<div data-bk="fields"></div>` | The customer's details: name, email, phone if the business asks for it, the business's own questions and your theme's [custom fields](#custom-fields-preview). It's Octabiz's own form, in a frame inside your page and drawn in your tokens. Your code can't read what the customer types; that goes straight to Octabiz |
| `<div data-bk="payment"></div>` | When the service is paid when booking: the amount due, and a line saying payment happens on Stripe's secure page. Empty otherwise |

Required on `book` (and on a [kind's page](#new-service-kinds-preview)): the time zone picker, `{{ service.cutoffText }}`, `data-bk="payment"`, `data-bk="fields"`, `data-bk="terms"` and `data-bk="powered-by"`. Don't draw your own inputs for the customer's details: a page can't book without Octabiz's form. `validate.mjs` and the upload check send back any text input, `<textarea>`, editable content or typing listener outside it, and any code that moves its own page (`location`, `window.open`, `<meta http-equiv="refresh">`). Choices are fine: radios, check boxes, ranges, buttons and `<select>`.

### The SDK, version 2

Everything from Level 2 still works. These are new:

| Call | Does |
| --- | --- |
| `page` | The page data above, read-only. Handy for the parts a template can't loop over |
| `getFields(serviceId)` | `[{ id, type, label, help, required, options, … }]`: every field this booking asks for, in order |
| `readFields()` | Checks the `data-bk="fields"` form: a promise of `true` when it's complete, or `false` after the form marks what's missing or wrong. You never get the answers themselves |
| `validate(serviceId, answers)` | `{ ok, errors: { fieldId: sentence } }`, the same check the server runs, for sample answers in your own preview |
| `quote(serviceId, selection)` | `{ lines: [{ label, amountText }], totalText, upfront }`: the price for what the customer picked, in the business's currency. A [kind](#new-service-kinds-preview) that prices add-ons from fields reads them from the form itself. Call it again on `on('fields:change')` |
| `getSlots(serviceId, date, tz, selection?)` | As before. With a `selection` (`{ minutes, quantity }`) it only returns starts where that fits, and each slot has `remaining` |
| `hold(serviceId, start, selection?)` | As before, holding the length and quantity too |
| `book({ holdId })` | Books the held time for the customer in the `data-bk="fields"` form (`{ booked: true }`; your page never gets the booking's token), and Octabiz opens **You're booked** itself. If the service is paid when booking, Octabiz takes the customer to Stripe's secure checkout instead, and back to **You're booked** once they've paid. Your page never sees card details |

`book()` errors, as `{ code, message }`: `SLOT_TAKEN`, `HOLD_EXPIRED`, `PAYMENT_FAILED`, `NO_FIELDS` (the page has no `data-bk="fields"`), and `FIELD_INVALID`. The form shows each problem under its question, and `fields: { fieldId: sentence }` has the same sentences. As before, show `message` as it is.

`on('fields:change', fn)` tells your page the customer changed something in the form, with no details, so you can call `quote()` again.

## Custom fields (preview)

`fields` adds questions to the booking form. They show on the built-in **Your details** page and in `data-bk="fields"`, so a tokens-only theme can use them too.

```json
"fields": [
  { "id": "pet_name", "type": "text", "label": "Your pet's name", "required": true, "maxLength": 40 },
  { "id": "species", "type": "select", "label": "Dog or cat?", "options": ["Dog", "Cat"], "display": "chips", "required": true },
  { "id": "weight_kg", "type": "number", "label": "Weight", "unit": "kg", "min": 1, "max": 90, "step": 0.5 },
  { "id": "vet_phone", "type": "phone", "label": "Your vet's phone number", "sensitive": true }
]
```

| Key | Required | What it does |
| --- | --- | --- |
| `id` | yes | `a-z`, `0-9` and `_`, up to 32 characters, unique in the theme. Keep it the same across versions: it's where the answers are stored |
| `type` | yes | `text`, `textarea`, `email`, `phone`, `url`, `number`, `select`, `multiselect`, `checkbox` or `date` |
| `label` | yes | The question, up to 80 characters |
| `help` | no | One line under the input, up to 160 characters |
| `required` | no | `true` to make it required. A required `checkbox` is a consent the customer has to tick |
| `options` | `select`, `multiselect` | Up to 30 choices, each up to 60 characters |
| `display` | no | `chips` or `list` for `select` and `multiselect` |
| `min` · `max` · `step` · `unit` | no | For `number` |
| `maxLength` | no | For `text` (up to 200) and `textarea` (up to 2000) |
| `dates` | no | For `date`: `past` or `future` |
| `sensitive` | no | `true` keeps the answer out of emails and calendar invites. Only staff see it |
| `appliesTo` | no | Ids of your `serviceKinds` the field is for. Leave it out to ask it on every service |

Up to 20 fields. When a business installs your theme it can turn each field off, or make it optional, per service in **Bookings → Services → Questions**.

What Octabiz does with the answers:

- **Checks them on the server** against your definition (type, required, options, limits), from the `data-bk="fields"` form.
- **Stores them with the appointment.** Staff see them on the appointment, in exports and in reports, under your field's label.
- **Prints them in emails** as `{{ answers.pet_name }}` when the business edits its confirmation, unless the field is `sensitive`.
- **Keeps them** if the theme is removed later. The fields stop showing, and past answers stay on their appointments.

Your pages only ever see what the customer typed during this visit. A theme can't read answers back from Octabiz.

## New service kinds (preview)

Octabiz has appointments, classes, visits and walk-ins built in. `serviceKinds` adds a kind of booking it doesn't have, made from the same building blocks the booking engine already checks: how long a booking lasts, how many can share a time, and how the price adds up. Octabiz still works out open times, holds, payment, emails and the staff calendar.

```json
"serviceKinds": [{
  "id": "rental",
  "name": "Equipment rental",
  "description": "Customers rent a number of items for a few hours.",
  "icon": "sailboat",
  "time": { "mode": "range", "minMinutes": 120, "maxMinutes": 480, "stepMinutes": 60 },
  "capacity": { "mode": "units", "unitLabel": "kayak", "unitLabelPlural": "kayaks", "maxPerBooking": 6 },
  "pricing": { "per": ["unit", "hour"], "rate": "settings.hourly_rate", "upfront": true,
               "addOns": [{ "field": "dry_bags", "each": "settings.dry_bag_price", "label": "Dry bags" }] },
  "settings": [
    { "id": "units_total", "type": "number", "label": "Kayaks you rent out", "default": 12, "min": 1, "max": 500, "maps": "capacity.total" },
    { "id": "hourly_rate", "type": "money", "label": "Price per kayak, per hour", "default": 18 },
    { "id": "dry_bag_price", "type": "money", "label": "Dry bag, each", "default": 4 }
  ],
  "page": "booking/rental.html",
  "example": { "name": "Sit-on-top kayak", "description": "Stable, easy kayaks for the bay." }
}]
```

| Key | What it does |
| --- | --- |
| `id`, `name`, `description`, `icon` | How the kind appears when a business adds a service. `icon` is a [Lucide](https://lucide.dev/icons) name |
| `time.mode` | `fixed`: the business sets the length (`maps: "time.minutes"`). `choice`: the customer picks from `options` (minutes). `range`: the customer picks between `minMinutes` and `maxMinutes` in `stepMinutes` |
| `capacity.mode` | `one`: one booking per time. `seats`: a group shares a time, up to `total` people. `units`: a pool of `total` items, and bookings overlap until the pool runs out |
| `pricing.per` | Any of `booking`, `person`, `unit` and `hour`. The price is `rate` times each one you list |
| `pricing.upfront` | `true` to take payment when the customer books. Otherwise they pay at the visit |
| `pricing.addOns` | Extras priced from a field: a `number` field adds `each` × the answer, a `checkbox` adds `each` once |
| `settings` | What the business fills in when it creates a service of this kind. Types: `number`, `money`, `select`, `text`, `checkbox`. `maps` sends a value to `capacity.total`, `capacity.maxPerBooking` or `time.minutes`. `money` is always in the business's currency |
| `page` | The `book` page for services of this kind. Same data and required elements as `book`, plus `service.kind` |
| `example` | The sample service in the preview tool and on your market listing |

Prices are always worked out by Octabiz from these rules, and taxes, deposits, refunds and gift cards apply as usual. Your page shows `quote()`, never its own sums. Pricing or availability rules you can't describe here aren't possible yet. Tell us what you need under **Requests** in the developer portal.

Up to 5 kinds per theme. A business that installs your theme sees them in **Bookings → Services → New service**. If it removes the theme later, its services of that kind stop taking new bookings, and existing bookings stay.

## Develop, check and package

```bash
node tools/preview.mjs examples/booking-theme-clay-studio     # → http://localhost:4300
node tools/validate.mjs examples/booking-theme-clay-studio
node tools/pack.mjs examples/booking-theme-clay-studio        # → dist/…-1.0.0.booking-theme.json
node tools/pack.mjs examples/booking-template-flow-yoga       # → dist/…-1.0.0.zip (theme.json + booking/ + assets/)
```

The preview shows every screen (service page, time picked, details, booked, manage, and the "time just taken" error), with the theme's settings in the top bar. For Level 2 pages it runs your page against a mock `window.octabizBooking` with sample open times. Add `?error=taken` to see how your page handles `SLOT_TAKEN`, and `?bar=0` to hide the top bar for screenshots.

In the developer portal choose **New app → Booking theme**, upload the `.booking-theme.json` (Level 1) or the `.zip` (Level 2), and the same checks run again.
