// Builds the <head> tags (title, description, keywords, Open Graph, JSON-LD) from site content on the server,
// so search engines and link previews (LinkedIn, WhatsApp…) see real details — they don't run the page's JavaScript.
// Shared by src/worker.js (Cloudflare) and server.js (local).

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function renderHead(html, content, origin) {
  const settings = content?.settings || {};
  const profile = content?.profile || {};
  const visible = (list) => (Array.isArray(list) ? list.filter((x) => x && !x.hidden) : []);
  const abs = (url) => (!url ? '' : /^https?:\/\//i.test(url) ? url : `${origin}${url.startsWith('/') ? '' : '/'}${url}`);

  const title = settings.siteTitle || profile.name || 'Portfolio';
  const description = settings.metaDescription || profile.intro || '';
  const image = abs(profile.avatar);
  const url = `${origin}/`;
  const location = visible(content?.info).find((i) => /based|location|city/i.test(i.label || ''))?.value;

  const person = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.name,
    jobTitle: profile.headline,
    description,
    url,
    image: image || undefined,
    address: location ? { '@type': 'PostalAddress', addressLocality: location } : undefined,
    sameAs: visible(content?.socials).map((s) => s.url).filter((u) => /^https?:\/\//i.test(u || '')),
    knowsAbout: visible(content?.skills).map((s) => s.name).filter(Boolean).slice(0, 40),
  };

  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    settings.metaKeywords ? `<meta name="keywords" content="${esc(settings.metaKeywords)}" />` : '',
    `<meta name="author" content="${esc(profile.name || '')}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="profile" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    image ? `<meta property="og:image" content="${esc(image)}" />` : '',
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    image ? `<meta name="twitter:image" content="${esc(image)}" />` : '',
    `<script type="application/ld+json">${JSON.stringify(person).replace(/</g, '\\u003c')}</script>`,
  ].filter(Boolean).join('\n  ');

  return html.replace(/<title>[\s\S]*?<\/title>\s*<meta name="description" content="[^"]*" \/>/, tags);
}
