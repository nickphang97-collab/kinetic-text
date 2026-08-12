import { join } from "node:path";
import { runCommand } from "./spawn";

const FONT_MD5 = {
  "Lato Black": ["Lato-Black.ttf", "1233fdf19c04333c7f58af4eb8698452"],
  "Lato Regular": ["Lato-Regular.ttf", "3b9b99039cc0a98dd50c3cbfac57ccb2"],
} as const;

export class EnvironmentError extends Error {
  readonly exitCode = 3;
}

function fontDirectory(): string {
  return join(import.meta.dir, "..", "assets", "fonts");
}

async function md5(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("md5");
  hasher.update(await Bun.file(path).arrayBuffer());
  return hasher.digest("hex");
}

async function requireCommand(argv: readonly string[], label: string, matcher: (combined: string) => boolean): Promise<string> {
  const result = await runCommand(argv, 10_000);
  const combined = `${result.stdout}\n${result.stderr}`;
  if (result.exitCode !== 0 || !matcher(combined)) throw new EnvironmentError(`${label}: missing or incompatible`);
  return combined;
}

export async function checkFont(requested: string, allowSubstitution = false): Promise<string> {
  for (const [family, [filename, expected]] of Object.entries(FONT_MD5)) {
    if (family.toLowerCase() !== requested.toLowerCase()) continue;
    const actual = await md5(join(fontDirectory(), filename));
    if (actual !== expected) throw new EnvironmentError(`${filename}: md5 ${actual}, expected ${expected}`);
    return `${family}: vendored ${filename} md5 ${actual}`;
  }
  const matched = await runCommand(["fc-match", "-f", "%{family}", requested], 10_000);
  if (matched.exitCode !== 0) throw new EnvironmentError(`${requested}: fc-match failed`);
  const families = matched.stdout.split(",").map((family) => family.trim()).filter(Boolean);
  if (families.some((family) => family.toLowerCase() === requested.toLowerCase())) {
    return `${requested}: fontconfig matched ${families.join(", ")}`;
  }
  const substituted = families.join(", ") || "unknown";
  if (allowSubstitution) return `WARNING: ${requested}: substituted by ${substituted}`;
  throw new EnvironmentError(`${requested}: requested font unavailable; fontconfig substituted ${substituted}. Installing a font is the operator's call: sudo apt install fonts-league-spartan && fc-cache -f`);
}

export async function runPreflight(requestedFont = "Lato Black", allowSubstitution = false): Promise<readonly string[]> {
  const lines: string[] = [];
  const ffmpeg = await requireCommand(["ffmpeg", "-version"], "ffmpeg", (value) => value.includes("ffmpeg version"));
  lines.push(`PASS ffmpeg: ${ffmpeg.split("\n")[0] ?? "present"}`);
  const filters = await requireCommand(["ffmpeg", "-filters"], "ffmpeg filters", (value) => /\bass\s+V->V/.test(value) && /\bssim\s+VV->V/.test(value));
  lines.push("PASS ass filter: present");
  lines.push("PASS ssim filter: present");
  lines.push(filters.includes("drawtext") ? "INFO drawtext: present" : "INFO drawtext: absent (expected, libass path in use)");
  const encoders = await requireCommand(["ffmpeg", "-encoders"], "ffmpeg encoders", (value) => value.includes("libx264") && /\baac\b/.test(value));
  lines.push(encoders.includes("libx264") ? "PASS libx264: present" : "FAIL libx264: absent");
  lines.push(/\baac\b/.test(encoders) ? "PASS aac: present" : "FAIL aac: absent");
  const ffprobe = await requireCommand(["ffprobe", "-version"], "ffprobe", (value) => value.includes("ffprobe version"));
  lines.push(`PASS ffprobe: ${ffprobe.split("\n")[0] ?? "present"}`);
  for (const [family, [filename, expected]] of Object.entries(FONT_MD5)) {
    const actual = await md5(join(fontDirectory(), filename));
    if (actual !== expected) throw new EnvironmentError(`${family}: md5 ${actual}, expected ${expected}`);
    lines.push(`PASS ${family}: ${filename} md5 ${actual}`);
  }
  lines.push(`PASS requested font: ${await checkFont(requestedFont, allowSubstitution)}`);
  return lines;
}

export function getFontDirectory(): string {
  return fontDirectory();
}
