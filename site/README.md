# abhilekh.org public page

A cinematic one-page site: the HyperFrames hero film (film/hero) loops behind the promise, the opening statement
lights up word by word as you scroll, and the four steps (photograph, read, confirm, share) are full-screen chapters
with small animations. Planning-stage wording; the doctor-view example is labelled ILLUSTRATION · SAMPLE with
invented values; the film is labelled as an animation.

- No outside requests, no cookies, no tracking. Fonts (Fraunces, Inter, Noto Serif Devanagari; all SIL OFL) and
  the film are served from this folder. `motion.js` only reveals sections on scroll and pauses the film off screen.
- Reduced motion (the visitor's setting): no autoplay, the poster shows, everything is visible without animation.
- `_headers`: strict Content-Security-Policy (only this site's own script, styles, fonts, images and media), no
  framing, no referrer; long cache for fonts and media.

## Hosting (Cloudflare Pages, free plan)

Direct Upload of this folder, project `abhilekh`; custom domains `abhilekh.org` and `www.abhilekh.org` (www
redirects to the root). `app.abhilekh.org` stays on Azure. Total size about 2.9 MB, the film 0.6–1.3 MB.

## Film encodes

    ffmpeg -i hero.mp4 -an -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart media/hero-1080-v3.mp4
    ffmpeg -i hero.mp4 -an -vf scale=1280:-2 -c:v libx264 -preset slow -crf 25 -pix_fmt yuv420p -movflags +faststart media/hero-720-v3.mp4
    ffmpeg -i hero.mp4 -an -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 media/hero-1080-v3.webm
    ffmpeg -ss 6.6 -i hero.mp4 -frames:v 1 -vf scale=1600:-2 -q:v 4 media/poster-v3.jpg

## Email protection (separate yes needed)

Until email is wanted: no MX record, plus `TXT abhilekh.org "v=spf1 -all"` and
`TXT _dmarc.abhilekh.org "v=DMARC1; p=reject"`.

When the film changes, give the files a new version suffix (-v4 …) and update index.html: media is cached for 7 days.
