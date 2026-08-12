import { join } from "node:path";
import { emitAss } from "./ass/emit";
import { escapeFilterValue } from "./limits";
import { getFontDirectory } from "./preflight";
import { CommandError, runCommand } from "./spawn";
import { THEMES } from "./themes";
import type { PresetName } from "./themes";
import type { Timeline } from "./timing";

export interface RenderedFile {
  readonly assPath: string;
  readonly videoPath?: string;
}

export async function writeAss(timeline: Timeline, preset: PresetName, outputPath: string, stem: string): Promise<string> {
  const assPath = join(outputPath, `${stem}.${preset}.ass`);
  await Bun.write(assPath, emitAss(timeline, preset));
  return assPath;
}

export async function renderPreset(timeline: Timeline, preset: PresetName, outputPath: string, stem: string): Promise<RenderedFile> {
  const assPath = await writeAss(timeline, preset, outputPath, stem);
  const assName = `${stem}.${preset}.ass`;
  const videoName = `${stem}.${preset}.mp4`;
  const firstTheme = timeline.blocks[0]?.settings.theme;
  if (!firstTheme) throw new Error("Cannot render an empty timeline");
  const dimensions = preset === "vertical" ? "1080x1920" : "1920x1080";
  const duration = (timeline.durationMs / 1000).toFixed(3);
  const filter = `ass=${escapeFilterValue(assName)}:fontsdir=${escapeFilterValue(getFontDirectory())}`;
  const result = await runCommand([
    "ffmpeg", "-nostdin", "-y", "-loglevel", "error",
    "-f", "lavfi", "-i", `color=c=${THEMES[firstTheme].bg}:s=${dimensions}:r=30`,
    "-t", duration,
    "-vf", filter,
    "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p",
    videoName,
  ], 120_000, outputPath);
  if (result.exitCode !== 0) {
    throw new CommandError(`ffmpeg exited ${result.exitCode} while rendering ${videoName}: ${result.stderr.trim()}`);
  }
  return { assPath, videoPath: join(outputPath, videoName) };
}
