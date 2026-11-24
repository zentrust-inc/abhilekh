# Aama's story film (draft 2, rebuilt 23 Nov 2026)

79 seconds, Nepali narration, EN/NE subtitles. Public on YouTube:
https://youtu.be/hb7j5QOxR7Q (channel @abhilekhhealth).

The earlier film template (`film/story-75`, GSAP rendered by Playwright) was never
pushed and was lost. This is a rebuild: camera moves over the site's own
illustrations (scenes 1, 2, 3, 4, 5, 7, 8 from `site-next/`), cut to the narration.

## Files

- `stills.py`: renders each scene SVG from `site-next/` at 4x into `stills/`
  (the scene's own "A story · fictional family" label is hidden; the film adds its own).
- `ov.html`, `ov.py`: the overlays ("A story · fictional family", "Planned: helping a
  family member", and the end card) as PNGs in `ov/`.
- `render.py`: one mp4 per shot into `shots/`. The shot list, times and camera
  keyframes are at the top.
- `story-ne.vtt`, `story-en.vtt`: subtitles, timed to the narration.

## Rebuild

```
python3 stills.py && python3 ov.py && python3 render.py
for s in A B C D E F G H I J K; do echo "file 'shots/$s.mp4'"; done > list.txt
ffmpeg -f concat -safe 0 -i list.txt -c copy video.mp4
```

Narration: ElevenLabs voice "Abhilekh narrator" (mzFMlMbq25M3MlYd09uZ, eleven_v4),
files `abhilekh-ne-01.mp3` … `-14.mp3` (line 8: `-08a`) in Drive › Kakani-3 › Abhilekh ›
Film › Narration. Each clip starts at:
1.0, 8.0, 13.0, 18.0, 21.0, 27.0, 32.0, 38.3, 43.0, 49.0, 53.8, 60.6, 66.4, 71.2 s.
Mixed with `adelay` + `amix`, then `loudnorm I=-16`. No music yet (the bansuri motif
is still to come).

Encodes on the site: `site-next/media/story-480-v2.mp4`, `story-720-v2.mp4`,
`story-poster-v2.jpg`, `story-en.vtt`, `story-ne.vtt`. The 1080p master lives in
Drive › Film (`abhilekh-story-ne-1080.mp4`), not in this repository.

## YouTube metadata

Title: Abhilekh: Aama's story in 80 seconds · अभिलेख: आमाको कथा
Language: Nepali. Not made for kids. No paid promotion. AI-use question: No (no
realistic people, places or events); the description says the voice is AI-generated.
Chapters: 0:00 The plastic bag · 0:17 Photographing the paper · 0:31 Two readers,
nothing guessed · 0:42 Checking against the photo · 0:53 The doctor, then the share
is stopped · 1:06 The paper stays. The history moves.

Every paper shown is an invented sample. Family help is PLANNED, labelled on screen.
