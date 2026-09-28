# AlwaysTap

AlwaysTap is a responsive marketing landing page for a Google review card product. It helps local businesses collect more authentic Google reviews by making the review flow simple and friction-free with a tap-based NFC experience.

## Overview

This project includes:
- a clean landing page for AlwaysTap
- pricing cards for standard and custom quantity orders
- a WhatsApp lead flow with name and phone capture
- Google Apps Script integration to save leads into a spreadsheet
- responsive layout for desktop, tablet, and mobile screens

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript
- Google Apps Script (for lead saving)
- WhatsApp business messaging flow

## Project Structure

```text
.
├── index.html
├── README.md
├── 127e2e82-ea33-4651-a8f2-8c0989e8487b.png
├── 7d5bf31b-a9c8-481c-9b10-27edcea4dd3c.png
├── ba04ac68-ef5c-4796-b962-0fb1d973cab2.png
├── bb2056b6-76ee-4809-bf43-c19167f67ec0.jpg
├── google-apps-script/
│   └── Code.gs
└── .vercel/
```

## Getting Started

Open the landing page directly in a browser:

```bash
start index.html
```

Or serve it locally with a simple static server if you want a cleaner preview:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Lead Capture Flow

The page includes a modal form that captures:
- customer name
- phone number
- optional custom number of cards for bulk/custom orders

After submission, it:
1. sends the data to a Google Apps Script endpoint
2. opens WhatsApp with the order message
3. allows the business owner to receive leads in the same flow

## WhatsApp Message Format

Example:

```text
Hi AlwaysTap, I'd like to order the ₹1,999 Single Card. Please share the payment and setup details.
```

For custom quantity orders, the message includes the requested number of cards.

## Google Sheet Integration

The current Apps Script endpoint is expected to write lead rows into a Google Sheet. Update the script if needed to match your final Google Sheet ID and sheet settings.

## Deployment

This landing page is designed to work well on static hosting platforms such as:
- Vercel
- Netlify
- GitHub Pages

## AlwaysTap client studio

- Open `/dashboard` to manage client profiles. It uses the same AlwaysTap domain and branding as the marketing site.
- Every client gets a permanent URL such as `/r/business-name-01`. Vercel rewrites all of those paths to one review-page app, so creating a client does not require adding a new HTML page or deploying the site again.
- Client records are stored in the existing Apps Script spreadsheet in a `Clients` tab. NFC/QR visits, ratings, selected suggestions and Google click-throughs are stored in `ReviewEvents`. The existing order-lead `Sheet1` and `doPost` flow are retained.
- The current client studio has no login, as requested. Anyone who finds `/dashboard` can view or change client records, and the public Apps Script endpoint can be called directly. Keep it for a trusted MVP trial; add access control before broader use.
- Optional written feedback appears on the customer form but is not saved or sent to the spreadsheet.

### Deploying the client studio

1. In Apps Script, update the existing web app project with `google-apps-script/Code.gs`, save, and deploy a new version of the existing web app. Keep the same deployment URL used by `app.js`.
2. Deploy the repository to Vercel. `vercel.json` handles `/dashboard` and `/r/{slug}`.
3. Visit `https://alwaystap.vercel.app/dashboard`, create a test client, and scan its QR code from a phone.

The dashboard and public review page both read and write to the shared Sheet. Creating a client only adds a Sheet row; it does not require a GitHub commit or new Vercel deployment.

## Notes

- The site is tuned for responsiveness across desktop, tablet, and mobile screens.
- The pricing grid stays horizontal on larger displays and stacks on smaller displays.
- Bulk/custom orders are supported through a custom quantity column and lead form flow.

## License

This project is for business use and internal deployment. Add your own licensing details if you plan to distribute it externally.
