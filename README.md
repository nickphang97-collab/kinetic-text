# kinetic-text

`kinetic-text` is a deterministic local renderer for short, prewritten text assets. It turns a small Markdown-adjacent script into a silent MP4 using Bun, FFmpeg, libass, and an in-repo Lato font. It is deliberately narrower than a general video editor or automatic captioning app.

There are no API keys, uploads, watermarks, render-time downloads, or font-install dependencies. This FFmpeg build has no `drawtext`; the CLI uses the `ass` filter because it preserves the animation tags and is verified by `kinetic-text probe`.

## Quick start

```bash
bun install --offline
bun run src/cli.ts probe
bun run src/cli.ts render tests/fixtures/demo.md --preset vertical,horizontal --out out
```

The renderer keeps the generated `.ass` next to each `.mp4` for inspection. The default output is 1080×1920 at 30 fps; `horizontal` is 1920×1080 at 30 fps. Both use H.264, CRF 18, and `yuv420p`.

## Input

```markdown
---
style: word-pop
theme: midnight
font: Lato Black
wpm: 150
---

[00:00.40] You don't need *permission*
to start.

:: style: slide-karaoke

[00:04.00] Build the thing
*today*
```

Blank lines separate blocks. A line beginning with `#` is a comment. Directives change `style`, `theme`, or `font` from that point forward. Anchors use `[mm:ss.cc]` or `[mm:ss.cc-mm:ss.cc]`. One `*emphasis*` span is allowed per line; `\*` and `\[` escape literal markers. Unknown keys, impossible timing, unclosed emphasis, and overlapping anchors fail with exit 2 instead of silently changing the render.

## Four styles

- `word-pop`: one fixed-position event per word; scale and alpha overshoot without horizontal reflow. [Sample MP4](samples/word-pop.vertical.mp4)
- `slide-karaoke`: one dim line with a progressive libass `\kf` sweep. A real mid-word frame confirmed partial fill on this box, so the `\k` fallback was not needed. [Sample MP4](samples/slide-karaoke.vertical.mp4)
- `typewriter`: the full line is laid out once while characters reveal left to right and the leading character cools from accent to primary. [Sample MP4](samples/typewriter.vertical.mp4)
- `stack-build`: new lines rise into a centred stack while older lines move up, shrink, and dim. [Sample MP4](samples/stack-build.vertical.mp4)

The committed frame receipts are in [`captures/m2/`](captures/m2/). Tests decode rendered frames to RGB, assert deterministic container properties, measure ink and luma-weighted centroids with tolerance, and compare the word-pop animation over the cropped text band with SSIM. No pixel hashes are used.

Themes are `midnight`, `paper`, and `neon`. The shipped font files are `Lato Black` and `Lato Regular`, redistributed with their OFL-1.1 copyright file under `assets/fonts/`. `probe` checks their pinned MD5 values before rendering.

## CLI

```text
kinetic-text render <script.md> [options]
kinetic-text probe [--font <family>]

--style word-pop|slide-karaoke|typewriter|stack-build
--preset vertical|horizontal|vertical,horizontal
--theme midnight|paper|neon
--font <family>
--wpm <positive number>
--tail <seconds>
--out <directory>
--ass-only
--allow-font-substitution
```

Exit 0 means success. Exit 2 is an input or timing error. Exit 3 is a missing tool, filter, encoder, or requested font. Exit 4 is a failed or timed-out FFmpeg/ffprobe process. The v0.1 CLI rejects `--audio` and `--seed` loudly because those M3 features are deferred rather than pretending to apply them.

## When to use this instead of CapCut—and when not to

Use this when the source already exists as text and the job benefits from batching, reproducibility, version control, no upload, no watermark, or being called by another local tool. Wording revisions re-render from the same source without hand-moving keyframes.

Use CapCut, Captions.ai, InShot, or another editor when the source is speech that needs ASR, when words must follow delivery or music precisely, when the composition needs per-clip art direction, or when you want to nudge elements by hand. Centred-only layouts are enough for this narrow v0.1 caption renderer, but they are not a substitute for designed kinetic typography. Fixed left/right ASS anchors are a possible v2 extension; arbitrary placement and font measurement are not part of this tool.

Anchored-hybrid timing is intended for coarse line or section sync. It is not forced lyric alignment.

## Review provenance

The requested Fable seat was unavailable in the Codex build environment. Before M2 implementation, a fresh independent same-family reviewer received the PRD’s three exact structural questions. Its verdict was to ship only under the narrow “deterministic local renderer for prewritten text assets” positioning above, retain centred-only layouts and anchored-hybrid timing for v0.1, and defer fixed left/right anchors and forced-aligned lyrics to separate evidence-driven work.
