#!/usr/bin/env node
/**
 * Webstitch public site builder. No dependencies: Node 18+ only.
 *
 *   node build.mjs          # src/ -> dist/
 *
 * - Wraps every file in src/pages/ in src/layout.html
 * - Fills {{tokens}} from site.config.json and the JSON files in src/data/
 * - Copies src/assets/ and src/static/, writes sitemap.xml and robots.txt
 */
import { readFile, writeFile, mkdir, rm, cp, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, 'src');
const out = path.join(root, 'dist');
const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const config = await readJson(path.join(root, 'site.config.json'));
const data = {};
for (const name of ['faq', 'extras', 'portfolio', 'testimonials']) {
  data[name] = await readJson(path.join(src, 'data', `${name}.json`));
}
const layout = await readFile(path.join(src, 'layout.html'), 'utf8');

// Cache-busting: ?v=<hash> changes whenever the file changes.
const version = async (file) =>
  createHash('sha1').update(await readFile(path.join(src, file))).digest('hex').slice(0, 8);
const cssVersion = await version('assets/css/styles.css');
const jsVersion = await version('assets/js/main.js');

/* ---------- generated blocks ---------- */
const faqItems = (page) => data.faq.filter((f) => f.pages.includes(page));
const blocks = {
  faq: (page) => faqItems(page).map((f) =>
    `<details class="faq-item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n'),

  faqSchema: (page) => `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqItems(page).map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }).replace(/</g, '\\u003c')}</script>`,

  extras: () => data.extras.map((e) =>
    `<li><div><h3>${esc(e.name)}</h3><p>${esc(e.description)}</p></div><p class="extra-price">${esc(e.price)}</p></li>`).join('\n'),

  portfolio: () => data.portfolio.map((p) => `<article class="project reveal">
<header><div><h2>${esc(p.name)}</h2><p class="project-meta">${esc(p.type)}${p.town ? ` · ${esc(p.town)}` : ''}</p></div>
${p.concept ? '<span class="badge">Concept</span>' : (p.url ? `<a class="text-link" href="${esc(p.url)}" rel="noopener">Visit site</a>` : '')}</header>
<div class="project-shots">
<figure><img src="${esc(p.before)}" alt="${esc(p.name)} website before the redesign" width="1200" height="750" loading="lazy" decoding="async"><figcaption>Before</figcaption></figure>
<figure class="shot-after"><img src="${esc(p.after)}" alt="${esc(p.name)} website after the redesign" width="1200" height="750" loading="lazy" decoding="async"><figcaption>After</figcaption></figure>
</div>
<p>${esc(p.summary)}</p>
${p.highlights && p.highlights.length ? `<ul class="ticks">${p.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
</article>`).join('\n'),

  // Buttons that switch the home-page before/after slider between projects.
  showcaseTabs: () => data.portfolio.map((p, i) =>
    `<button type="button" class="chip" data-before="${esc(p.before)}" data-after="${esc(p.after)}" data-name="${esc(p.name)}" aria-pressed="${i === 0}">${esc(p.type)}</button>`).join('\n'),
  showcaseBefore: () => esc(data.portfolio[0].before),
  showcaseAfter: () => esc(data.portfolio[0].after),
  showcaseName: () => esc(data.portfolio[0].name),

  testimonials: () => (data.testimonials.length
    ? `<ul class="quotes">${data.testimonials.map((t) => `<li class="reveal"><blockquote><p>${esc(t.quote)}</p><footer><b>${esc(t.name)}</b>${t.business ? `, ${esc(t.business)}` : ''}</footer></blockquote></li>`).join('\n')}</ul>`
    : `<div class="quote-placeholder reveal"><p class="big">We are a new studio, so this space is waiting for our first reviews.</p>
<p>We would rather show you an empty space than a made-up quote. Be one of our first clients and you will get our full attention, a fixed price and a website you are proud to share.</p>
<p><a class="text-link" href="/get-started/">Be one of our first reviews</a></p></div>`),

  phoneLine: () => (config.phone ? `<li><span>Phone</span><a href="tel:${esc(config.phone.replace(/[^\d+]/g, ''))}">${esc(config.phone)}</a></li>` : ''),
  postalLine: () => (config.postalAddress ? `<li><span>Post</span>${esc(config.postalAddress)}</li>` : ''),
  postalText: () => esc(config.postalAddress || 'available on request by email'),
  turnstile: () => (config.turnstileSiteKey
    ? `<div class="cf-turnstile" data-sitekey="${esc(config.turnstileSiteKey)}"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>` : ''),
};

function fill(html, page) {
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    if (key in blocks) return blocks[key](page.id);
    if (key in page) return page[key];
    if (key in config) return esc(config[key]);
    throw new Error(`Unknown token {{${key}}} in ${page.file}`);
  });
}

/* ---------- pages ---------- */
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(path.join(src, 'assets'), path.join(out, 'assets'), { recursive: true });
await cp(path.join(src, 'static'), out, { recursive: true });

const sitemap = [];
for (const file of (await readdir(path.join(src, 'pages'))).filter((f) => f.endsWith('.html')).sort()) {
  const raw = await readFile(path.join(src, 'pages', file), 'utf8');
  const fm = raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->/);
  if (!fm) throw new Error(`${file} needs a JSON front matter comment at the top`);
  const meta = JSON.parse(fm[1]);
  const id = file.replace('.html', '');
  const url = id === 'index' ? '/' : id === '404' ? '/404.html' : `/${id}/`;
  const page = {
    id: id === 'index' ? 'home' : id, file, url,
    title: esc(meta.title), description: esc(meta.description || ''),
    canonical: config.siteUrl + url,
    robots: meta.noindex ? '<meta name="robots" content="noindex">' : '',
    year: String(new Date().getFullYear()),
    cssVersion, jsVersion,
  };
  page.content = fill(raw.slice(fm[0].length), page);
  let html = fill(layout, page);
  // Mark the current page in the navigation.
  html = html.replace(new RegExp(`(<a data-nav href="${url.replace(/\//g, '\\/')}")`, 'g'), '$1 aria-current="page"');

  const target = id === 'index' ? 'index.html' : id === '404' ? '404.html' : path.join(id, 'index.html');
  await mkdir(path.dirname(path.join(out, target)), { recursive: true });
  await writeFile(path.join(out, target), html);
  if (!meta.noindex) sitemap.push(page.canonical);
}

await writeFile(path.join(out, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
await writeFile(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${config.siteUrl}/sitemap.xml\n`);

console.log(`Built ${sitemap.length} indexable page(s) -> site/dist`);
