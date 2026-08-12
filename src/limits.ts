import { isAbsolute, relative, resolve } from "node:path";

export const LIMITS = {
  scriptBytes: 256 * 1024,
  lines: 2000,
  lineCharacters: 400,
  blocks: 200,
  audioBytes: 200 * 1024 * 1024,
  durationSeconds: 300,
  diskBytes: 2 * 1024 * 1024 * 1024,
} as const;

export class InputError extends Error {
  readonly exitCode = 2;
}

export function assertScriptLimits(text: string, source: string): void {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > LIMITS.scriptBytes) {
    throw new InputError(`${source}: ${bytes} bytes exceeds the ${LIMITS.scriptBytes}-byte script limit`);
  }
  const lines = text.split(/\r?\n/);
  if (lines.length > LIMITS.lines) {
    throw new InputError(`${source}: ${lines.length} lines exceeds the ${LIMITS.lines}-line limit`);
  }
  for (const [index, line] of lines.entries()) {
    if ([...line].length > LIMITS.lineCharacters) {
      throw new InputError(`${source}:${index + 1}: ${[...line].length} characters exceeds the ${LIMITS.lineCharacters}-character line limit`);
    }
  }
  const meaningful = lines.map((line) => line.trim()).filter((line) => !line.startsWith("#") && !line.startsWith("::"));
  let blocks = 0;
  let insideBlock = false;
  for (const line of meaningful) {
    if (line === "") {
      insideBlock = false;
    } else if (!insideBlock && line !== "---" && !/^(style|theme|font|wpm):/.test(line)) {
      blocks += 1;
      insideBlock = true;
    }
  }
  if (blocks > LIMITS.blocks) {
    throw new InputError(`${source}: ${blocks} blocks exceeds the ${LIMITS.blocks}-block limit`);
  }
}

export function resolveUserPath(input: string, cwd: string): string {
  if (!isAbsolute(input) && input.split(/[\\/]/).includes("..")) {
    throw new InputError(`${input}: relative path escape with '..' is not allowed`);
  }
  const resolved = resolve(cwd, input);
  if (!isAbsolute(input)) {
    const rel = relative(cwd, resolved);
    if (rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
      throw new InputError(`${input}: resolved path escapes ${cwd}`);
    }
  }
  return resolved;
}

export function escapeAssText(text: string): string {
  return text.replaceAll("\\", "\\\\").replaceAll("{", "\\{").replaceAll("}", "\\}");
}

export function escapeFilterValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("'", "\\'");
}

export function assertDuration(seconds: number, source: string): void {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > LIMITS.durationSeconds) {
    throw new InputError(`${source}: duration ${seconds}s exceeds the ${LIMITS.durationSeconds}s limit`);
  }
}

export function assertAudioSize(bytes: number, source: string): void {
  if (bytes > LIMITS.audioBytes) throw new InputError(`${source}: ${bytes} bytes exceeds the ${LIMITS.audioBytes}-byte audio limit`);
}

export function assertDiskProjection(currentBytes: number, projectedBytes: number): void {
  if (currentBytes + projectedBytes > LIMITS.diskBytes) {
    throw new InputError(`projected output ${currentBytes + projectedBytes} bytes exceeds the ${LIMITS.diskBytes}-byte disk limit`);
  }
}
