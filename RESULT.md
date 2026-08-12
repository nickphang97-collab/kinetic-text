# kinetic-text — build result

Status: M0 and M1 green; structural style/render milestone next.

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

## Shipped

Pending.

## Deferred to V2

Pending.

## Needs-you

Pending final human gates.
