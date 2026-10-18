# InsideInvoice SEO Audit and Handoff

Date: 2026-10-18

## Audit findings

- The frontend is a React 19/Vite 7 client-rendered SPA using React Router. The
  initial HTML previously contained an empty `#root`, a generic title, and a
  bundled source SVG favicon reference.
- `/sitemap.xml` did not exist. Netlify and Nginx SPA fallback rules therefore
  returned `index.html` with HTTP 200 for that URL, which explains Google's
  “Sitemap is HTML” error.
- `/favicon.ico` did not exist in the deployed static output. The SPA fallback
  returned HTML for the favicon request, which explains the generic Google icon.
- The site had no route-aware description, canonical, Open Graph, Twitter, or
  JSON-LD implementation.
- The canonical production domain used for the public SEO surface is now
  `https://www.insideinvoice.com`; the bare `.com`, `.in`, and Netlify
  subdomains are configured to redirect there in the frontend deployment
  configuration.

The Spring Boot backend was audited but intentionally left untouched, including
its existing configuration and secrets, per the project instruction.

## Implemented in the frontend

- Added a real XML sitemap containing only the 12 verified public, indexable
  routes: `public/sitemap.xml`.
- Replaced the crawler policy with a focused `public/robots.txt` that references
  the canonical sitemap, leaves rendering assets crawlable, blocks application
  and API paths, and does not treat robots.txt as access control.
- Added branded `favicon.ico`, 16px/32px/48px PNG icons, an SVG icon, a 180px
  Apple touch icon, and a 1200x630 social preview image.
- Wired icon, manifest, canonical, description, Open Graph, and Twitter tags in
  `index.html`.
- Added route-aware metadata in `src/components/SeoHead.jsx`, including
  noindex handling for authentication, application, placeholder video, and
  token-share routes.
- Added homepage `Organization`, `WebSite`, and `SoftwareApplication` JSON-LD
  using only verified brand/product information.
- Added the noindex route shell and post-build metadata generation in
  `scripts/prerender-seo.mjs`; the build now creates static metadata shells for
  public routes and noindex shells for non-public routes.
- Added explicit static-host handling for sitemap, robots, favicon, and token
  share resources in `netlify.toml`, `public/_redirects`, and `nginx.conf`.
- Improved the homepage H1 to clearly describe GST invoicing and billing for
  India, and aligned the QR generator's default URL with the canonical host.

## Verification completed

- `npm run lint` — passed.
- `npm run build` — passed, including the SEO shell generation step.
- Sitemap XML parsed successfully with the Sitemap namespace; 12 absolute,
  unique canonical URLs were validated and private routes were absent.
- Favicon assets validated: ICO contains 16/32/48 entries, PNG is 48x48, Apple
  icon is 180x180, and social image is 1200x630.
- Netlify TOML parsed successfully.
- A local static-server smoke test returned HTTP 200 and correct content types
  for HTML, sitemap XML, robots text, favicon ICO/PNG, and OG image. Public
  route shells expose their unique metadata; `/login/` and `/i/` expose
  `noindex,nofollow,noarchive`.
- The backend working tree contains only its pre-existing
  `InvoiceEmailTemplate.java` change; no backend file was changed for SEO.

## Deployment and Search Console handoff

The live `www` site was checked before deployment on 2026-10-18. At that time,
`https://www.insideinvoice.com/sitemap.xml` and
`https://www.insideinvoice.com/favicon.ico` both returned the SPA HTML shell, so
the production fix is **not yet verified**.
Deploy the frontend from this project using the existing authorized Netlify or
Docker workflow, then verify:

```bash
curl -I https://www.insideinvoice.com/sitemap.xml
curl -I https://www.insideinvoice.com/robots.txt
curl -I https://www.insideinvoice.com/favicon.ico
curl -I https://www.insideinvoice.com/favicon-48.png
```

The sitemap must be HTTP 200 with XML content and the favicon must be an image,
not HTML. After deployment in Google Search Console:

1. Confirm the Domain property for `insideinvoice.com` is verified.
2. Submit `https://www.insideinvoice.com/sitemap.xml`.
3. Use URL Inspection for `/`, `/gst-calculator`, and `/documentation`.
4. Request indexing for the homepage and important updated public pages.
5. Recheck sitemap processing, selected canonical URLs, and crawl errors.
6. Recheck the favicon after Google recrawls the homepage; Google controls the
   refresh timing and it cannot be claimed before independent confirmation.

The public pages remain client-rendered for their visible body content. The
build now provides route-specific initial metadata, while Google may still need
to render JavaScript to see the full page body. A future SSR/SSG migration is a
larger architectural option, not required for this static metadata fix.
