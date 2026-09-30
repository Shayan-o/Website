# Margins — Cloudflare Pages + D1

This folder is a static recreation of the public Margins pages plus a Cloudflare Pages Functions backend. It includes a D1-backed essay editor, newsletter signup with double opt-in, subscriber management, unsubscribe links, and an explicit admin action to send a published essay to confirmed subscribers.

## Included pages and features

- Home, three captured essays, tags index, and Design, Tools, and Writing tag pages.
- Privacy page describing Cloudflare D1 storage and Resend email delivery; replace the contact placeholder before launch.
- `/admin.html`: password-protected essay editor and confirmed-subscriber list, with CSV export and subscriber removal.
- Public essays load from D1 after the database is configured. The captured essays are seeded by the first migration.
- Newsletter signup stores no address until the confirmation email is accepted for delivery. Confirmation and unsubscribe links are time-limited and single-use.
- Admins can explicitly email a published essay to confirmed subscribers. Each recipient gets an individual message with an unsubscribe link.

## Cloudflare setup

This project uses Pages Functions. Cloudflare’s documentation says Functions must be deployed through a connected Git repository or Wrangler; dashboard Direct Upload does not support Functions. Keep `functions/` at the project root and use `public/` as the Pages build output directory. See the [Pages Functions guide](https://developers.cloudflare.com/pages/functions/), [D1 bindings guide](https://developers.cloudflare.com/pages/functions/bindings/), and [D1 migrations reference](https://developers.cloudflare.com/d1/reference/migrations/).

1. Put the contents of this folder at the root of a Git repository and connect it to Cloudflare Pages. Use build command `exit 0` and output directory `public`.
2. Create a Cloudflare D1 database named `margins-content` (for example, `npx wrangler d1 create margins-content`). Copy the returned database ID into `database_id` in `wrangler.toml`.
3. Apply the initial schema and seed essays with `npx wrangler d1 migrations apply margins-content --remote`.
4. In the Pages project’s **Settings → Variables and Secrets**, set these for production (and preview if you will use preview deployments):
   - Secret `ADMIN_PASSWORD`: a unique, strong password for `/admin.html`.
   - Secret `SESSION_SECRET`: a randomly generated secret used to sign eight-hour admin sessions.
   - Secret `RESEND_API_KEY`: a Resend API key with permission to send email.
   - Variable `MAIL_FROM`: a sender such as `Margins <newsletter@your-domain.com>` whose domain is verified in Resend.
5. Deploy the project. Open `https://your-domain/admin.html` and sign in with `ADMIN_PASSWORD`.
6. Once your domain is ready, add it to the Pages project as its custom domain and verify the DNS setup in Cloudflare.

Resend receives subscriber email addresses to deliver opt-in confirmations, unsubscribe confirmations, and newsletter messages. The public privacy wording discloses this. Replace the contact placeholder in `public/privacy.html` and update the disclosure if you change providers. Do not place secrets in this repository.

## Writing and publishing

Sign in at `/admin.html`, select an essay or click **New essay**, then save it as a draft or publish it. Published essays appear on the site from D1. To email one to confirmed subscribers, select the published essay and use **Email this essay to confirmed subscribers**; this is a separate action from publishing. The public API accepts only published essays.

The browser editor treats essay content as plain text. Separate paragraphs with a blank line. Slugs become permanent article URLs, so avoid changing an existing slug unless you also plan redirects.

## Local content snapshot

`public/essays.js` retains the public content snapshot so the site can render its current essays before the D1 API is available. `migrations/0001_initial.sql` seeds those same essays into a new D1 database. Future published content is managed in D1 through the admin editor.
