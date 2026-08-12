#!/usr/bin/env bun
import { EnvironmentError, runPreflight } from "./preflight";
import { CommandError } from "./spawn";
import { InputError } from "./limits";

function valueAfter(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

async function main(args: readonly string[]): Promise<void> {
  const [command] = args;
  if (command !== "probe") throw new InputError("Usage: kinetic-text probe [--font <family>] [--allow-font-substitution]");
  const font = valueAfter(args, "--font") ?? "Lato Black";
  const lines = await runPreflight(font, args.includes("--allow-font-substitution"));
  for (const line of lines) console.log(line);
}

try {
  await main(Bun.argv.slice(2));
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  if (error instanceof InputError || error instanceof EnvironmentError || error instanceof CommandError) process.exit(error.exitCode);
  process.exit(1);
}
