# Webstitch

Website, private admin and client-site template for **Webstitch** (webstitch.co.uk): modern websites for UK local
businesses. £150 to build, then £5 a month for the client's own domain and hosting.

```
.
├── site/              Public website (static, GitHub Pages, webstitch.co.uk)
│   ├── build.mjs          zero-dependency builder: src/ -> dist/
│   ├── site.config.json   contact email, API address, legal name
│   └── src/
│       ├── layout.html        header, footer and <head> shared by every page
│       ├── pages/             one file per page
│       ├── data/              portfolio.json, faq.json, extras.json, testimonials.json
│       ├── assets/            CSS, JS, fonts, images
│       └── static/            CNAME, favicons, share image
├── worker/            Cloudflare Worker: enquiry API + private admin (D1 database, R2 uploads)
│   ├── src/               index.js (routes), auth.js (Cloudflare Access check), pdf.js (invoices)
│   ├── public/admin/      the admin app (HTML, CSS, JS)
│   ├── migrations/        database schema
│   ├── samples/           example leads CSV for bulk import
│   └── BOT_ACCESS.md      optional: let an AI assistant such as Grok read the admin data
├── client-template/   Reusable client site: one site.json in, a finished static site out
└── .github/workflows/ pages.yml deploys /site to GitHub Pages
```

Nothing here needs a framework. You need [Node.js](https://nodejs.org) 18 or newer, a GitHub account and a free
Cloudflare account.

> **This repository is public if it is served by GitHub Pages on a free plan.** Never commit bank details, API keys or
> the `worker/.dev.vars` file. They belong in Worker secrets (step 4).

---

## 1. Run it locally

**Public site**

```bash
node site/build.mjs            # builds site/dist
npx serve site/dist            # http://localhost:3000
```

**Worker and admin**

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars # local-only settings with dummy bank details
npm run db:local               # creates the local database
npm run dev                    # http://localhost:8787/admin/
```

Locally, `DEV_BYPASS_ACCESS="true"` in `.dev.vars` skips the login. That switch only works when the address is
`localhost`, so it cannot open the deployed admin.

To test the enquiry form against your local Worker, temporarily set `"apiBase": "http://localhost:8787"` in
`site/site.config.json` and rebuild the site. Change it back before you commit.

**Client template**

```bash
cd client-template
node build.mjs && npx serve dist
```

---

## 2. Deploy the public site to GitHub Pages

1. Merge this branch into `main`.
2. On GitHub: **Settings > Pages > Build and deployment > Source: GitHub Actions**.
3. The **Deploy public site** workflow runs on every push to `main` that touches `site/`. Watch it under **Actions**.

> This repository used to serve a different site on `ross.asia`. Deploying this workflow replaces it. The old files
> remain in the git history if you ever need them.

### Connect webstitch.co.uk

The admin login (Cloudflare Access) needs the domain's DNS to be managed by Cloudflare, so do that first.

1. Add `webstitch.co.uk` to Cloudflare (free plan) and change the nameservers at your registrar to the two Cloudflare
   gives you.
2. In Cloudflare **DNS > Records** add these, each set to **DNS only** (grey cloud):

   | Type | Name | Content |
   | --- | --- | --- |
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `wame11.github.io` |

3. On GitHub: **Settings > Pages > Custom domain**, enter `webstitch.co.uk`, save, wait for the DNS check, then tick
   **Enforce HTTPS**. (The `CNAME` file in `site/src/static/` records the domain too.)
4. Email: in Cloudflare **Email > Email Routing**, forward `hello@webstitch.co.uk` to your own inbox. It is free.
   If you use a different address, change `email` in `site/site.config.json`.

---

## 3. Deploy the Worker, database and file storage

```bash
cd worker
npm install
npx wrangler login

npx wrangler d1 create webstitch
```

Copy the `database_id` it prints into `worker/wrangler.toml` (replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`), then:

```bash
npm run db:remote                              # creates the tables
npx wrangler r2 bucket create webstitch-uploads # storage for logos and photos
npx wrangler deploy
```

- The Worker is served at **app.webstitch.co.uk** (set in `wrangler.toml` under `routes`). Wrangler creates the DNS
  record for you. The `workers.dev` address is switched off on purpose so nothing can skip the login.
- **R2 is optional.** Cloudflare asks for a payment card before enabling R2, although the free allowance (10 GB) is
  far more than this needs. If you would rather not, delete the `[[r2_buckets]]` block from `wrangler.toml`. The
  enquiry form still works, uploads are skipped, and the admin tells you to ask the client to email their files.

## 4. Set the secrets

Secrets live encrypted in Cloudflare, never in this repository. Run each command and paste the value when asked:

```bash
npx wrangler secret put ADMIN_EMAILS         # you@example.com,assistant@example.com
npx wrangler secret put ACCESS_TEAM_DOMAIN   # yourteam.cloudflareaccess.com   (from step 5)
npx wrangler secret put ACCESS_AUD           # the long AUD tag                (from step 5)
npx wrangler secret put BANK_ACCOUNT_NAME    # Ethan Ross
npx wrangler secret put BANK_SORT_CODE       # 12-34-56
npx wrangler secret put BANK_ACCOUNT_NUMBER  # 12345678
```

Optional:

| Secret | What it does |
| --- | --- |
| `TURNSTILE_SECRET` | Spam check on the enquiry form. Create a Turnstile widget in Cloudflare, put its **site key** in `site/site.config.json` (`turnstileSiteKey`) and its **secret key** here. |
| `NOTIFY_WEBHOOK_URL` | A Discord or Slack webhook address. The Worker posts a one-line alert for each new enquiry (business name and type only). |
| `BOT_API_KEY` | Switches on the read-only API for an AI assistant. See [worker/BOT_ACCESS.md](worker/BOT_ACCESS.md). |

The bank details are only ever sent to a logged-in admin: on the invoice PDF and in the "Payment details" email
template. They are not in the public site, the database or the code.

## 5. Lock /admin with Cloudflare Access

1. Cloudflare dashboard > **Zero Trust**. The first time, choose a team name (this becomes
   `yourteam.cloudflareaccess.com`) and the Free plan.
2. **Access > Applications > Add an application > Self-hosted.**
   - Application name: `Webstitch admin`
   - Domain: `app.webstitch.co.uk`, Path: `admin`
   - Session duration: 24 hours is sensible
3. Add a policy: Action **Allow**, Include > **Emails**, then your email and your assistant's email.
4. Login method: the default **One-time PIN** emails a 6-digit code. Nothing else to set up.
5. Open the application's overview, copy the **Application Audience (AUD) tag**, and set the `ACCESS_AUD` and
   `ACCESS_TEAM_DOMAIN` secrets from step 4.
6. Visit **https://app.webstitch.co.uk/admin/**. You should be asked for your email, then land on the dashboard.

There are two locks, on purpose. Cloudflare Access stops anyone who is not on the list from reaching `/admin`. The
Worker then checks the signed login token itself and compares the email with `ADMIN_EMAILS`, so the admin stays shut
even if the Access application is deleted or misconfigured. If the secrets are missing the admin refuses everyone.

To add or remove a person, change **both** the Access policy and the `ADMIN_EMAILS` secret.

The only public route on the Worker is `POST /api/enquiry`, which accepts the Get Started form from the addresses
listed in `ALLOWED_ORIGINS` in `wrangler.toml`.

---

## 6. Using the admin

| Area | What it does |
| --- | --- |
| **Dashboard** | Total leads, clients won, conversion rate, revenue received, MRR, pipeline counts, new website enquiries, follow-ups due, overdue plans, unpaid invoices. |
| **Leads** | The pipeline: New → Contacted → Interested → Paid → Building → Live → Lost. Search and filter by status, type, town and website score. **Import CSV** takes a file like `worker/samples/leads-example.csv` and skips duplicates. |
| **Lead page** | Edit details, log calls and emails with a follow-up date, see invoices and the monthly plan. |
| **Client brief** | Everything the client wants: details, pages and copy, colours, fonts, hours, services and prices, social links, domain, monthly fee (£5 by default), extras, plus logo and photo uploads. Website enquiries arrive here already part-filled. |
| **Generate build prompt** | Turns the brief into a detailed prompt for an AI coding assistant, including a starter `site.json` for the client template and the GitHub Pages deploy steps. Copy it, download it as `.md`, or download the `site.json` on its own. |
| **Invoices** | Numbered invoices (`WS-2026-0001`), £150 build line, extras, a monthly fee line (the client's fee, £5 by default), payment reference (business name, trimmed to the 18 characters banks allow). **PDF** downloads the invoice with your bank details. **Mark paid** records the payment and moves the lead to Paid. |
| **Subscriptions** | Who pays the monthly fee, last payment date, next due date, an overdue flag (a week after the due date) and the monthly revenue total. |
| **Outreach** | Every call and email across all leads, with follow-ups due. |
| **Email templates** | Initial pitch, follow-up, after-call summary and payment details, filled in for the chosen lead. Each ends with an opt-out line. Copy, open in your email app, and log it as sent. Wording is editable. |
| **Settings and export** | Business details for invoices, prices for the build, the default monthly fee and extras, and CSV export of everything (leads, briefs, outreach, invoices, subscriptions, payments). |

### Outreach and the law, briefly

This is a summary, not legal advice.

- **Email (PECR):** you may email limited companies, LLPs, charities and churches at a business address without prior
  consent, as long as you say who you are and offer an opt-out. **Sole traders and ordinary partnerships are treated
  as individuals**, and many barbers, tradespeople and cafés are exactly that: email them only if they have asked to
  hear from you. Phoning or visiting is the safer first contact.
- **Calls:** check numbers against the TPS and CTPS before cold calling, and say who you are.
- **Opt-outs:** when someone says no, tick **Do not contact** on the lead. The admin then blocks the pitch templates
  for that business.
- **Data protection:** you hold personal data, so you probably need to pay the ICO data protection fee (about £40 a
  year for a sole trader). Check with the ICO's online self-assessment.

---

## 7. Add a new client, end to end

1. **Lead.** The business arrives through the website form (appears under "New website enquiries") or you add it in
   **Leads**. Log each call or email on the lead page.
2. **Brief.** Open **Client brief**, fill in what they want, upload their logo and photos, and save.
3. **Invoice.** **New invoice** > add any extras > **PDF**. Send it with the **Payment details** email template.
4. **Payment.** When the £150 arrives, press **Mark paid**. The lead moves to Paid. Set it to Building when you start.
5. **Build.**
   - Create a private repository for the client from `client-template/` (see
     [client-template/README.md](client-template/README.md)).
   - In the brief press **Generate build prompt**. Download `site.json` into `content/site.json`, put their images in
     `content/assets/`, and paste the prompt into your AI coding assistant to finish the copy and design.
   - `node build.mjs`, check it on a phone-sized screen, and push. GitHub Actions publishes it.
6. **Preview and changes.** Send the client the `github.io` preview link. Two rounds of changes are included.
7. **Go live.** Set `"domain"` in `site.json`, add the DNS records, enforce HTTPS, and set up their contact form key.
8. **Monthly plan.** In **Subscriptions** press **Add monthly plan** with the go-live date. The lead moves to Live.
   Ask the client to set up a standing order for their monthly fee with the reference on their invoice. Press **Record payment** each
   month when it arrives. Overdue plans are flagged on the dashboard.
9. **Show it off.** Take before and after screenshots (1200 × 750), save them in
   `site/src/assets/img/portfolio/`, add an entry to `site/src/data/portfolio.json`, and push.

---

## 8. Editing the public site

| To change | Edit |
| --- | --- |
| Contact email, phone, postal address, legal name | `site/site.config.json` |
| Portfolio projects | `site/src/data/portfolio.json` (set `"concept": false` and add a `url` for real clients) |
| Testimonials | `site/src/data/testimonials.json`, e.g. `[{ "quote": "…", "name": "Sam Taylor", "business": "Riverside Cuts" }]`. While it is empty the site shows an honest "reviews coming soon" panel. |
| FAQs | `site/src/data/faq.json` (`pages` controls where each question appears) |
| Extras and their prices | `site/src/data/extras.json`, and the matching list in the admin under **Settings** |
| Page wording | `site/src/pages/*.html` |
| Header, footer, meta tags | `site/src/layout.html` |
| Colours and type | the variables at the top of `site/src/assets/css/styles.css` |

`sitemap.xml` and `robots.txt` are generated by the build. Run `node site/build.mjs` to check your change, then push.

## 9. Before you go live

- [ ] Replace the placeholder decisions listed below with your own
- [ ] Add your postal address in `site/site.config.json` and the admin **Settings** (UK law expects an address on your
      website and invoices when you trade under a business name)
- [ ] Have the terms and privacy policy checked against how you actually work
- [ ] Set every secret in step 4 and confirm a test invoice shows the right bank details
- [ ] Send a test enquiry from the live site and find it in the admin
- [ ] Try `/admin` in a private window with an email that is **not** on the list: you should be refused

**Decisions made for you that you should review:** extras prices (£25 a page, £30 booking, £30 menu, £20 gallery),
"two rounds of changes", "reply within one working day", "edits within two working days", office hours of Monday to
Friday 9am to 6pm, invoices due in 7 days, the refund and missed-payment terms, and "England and Wales" as the
governing law (`governingLaw` in `site/site.config.json`).

Fonts: Inter, bundled under the SIL Open Font Licence.
