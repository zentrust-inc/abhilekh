# site-next · website v3 (PRD v3.0, 24 Nov 2026)

Rebuild of abhilekh.org on the recovered redesign-2026 pages, per the Website PRD v3.0
(https://claude.ai/artifact/46XjXEeDf6sZifWhh1qbkG).

Changes in v3:
- Nepali first (`data-lang="ne"`), English switch remembered on the device; `#en` opens English.
- Film v4 "Aama's story" (YouTube mw13BK-zZ8M) in the hero, behind our own poster
  `media/film-v4-poster.jpg` (export of the Canva thumbnail; until it is added, the bag illustration shows).
  Nothing loads from YouTube until play is tapped; the player is youtube-nocookie.com.
- `_headers`: CSP adds only `frame-src https://www.youtube-nocookie.com`; Referrer-Policy is
  strict-origin-when-cross-origin because the YouTube player refuses to play with no referrer.
- Content brought in line with PRD v2.1: 15-minute shares, watermark, no download;
  "Unresolved. Original document available."; read-aloud, show-the-doctor and printed QR summary (planned);
  offline photos; SHA-256 export; homepage story follows film script v4 (Aama and Sita).
- Old films and hero clips removed; fonts moved out of the stylesheet into `fonts/`.
- Film transcript (18 lines, NE/EN) as a fold-out under the hero.

Still to do: poster file, Nepali review by a native speaker, For Families sharing-defaults card,
real-phone test on 3G.

Planning stage: every paper shown is a fictional SAMPLE.
