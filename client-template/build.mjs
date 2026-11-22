#!/usr/bin/env node
/**
 * Webstitch client-site builder.
 *
 * Turns one JSON config file into a complete static website in ./dist.
 * No dependencies: needs Node 18+ only.
 *
 *   node build.mjs                          # builds content/site.json into dist/
 *   node build.mjs examples/cafe.json       # builds another config
 *   node build.mjs content/site.json out/   # custom output folder
 */
import { readFile, writeFile, mkdir, rm, cp, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(process.argv[2] || path.join(root, 'content/site.json'));
const outDir = path.resolve(process.argv[3] || path.join(root, 'dist'));

const site = JSON.parse(await readFile(configPath, 'utf8'));
const biz = site.business || {};
const theme = site.theme || {};
const pages = site.pages || [];
if (!biz.name) throw new Error('site.json needs business.name');
if (!pages.length) throw new Error('site.json needs at least one page');

/* ---------- helpers ---------- */
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const exists = (p) => stat(p).then(() => true, () => false);
const telHref = (p = '') => 'tel:' + String(p).replace(/[^\d+]/g, '');
const paras = (body) => (Array.isArray(body) ? body : [body]).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('\n');

const FONTS = {
  inter: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  serif: "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
  rounded: "ui-rounded, 'Arial Rounded MT Bold', 'Hiragino Maru Gothic ProN', Quicksand, Calibri, sans-serif",
  slab: "Rockwell, 'Rockwell Nova', 'Roboto Slab', 'DejaVu Serif', Georgia, serif",
};
const font = (key, fallback) => FONTS[key] || key || FONTS[fallback];

// Pick black or white text for a background colour, whichever contrasts better (WCAG).
function luminance(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const inkFor = (hex) => ((luminance(hex) + 0.05) / 0.05 > 1.05 / (luminance(hex) + 0.05) ? '#111111' : '#ffffff');

const colours = {
  primary: theme.primary || '#1f3a5f',
  accent: theme.accent || theme.primary || '#1f3a5f',
  background: theme.background || '#ffffff',
  surface: theme.surface || '#f5f4f0',
  text: theme.text || '#16181d',
};
colours.primaryInk = inkFor(colours.primary);
colours.accentInk = inkFor(colours.accent);

const address = biz.address || {};
const addressLines = [address.line1, address.line2, address.town, address.county, address.postcode].filter(Boolean);
const addressText = addressLines.join(', ');
const baseUrl = site.domain ? `https://${site.domain}` : '';
const mapSrc = biz.mapEmbedUrl
  || (addressText ? `https://www.google.com/maps?q=${encodeURIComponent(`${biz.name}, ${addressText}`)}&output=embed` : '');

/* ---------- opening hours ---------- */
const DAYS = [['mon', 'Monday', 'Mo'], ['tue', 'Tuesday', 'Tu'], ['wed', 'Wednesday', 'We'], ['thu', 'Thursday', 'Th'],
  ['fri', 'Friday', 'Fr'], ['sat', 'Saturday', 'Sa'], ['sun', 'Sunday', 'Su']];
const hours = site.hours || null;
const isClosed = (v) => !v || /closed/i.test(v);

function hoursTable() {
  if (!hours) return '';
  const rows = DAYS.map(([key, label], i) => {
    const v = hours[key];
    const text = isClosed(v) ? 'Closed' : esc(v.replace(/\s*-\s*/g, ' – '));
    return `<tr data-day="${(i + 1) % 7}"><th scope="row">${label}</th><td>${text}</td></tr>`;
  }).join('\n');
  return `<table class="hours"><caption class="sr-only">Opening hours</caption><tbody>\n${rows}\n</tbody></table>`
    + (site.hoursNote ? `<p class="small muted">${esc(site.hoursNote)}</p>` : '');
}

function hoursSchema() {
  if (!hours) return undefined;
  return DAYS.filter(([key]) => !isClosed(hours[key]) && /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/.test(hours[key]))
    .map(([key, label]) => {
      const [opens, closes] = hours[key].split('-').map((s) => s.trim());
      return { '@type': 'OpeningHoursSpecification', dayOfWeek: label, opens, closes };
    });
}

/* ---------- section renderers ---------- */
function button(cta, cls, rel) {
  if (!cta || !cta.label) return '';
  const href = cta.href || '#';
  const url = /^(https?:|tel:|mailto:|#)/.test(href) ? href : rel + href.replace(/^\//, '');
  const ext = /^https?:/.test(href) ? ' rel="noopener"' : '';
  return `<a class="btn ${cls}" href="${esc(url)}"${ext}>${esc(cta.label)}</a>`;
}
const img = (src, alt, rel, attrs = '') =>
  `<img src="${esc(/^https?:/.test(src) ? src : rel + src)}" alt="${esc(alt || '')}" ${attrs}>`;
const heading = (s, level = 2) => (s.heading
  ? `${s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : ''}<h${level}>${esc(s.heading)}</h${level}>` : '');

const renderers = {
  hero(s, rel) {
    const info = [];
    if (addressText) info.push(`<li><span>Find us</span>${esc(addressText)}</li>`);
    if (biz.phone) info.push(`<li><span>Call</span><a href="${telHref(biz.phone)}">${esc(biz.phone)}</a></li>`);
    if (hours) info.push('<li><span>Today</span><b data-today-hours>See opening hours</b></li>');
    const side = s.image
      ? `<div class="hero-media">${img(s.image, s.imageAlt, rel, 'width="800" height="600" fetchpriority="high"')}</div>`
      : (info.length ? `<ul class="hero-card">${info.join('')}</ul>` : '');
    return `<section class="hero"><div class="wrap hero-grid">
<div>${s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : ''}
<h1>${esc(s.heading || biz.name)}</h1>
${s.text ? `<p class="lead">${esc(s.text)}</p>` : ''}
<div class="actions">${button(s.cta, 'btn-solid', rel)}${button(s.secondaryCta, 'btn-ghost', rel)}</div></div>
${side}
</div></section>`;
  },

  text(s, rel) {
    return `<section class="section${s.tinted ? ' tinted' : ''}"><div class="wrap ${s.image ? 'split' : 'narrow'}">
<div>${heading(s)}${paras(s.body)}${s.cta ? `<p>${button(s.cta, 'btn-solid', rel)}</p>` : ''}</div>
${s.image ? `<div class="media">${img(s.image, s.imageAlt, rel, 'loading="lazy" width="800" height="600"')}</div>` : ''}
</div></section>`;
  },

  features(s) {
    const items = (s.items || []).map((it) =>
      `<li><h3>${esc(it.title)}</h3>${it.text ? `<p>${esc(it.text)}</p>` : ''}</li>`).join('\n');
    return `<section class="section${s.tinted ? ' tinted' : ''}"><div class="wrap">${heading(s)}
${s.text ? `<p class="lead">${esc(s.text)}</p>` : ''}<ul class="cards">${items}</ul></div></section>`;
  },

  // Price list, menu or service list. Groups are optional headings (e.g. "Cuts", "Hot drinks").
  services(s) {
    const groups = (s.groups || []).map((g) => `<div class="price-group">${g.name ? `<h3>${esc(g.name)}</h3>` : ''}<ul class="prices">
${(g.items || []).map((it) => `<li><div><b>${esc(it.name)}</b>${it.description ? `<span>${esc(it.description)}</span>` : ''}</div>${it.price ? `<em>${esc(it.price)}</em>` : ''}</li>`).join('\n')}
</ul></div>`).join('\n');
    return `<section class="section${s.tinted ? ' tinted' : ''}"><div class="wrap">${heading(s)}
${s.text ? `<p class="lead">${esc(s.text)}</p>` : ''}<div class="price-grid">${groups}</div>
${s.note ? `<p class="small muted">${esc(s.note)}</p>` : ''}</div></section>`;
  },

  gallery(s, rel) {
    const items = (s.images || []).map((im) =>
      `<li><a href="${esc(rel + im.src)}">${img(im.src, im.alt, rel, 'loading="lazy" width="600" height="450"')}</a></li>`).join('\n');
    return `<section class="section"><div class="wrap">${heading(s)}<ul class="gallery">${items}</ul></div></section>`;
  },

  testimonials(s) {
    const items = (s.items || []).map((t) =>
      `<li><blockquote><p>${esc(t.quote)}</p><footer>${esc(t.name)}${t.detail ? `, <span>${esc(t.detail)}</span>` : ''}</footer></blockquote></li>`).join('\n');
    return `<section class="section tinted"><div class="wrap">${heading(s)}<ul class="quotes">${items}</ul></div></section>`;
  },

  faq(s) {
    const items = (s.items || []).map((f) => `<details><summary>${esc(f.q)}</summary>${paras(f.a)}</details>`).join('\n');
    return `<section class="section"><div class="wrap narrow">${heading(s)}<div class="faq">${items}</div></div></section>`;
  },

  hours(s) {
    return `<section class="section${s.tinted ? ' tinted' : ''}"><div class="wrap narrow">${heading({ heading: 'Opening hours', ...s })}${hoursTable()}</div></section>`;
  },

  // Third-party embed, e.g. a booking widget (Fresha, Booksy, Calendly) or a video.
  embed(s) {
    return `<section class="section"><div class="wrap">${heading(s)}${s.text ? `<p class="lead">${esc(s.text)}</p>` : ''}
<iframe class="embed" src="${esc(s.url)}" title="${esc(s.title || s.heading || 'Embedded content')}" loading="lazy" style="height:${Number(s.height) || 640}px"></iframe></div></section>`;
  },

  cta(s, rel) {
    return `<section class="cta"><div class="wrap"><h2>${esc(s.heading)}</h2>${s.text ? `<p>${esc(s.text)}</p>` : ''}
<div class="actions">${button(s.cta, 'btn-invert', rel)}${button(s.secondaryCta, 'btn-outline-invert', rel)}</div></div></section>`;
  },

  contact(s) {
    const form = site.contactForm && site.contactForm.action;
    const details = `<ul class="contact-list">
${biz.phone ? `<li><span>Phone</span><a href="${telHref(biz.phone)}">${esc(biz.phone)}</a></li>` : ''}
${biz.email ? `<li><span>Email</span><a href="mailto:${esc(biz.email)}">${esc(biz.email)}</a></li>` : ''}
${addressText ? `<li><span>Address</span>${addressLines.map(esc).join('<br>')}</li>` : ''}
</ul>${hours && s.showHours !== false ? `<h3>Opening hours</h3>${hoursTable()}` : ''}`;
    const formHtml = form ? `<form class="form" action="${esc(site.contactForm.action)}" method="post" data-ajax>
${site.contactForm.accessKey ? `<input type="hidden" name="access_key" value="${esc(site.contactForm.accessKey)}">` : ''}
<input type="hidden" name="subject" value="New website enquiry for ${esc(biz.name)}">
<p class="hp" aria-hidden="true"><label>Leave this empty <input type="text" name="botcheck" tabindex="-1" autocomplete="off"></label></p>
<p><label for="cf-name">Your name</label><input id="cf-name" name="name" autocomplete="name" required></p>
<p><label for="cf-email">Email</label><input id="cf-email" name="email" type="email" autocomplete="email" required></p>
<p><label for="cf-phone">Phone <span class="muted">(optional)</span></label><input id="cf-phone" name="phone" type="tel" autocomplete="tel"></p>
<p><label for="cf-message">Message</label><textarea id="cf-message" name="message" rows="5" required></textarea></p>
<p><button class="btn btn-solid" type="submit">Send message</button></p>
<p class="form-status" role="status" aria-live="polite"></p>
</form>` : `<div class="actions stack">
${biz.phone ? `<a class="btn btn-solid" href="${telHref(biz.phone)}">Call ${esc(biz.phone)}</a>` : ''}
${biz.email ? `<a class="btn btn-ghost" href="mailto:${esc(biz.email)}">Email us</a>` : ''}</div>`;
    return `<section class="section"><div class="wrap">${heading({ heading: 'Get in touch', ...s })}
${s.text ? `<p class="lead">${esc(s.text)}</p>` : ''}
<div class="contact-grid"><div>${details}</div><div>${formHtml}</div></div>
${mapSrc && s.map !== false ? `<iframe class="map" src="${esc(mapSrc)}" title="Map showing ${esc(biz.name)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : ''}
</div></section>`;
  },
};

/* ---------- page shell ---------- */
const SOCIAL = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', x: 'X', youtube: 'YouTube', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', tripadvisor: 'Tripadvisor' };
const socialLinks = Object.entries(site.social || {}).filter(([, url]) => url)
  .map(([key, url]) => `<a href="${esc(url)}" rel="noopener me">${esc(SOCIAL[key] || key)}</a>`).join('');

const assetsDir = path.join(path.dirname(configPath), 'assets');
const hasCustomFavicon = await exists(path.join(assetsDir, 'favicon.svg'));
const usesInter = [theme.headingFont, theme.bodyFont].includes('inter');
const pageUrl = (p) => `${baseUrl}/${p.slug ? p.slug + '/' : ''}`;

function schema() {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': biz.schemaType || 'LocalBusiness',
    name: biz.name,
    description: (site.seo && site.seo.description) || biz.description,
    url: baseUrl || undefined,
    telephone: biz.phone || undefined,
    email: biz.email || undefined,
    image: site.seo && site.seo.ogImage && baseUrl ? `${baseUrl}/${site.seo.ogImage}` : undefined,
    address: addressLines.length ? {
      '@type': 'PostalAddress', streetAddress: [address.line1, address.line2].filter(Boolean).join(', '),
      addressLocality: address.town, addressRegion: address.county, postalCode: address.postcode, addressCountry: 'GB',
    } : undefined,
    openingHoursSpecification: hoursSchema(),
    sameAs: Object.values(site.social || {}).filter(Boolean),
  }).replace(/</g, '\\u003c');
}

function renderPage(page) {
  const isHome = !page.slug;
  const rel = isHome ? './' : '../';
  const seo = site.seo || {};
  const title = page.seoTitle || (isHome ? (seo.title || `${biz.name}${biz.tagline ? ' | ' + biz.tagline : ''}`) : `${page.title} | ${biz.name}`);
  const description = page.description || seo.description || biz.description || '';
  const nav = pages.filter((p) => p.nav !== false).map((p) =>
    `<li><a href="${rel}${p.slug ? p.slug + '/' : ''}"${p === page ? ' aria-current="page"' : ''}>${esc(p.navLabel || p.title)}</a></li>`).join('');
  const headerCta = site.headerCta || (biz.phone ? { label: `Call ${biz.phone}`, href: telHref(biz.phone) } : null);
  const body = (page.sections || []).map((s) => {
    const fn = renderers[s.type];
    if (!fn) throw new Error(`Unknown section type "${s.type}" on page "${page.title}"`);
    return fn(s, rel);
  }).join('\n\n');

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${baseUrl ? `<link rel="canonical" href="${esc(pageUrl(page))}">` : ''}
<meta property="og:type" content="website">
<meta property="og:locale" content="en_GB">
<meta property="og:site_name" content="${esc(biz.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${baseUrl ? `<meta property="og:url" content="${esc(pageUrl(page))}">` : ''}
${seo.ogImage && baseUrl ? `<meta property="og:image" content="${esc(`${baseUrl}/${seo.ogImage}`)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="${esc(colours.primary)}">
<link rel="icon" href="${rel}${hasCustomFavicon ? 'assets/favicon.svg' : 'favicon.svg'}" type="image/svg+xml">
${usesInter ? `<link rel="preload" href="${rel}theme/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>` : ''}
<style>:root{--primary:${colours.primary};--primary-ink:${colours.primaryInk};--accent:${colours.accent};--accent-ink:${colours.accentInk};--bg:${colours.background};--surface:${colours.surface};--text:${colours.text};--font-heading:${font(theme.headingFont, 'system')};--font-body:${font(theme.bodyFont, 'system')};--radius:${Number.isFinite(theme.radius) ? theme.radius : 10}px}</style>
<link rel="stylesheet" href="${rel}theme/styles.css">
${isHome ? `<script type="application/ld+json">${schema()}</script>` : ''}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="wrap bar">
<a class="brand" href="${rel}">${site.logo ? img(site.logo, biz.name, rel, 'height="44"') : esc(biz.name)}</a>
<button class="nav-toggle" aria-expanded="false" aria-controls="nav">Menu</button>
<nav id="nav" aria-label="Main"><ul>${nav}</ul></nav>
${headerCta ? button(headerCta, 'btn-solid header-cta', rel) : ''}
</div></header>
<main id="main">
${body}
</main>
<footer class="site-footer"><div class="wrap footer-grid">
<div><p class="footer-name">${esc(biz.name)}</p>${addressText ? `<p>${addressLines.map(esc).join('<br>')}</p>` : ''}</div>
<div>${biz.phone ? `<p><a href="${telHref(biz.phone)}">${esc(biz.phone)}</a></p>` : ''}${biz.email ? `<p><a href="mailto:${esc(biz.email)}">${esc(biz.email)}</a></p>` : ''}${socialLinks ? `<p class="social">${socialLinks}</p>` : ''}</div>
<div><ul class="footer-nav">${nav}</ul></div>
</div>
<div class="wrap legal"><p>&copy; <span data-year>${new Date().getFullYear()}</span> ${esc(biz.name)}. ${esc((site.footer && site.footer.note) || '')}</p>
<p>Website by <a href="https://webstitch.co.uk" rel="noopener">Webstitch</a></p></div>
</footer>
<script>window.SITE_HOURS=${JSON.stringify(hours || null)};</script>
<script src="${rel}theme/script.js" defer></script>
</body>
</html>
`;
}

/* ---------- write everything ---------- */
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await cp(path.join(root, 'theme'), path.join(outDir, 'theme'), { recursive: true });
if (await exists(assetsDir)) await cp(assetsDir, path.join(outDir, 'assets'), { recursive: true });

for (const page of pages) {
  const dir = page.slug ? path.join(outDir, page.slug) : outDir;
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), renderPage(page));
}

// 404 page: uses root-absolute links because it can be served from any path.
const notFound = renderPage({
  slug: '404', title: 'Page not found', nav: false,
  sections: [{ type: 'text', heading: 'Sorry, that page isn’t here', body: ['The page may have moved, or the link might be out of date.'], cta: { label: 'Back to the home page', href: '/' } }],
}).replace(/(href|src)="\.\.\//g, '$1="/').replace('<meta name="viewport"', '<meta name="robots" content="noindex">\n<meta name="viewport"');
await writeFile(path.join(outDir, '404.html'), notFound);

if (!hasCustomFavicon) {
  const initial = esc(biz.name.replace(/^the\s+/i, '').charAt(0).toUpperCase());
  await writeFile(path.join(outDir, 'favicon.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${colours.primary}"/><text x="32" y="44" font-family="Arial,Helvetica,sans-serif" font-size="36" font-weight="700" text-anchor="middle" fill="${colours.primaryInk}">${initial}</text></svg>\n`);
}

if (site.domain) {
  await writeFile(path.join(outDir, 'CNAME'), site.domain + '\n');
  await writeFile(path.join(outDir, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${pageUrl(p)}</loc></url>`).join('\n')}\n</urlset>\n`);
}
await writeFile(path.join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\n${site.domain ? `Sitemap: ${baseUrl}/sitemap.xml\n` : ''}`);
await writeFile(path.join(outDir, '.nojekyll'), '');

console.log(`Built ${pages.length} page(s) for ${biz.name} -> ${path.relative(process.cwd(), outDir) || '.'}`);
