import { CommandError, runCommand } from "../src/spawn";

export interface FrameMetrics {
  readonly dimensions: readonly [number, number];
  readonly inkRatio: number;
  readonly centroid: readonly [number, number];
}

async function runBinary(argv: readonly string[], timeoutMs: number): Promise<Uint8Array> {
  const proc = Bun.spawn([...argv], { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeoutMs);
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).arrayBuffer(),
    new Response(proc.stderr).text(),
  ]).finally(() => clearTimeout(timer));
  if (timedOut) throw new CommandError(`${argv[0] ?? "command"} timed out after ${timeoutMs}ms`);
  if (exitCode !== 0) throw new CommandError(`${argv[0] ?? "command"} exited ${exitCode}: ${stderr.trim()}`);
  return new Uint8Array(stdout);
}

function rgb(hex: string): readonly [number, number, number] {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Invalid background colour ${hex}`);
  return [Number.parseInt(match[1] ?? "00", 16), Number.parseInt(match[2] ?? "00", 16), Number.parseInt(match[3] ?? "00", 16)];
}

function luma(red: number, green: number, blue: number): number {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export async function frameMetrics(video: string, timestamp: number, width: number, height: number, background: string): Promise<FrameMetrics> {
  const pixels = await runBinary([
    "ffmpeg", "-nostdin", "-loglevel", "error", "-ss", timestamp.toFixed(3), "-i", video,
    "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
  ], 20_000);
  const expected = width * height * 3;
  if (pixels.byteLength !== expected) throw new Error(`${video}: decoded ${pixels.byteLength} bytes, expected ${expected}`);
  const [bgRed, bgGreen, bgBlue] = rgb(background);
  const backgroundLuma = luma(bgRed, bgGreen, bgBlue);
  let inkPixels = 0;
  let weight = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (let offset = 0; offset < pixels.length; offset += 3) {
    const red = pixels[offset] ?? 0;
    const green = pixels[offset + 1] ?? 0;
    const blue = pixels[offset + 2] ?? 0;
    const delta = Math.abs(luma(red, green, blue) - backgroundLuma);
    if (delta <= 24) continue;
    const pixel = offset / 3;
    inkPixels += 1;
    weight += delta;
    weightedX += (pixel % width) * delta;
    weightedY += Math.floor(pixel / width) * delta;
  }
  const centroid: readonly [number, number] = weight === 0 ? [0.5, 0.5] : [weightedX / weight / width, weightedY / weight / height];
  return { dimensions: [width, height], inkRatio: inkPixels / (width * height), centroid };
}

export async function extractPng(video: string, timestamp: number, output: string): Promise<void> {
  const result = await runCommand(["ffmpeg", "-nostdin", "-loglevel", "error", "-ss", timestamp.toFixed(3), "-i", video, "-frames:v", "1", "-y", output], 20_000);
  if (result.exitCode !== 0) throw new CommandError(`frame extraction failed: ${result.stderr.trim()}`);
}

export async function bandSsim(first: string, second: string, crop: string): Promise<number> {
  const graph = `[0:v]crop=${crop},format=yuv420p[a];[1:v]crop=${crop},format=yuv420p[b];[a][b]ssim`;
  const result = await runCommand(["ffmpeg", "-nostdin", "-i", first, "-i", second, "-lavfi", graph, "-f", "null", "-"], 20_000);
  const match = /SSIM Y:([0-9.]+)/.exec(result.stderr);
  if (result.exitCode !== 0 || !match?.[1]) throw new CommandError(`SSIM failed: ${result.stderr.trim()}`);
  return Number(match[1]);
}
