# Aama's story · film v3 (cinematic, 80 s, 1080p60)

Start with `design.md` (visual system, emotional arc, storyboard and where the brief
was adjusted to the product rules).

- `src.html`: layout, styles and the GSAP master timeline.
- `build.py`: makes `index.html` (self-contained: the site's characters and props,
  embedded fonts, GSAP inlined). `python3 build.py path/to/gsap.min.js`
- `index.html`: open it in a browser to watch (loops, no sound), or add `?render` to
  seek it from code: `FILM.seek(t)`.
- `render.py`: `python3 render.py out.mp4 2` renders 4800 frames at 60 fps.
- Sound: the narration mix from `../story/README.md` (same clip times), padded to 80 s.
  Subtitles: `../story/story-en.vtt`, `story-ne.vtt` (same timings).

The 1080p60 master is in Drive › Kakani-3 › Abhilekh › Film
(`abhilekh-story-v3-1080p60.mp4`), not in this repository.
Every paper shown is an invented sample; family help is labelled PLANNED on screen.
