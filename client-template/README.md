# Webstitch client site template

One JSON file in, one finished static website out. No dependencies, no framework: Node 18+ and nothing else.

```
client-template/
├── build.mjs               the builder (reads the config, writes dist/)
├── content/
│   ├── site.json           everything about this client: copy, colours, pages, hours
│   └── assets/             the client's logo and photos (copied to dist/assets/)
├── theme/                  shared CSS, JS and fonts (same for every client)
├── examples/               more sample configs (café, church)
└── .github/workflows/      deploys to GitHub Pages on every push to main
```

## Build and preview

```bash
node build.mjs                      # content/site.json -> dist/
node build.mjs examples/cafe.json   # try another config
npx serve dist                      # preview at http://localhost:3000
```

## Start a new client site

1. Create a new **private** GitHub repo for the client (e.g. `client-marlowes-barbers`) and copy the contents of
   this folder into it, including the hidden `.github` folder. Tip: push this folder once to its own repo and tick
   **Settings > Template repository**, then use **Use this template** for each new client.
2. In the Webstitch admin, open the client's brief and press **Generate build prompt**. The download includes a
   ready-made `site.json`. Save it over `content/site.json`.
3. Put the client's logo and photos in `content/assets/` and reference them as `assets/filename.jpg`.
4. Run `node build.mjs` and check every page on a phone-sized window.
5. Push to `main`. In the repo go to **Settings > Pages > Source: GitHub Actions**. The site deploys in about a minute.

## site.json reference

| Key | What it does |
| --- | --- |
| `domain` | The client's domain without `https://`. Writes the `CNAME` file, canonical URLs and `sitemap.xml`. Leave empty until the domain is ready. |
| `business` | `name`, `tagline`, `description`, `phone`, `email`, `address` (`line1`, `line2`, `town`, `county`, `postcode`), `schemaType` (a schema.org type such as `HairSalon`, `CafeOrCoffeeShop`, `Church`, `Plumber`, `LocalBusiness`), `mapEmbedUrl` (optional, otherwise the map is built from the address). |
| `theme` | `primary` (hero, call-to-action bands), `accent` (buttons, highlights), `background`, `surface` (tinted sections), `text`, `radius` (corner roundness in px), `headingFont` and `bodyFont`. Fonts: `inter`, `system`, `serif`, `rounded`, `slab`, or any CSS `font-family` value. Button text colour is chosen automatically for contrast. |
| `logo` | Path to a logo image, e.g. `assets/logo.svg`. Empty shows the business name as text. |
| `seo` | `title` and `description` for the home page, `ogImage` (path to a 1200x630 share image). |
| `social` | Links: `facebook`, `instagram`, `tiktok`, `x`, `youtube`, `linkedin`, `whatsapp`, `tripadvisor`. |
| `hours` | `mon` to `sun`, each `"09:00-17:30"` or `"closed"`. Remove the key entirely if hours do not apply. `hoursNote` adds a line underneath. |
| `headerCta` | Button in the header: `{ "label": "Book now", "href": "tel:01632960123" }`. Defaults to click-to-call. |
| `contactForm` | `action` is the form endpoint. Empty shows call and email buttons instead of a form. See below. |
| `pages` | Up to 5 pages. Each has `slug` (empty for the home page), `title`, optional `navLabel` and `description`, and a list of `sections`. |

### Section types

| `type` | Fields |
| --- | --- |
| `hero` | `eyebrow`, `heading`, `text`, `cta`, `secondaryCta`, `image` + `imageAlt` (without an image it shows an address, phone and today's hours card) |
| `text` | `heading`, `body` (array of paragraphs), `image` + `imageAlt`, `cta`, `tinted` |
| `features` | `heading`, `text`, `items` (`title`, `text`), `tinted` |
| `services` | Price list or menu. `heading`, `text`, `groups` (`name`, `items` with `name`, `description`, `price`), `note`, `tinted` |
| `gallery` | `heading`, `images` (`src`, `alt`) |
| `testimonials` | `heading`, `items` (`quote`, `name`, `detail`) |
| `faq` | `heading`, `items` (`q`, `a`) |
| `hours` | Opening hours table. `heading`, `tinted` |
| `embed` | Booking widget or video. `heading`, `text`, `url`, `title`, `height` |
| `cta` | Full-width call to action. `heading`, `text`, `cta`, `secondaryCta` |
| `contact` | Phone, email, address, hours, contact form and map. `heading`, `text`, `map: false` to hide the map |

Links inside the site are written without a leading slash, e.g. `"href": "prices/"`. Phone links use `tel:`.

### Contact form

Static sites need a form service to deliver messages. Either works on a free plan:

- **Web3Forms**: create an access key for the client's email at web3forms.com, then set
  `"contactForm": { "action": "https://api.web3forms.com/submit", "accessKey": "THE-KEY" }`.
- **Formspree**: create a form and set `"contactForm": { "action": "https://formspree.io/f/abcdwxyz" }`.

Send a test message before go-live and check it reaches the client's inbox.

## Connect the client's domain

1. Set `"domain": "theirdomain.co.uk"` in `content/site.json` and push. The build writes the `CNAME` file.
2. At the domain's DNS provider add:

   | Type | Name | Value |
   | --- | --- | --- |
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `YOUR-GITHUB-USERNAME.github.io` |

3. In the client repo: **Settings > Pages > Custom domain**, enter the domain and save. When the DNS check passes,
   tick **Enforce HTTPS** (the certificate can take up to an hour).

## Go-live checklist

- [ ] Every page reads well on a phone, and the menu opens and closes
- [ ] Phone number taps to call, email link opens, map shows the right place
- [ ] Contact form test message arrives
- [ ] Page titles and descriptions are filled in (`seo` and each page's `description`)
- [ ] All images have `alt` text and are under about 300 KB each
- [ ] Domain connected, HTTPS enforced, `www` redirects
- [ ] Client has updated their Google Business Profile with the new website address

Fonts: Inter is bundled under the SIL Open Font Licence (see `theme/fonts/OFL.txt`).
