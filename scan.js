#!/usr/bin/env node
/*
  Storefront Accessibility Snapshot
  ---------------------------------
  Automated WCAG 2.2 A/AA scan (axe-core) of a small set of key pages on a store:
  home, a collection, a product page, and the cart. Writes a client-ready HTML
  report + raw JSON per site, and a summary CSV across all sites.

  Usage:
    node scan.js https://store-a.com https://store-b.com
    node scan.js --file prospects.csv            (CSV with columns: brand,url)
    node scan.js --pages https://x.com/,https://x.com/products/y   (explicit page list, one site)

  Env:
    PROVIDER_NAME   name shown in the report footer (default: none)
    PROVIDER_EMAIL  contact shown in the report footer (default: none)
    OUT_DIR         output folder (default: ./reports)
    CHROMIUM_PATH   optional explicit Chromium executable
*/
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const AXE_SOURCE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const PLAIN = require('./rules-plain');

const OUT_DIR = process.env.OUT_DIR || path.join(process.cwd(), 'reports');
const PROVIDER_NAME = process.env.PROVIDER_NAME || '';
const PROVIDER_EMAIL = process.env.PROVIDER_EMAIL || '';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const OVERLAYS = ['accessibe', 'acsbapp', 'userway', 'audioeye', 'equalweb', 'accessibly', 'maxaccess', 'ada-widget', 'enable.co.il', 'userway.org'];
const IMPACT_ORDER = { critical: 0, serious: 1, moderate: 2, minor: 3 };

function slug(s) { return s.toLowerCase().replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function origin(u) { const x = new URL(u); return x.origin; }

function parseArgs() {
  const a = process.argv.slice(2);
  const sites = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--file') {
      const rows = fs.readFileSync(a[++i], 'utf8').split(/\r?\n/).filter(Boolean);
      const header = rows.shift().split(',').map(h => h.trim().toLowerCase());
      for (const r of rows) {
        const cols = r.split(',');
        const rec = Object.fromEntries(header.map((h, j) => [h, (cols[j] || '').trim()]));
        if (rec.url) sites.push({ brand: rec.brand || rec.url, url: rec.url });
      }
    } else if (a[i] === '--pages') {
      const pages = a[++i].split(',').map(s => s.trim()).filter(Boolean);
      sites.push({ brand: process.env.BRAND || new URL(pages[0]).hostname, url: pages[0], pages });
    } else if (/^https?:\/\//.test(a[i])) {
      sites.push({ brand: new URL(a[i]).hostname, url: a[i] });
    }
  }
  if (!sites.length) { console.error('No sites given. See header of scan.js for usage.'); process.exit(1); }
  return sites;
}

async function discoverPages(ctx, site) {
  if (site.pages) return site.pages.map((u, i) => ({ label: i === 0 ? 'Home' : `Page ${i + 1}`, url: u }));
  const base = origin(site.url);
  const pages = [{ label: 'Home', url: base + '/' }];
  let isShopify = false;
  try {
    const r = await ctx.request.get(base + '/products.json?limit=5', { timeout: 20000 });
    if (r.ok()) {
      const j = await r.json();
      if (Array.isArray(j.products)) {
        isShopify = true;
        pages.push({ label: 'Collection', url: base + '/collections/all' });
        const p = j.products.find(p => p.handle);
        if (p) pages.push({ label: 'Product', url: `${base}/products/${p.handle}` });
        pages.push({ label: 'Cart', url: base + '/cart' });
      }
    }
  } catch (_) { /* not shopify or blocked */ }
  return { pages, isShopify };
}

async function findStatement(ctx, base) {
  for (const p of ['/pages/accessibility', '/pages/accessibility-statement', '/pages/accessibility-policy', '/pages/website-accessibility', '/accessibility']) {
    try {
      const r = await ctx.request.get(base + p, { timeout: 15000, maxRedirects: 3 });
      if (r.status() === 200) return base + p;
    } catch (_) {}
  }
  return null;
}

async function scanPage(ctx, pg) {
  const page = await ctx.newPage();
  const res = { ...pg, ok: false };
  try {
    await page.goto(pg.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // Password-protected Shopify stores (e.g. development stores): unlock once, then reload the page.
    if (/\/password(\?|$)/.test(new URL(page.url()).pathname + new URL(page.url()).search) && process.env.STORE_PASSWORD) {
      await page.fill('input[type="password"]', process.env.STORE_PASSWORD);
      await Promise.all([page.waitForNavigation({ timeout: 30000 }).catch(() => {}), page.press('input[type="password"]', 'Enter')]);
      await page.goto(pg.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    }
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    res.finalUrl = page.url();
    res.title = await page.title();
    await page.addScriptTag({ content: AXE_SOURCE });
    const axe = await page.evaluate(async (tags) => {
      // eslint-disable-next-line no-undef
      const r = await axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations', 'incomplete'] });
      const slim = v => ({ id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, tags: v.tags,
        nodes: v.nodes.map(n => ({ target: n.target.join(' '), html: n.html.slice(0, 220), summary: (n.failureSummary || '').slice(0, 300) })) });
      return { violations: r.violations.map(slim), incomplete: r.incomplete.length, passes: r.passes ? r.passes.length : null };
    }, TAGS);
    const extra = await page.evaluate((overlays) => {
      const scripts = [...document.scripts].map(s => (s.src || '') + ' ' + (s.textContent || '').slice(0, 400)).join(' ').toLowerCase();
      const overlay = overlays.find(o => scripts.includes(o)) || null;
      const firstLinks = [...document.querySelectorAll('a[href^="#"]')].slice(0, 5).map(a => (a.textContent || '').trim().toLowerCase());
      const skipLink = firstLinks.some(t => t.includes('skip'));
      const vp = document.querySelector('meta[name=viewport]');
      return { overlay, skipLink, lang: document.documentElement.getAttribute('lang'), viewport: vp ? vp.getAttribute('content') : null,
        images: document.images.length, imagesNoAlt: [...document.images].filter(i => !i.hasAttribute('alt')).length };
    }, OVERLAYS);
    Object.assign(res, axe, { extra, ok: true });
  } catch (e) {
    res.error = String(e.message || e).split('\n')[0];
  } finally {
    await page.close();
  }
  return res;
}

function aggregate(pages) {
  const byRule = new Map();
  for (const p of pages.filter(p => p.ok)) {
    for (const v of p.violations) {
      const r = byRule.get(v.id) || { id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, tags: v.tags, count: 0, pages: new Set(), examples: [] };
      r.count += v.nodes.length; r.pages.add(p.label);
      for (const n of v.nodes) if (r.examples.length < 3) r.examples.push({ page: p.label, ...n });
      byRule.set(v.id, r);
    }
  }
  return [...byRule.values()].map(r => ({ ...r, pages: [...r.pages] }))
    .sort((a, b) => (IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact]) || (b.count - a.count));
}

function wcagRefs(tags) {
  return tags.filter(t => /^wcag\d{3,4}$/.test(t)).map(t => { const d = t.replace('wcag', ''); return d.length === 3 ? `${d[0]}.${d[1]}.${d[2]}` : `${d[0]}.${d[1]}.${d.slice(2)}`; });
}

function renderHtml(site, result) {
  const { pages, rules, statement, isShopify, scannedAt } = result;
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const r of rules) counts[r.impact] = (counts[r.impact] || 0) + r.count;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const overlay = pages.map(p => p.extra && p.extra.overlay).find(Boolean);
  const okPages = pages.filter(p => p.ok);
  const skip = okPages.length ? okPages.every(p => p.extra.skipLink) : null;
  const zoomBlocked = okPages.some(p => /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(p.extra.viewport || ''));
  const ruleRows = rules.map(r => {
    const pl = PLAIN[r.id] || {};
    const ex = r.examples.map(e => `<li><span class="pg">${esc(e.page)}</span> <code>${esc(e.target)}</code></li>`).join('');
    return `<section class="issue ${r.impact}">
      <div class="ih"><span class="badge ${r.impact}">${esc(r.impact)}</span><h3>${esc(r.help)}</h3><span class="n">${r.count} element${r.count === 1 ? '' : 's'} · ${esc(r.pages.join(', '))}</span></div>
      ${pl.what ? `<p><b>What it means:</b> ${esc(pl.what)}</p>` : ''}
      ${pl.who ? `<p><b>Who it affects:</b> ${esc(pl.who)}</p>` : ''}
      ${pl.fix ? `<p><b>Typical fix:</b> ${esc(pl.fix)}</p>` : ''}
      <p class="ref">WCAG ${esc(wcagRefs(r.tags).join(', ') || 'best practice')} · rule <code>${esc(r.id)}</code> · <a href="${esc(r.helpUrl)}">reference</a></p>
      <details><summary>Example locations</summary><ul>${ex}</ul></details>
    </section>`;
  }).join('\n');
  const pageRows = pages.map(p => `<tr><td>${esc(p.label)}</td><td><a href="${esc(p.url)}">${esc(p.url)}</a></td><td>${p.ok ? p.violations.reduce((a, v) => a + v.nodes.length, 0) : 'not scanned: ' + esc(p.error)}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Accessibility Snapshot: ${esc(site.brand)}</title>
<style>
:root{--bg:#fbfaf7;--fg:#1d1d1b;--mut:#5d5b55;--line:#e3e0d8;--card:#fff;--crit:#a11d2b;--ser:#b4530a;--mod:#7a6a00;--min:#4b5563;--acc:#1f4e79}
@media (prefers-color-scheme:dark){:root{--bg:#161614;--fg:#eceae4;--mut:#a7a49c;--line:#34332f;--card:#1e1e1b;--crit:#f07b86;--ser:#f0a35c;--mod:#e0cf5a;--min:#a9b1bd;--acc:#8cb8e6}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:860px;margin:0 auto;padding:32px 16px 64px}h1{font-size:1.7rem;margin:0 0 4px}h2{margin-top:40px;font-size:1.2rem;border-bottom:1px solid var(--line);padding-bottom:6px}
.sub{color:var(--mut);margin:0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:20px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px}.card b{display:block;font-size:1.6rem}.card span{color:var(--mut);font-size:.85rem}
.issue{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--min);border-radius:8px;padding:14px 16px;margin:12px 0}
.issue.critical{border-left-color:var(--crit)}.issue.serious{border-left-color:var(--ser)}.issue.moderate{border-left-color:var(--mod)}
.ih{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline}.ih h3{margin:0;font-size:1.02rem;flex:1 1 300px}.n{color:var(--mut);font-size:.85rem}
.badge{font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;font-weight:700;padding:2px 7px;border-radius:99px;border:1px solid currentColor}
.badge.critical{color:var(--crit)}.badge.serious{color:var(--ser)}.badge.moderate{color:var(--mod)}.badge.minor{color:var(--min)}
.ref{color:var(--mut);font-size:.85rem}code{font-size:.82rem;word-break:break-all}a{color:var(--acc)}
table{width:100%;border-collapse:collapse;font-size:.9rem}td,th{border-bottom:1px solid var(--line);padding:6px 4px;text-align:left;vertical-align:top}td a{word-break:break-all}
.note{background:var(--card);border:1px dashed var(--line);border-radius:8px;padding:12px 14px;color:var(--mut);font-size:.9rem}.pg{font-weight:600}
footer{margin-top:40px;color:var(--mut);font-size:.85rem}
</style></head><body><main>
<p class="sub">Accessibility Snapshot</p>
<h1>${esc(site.brand)}</h1>
<p class="sub">${esc(origin(site.url))} · scanned ${esc(scannedAt)} · WCAG 2.2 A/AA automated rules</p>
<div class="grid">
<div class="card"><b>${total}</b><span>failing elements across ${okPages.length} page${okPages.length === 1 ? '' : 's'}</span></div>
<div class="card"><b>${rules.length}</b><span>distinct issue types</span></div>
<div class="card"><b>${counts.critical + counts.serious}</b><span>critical or serious</span></div>
<div class="card"><b>${statement ? 'Yes' : isShopify === null ? 'n/a' : 'None found'}</b><span>accessibility statement</span></div>
</div>
<h2>Quick checks</h2>
<table><tr><th>Check</th><th>Result</th></tr>
<tr><td>Platform</td><td>${isShopify === null ? 'Not checked (explicit page list)' : isShopify ? 'Shopify (verified via public product feed)' : 'Not identified as Shopify'}</td></tr>
<tr><td>Accessibility statement</td><td>${statement ? `<a href="${esc(statement)}">${esc(statement)}</a>` : isShopify === null ? 'Not checked (explicit page list)' : 'Not found at common paths'}</td></tr>
<tr><td>Overlay / widget detected</td><td>${overlay ? esc(overlay) + ' (overlays do not fix the underlying code issues listed below)' : 'None detected'}</td></tr>
<tr><td>"Skip to content" link</td><td>${skip === null ? 'n/a' : skip ? 'Present' : 'Missing on at least one page'}</td></tr>
<tr><td>Mobile pinch-zoom</td><td>${zoomBlocked ? 'Blocked on at least one page' : 'Allowed'}</td></tr>
</table>
<h2>Issues found (most severe first)</h2>
${ruleRows || '<p>No automated rule violations detected on the scanned pages.</p>'}
<h2>Pages scanned</h2>
<table><tr><th>Page</th><th>URL</th><th>Failing elements</th></tr>${pageRows}</table>
<h2>What this snapshot is and is not</h2>
<div class="note">This is an automated scan of ${okPages.length} key page${okPages.length === 1 ? '' : 's'} using the open-source axe-core engine. Automated tools catch only part of WCAG issues; keyboard navigation, screen-reader flow, checkout, and content quality need manual testing. It is a technical report, not legal advice, and it does not certify compliance with the ADA, the European Accessibility Act, or any other law.</div>
<footer>${PROVIDER_NAME ? 'Prepared by ' + esc(PROVIDER_NAME) : ''}${PROVIDER_EMAIL ? ' · ' + esc(PROVIDER_EMAIL) : ''}</footer>
</main></body></html>`;
}

(async () => {
  const sites = parseArgs();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const launchOpts = { headless: true };
  if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(launchOpts);
  const summary = [['brand', 'url', 'shopify', 'statement', 'overlay', 'pages_ok', 'issue_types', 'failing_elements', 'critical', 'serious', 'top_issues', 'report']];
  for (const site of sites) {
    process.stdout.write(`Scanning ${site.brand} (${site.url}) ... `);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141 Safari/537.36 a11y-snapshot' });
    const disc = await discoverPages(ctx, site);
    const pageList = Array.isArray(disc) ? disc : disc.pages;
    const isShopify = Array.isArray(disc) ? null : disc.isShopify;
    const statement = site.pages ? null : await findStatement(ctx, origin(site.url));
    const pages = [];
    for (const pg of pageList) pages.push(await scanPage(ctx, pg));
    await ctx.close();
    const rules = aggregate(pages);
    const result = { site, scannedAt: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC', isShopify, statement, pages, rules };
    const dir = path.join(OUT_DIR, slug(site.brand));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(result, null, 2));
    fs.writeFileSync(path.join(dir, 'report.html'), renderHtml(site, result));
    const c = { critical: 0, serious: 0 }; let total = 0;
    for (const r of rules) { total += r.count; if (c[r.impact] !== undefined) c[r.impact] += r.count; }
    const overlay = pages.map(p => p.extra && p.extra.overlay).find(Boolean) || '';
    summary.push([site.brand, site.url, isShopify, statement || '', overlay, pages.filter(p => p.ok).length + '/' + pages.length, rules.length, total, c.critical, c.serious,
      rules.slice(0, 4).map(r => `${r.id}(${r.count})`).join(' '), path.join(dir, 'report.html')]);
    console.log(`${total} failing elements, ${rules.length} issue types`);
  }
  await browser.close();
  const csv = summary.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'summary.csv'), csv);
  console.log(`\nDone. Reports in ${OUT_DIR} (summary.csv + one folder per site).`);
})().catch(e => { console.error(e); process.exit(1); });
