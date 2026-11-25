# Hero film (HyperFrames source)

The 14-second silent loop behind the abhilekh.org headline: in warm daylight over Himalayan ridges, papers rise out of a plastic bag, straighten, are read
(a light passes) and checked, fly into a phone, and the phone shows a QR code for abhilekh.org; then fades to warm light so
the loop is seamless. An animation of shapes only: no real people, no footage, no real records.

Made with HyperFrames 0.9.77 (open source, HTML rendered to video). Everything is local: GSAP and the font are in
`assets/`, the QR code is a real code for https://abhilekh.org.

    cd film/hero
    npx hyperframes@0.9.77 check
    npx hyperframes@0.9.77 render --output hero.mp4

The current site (`site-next/`) no longer uses this loop; the hero is the film v4 poster. The old `site/` folder, which
held the web encodes (H.264 1080p CRF 24 and 720p CRF 25, VP9 1080p CRF 36, poster at 6.6 s) and the exact ffmpeg
lines in its README, was removed on 25 Nov 2026; both are in the git history before that change.
