# Review guidelines

Every new app and every new version is reviewed by a person at Octabiz before businesses can install it. Here is what reviewers look at, and the real reasons the examples in this repo were sent back before they were approved.

## What reviewers check

**Every product**
- The listing is honest. The name, descriptions and screenshots match what the product does.
- The price, licence and refund policy are set and match the listing.
- The support, privacy and terms links load.
- There are no copied brands, logos or images you don't have the right to use.

**Embedded apps**
- It **only asks for data it needs**. Every permission should be visible in what the app does.
- It works. Reviewers use **Try it**, which runs your build against sample data, and read your code in the package viewer.
- Automatic checks: a malware scan, lint and build (every script parses), the package size, and new permissions compared with the live version.
- **Privacy:** it shows and exports no more personal data than the task needs.

**Templates and themes**
- The preview looks right on phones and desktops.
- Text is readable (contrast) and nothing is broken or empty.
- Placeholder copy (“Lorem ipsum”, “Click here”) has been replaced with real sample content a business could keep.

## Real review notes from these examples

| Example | Sent back because | How it was fixed |
| --- | --- | --- |
| Harbor Linen v1.0.0 | Cards (surface `#F1EBE1`) blended into the page (background `#FAF7F2`), and the icon looked unfinished. | A deeper surface (`#E8DCC8`) with a visible border, darker muted text, and a proper icon. |
| Bright Clinic v1.0.0 | Every text was Lorem ipsum, the button said “Click here”, and the subheading (`#A9BDB6` on `#F3FAF7`) was too faint. | Real sample copy, a clear booking button label, and a darker subheading. |
| Top Customers v1.0.0 | The CSV export was open to **formula injection**: a customer named `=HYPERLINK(…)` runs as a formula in Excel or Sheets. | Cells that start with `= + - @` get a leading `'`; plain numbers are left alone. |
| Birthday Reminders v1.0.0 | Each row and the CSV showed the **full date of birth and age**. Staff only need the day and month. | The app drops the birth year as soon as it loads the data. |

## Rejected, or asked to change?

- **Ask for changes.** You can fix the build and resubmit under the **same version number**. Reply to each note on the **Versions** tab.
- **Rejected.** That version number can't be reused. Upload the fix as a new version, for example `1.1.0`.

The reviewer's message is always on your app's **Versions** tab.
