# kinetic-text — build result

Status: preconditions green; implementation not started.

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

No milestone checkpoints yet.

## Shipped

Pending.

## Deferred to V2

Pending.

## Needs-you

Pending final human gates.
