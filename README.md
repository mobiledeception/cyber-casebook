# The Cyber Casebook — website

This folder builds the whole site. Run `node generate.js` (Node 18+, nothing to install) and the finished site appears in `dist/`:

| Page | What it is |
|---|---|
| `index.html` | Home page (Just In, EK browser, search, results) — loads live data from the sheet |
| `case/<date>-<headline>.html` | One page per case study: synopsis, key terms, full EK statements, related cases |
| `archive.html` | Every case study, newest first |
| `about.html`, `privacy.html` | Required for AdSense approval |
| `sitemap.xml`, `robots.txt`, `ads.txt` | For Google Search and AdSense (sitemap/ads.txt appear once `siteUrl` / `adsense.client` are set) |

All settings live in **config.json**:

```json
{
  "siteUrl": "https://yourdomain.com",
  "dataUrl": "https://script.google.com/macros/s/.../exec",
  "contactEmail": "you@yourdomain.com",
  "adsense": { "client": "ca-pub-XXXXXXXXXXXXXXXX",
               "slots": { "home": "", "results": "", "case": "", "archive": "" } }
}
```

Ads stay off until `adsense.client` is filled in. With only `client` set, Google Auto ads can place ads; adding slot IDs also shows the labeled ad boxes (below Just In, under search results, under each case's buttons, and in the archive). Ads are never placed beside the Download PDF / Read the Source buttons.

---

## 1. Host it (free) — Cloudflare Pages with automatic rebuilds

1. Create a free GitHub account and a new **private** repository. Upload everything in this folder (not `dist/`).
2. In Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**, pick the repository.
   - Build command: `node generate.js`
   - Build output directory: `dist`
3. After the first deploy: **Settings → Builds → Deploy hooks → Add** (name it "daily"). Copy the hook URL.
4. In the Case Study Log sheet: **Extensions → Apps Script**, paste **CaseStudyLog_v11.gs**, put the hook URL in `DEPLOY_HOOK_URL`, save, run `setupTrigger`, then **Deploy → Manage deployments → Edit → New version**.

Now every time new case studies land in the sheet, the site rebuilds itself with the new pages. (The sheet menu also has **Case Study Log → Rebuild website now**.)

*No GitHub?* Upload the `dist` folder with Cloudflare Pages "Direct upload" or Netlify Drop. The home page still shows new cases live, but the case pages and archive only update when you rebuild and re-upload.

## 2. Custom domain

Buy a domain (about $10–15/year — Cloudflare Registrar sells at cost). In the Pages project: **Custom domains → Set up a domain**. Then set `siteUrl` in config.json.

## 3. AdSense

1. Fill in `contactEmail` and `siteUrl`, let the site build, and wait until it has a couple of weeks of case studies.
2. Apply at adsense.google.com with your domain. Copy your publisher ID (`ca-pub-…`) into `adsense.client` — this adds the verification code to every page and creates `ads.txt`.
3. In AdSense → **Privacy & messaging**, turn on the European regulations (GDPR) consent message.
4. After approval: **Ads → By ad unit → Display ads**, create units named home / results / case / archive, and paste each slot ID into `adsense.slots`.

Rules that keep the account safe: never ask visitors to click ads, and never click your own ads.

## 4. Google Search

Add the domain in Google Search Console and submit `https://yourdomain.com/sitemap.xml`.
