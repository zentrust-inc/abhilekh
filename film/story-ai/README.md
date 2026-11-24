# Aama's story — AI-animated cut (80 s, 1080p30)

Planning stage. A story with a fictional family; every paper shown is an invented sample.

- Picture: ten short clips made with Canva AI ("Create a video clip", start frame = a still
  generated from the character sheets). Clips are kept in Drive › Kakani-3 › Abhilekh › Film › AI shots
  (not in git). `shots.json` holds the shot prompts.
- UI layer: the v3 film (`../story-v3/index.html?render&overlay`) rendered with only its interface
  layers on transparency — `python3 ovrender.py overlay.mov 4 0 71`.
- `base.sh` retimes the clips onto the narration timeline (minterpolate for the two long holds),
  softens the clip under the reader and doctor screens, and dissolves into the v3 end card at 71 s.
- Final: `base.mp4` + `overlay.mov` + `narration80.wav` (same timeline and subtitles as v3).

Timeline: A 0–7.6 bag · B 7.6–13 clinic · C 13–17 search · D 17–21 gate · E 21–31.6 photo ·
(reader UI over soft E 31.6–42.5) · G 42.5–48.8 Bikash · H 48.8–53.7 QR · I 53.7–60.4 doctor reads ·
J 60.4–66.2 share stopped · K 66.2–71 tea · end card 71–80.

Output: Drive › Film › abhilekh-story-ai-1080.mp4; YouTube https://youtu.be/wrpaTRnYT50 (Private).
