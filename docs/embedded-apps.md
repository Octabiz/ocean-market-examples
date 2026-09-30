# Embedded apps

An embedded app is a small web app (HTML, CSS and JavaScript) that appears as its own page inside Octabiz. Businesses open it from their sidebar after installing it from Ocean Market.

## How it runs

- **Octabiz hosts it.** When your version is approved, Octabiz serves the files from your reviewed `.zip` at an address on `api.octabiz.ai`. Businesses always run exactly the build Octabiz reviewed. The address you give while developing is only for your own testing.
- **It runs in a sandboxed frame** with its own origin, separate from the Octabiz app. It can't read Octabiz cookies, storage or the page around it.
- **It gets no login token and no database connection.** It asks the Octabiz page for data through a message bridge, and Octabiz checks each request against the permissions the business granted when it installed your app.
- **It can't make network requests.** The Content Security Policy sets `connect-src 'none'`. The one exception is an app that declares **"Sends data to an outside service"**. That's shown to businesses before they install, and it allows `https:` requests.

## Package layout

```
index.html          required, at the top of the zip — the page Octabiz opens
app.js              your code (any number of .js files)
styles.css
octabiz-bridge.js   the bridge client from this repo (copy it in)
app.json            name, version, permissions (read by the tools and reviewers)
images/…            optional
```

**Rules the serving policy enforces:**

| Allowed | Not allowed |
| --- | --- |
| `<script src="app.js">` (files in your package) | Inline `<script>…</script>` or `onclick="…"` attributes. Use `addEventListener`. |
| `<link rel="stylesheet" href="styles.css">`, inline `style=""` | Scripts or fonts from a CDN. Put them in the package. |
| Images from your package, `data:`, `blob:` or any `https:` URL | `fetch`, `XMLHttpRequest` and `WebSocket`, unless you declare "sends data outside" |
| Downloads (`<a download>` with a Blob URL) | `eval`, `new Function`, navigating the parent page |

The upload scan fails a package that contains executables or server-side files (`.exe`, `.sh`, `.php`, `.py`, `.wasm`…), crypto-miner code, hidden code (`eval(atob(...))`), or code that tries to redirect the Octabiz page. Every `.js` file must parse, and every `.json` file must be valid.

## The bridge (protocol v1)

Every message has `channel: "ocean-market"` and `version: 1`. `octabiz-bridge.js` wraps all of this for you:

```js
OctabizBridge.ready().then(function (ctx) {
  // ctx = { organizationId, appSlug, grantedScopes, config, currency }
  if (!OctabizBridge.hasScope('invoices:read')) { /* explain what's missing */ }
  return OctabizBridge.listAll('invoices.list');          // pages through everything
}).then(function (invoices) { /* … */ });

OctabizBridge.formatMoney(1234.5);   // "$1,234.50" in the business's currency
```

### Messages

| Direction | Message |
| --- | --- |
| Octabiz → app, on load | `{ type: "handshake", organizationId, appSlug, grantedScopes, config, currency }` |
| App → Octabiz | `{ type: "request", id, operation, params }` |
| Octabiz → app | `{ type: "response", id, ok: true, data }` or `{ type: "response", id, ok: false, error }` |

Octabiz accepts requests only from your frame and your origin. Reply with the same `id` you received. If your page is opened outside Octabiz, no handshake arrives, and `ready()` rejects with `NOT_EMBEDDED`. Show a friendly message when that happens.

### Operations

| Operation | Permission | Params | Returns (array rows unless noted) |
| --- | --- | --- | --- |
| `me` | none | none | `{ organizationId, appSlug, grantedScopes }` |
| `customers.list` | `customers:read` | `limit` (≤ 200), `offset`, `with_birthday: true` | `id, name, email, phone, date_of_birth, created_at`, newest first |
| `invoices.list` | `invoices:read` | `limit` (≤ 200), `offset` | `id, invoice_number, customer_id, customer_name, invoice_date, total, amount_paid, status, created_at`. Voided invoices are excluded. |
| `products.list` | `products:read` | `limit` (≤ 200) | the public product catalog |
| `customers.create` | `customers:write` | `name` (required), `email`, `phone` | the new customer (one object) |

A request without the matching permission fails with `Operation "…" requires scope "…"`. `ui:embed` is the permission to show a screen at all; every embedded app asks for it.

## Permissions (scopes)

Ask only for what the app needs. Reviewers check this, and businesses see each permission before they install. The list the developer portal offers for embedded apps:

`customers:read`, `customers:write`, `invoices:read`, `invoices:write`, `products:read`, `inventory:read`, `smart_tags:read`, `accounting:read`, `accounting:write`, `hr:read`, `ui:embed`.

Declare anything sensitive in the portal's **"Does your app do any of these?"** step: sends data outside Octabiz, runs in the background, messages customers, or handles card data.

## Developing locally

```bash
node tools/dev-host.mjs examples/embedded-top-customers
```

This opens a mock Octabiz at `http://localhost:4400`. It frames your app from a **different origin** (`http://127.0.0.1:4401`), sends the same **Content Security Policy** as production, and answers the bridge from sample data: 40 customers, 220 invoices and a few products. From the sidebar you can:

- untick a permission, to test your "missing permission" message
- switch the currency
- simulate an empty business
- slow the network down
- watch every bridge message in the log

## Checklist before you submit

- [ ] `node tools/validate.mjs` passes.
- [ ] Works with an empty business, and with a slow network.
- [ ] A clear message for a missing permission, and for being opened outside Octabiz.
- [ ] Money uses `formatMoney` (the business's currency), never a hard-coded `$`.
- [ ] CSV exports guard against formula injection (see `downloadCsv` in the examples).
- [ ] Readable in light and dark mode, usable at phone width, and usable with the keyboard.
