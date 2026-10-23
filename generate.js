#!/usr/bin/env node
/**
 * The Cyber Casebook site generator.
 *
 *   node generate.js
 *
 * Reads config.json, pulls the latest case studies from the Apps Script feed
 * ("dataUrl"), and writes the finished website into dist/:
 *   index.html, archive.html, about.html, privacy.html, 404.html,
 *   case/<one page per case study>.html, sitemap.xml, robots.txt, ads.txt
 * If the feed can't be reached it uses data/snapshot.json instead.
 * Needs Node 18 or newer. No packages to install.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const PRIVACY_UPDATED = 'October 11, 2026';
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const cfg = JSON.parse(read('config.json'));
const SITE = String(cfg.siteUrl || '').replace(/\/+$/, '');
const ADS = cfg.adsense || {};
const EKMAP = JSON.parse(read('data/ekmap.json'));

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = o => JSON.stringify(o).replace(/</g, '\\u003c');
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const fmtDate = d => { const [y, m, day] = String(d).split('-').map(Number); if (!y) return d; return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };
const monthName = d => { const [y, m] = String(d).split('-').map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }); };
const isAI = c => /^ai$/i.test(c.category);
const catCls = c => isAI(c) ? 'ai' : /^network/i.test(c.category) ? 'nw' : '';
const ekCmp = (a, b) => { const pa = a.split('.'), pb = b.split('.'); for (let i = 0; i < 4; i++) { const x = pa[i] || '', y = pb[i] || ''; const nx = +x, ny = +y; if (!isNaN(nx) && !isNaN(ny) && nx !== ny) return nx - ny; if (isNaN(nx) && x !== y) return x < y ? -1 : 1; } return 0; };
const statement = (course, id) => (EKMAP.ek[course] || {})[id] || '';
const loTitle = (course, id) => (EKMAP.lo[course] || {})[id.split('.').slice(0, 3).join('.')] || '';
const abs = p => (SITE || '') + '/' + p.replace(/^\/+/, '');
const ICON = {
  dl: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-5-5m5 5l5-5M4 21h16"/></svg>',
  ext: '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>'
};

function normalize(list) {
  return (list || []).filter(c => c && c.headline).map((c, i) => ({
    _i: i, date: String(c.date || '').slice(0, 10), category: c.category || '', headline: String(c.headline),
    synopsis: c.synopsis || '', keyTerms: c.keyTerms || [], apCyber: c.apCyber || [], apNet: c.apNet || [],
    outlet: c.outlet || '', sourceUrl: c.sourceUrl || '', pdfView: c.pdfView || '', pdfDownload: c.pdfDownload || ''
  }));
}
function slugify(c, used) {
  const all = c.headline.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/).filter(Boolean);
  const words = [];
  for (const w of all) { if ((words.join('-') + '-' + w).length > 60) break; words.push(w); }
  const base = (c.date ? c.date + '-' : '') + (words.join('-') || 'case');
  let s = base, n = 2;
  while (used.has(s)) s = base + '-' + n++;
  used.add(s);
  return s;
}

/* ---------- analytics ---------- */
const gaId = String(cfg.googleAnalytics || '').trim();
const gaHead = /^G-[A-Z0-9]+$/.test(gaId)
  ? `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', '${gaId}');
</script>
`
  : '';

/* ---------- ads ---------- */
const adClient = String(ADS.client || '').trim();
const adHead = adClient
  ? `<meta name="google-adsense-account" content="${esc(adClient)}">\n<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(adClient)}" crossorigin="anonymous"></script>\n`
  : '';
function adUnit(name, lazy) {
  const slot = String((ADS.slots || {})[name] || '').trim();
  if (!adClient || !slot) return '';
  return `<aside class="adslot" aria-label="Advertisement"><div class="adlab">Advertisement</div>` +
    `<ins class="adsbygoogle" style="display:block" data-ad-client="${esc(adClient)}" data-ad-slot="${esc(slot)}" data-ad-format="auto" data-full-width-responsive="true"></ins>` +
    (lazy ? '' : `<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>`) + `</aside>`;
}

/* ---------- shared page parts ---------- */
const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Share+Tech+Mono&display=swap" rel="stylesheet">`;
function headMeta({ title, desc, url, type = 'website' }) {
  return [
    SITE ? `<link rel="canonical" href="${esc(abs(url))}">` : '',
    `<meta property="og:site_name" content="The Cyber Casebook">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    SITE ? `<meta property="og:url" content="${esc(abs(url))}">` : '',
    SITE ? `<meta property="og:image" content="${esc(abs('img/banner.jpg'))}">` : '',
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="theme-color" content="#000503">`,
    `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#000"/><text x="32" y="44" font-family="monospace" font-size="34" font-weight="700" text-anchor="middle" fill="#00FF66">&gt;_</text></svg>')}">`
  ].filter(Boolean).join('\n');
}
function footer(pre) {
  return `<footer>
    <nav aria-label="Site"><a href="${pre}index.html">Home</a><a href="${pre}archive.html">All case studies</a><a href="${pre}about.html">About</a><a href="${pre}privacy.html">Privacy</a></nav>
    <p><b>The Cyber Casebook</b> · Case studies are written for grades 9-12 from reputable news reports. Always read the original source. EK statements are paraphrased from the AP Cybersecurity and AP Networking course frameworks.</p>
    <p>AP® is a trademark registered by the College Board, which is not affiliated with, and does not endorse, this site.</p>
  </footer>`;
}
function shell({ title, desc, url, pre, body, jsonld, type }) {
  return `<!doctype html>
<html lang="en">
<head>
${gaHead}<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${headMeta({ title, desc, url, type })}
${fonts}
<link rel="stylesheet" href="${pre}assets/site.css">
<script>try{if(localStorage.getItem("ccTheme")==="light")document.documentElement.dataset.theme="light"}catch(e){}</script>
${adHead}${jsonld ? `<script type="application/ld+json">${json(jsonld)}</script>\n` : ''}</head>
<body>
<canvas id="rain" aria-hidden="true"></canvas>
<div class="wrap">
  <header class="topbar">
    <a class="brand" href="${pre}index.html">&gt;_ The Cyber Casebook <small>// AP CYBER · AP NETWORKING · AI</small></a>
    <nav aria-label="Site"><a href="${pre}index.html">Home</a><a href="${pre}archive.html">All cases</a><a href="${pre}about.html">About</a><button type="button" class="theme-toggle" data-theme-toggle aria-pressed="false">Light mode</button></nav>
  </header>
${body}
  ${footer(pre)}
</div>
<script src="${pre}assets/rain.js"></script>
</body>
</html>
`;
}
function pdfButton(c) {
  if (!c.pdfDownload && !c.pdfView) return `<span class="btn" aria-disabled="true">${ICON.dl} PDF coming soon</span>`;
  return `<a class="btn primary" href="${esc(c.pdfDownload || c.pdfView)}" target="_blank" rel="noopener">${ICON.dl} Download PDF</a>`;
}
function sourceButton(c) {
  return c.sourceUrl ? `<a class="btn" href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">${ICON.ext} Read the source</a>` : '';
}

/* ---------- pages ---------- */
function featuredCard(c) {
  return `
    <article class="fcard ${catCls(c)}">
      <div class="meta"><span class="badge ${catCls(c)}">${esc(c.category || 'Case')}</span><span>${esc(fmtDate(c.date))}</span><span>${esc(c.outlet)}</span></div>
      <h3><a href="${esc(c.page)}">${esc(c.headline)}</a></h3>
      <p class="syn">${esc(c.synopsis || 'Synopsis coming soon.')}</p>
      <div class="src">Source: ${c.sourceUrl ? `<a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">${esc(c.outlet || host(c.sourceUrl))}</a>` : esc(c.outlet)}</div>
      <div class="links">
        ${pdfButton(c)}
        ${sourceButton(c)}
      </div>
    </article>`;
}

function buildIndex(cases, pages) {
  const desc = 'Real-world Cybersecurity, Networking, and AI case studies for grades 9-12, aligned to AP Cybersecurity and AP Networking essential knowledge.';
  const site = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'The Cyber Casebook', description: desc, url: SITE ? abs('') : undefined };
  const isAI = c => /^ai$/i.test(c.category), isNet = c => /^network/i.test(c.category);
  const picks = [isAI, isNet, c => !isAI(c) && !isNet(c)].map(f => cases.find(f)).filter(Boolean);
  cases.forEach(c => { if (picks.length < 3 && !picks.includes(c)) picks.push(c); });
  picks.sort((a, b) => b.date.localeCompare(a.date) || a._i - b._i);
  const featured = picks.slice(0, 3).map(featuredCard).join('') || '<div class="empty">No case studies yet.</div>';
  let s = read('src/index.html');
  s = s.replace('__HEAD__', gaHead + headMeta({ title: 'The Cyber Casebook', desc, url: '' }) + '\n' + adHead + `<script type="application/ld+json">${json(site)}</script>`)
    .replace('__FEATURED__', () => featured)
    .replace('<!--AD:home-->', () => adUnit('home'))
    .replace('<!--AD:results-->', () => adUnit('results', true))
    .replace('__FOOTER__', () => footer(''))
    .replace('__DATA_URL__', () => JSON.stringify(String(cfg.dataUrl || '')))
    .replace('__SNAPSHOT__', () => json(cases.map(({ _i, page, slug, ...c }) => c)))
    .replace('__EKMAP__', () => json(EKMAP))
    .replace('__PAGES__', () => json(pages));
  const left = s.match(/__[A-Z_]+__/);
  if (left) throw new Error('Unfilled placeholder in index.html: ' + left[0]);
  return s;
}

function ekBlock(course, ids, name) {
  if (!ids.length) return '';
  return `
  <section class="block ${course === 'net' ? 'net' : ''}">
    <h2>${name} alignment</h2>
    <ul class="eks">${[...ids].sort(ekCmp).map(id => `
      <li><a class="ek ${course}" href="../index.html#view=results&amp;${course}=${encodeURIComponent(id)}" title="See every case study that uses ${esc(id)}">${esc(id)}</a>${esc(statement(course, id) || 'Statement not found in the framework reference.')}${loTitle(course, id) ? `<span class="lo">Learning objective: ${esc(loTitle(course, id))}</span>` : ''}</li>`).join('')}
    </ul>
  </section>`;
}

function related(c, cases) {
  const score = o => {
    let s = 0;
    o.apCyber.forEach(e => c.apCyber.includes(e) && (s += 2));
    o.apNet.forEach(e => c.apNet.includes(e) && (s += 2));
    o.keyTerms.forEach(t => c.keyTerms.some(k => k.toLowerCase() === t.toLowerCase()) && (s += 2));
    if (o.category === c.category) s += 1;
    return s;
  };
  return cases.filter(o => o !== c).map(o => [score(o), o]).filter(([s]) => s > 0)
    .sort((a, b) => b[0] - a[0] || b[1].date.localeCompare(a[1].date)).slice(0, 3).map(([, o]) => o);
}

function buildCase(c, cases) {
  const title = `${c.headline} · ${c.category || 'Case'} case study · The Cyber Casebook`;
  const desc = c.synopsis || `A ${c.category} case study for grades 9-12 aligned to AP Cybersecurity and AP Networking.`;
  const rel = related(c, cases);
  const ld = {
    '@context': 'https://schema.org', '@type': ['Article', 'LearningResource'],
    headline: c.headline, description: desc, datePublished: c.date, dateModified: c.date, inLanguage: 'en',
    educationalLevel: 'Grades 9-12', learningResourceType: 'Case study', keywords: c.keyTerms.join(', '),
    teaches: [...c.apCyber.map(e => 'AP Cybersecurity EK ' + e), ...c.apNet.map(e => 'AP Networking EK ' + e)],
    isBasedOn: c.sourceUrl || undefined,
    publisher: { '@type': 'Organization', name: 'The Cyber Casebook' },
    mainEntityOfPage: SITE ? abs(c.page) : undefined,
    image: SITE ? abs('img/banner.jpg') : undefined
  };
  const body = `
  <div class="crumbs"><a href="../index.html">Home</a> / <a href="../archive.html">All case studies</a> / ${esc(c.headline)}</div>
  <main class="page">
    <article class="fcard ${catCls(c)}">
      <div class="meta"><span class="badge ${catCls(c)}">${esc(c.category || 'Case')}</span><time datetime="${esc(c.date)}">${esc(fmtDate(c.date))}</time><span>Source outlet: <b style="color:var(--text);font-weight:600">${esc(c.outlet)}</b></span></div>
      <h1>${esc(c.headline)}</h1>
      <p class="lead">${esc(c.synopsis || 'Synopsis coming soon.')}</p>
      <div class="src">Source URL: ${c.sourceUrl ? `<a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">${esc(c.sourceUrl)}</a>` : '—'}</div>
      <div class="links">
        ${pdfButton(c)}
        ${sourceButton(c)}
      </div>
    </article>
    ${adUnit('case')}
    ${c.keyTerms.length ? `
    <section class="block">
      <h2>Key terms</h2>
      <div class="tags">${c.keyTerms.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    </section>` : ''}
    ${ekBlock('cyber', c.apCyber, 'AP Cybersecurity')}
    ${ekBlock('net', c.apNet, 'AP Networking')}
    ${rel.length ? `
    <section class="block">
      <h2>Related case studies</h2>
      <div class="related">${rel.map(o => `<a class="${catCls(o)}" href="${esc(o.slug)}.html"><b>${esc(o.headline)}</b><span>${esc(o.category)} · ${esc(fmtDate(o.date))}</span></a>`).join('')}</div>
    </section>` : ''}
  </main>`;
  return shell({ title, desc, url: c.page, pre: '../', body, jsonld: ld, type: 'article' });
}

function buildArchive(cases) {
  const groups = [];
  cases.forEach(c => {
    const m = monthName(c.date);
    if (!groups.length || groups[groups.length - 1][0] !== m) groups.push([m, []]);
    groups[groups.length - 1][1].push(c);
  });
  const body = `
  <main class="page arch">
    <h1>All case studies</h1>
    <p class="lead">Every Cyber Casebook case study, newest first. Each one links to a classroom-ready PDF and the original news report.</p>
    ${groups.map(([m, list], gi) => `
    <h2>${esc(m)}</h2>
    <ul>${list.map(c => `
      <li><time datetime="${esc(c.date)}">${esc(fmtDate(c.date))}</time><div><a class="${catCls(c)}" href="${esc(c.page)}">${esc(c.headline)}</a><small>${esc(c.category)} · ${esc(c.outlet)}${c.synopsis ? ' — ' + esc(c.synopsis) : ''}</small></div></li>`).join('')}
    </ul>${gi === 0 ? adUnit('archive') : ''}`).join('')}
  </main>`;
  return shell({ title: 'All case studies · The Cyber Casebook', desc: 'The full archive of Cyber Casebook case studies on cybersecurity, networking, and AI for grades 9-12.', url: 'archive.html', pre: '', body });
}

function contactLine() {
  const e = String(cfg.contactEmail || '').trim();
  return e ? `<a href="mailto:${esc(e)}">${esc(e)}</a>` : 'the contact email listed on this page (coming soon)';
}

function buildAbout(n) {
  const body = `
  <main class="page prose">
    <h1>About The Cyber Casebook</h1>
    <section class="block">
      <p>The Cyber Casebook is a free library of short, classroom-ready case studies about real events in cybersecurity, computer networking, and artificial intelligence. It is written for high school students in grades 9-12 and for the teachers who work with them.</p>
      <p>Each case study starts from a reputable news report. It explains what happened in plain language, highlights the key terms, and maps the story to essential knowledge (EK) statements in the AP Cybersecurity and AP Networking course frameworks. Every case links back to the original article so readers can check the facts for themselves.</p>
    </section>
    <section class="block">
      <h2>How the case studies are made</h2>
      <p>New case studies are added on school days. They are produced with AI-assisted research, writing, and design tools from published reporting, and each one cites its source. The case studies describe what happened and why it matters; they never include step-by-step instructions for carrying out an attack.</p>
      <p>Found a mistake? Please let us know at ${contactLine()} and we'll correct it.</p>
    </section>
    <section class="block">
      <h2>Using the case studies</h2>
      <ul>
        <li>Browse by AP Cybersecurity or AP Networking EK number to find cases for a specific lesson.</li>
        <li>Search by keyword, category, key term, or date.</li>
        <li>Download the two-page PDF for printing or posting to your class page.</li>
      </ul>
      <p>The Cyber Casebook currently has ${n} case ${n === 1 ? 'study' : 'studies'}. It is free to use and is supported by advertising.</p>
    </section>
    <section class="block">
      <h2>Not affiliated with the College Board</h2>
      <p>AP® is a trademark registered by the College Board, which is not affiliated with, and does not endorse, this site. EK statements are paraphrased from the public AP course frameworks for reference.</p>
    </section>
  </main>`;
  return shell({ title: 'About · The Cyber Casebook', desc: 'What The Cyber Casebook is, how its case studies are made, and how to use them in class.', url: 'about.html', pre: '', body });
}

function buildPrivacy() {
  const ads = `
    <section class="block">
      <h2>Advertising</h2>
      <p>The Cyber Casebook is free because it shows ads served by Google AdSense. Google and its partners use cookies and similar technologies to serve and measure ads, to limit how often you see an ad, and to prevent fraud. Google's use of advertising cookies lets it and its partners serve ads based on visits to this and other websites.</p>
      <p>You can learn how Google uses this information at <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">How Google uses information from sites or apps that use its services</a>, and you can turn off personalized advertising in <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google's Ad Settings</a> or opt out of some third-party vendors at <a href="https://www.aboutads.info/choices" target="_blank" rel="noopener">aboutads.info</a>.</p>
      <p>Visitors in the European Economic Area, the United Kingdom, and Switzerland are asked for consent before personalized ads are shown. Google limits ad personalization and sensitive ad categories for users it identifies as under 18.</p>
    </section>`;
  const body = `
  <main class="page prose">
    <h1>Privacy policy</h1>
    <p class="note">Last updated ${PRIVACY_UPDATED}</p>
    <section class="block">
      <h2>The short version</h2>
      <p>The Cyber Casebook does not have accounts, sign-ups, comments, or forms, and it does not ask you for any personal information. You can use every part of the site without telling us who you are.</p>
    </section>
    <section class="block">
      <h2>Information collected automatically</h2>
      <ul>
        <li><b>Hosting logs.</b> Like nearly every website, our web host records basic technical information when a page is requested, such as IP address, browser type, and the page visited. It is used to keep the site running and secure.</li>
        ${gaHead ? `<li><b>Analytics.</b> We use Google Analytics to count visits and see which pages and case studies are used most. It sets cookies and records information such as the pages you view, how long you stay, your general location (city level), and your device and browser type. We see only combined reports, never anything that identifies you. Learn more at <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">How Google uses information from sites that use its services</a>, or opt out with the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener">Google Analytics opt-out browser add-on</a>.</li>\n        ` : ''}<li><b>Fonts.</b> Text is displayed with Google Fonts, so your browser requests font files from Google.</li>
        <li><b>Case study data and PDFs.</b> The list of case studies is loaded from Google Apps Script, and PDFs are stored on Google Drive. Opening a PDF or the case list sends a request to Google.</li>
        <li><b>Links to news sources.</b> "Read the source" opens another website, which has its own privacy policy.</li>
      </ul>
    </section>
    ${adClient ? ads : ''}
    <section class="block">
      <h2>Students and children</h2>
      <p>This site is written for high school students (about ages 14-18) and their teachers. It is not directed to children under 13, and we do not knowingly collect personal information from anyone. If you believe a child has provided personal information through this site, contact us and we will help remove it.</p>
    </section>
    <section class="block">
      <h2>Changes and contact</h2>
      <p>If this policy changes, the new version will be posted on this page with a new date. Questions? Contact ${contactLine()}.</p>
    </section>
  </main>`;
  return shell({ title: 'Privacy policy · The Cyber Casebook', desc: 'How The Cyber Casebook handles information, cookies, and advertising.', url: 'privacy.html', pre: '', body });
}

function build404() {
  const body = `
  <main class="page prose">
    <h1>404 // Not found</h1>
    <section class="block"><p>That page isn't in the Casebook. Try the <a href="/index.html">home page</a> or the <a href="/archive.html">full archive</a>.</p></section>
  </main>`;
  return shell({ title: 'Not found · The Cyber Casebook', desc: 'Page not found.', url: '404.html', pre: '/', body });
}

/* ---------- data ---------- */
async function loadCases() {
  const url = String(cfg.dataUrl || '').trim();
  if (url) {
    try {
      const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(45000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      if (!Array.isArray(data.cases)) throw new Error('no cases in feed');
      fs.writeFileSync(path.join(ROOT, 'data/snapshot.json'), JSON.stringify(data.cases, null, 1));
      console.log(`Feed: ${data.cases.length} case studies (updated ${data.updated || 'n/a'}).`);
      return data.cases;
    } catch (e) {
      console.warn('! Could not read the live feed (' + e.message + '). Using data/snapshot.json.');
    }
  } else {
    console.warn('! config.json has no "dataUrl" yet. Using data/snapshot.json.');
  }
  return JSON.parse(read('data/snapshot.json'));
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    const a = path.join(from, f), b = path.join(to, f);
    if (fs.statSync(a).isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}

(async () => {
  const cases = normalize(await loadCases());
  cases.sort((a, b) => b.date.localeCompare(a.date) || a._i - b._i);
  const used = new Set(), pages = {};
  cases.forEach(c => {
    c.slug = slugify(c, used);
    c.page = 'case/' + c.slug + '.html';
    pages[c.sourceUrl || c.date + '|' + c.headline] = c.page;
  });

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'case'), { recursive: true });
  copyDir(path.join(ROOT, 'assets'), path.join(OUT, 'assets'));
  copyDir(path.join(ROOT, 'img'), path.join(OUT, 'img'));
  const write = (f, s) => fs.writeFileSync(path.join(OUT, f), s);

  write('index.html', buildIndex(cases, pages));
  // Wording of every AP essential knowledge statement and learning objective (lowercase words only).
  // The Apps Script reads this to fill the sheet's "AP Framework Key Terms" column.
  const fwText = ['ek', 'lo'].flatMap(k => Object.values(EKMAP[k] || {}).flatMap(o => Object.values(o))).join(' ')
    .toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  write('ap-framework.txt', ' ' + fwText + ' ');
  // School (Google) version. A problem here never stops the main site from building.
  try {
    const schoolSize = require('./school.js')({ ROOT, OUT, cfg, cases, EKMAP, json });
    console.log(`Built dist/school.html (${Math.round(schoolSize / 1024)} KB) for the Google version.`);
  } catch (e) {
    console.warn('! School version skipped: ' + e.message);
  }
  write('archive.html', buildArchive(cases));
  write('about.html', buildAbout(cases.length));
  write('privacy.html', buildPrivacy());
  write('404.html', build404());
  cases.forEach(c => write(c.page, buildCase(c, cases)));

  if (SITE) {
    const today = new Date().toISOString().slice(0, 10);
    const urls = [['', cases[0]?.date || today], ['archive.html', cases[0]?.date || today], ['about.html', today], ['privacy.html', '2026-10-01'],
      ...cases.map(c => [c.page, c.date])];
    write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.map(([u, d]) => `  <url><loc>${esc(abs(u))}</loc><lastmod>${esc(d)}</lastmod></url>`).join('\n') + '\n</urlset>\n');
  }
  write('robots.txt', `User-agent: *\nAllow: /\n${SITE ? `Sitemap: ${abs('sitemap.xml')}\n` : ''}`);
  if (adClient) write('ads.txt', `google.com, ${adClient.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);

  console.log(`Built dist/ with ${cases.length} case pages.`);
  if (!SITE) console.warn('! Set "siteUrl" in config.json so canonical links and the sitemap use your domain.');
  if (!String(cfg.contactEmail || '').trim()) console.warn('! Add "contactEmail" in config.json (shown on About and Privacy; AdSense reviewers look for it).');
  if (!adClient) console.log('  Ads are off until "adsense.client" is set in config.json.');
})().catch(e => { console.error(e); process.exit(1); });
