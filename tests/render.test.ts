import { beforeAll, describe, expect, test } from "bun:test";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseDocument } from "../src/parse";
import { renderPreset } from "../src/render";
import { runCommand } from "../src/spawn";
import { resolveTiming } from "../src/timing";
import { bandSsim, extractPng, frameMetrics } from "./frame";

const names = ["word-pop", "slide-karaoke", "typewriter", "stack-build"] as const;
const fixtures = join(import.meta.dir, "fixtures");
const output = join(import.meta.dir, "..", "out", "render-test");
const captures = join(import.meta.dir, "..", "captures", "m2");
const durations = new Map<string, number>();

beforeAll(async () => {
  await mkdir(output, { recursive: true });
  await mkdir(captures, { recursive: true });
  for (const name of names) {
    const source = await readFile(join(fixtures, `${name}.md`), "utf8");
    const timeline = resolveTiming(parseDocument(source, `${name}.md`));
    durations.set(name, timeline.durationMs);
    await renderPreset(timeline, "vertical", output, name);
  }
}, 30_000);

function video(name: string): string {
  return join(output, `${name}.vertical.mp4`);
}

async function probe(name: string): Promise<ReadonlyMap<string, string>> {
  const result = await runCommand([
    "ffprobe", "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height,r_frame_rate,pix_fmt,nb_frames", "-of", "default=nw=1", video(name),
  ], 10_000);
  if (result.exitCode !== 0) throw new Error(result.stderr);
  return new Map(result.stdout.trim().split("\n").map((line) => {
    const separator = line.indexOf("=");
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}

describe("M2 rendered-frame assertions", () => {
  for (const name of names) {
    test(`${name} has deterministic vertical container properties`, async () => {
      const values = await probe(name);
      expect(values.get("width")).toBe("1080");
      expect(values.get("height")).toBe("1920");
      expect(values.get("r_frame_rate")).toBe("30/1");
      expect(values.get("pix_fmt")).toBe("yuv420p");
      expect(Number(values.get("nb_frames"))).toBe(Math.round((durations.get(name) ?? 0) / 1000 * 30));
    });
  }

  test("word-pop mid-animation is smaller than settled and stays centred", async () => {
    const mid = await frameMetrics(video("word-pop"), 0.045, 1080, 1920, "#101820");
    const settled = await frameMetrics(video("word-pop"), 0.600, 1080, 1920, "#101820");
    expect(mid.inkRatio).toBeLessThan(settled.inkRatio);
    expect(Math.abs(mid.centroid[0] - 0.5)).toBeLessThan(0.03);
    expect(Math.abs(settled.centroid[0] - 0.5)).toBeLessThan(0.03);
    expect(Math.abs(settled.centroid[1] - 0.46)).toBeLessThan(0.03);
    const midPng = join(captures, "word-pop-0.045.png");
    const settledPng = join(captures, "word-pop-0.600.png");
    await extractPng(video("word-pop"), 0.045, midPng);
    await extractPng(video("word-pop"), 0.600, settledPng);
    expect(await bandSsim(midPng, settledPng, "1080:400:0:760")).toBeLessThan(0.985);
  });

  test("typewriter reveal increases visible ink without centroid drift", async () => {
    const mid = await frameMetrics(video("typewriter"), 0.500, 1080, 1920, "#101820");
    const settled = await frameMetrics(video("typewriter"), 2.000, 1080, 1920, "#101820");
    expect(settled.inkRatio).toBeGreaterThan(mid.inkRatio * 1.3);
    expect(Math.abs(settled.centroid[0] - 0.468)).toBeLessThan(0.03);
  });

  test("karaoke and stack-build produce visible centred text", async () => {
    const karaoke = await frameMetrics(video("slide-karaoke"), 0.600, 1080, 1920, "#101820");
    const stack = await frameMetrics(video("stack-build"), 3.600, 1080, 1920, "#101820");
    expect(karaoke.inkRatio).toBeGreaterThan(0.001);
    expect(stack.inkRatio).toBeGreaterThan(0.001);
    expect(Math.abs(karaoke.centroid[0] - 0.468)).toBeLessThan(0.03);
    expect(Math.abs(stack.centroid[0] - 0.5)).toBeLessThan(0.03);
  });
});
