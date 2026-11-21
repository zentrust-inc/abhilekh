# abhilekh.org public page

One self-contained page (`index.html`): no scripts, no cookies, no tracking, no outside requests. Planning-stage
wording; the doctor-view example is labelled ILLUSTRATION · SAMPLE with invented values.

## Hosting plan (not live until Dr. Shrestha says go)

- Cloudflare Pages, free plan, **Direct Upload** of this folder (no build step), project name `abhilekh`.
- Custom domains: `abhilekh.org` (root) and `www.abhilekh.org`; a Cloudflare redirect rule sends `www` to the root.
- `app.abhilekh.org` stays pointed at the Azure app (DNS only); this page does not touch it.
- `_headers` sets strict security headers; the Content-Security-Policy allows only the page's own inline styles.

## Email protection (separate yes needed)

Until email is wanted: no MX record, plus `TXT abhilekh.org "v=spf1 -all"` and
`TXT _dmarc.abhilekh.org "v=DMARC1; p=reject"`, so nobody can send mail as @abhilekh.org.
