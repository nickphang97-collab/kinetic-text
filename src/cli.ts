#!/usr/bin/env bun
import { basename, extname } from "node:path";
import { mkdir } from "node:fs/promises";
import { EnvironmentError, runPreflight } from "./preflight";
import { CommandError } from "./spawn";
import { InputError, resolveUserPath } from "./limits";
import { parseDocument } from "./parse";
import { resolveTiming } from "./timing";
import { PRESET_NAMES, STYLE_NAMES, THEME_NAMES } from "./themes";
import type { PresetName, StyleName, ThemeName } from "./themes";
import { renderPreset, writeAss } from "./render";

function valueAfter(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new InputError(`${flag}: a value is required`);
  return value;
}

function validateRenderArguments(args: readonly string[]): void {
  const valued = new Set(["--style", "--preset", "--theme", "--font", "--wpm", "--tail", "--out"]);
  const boolean = new Set(["--ass-only", "--allow-font-substitution"]);
  const seen = new Set<string>();
  for (let index = 2; index < args.length; index += 1) {
    const flag = args[index];
    if (!flag) continue;
    if (flag === "--audio" || flag === "--seed") throw new InputError(`${flag}: deferred to V2; this v0.1 build refuses to ignore it`);
    if (!valued.has(flag) && !boolean.has(flag)) throw new InputError(`render: unknown option '${flag}'`);
    if (seen.has(flag)) throw new InputError(`render: duplicate option '${flag}'`);
    seen.add(flag);
    if (boolean.has(flag)) continue;
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new InputError(`${flag}: a value is required`);
    index += 1;
  }
}

async function main(args: readonly string[]): Promise<void> {
  const [command] = args;
  if (command === "probe") {
    const font = valueAfter(args, "--font") ?? "Lato Black";
    const lines = await runPreflight(font, args.includes("--allow-font-substitution"));
    for (const line of lines) console.log(line);
    return;
  }
  if (command !== "render") throw new InputError("Usage: kinetic-text render <script.md> [options] | kinetic-text probe");
  const scriptArgument = args[1];
  if (!scriptArgument || scriptArgument.startsWith("--")) throw new InputError("render: a script path is required");
  validateRenderArguments(args);
  const cwd = process.cwd();
  const scriptPath = resolveUserPath(scriptArgument, cwd);
  const outputPath = resolveUserPath(valueAfter(args, "--out") ?? "out", cwd);
  const presetValues = (valueAfter(args, "--preset") ?? "vertical").split(",");
  const presets: PresetName[] = [];
  for (const value of presetValues) {
    if (!PRESET_NAMES.some((name) => name === value)) throw new InputError(`${scriptArgument}: unknown preset '${value}'`);
    if (value === "vertical" || value === "horizontal") presets.push(value);
  }
  const styleValue = valueAfter(args, "--style");
  let style: StyleName | undefined;
  if (styleValue) {
    if (!STYLE_NAMES.some((name) => name === styleValue)) throw new InputError(`${scriptArgument}: unknown style '${styleValue}'`);
    if (styleValue === "word-pop" || styleValue === "slide-karaoke" || styleValue === "typewriter" || styleValue === "stack-build") style = styleValue;
  }
  const themeValue = valueAfter(args, "--theme");
  let theme: ThemeName | undefined;
  if (themeValue) {
    if (!THEME_NAMES.some((name) => name === themeValue)) throw new InputError(`${scriptArgument}: unknown theme '${themeValue}'`);
    if (themeValue === "midnight" || themeValue === "paper" || themeValue === "neon") theme = themeValue;
  }
  const wpmValue = valueAfter(args, "--wpm");
  const wpm = wpmValue === undefined ? undefined : Number(wpmValue);
  if (wpm !== undefined && (!Number.isFinite(wpm) || wpm <= 0)) throw new InputError(`${scriptArgument}: --wpm must be a positive number`);
  const fontValue = valueAfter(args, "--font");
  const sourceText = await Bun.file(scriptPath).text();
  const document = parseDocument(sourceText, scriptArgument, { style, theme, font: fontValue, wpm });
  const timeline = resolveTiming(document, Number(valueAfter(args, "--tail") ?? "0.6"));
  const fonts = new Set(document.blocks.map((block) => block.settings.font));
  for (const font of fonts) await runPreflight(font, args.includes("--allow-font-substitution"));
  await mkdir(outputPath, { recursive: true });
  const stem = basename(scriptPath, extname(scriptPath));
  for (const preset of presets) {
    if (args.includes("--ass-only")) {
      console.log(`WROTE ${await writeAss(timeline, preset, outputPath, stem)}`);
    } else {
      const rendered = await renderPreset(timeline, preset, outputPath, stem);
      console.log(`WROTE ${rendered.assPath}`);
      console.log(`WROTE ${rendered.videoPath ?? ""}`);
    }
  }
}

try {
  await main(Bun.argv.slice(2));
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  if (error instanceof InputError || error instanceof EnvironmentError || error instanceof CommandError) process.exit(error.exitCode);
  process.exit(1);
}
