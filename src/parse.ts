import type { StyleName, ThemeName } from "./themes";
import { InputError, assertScriptLimits } from "./limits";
import { STYLE_NAMES, THEME_NAMES } from "./themes";

export interface TextSegment {
  readonly text: string;
  readonly emphasis: boolean;
}

export interface ParsedAnchor {
  readonly startMs: number;
  readonly endMs?: number;
}

export interface BlockSettings {
  readonly style: StyleName;
  readonly theme: ThemeName;
  readonly font: string;
}

export interface ParsedLine {
  readonly sourceLine: number;
  readonly text: string;
  readonly segments: readonly TextSegment[];
  readonly anchor?: ParsedAnchor;
}

export interface ParsedBlock {
  readonly settings: BlockSettings;
  readonly lines: readonly ParsedLine[];
}

export interface ParsedDocument {
  readonly source: string;
  readonly wpm: number;
  readonly blocks: readonly ParsedBlock[];
}

export interface ParseDefaults {
  readonly style?: StyleName;
  readonly theme?: ThemeName;
  readonly font?: string;
  readonly wpm?: number;
}

function isStyleName(value: string): value is StyleName {
  return STYLE_NAMES.some((name) => name === value);
}

function isThemeName(value: string): value is ThemeName {
  return THEME_NAMES.some((name) => name === value);
}

function parseTimestamp(value: string, source: string, sourceLine: number): number {
  const match = /^(\d{2}):(\d{2})\.(\d{2})$/.exec(value);
  if (!match) throw new InputError(`${source}:${sourceLine}: invalid timestamp '${value}'`);
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const centiseconds = Number(match[3]);
  if (seconds >= 60) throw new InputError(`${source}:${sourceLine}: timestamp seconds must be below 60`);
  return ((minutes * 60 + seconds) * 1000) + centiseconds * 10;
}

function parseSegments(value: string, source: string, sourceLine: number): readonly TextSegment[] {
  const segments: TextSegment[] = [];
  let buffer = "";
  let emphasis = false;
  let completedEmphasis = false;

  const push = (): void => {
    if (buffer !== "") segments.push({ text: buffer, emphasis });
    buffer = "";
  };

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];
    if (character === "\\" && (next === "*" || next === "[")) {
      buffer += next;
      index += 1;
      continue;
    }
    if (character !== "*") {
      buffer += character;
      continue;
    }
    if (!emphasis && completedEmphasis) {
      throw new InputError(`${source}:${sourceLine}: at most one emphasis span is allowed per line`);
    }
    push();
    emphasis = !emphasis;
    if (!emphasis) completedEmphasis = true;
  }
  if (emphasis) throw new InputError(`${source}:${sourceLine}: unclosed emphasis span`);
  push();
  if (segments.some((segment) => segment.emphasis && segment.text === "")) {
    throw new InputError(`${source}:${sourceLine}: empty emphasis span`);
  }
  return segments;
}

function parseContentLine(raw: string, source: string, sourceLine: number): ParsedLine {
  const anchorMatch = /^\[(\d{2}:\d{2}\.\d{2})(?:-(\d{2}:\d{2}\.\d{2}))?\]\s*/.exec(raw);
  const body = anchorMatch ? raw.slice(anchorMatch[0].length) : raw;
  const segments = parseSegments(body, source, sourceLine);
  const text = segments.map((segment) => segment.text).join("");
  if (text.trim() === "") throw new InputError(`${source}:${sourceLine}: caption line is empty`);
  if (!anchorMatch) return { sourceLine, text, segments };
  const startValue = anchorMatch[1];
  if (!startValue) throw new InputError(`${source}:${sourceLine}: invalid start anchor`);
  const startMs = parseTimestamp(startValue, source, sourceLine);
  const endValue = anchorMatch[2];
  if (!endValue) return { sourceLine, text, segments, anchor: { startMs } };
  const endMs = parseTimestamp(endValue, source, sourceLine);
  if (endMs <= startMs) throw new InputError(`${source}:${sourceLine}: anchor end must be after its start`);
  return { sourceLine, text, segments, anchor: { startMs, endMs } };
}

export function parseDocument(text: string, source: string, defaults: ParseDefaults = {}): ParsedDocument {
  assertScriptLimits(text, source);
  const lines = text.split(/\r?\n/);
  let style: StyleName = defaults.style ?? "word-pop";
  let theme: ThemeName = defaults.theme ?? "midnight";
  let font = defaults.font ?? "Lato Black";
  let wpm = defaults.wpm ?? 150;
  if (font === "") throw new InputError(`${source}: font cannot be empty`);
  if (!Number.isFinite(wpm) || wpm <= 0) throw new InputError(`${source}: wpm must be a positive number`);
  let cursor = 0;

  if (lines[0] === "---") {
    cursor = 1;
    let closed = false;
    for (; cursor < lines.length; cursor += 1) {
      const raw = lines[cursor] ?? "";
      if (raw === "---") {
        closed = true;
        cursor += 1;
        break;
      }
      const separator = raw.indexOf(":");
      if (separator <= 0) throw new InputError(`${source}:${cursor + 1}: invalid front-matter entry`);
      const key = raw.slice(0, separator).trim();
      const value = raw.slice(separator + 1).trim();
      if (!new Set(["style", "theme", "font", "wpm"]).has(key)) {
        throw new InputError(`${source}:${cursor + 1}: unknown front-matter key '${key}'`);
      }
      if (key === "style") {
        if (!isStyleName(value)) throw new InputError(`${source}:${cursor + 1}: unknown style '${value}'`);
        style = value;
      } else if (key === "theme") {
        if (!isThemeName(value)) throw new InputError(`${source}:${cursor + 1}: unknown theme '${value}'`);
        theme = value;
      } else if (key === "font") {
        if (value === "") throw new InputError(`${source}:${cursor + 1}: font cannot be empty`);
        font = value;
      } else {
        wpm = Number(value);
        if (!Number.isFinite(wpm) || wpm <= 0) throw new InputError(`${source}:${cursor + 1}: wpm must be a positive number`);
      }
    }
    if (!closed) throw new InputError(`${source}:1: unclosed front matter`);
  }

  const blocks: ParsedBlock[] = [];
  let currentLines: ParsedLine[] = [];
  let currentSettings: BlockSettings | undefined;
  const flush = (): void => {
    if (currentLines.length > 0 && currentSettings) blocks.push({ settings: currentSettings, lines: currentLines });
    currentLines = [];
    currentSettings = undefined;
  };

  for (; cursor < lines.length; cursor += 1) {
    const raw = lines[cursor] ?? "";
    const sourceLine = cursor + 1;
    if (raw.startsWith("#")) continue;
    if (raw.trim() === "") {
      flush();
      continue;
    }
    if (raw.startsWith("::")) {
      flush();
      const directive = /^::\s*([^:]+):\s*(.*?)\s*$/.exec(raw);
      if (!directive) throw new InputError(`${source}:${sourceLine}: invalid directive`);
      const key = directive[1]?.trim() ?? "";
      const value = directive[2]?.trim() ?? "";
      if (!new Set(["style", "theme", "font"]).has(key)) {
        throw new InputError(`${source}:${sourceLine}: unknown directive '${key}'`);
      }
      if (key === "style") {
        if (!isStyleName(value)) throw new InputError(`${source}:${sourceLine}: unknown style '${value}'`);
        style = value;
      } else if (key === "theme") {
        if (!isThemeName(value)) throw new InputError(`${source}:${sourceLine}: unknown theme '${value}'`);
        theme = value;
      } else {
        if (value === "") throw new InputError(`${source}:${sourceLine}: font cannot be empty`);
        font = value;
      }
      continue;
    }
    if (!currentSettings) currentSettings = { style, theme, font };
    currentLines.push(parseContentLine(raw, source, sourceLine));
  }
  flush();
  if (blocks.length === 0) throw new InputError(`${source}: no caption lines found`);
  return { source, wpm, blocks };
}
