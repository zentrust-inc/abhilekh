# Hero film (HyperFrames source)

The 14-second silent loop behind the abhilekh.org headline: papers rise out of a plastic bag, straighten, are read
(a light passes) and checked, fly into a phone, and the phone shows a QR code for abhilekh.org; then back to dark so
the loop is seamless. An animation of shapes only: no real people, no footage, no real records.

Made with HyperFrames 0.9.77 (open source, HTML rendered to video). Everything is local: GSAP and the font are in
`assets/`, the QR code is a real code for https://abhilekh.org.

    cd film/hero
    npx hyperframes@0.9.77 check
    npx hyperframes@0.9.77 render --output hero.mp4

Web encodes (into site/media/): H.264 1080p CRF 24 and 720p CRF 25 (faststart, no audio), VP9 1080p CRF 36, and a
poster frame at 6.6 s. See site/README.md for the exact ffmpeg lines.
