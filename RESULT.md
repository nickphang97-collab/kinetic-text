# kinetic-text — build result

Status: M0–M2 green; one-session scope limit reached, final wrap-up next.

## Preconditions

Run on 2026-08-13 before any implementation.

```text
$ ffmpeg -hide_banner -filters | rg '(^| )((ass)|(subtitles))( |$)'
 ... ass               V->V       Render ASS subtitles onto input video using the libass library.
 ... subtitles         V->V       Render text subtitles onto input video using the libass library.

$ bun --version
1.3.13
$ ffmpeg -version | head -1
ffmpeg version 7.0.2-static https://johnvansickle.com/ffmpeg/  Copyright (c) 2000-2024 the FFmpeg developers
$ ffprobe -version | head -1
ffprobe version 7.0.2-static https://johnvansickle.com/ffmpeg/  Copyright (c) 2007-2024 the FFmpeg developers
$ ffmpeg -version | rg -o libass | head -1
libass
$ ffmpeg -filters | rg -c drawtext
0
$ ffmpeg -filters | rg -i ' (ass|subtitles|ssim) '
 ... ass               V->V       Render ASS subtitles onto input video using the libass library.
 TS. ssim              VV->V      Calculate the SSIM between two video streams.
 ... subtitles         V->V       Render text subtitles onto input video using the libass library.
$ ffmpeg -encoders | rg ' libx264| aac '
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
 V....D libx264rgb           libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 RGB (codec h264)
 A....D aac                  AAC (Advanced Audio Coding)
$ md5sum /usr/share/fonts/truetype/lato/Lato-Black.ttf /usr/share/fonts/truetype/lato/Lato-Regular.ttf
1233fdf19c04333c7f58af4eb8698452  /usr/share/fonts/truetype/lato/Lato-Black.ttf
3b9b99039cc0a98dd50c3cbfac57ccb2  /usr/share/fonts/truetype/lato/Lato-Regular.ttf
$ fc-list : family | tr ',' '\\n' | sort -u | wc -l
264
```

All load-bearing values match the PRD. `drawtext` is absent as expected; libass `ass` is the rendering path.

## Checkpoints

### M0 — scaffold, vendored fonts, fail-loud preflight

Verifier: PASS.

```text
1233fdf19c04333c7f58af4eb8698452  assets/fonts/Lato-Black.ttf
3b9b99039cc0a98dd50c3cbfac57ccb2  assets/fonts/Lato-Regular.ttf
PASS ass filter: present
PASS ssim filter: present
INFO drawtext: absent (expected, libass path in use)
PASS libx264: present
PASS aac: present
PASS requested font: Lato Black: vendored Lato-Black.ttf md5 1233fdf19c04333c7f58af4eb8698452
EXIT=0
Impact: requested font unavailable; fontconfig substituted Noto Sans. Installing a font is the operator's call: sudo apt install fonts-league-spartan && fc-cache -f
EXIT=3
(pass) input limits > rejects relative path traversal
(pass) escaping > escapes filter parser metacharacters without touching spaces
(pass) escaping > escapes ASS override delimiters

 10 pass
 0 fail
 10 expect() calls
Ran 10 tests across 1 file. [17.00ms]
TSC_CLEAN
```

### M1 — parser and anchored-hybrid timing

The red-first verifier discriminated against always-success stubs:

```text
0 pass
20 fail
21 expect() calls
Ran 20 tests across 2 files. [30.00ms]
RED_STUB_EXIT=1
```

Final verifier: PASS. One initially incorrect test constant was corrected from `0.70s` to the PRD-derived `1.84s` (`450 + 55×29 - 200 = 1845 ms`) without changing the branch under test.

```text
(pass) parseDocument > honours escaped asterisks and brackets
(pass) parseDocument > preserves ASS-looking text literally for the emitter to escape
(pass) parseDocument > rejects broken fixture unknown-front-matter.md
(pass) parseDocument > rejects broken fixture two-emphasis.md
(pass) parseDocument > rejects broken fixture unclosed-emphasis.md
(pass) parseDocument > rejects unknown directives and reports the line
(pass) parseDocument > rejects invalid style values

 21 pass
 0 fail
 35 expect() calls
Ran 21 tests across 2 files. [54.00ms]
WROTE out/demo.vertical.ass
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes
Style: Kin,Lato Black,96,&H00FFFFFF&,&H66FFFFFF&,&H00101010&,&H80000000,0,0,0,0,100,100,0,0,1,6,0,5,80,80,160,1
Dialogue: 0,0:00:00.40,0:00:02.23,Kin,,,,,{\\an5\\pos(540,883)\\fad(120,120)}You don't need permission
TSC_CLEAN
```

### M2 — four styles, emphasis emitter, and minimal MP4 render path

The requested Fable seat was unavailable. A fresh independent same-family reviewer received the PRD’s exact Q1/Q2/Q3 prompts before implementation. It recommended narrow positioning as a deterministic local renderer for prewritten text, centred-only layouts for v0.1, fixed left/right ASS anchors only as an evidence-driven v2 option, and anchored-hybrid timing for coarse line/section sync rather than lyrics. These conclusions are reflected in `README.md`.

The known M2/M3 drift was corrected by implementing the minimum silent MP4 render path needed by the M2 verifier. The full audio/temp lifecycle remains M3/V2.

Final verifier: PASS. All test pipelines ran with `set -o pipefail` (the final combined runs used `set -euo pipefail`).

```text
(pass) M2 rendered-frame assertions > word-pop has deterministic vertical container properties
(pass) M2 rendered-frame assertions > slide-karaoke has deterministic vertical container properties
(pass) M2 rendered-frame assertions > typewriter has deterministic vertical container properties
(pass) M2 rendered-frame assertions > stack-build has deterministic vertical container properties
(pass) M2 rendered-frame assertions > word-pop mid-animation is smaller than settled and stays centred
(pass) M2 rendered-frame assertions > typewriter reveal increases visible ink without centroid drift
(pass) M2 rendered-frame assertions > karaoke and stack-build produce visible centred text

 44 pass
 0 fail
 92 expect() calls
Ran 44 tests across 5 files. [16.45s]
TSC_CLEAN

word-pop:       1080 / 1920 / yuv420p / 30/1 / 54 frames
slide-karaoke:  1080 / 1920 / yuv420p / 30/1 / 90 frames
typewriter:     1080 / 1920 / yuv420p / 30/1 / 90 frames
stack-build:    1080 / 1920 / yuv420p / 30/1 / 148 frames
[Parsed_ssim_4] SSIM Y:0.947778 U:0.954241 V:0.959507 All:0.950810
--audio: deferred to V2; this v0.1 build refuses to ignore it
AUDIO_DEFER_EXIT=2
```

The SSIM comparison is cropped to the 1080×400 text band and explicitly converted to `yuv420p`, because PNG-to-PNG SSIM otherwise reports RGB channels rather than `SSIM Y` on this FFmpeg build. `0.947778` is safely below the `< 0.985` animation-difference discriminator.

Visual frame review performed in-session:

- `word-pop`: 45 ms is visibly smaller/fainter than 600 ms; both remain centred.
- `slide-karaoke`: the 600 ms frame shows a genuine partial fill inside the first word, confirming `\kf` works; no `\k` fallback was needed.
- `typewriter`: the prefix reveal and settled line are stable; emphasis remains orange.
- `stack-build`: four stages remain horizontally centred; older lines shift upward and dim without sideways drift.

Four committed sample MP4s exist in `samples/`; eight committed frame receipts exist in `captures/m2/`.

## Shipped

Pending.

## Deferred to V2

Pending.

## Needs-you

Pending final human gates.
