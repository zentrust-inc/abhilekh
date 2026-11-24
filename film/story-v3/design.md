# Aama's story · film v3 · design and storyboard

80 s · 1920×1080 · 60 fps · Nepali narration (14 lines, timings fixed by the voice) ·
EN/NE subtitles. One self-contained HTML page (`index.html`, GSAP inlined) that is seeked
frame by frame and rendered to video (`render.py`).

## 0. Rules that win over the brief

The brief asks for some things the approved design and the product rules don't allow.
Where they conflict, these win:

| Brief | Film does | Why |
| --- | --- | --- |
| Palette `#F7F4EB / #181C24 / #D95D39 / #0F766E` | Approved tokens: ivory `#f6f1e7`, navy `#0b1530`, terracotta `#c2512f`, teal `#13857a`, sand `#ece4d4`, hill blue-grey `#c4ccd9` | "No more major redesigns"; the film must match the site |
| Golden box + thread linking 6.8 to the record | **Cobalt `#2d5bff`** box and thread | Cobalt is used *only* to link a value to its place on the original paper |
| A=B rows "snap into consensus" | A=B pills only, **no ticks**. Values with a decimal point are confirmed one by one by a person ("Matches the paper") | Reading rules: decimals are never pre-ticked |
| Anti-TPO "wipes itself blank" | Field is left **empty**, then Bikash types it from the paper | Disagreement → empty, the person types |
| Sita and Bikash helping | On-screen **"Planned: helping a family member"** whenever they help | Family help is PLANNED, not built |
| Realistic lab sheet | Invented SAMPLE papers (Namuna / Udaharan names, SAMPLE stamp) | Fictional sample data only |
| Stop share | No PIN to stop; it ends at once | Reading rules |
| — | "A story · fictional family" stays on screen; the end card says "Planning stage" | Label every status honestly |

Fonts: Fraunces (titles), Inter (UI), Noto Serif Devanagari (Nepali), all embedded.

## 1. Visual system, light and depth

**Layers (2.5D parallax).** Every scene has four planes, driven by one camera
(focus point + zoom). Depth factor *d* scales how much a plane follows the camera:

- `far` (d 0.25–0.4): Himalayan ridges, Kathmandu roofline, stupa; hill blue-grey with
  atmospheric haze (ivory gradient over the lower third).
- `mid` (d 1.0): rooms, furniture and the characters (Aama, Sita, Bikash, the doctor),
  taken from the site's own illustrations so they stay the same people. Arms are
  rigged (shoulder pivot) so Aama and Sita can raise a phone.
- `near` (d 1.3–1.5): glass UI cards and phones with real 3D (`perspective: 1600px`,
  rotateX/Y), soft shadows, a 1px inner highlight.
- `air`: light shafts, dust motes (seeded, driven by time so every render is
  identical), vignette, colour grade.

**Light.** Act I: one cool dusty shaft from the window and a heavy vignette.
Act II: warm daylight (golden radial bloom, `soft-light`). Act III: warm clinic gold
grading to calm twilight indigo, then a single warm lamp. The grade is an overlay, so the
line art stays crisp.

**Motion language.** Spring-out ease `cubic-bezier(0.16, 1, 0.3, 1)` (`expo.out`-like)
for UI; `power2.inOut` for the camera; `back.out(2.2)` for badges and stamps; 60–80 ms
staggers for rows; `stroke-dashoffset` for threads, ticks and the brand mark.
Transitions are motivated camera moves (crane up, parallax slide, whip-pan, rack focus),
never cross-fades between flat pictures.

## 2. Emotional arc

- **Act I · 0:00–0:17 · worry.** Tight, low and dark: we start nose to the paper and
  pull back to find it lost in a bag under the bed. In the clinic the bag lands, the
  papers fan out and the one that matters isn't there.
- **Act II · 0:17–0:53 · clarity and care.** The frame opens to mountain daylight.
  Tactile, satisfying UI: the scan, the shutter, the two readers, a family member
  checking each value against the photo, across the distance between Pokhara and Kathmandu.
- **Act III · 0:53–1:20 · control and calm.** Confident clinic light, then twilight:
  the share is stopped and the doctor's screen goes quiet. Rest, then the mark.

## 3. Storyboard (times in seconds; narration line starts in brackets)

| # | Time | Narration | Picture and motion |
| --- | --- | --- | --- |
| 1a | 0.0–7.6 | L1 1.0 "आमाको स्वास्थ्यको सबै इतिहास…" | Macro on the slipped lab slip (T.S.H. 6.8), heavy vignette, dust in a cold shaft. Z pull-back (zoom 5→1.25) reveals the slip, the plastic bag and the bed. |
| 1b | 7.6–17.0 | L2 8.0 "नयाँ डाक्टरले…" · L3 13.0 "तर त्यो झोलामा छैन।" | Crane up into the clinic (scene slides up, motion blur). The bag drops onto the desk and settles (squash). Six papers fan out in 3D; the doctor's hand searches. At 13.0 a terracotta dashed stamp "Thyroid · 2082 — not in the bag" pops; the room dims to a spotlight. |
| 2 | 17.0–31.6 | L4 18.0 "अर्को उपाय छ।" · L5 21.0 "अस्पतालको गेटमा…" · L6 27.0 "फोटो जस्ताको तस्तै…" | Light blooms; parallax slide to the hospital gate with Annapurna ridges in haze. Sita raises her phone; a glass phone swings into the right third with a viewfinder on the report. Teal scan sweep, shutter flash, frame bounce. The photo lifts into a tilted glass card: "The photo Aama took, unchanged". |
| 3 | 31.6–42.5 | L7 32.0 "दुई रिडरले…" · L8 38.3 "धमिलो अंक…" | Push into the phone (×1.25), the world melts to bokeh. Reader A and Reader B scan down; rows 1–3 get A=B pills (80 ms stagger). Anti-TPO flickers A 12 / B 17, amber dashed border, value wipes to an empty field. Kinetic line "Nothing is guessed. · केही अड्कल गरिँदैन।" |
| 4 | 42.5–48.8 | L9 43.0 "काठमाडौंमा विकासले…" | Whip-pan across the ridgeline to Kathmandu (stupa in the window, afternoon light). Split focus: the photo with a cobalt box on 6.8, a cobalt thread draws to the record; Bikash taps "Matches the paper" (pulse). He types Anti-TPO 12 from the photo. |
| 5a | 48.8–53.7 | L10 49.0 "पोखरामा आमा…" | Pokhara clinic, Machhapuchhre in the window. Aama sits upright and raises her phone; the QR ripples; a dashed bridge arcs to the doctor's phone. |
| 5b | 53.7–60.4 | L11 53.8 "डाक्टरले कागजमा जे…" | The doctor's view glides open: values, units, printed ranges, the lab's own H flag; "What the paper says. No advice." "See the original" opens the photo; a cobalt link joins TSH to its place on the paper. |
| 5c | 60.4–66.2 | L12 60.6 "साँझ विकासले सेयर रोक्छन्…" | Grade to twilight indigo. A dark glass sheet rises: "That evening · Bikash's phone". Log rows type in; the terracotta button becomes "Share stopped" (no PIN). The doctor's screen frosts and locks: "18:20 Someone tried to open it. Nothing was shown." |
| 6a | 66.2–71.0 | L13 66.4 "कागज रहन्छ। इतिहास हिँड्छ।" | Calm wide: the old bag and Aama's reading glasses on the left, the record card standing on the right, lamp light. Slow pull-back. |
| 6b | 71.0–80.0 | L14 71.2 "अभिलेख। तपाईंको…" | Scale out to the ivory canvas. The mark draws (paper, lines, dot, tick); अभिलेख and Abhilekh rise from a mask; "Your medical history, with you." / "तपाईंको स्वास्थ्यको इतिहास, तपाईंसँगै।"; "Planning stage · abhilekh.org". |

## 4. Rendering

`index.html` exposes `window.seek(t)`; the master GSAP timeline is paused and every
moving thing (including dust) is a function of the timeline's time, so frames are
deterministic. `render.py` steps 1/60 s, screenshots JPEG (quality 92) and pipes to
ffmpeg (libx264 CRF 18) in parallel segments, joins them with the concat demuxer and adds
the narration mix (`loudnorm I=-16`).
