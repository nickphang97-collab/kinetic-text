#!/usr/bin/env bun
import { basename, extname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import { EnvironmentError, runPreflight } from "./preflight";
import { CommandError } from "./spawn";
import { InputError, resolveUserPath } from "./limits";
import { parseDocument } from "./parse";
import { resolveTiming } from "./timing";
import { emitAss } from "./ass/emit";
import { PRESET_NAMES } from "./themes";
import type { PresetName } from "./themes";

function valueAfter(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
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
  if (!args.includes("--ass-only")) throw new InputError("render: MP4 rendering is introduced in M2; pass --ass-only");
  const cwd = process.cwd();
  const scriptPath = resolveUserPath(scriptArgument, cwd);
  const outputPath = resolveUserPath(valueAfter(args, "--out") ?? "out", cwd);
  const presetValues = (valueAfter(args, "--preset") ?? "vertical").split(",");
  const presets: PresetName[] = [];
  for (const value of presetValues) {
    if (!PRESET_NAMES.some((name) => name === value)) throw new InputError(`${scriptArgument}: unknown preset '${value}'`);
    if (value === "vertical" || value === "horizontal") presets.push(value);
  }
  const sourceText = await Bun.file(scriptPath).text();
  const document = parseDocument(sourceText, scriptArgument);
  const timeline = resolveTiming(document, Number(valueAfter(args, "--tail") ?? "0.6"));
  const font = valueAfter(args, "--font") ?? document.blocks[0]?.settings.font ?? "Lato Black";
  await runPreflight(font, args.includes("--allow-font-substitution"));
  await mkdir(outputPath, { recursive: true });
  const stem = basename(scriptPath, extname(scriptPath));
  for (const preset of presets) {
    const assPath = join(outputPath, `${stem}.${preset}.ass`);
    await Bun.write(assPath, emitAss(timeline, preset));
    console.log(`WROTE ${assPath}`);
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
