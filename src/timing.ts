import type { ParsedDocument, ParsedLine } from "./parse";
import { InputError, assertDuration } from "./limits";

export const TIMING = {
  baseMs: 450,
  perCharAt150Ms: 55,
  minLineMs: 900,
  maxLineMs: 4000,
  floorLineMs: 350,
  minWordMs: 120,
  leadInMs: 300,
  gapKeepMs: 400,
  tailMs: 600,
} as const;

export interface TimedWord {
  readonly text: string;
  readonly emphasis: boolean;
  readonly startMs: number;
  readonly endMs: number;
}

export interface TimedLine extends ParsedLine {
  readonly startMs: number;
  readonly endMs: number;
  readonly words: readonly TimedWord[];
}

export interface TimedBlock {
  readonly settings: ParsedDocument["blocks"][number]["settings"];
  readonly lines: readonly TimedLine[];
}

export interface Timeline {
  readonly source: string;
  readonly blocks: readonly TimedBlock[];
  readonly durationMs: number;
}

interface WorkingLine {
  readonly line: ParsedLine;
  readonly blockIndex: number;
  readonly naturalMs: number;
  startMs?: number;
  endMs?: number;
}

function naturalDuration(line: ParsedLine, wpm: number): number {
  const visibleCharacters = Math.max(1, [...line.text].length);
  const raw = TIMING.baseMs + TIMING.perCharAt150Ms * (150 / wpm) * visibleCharacters;
  return Math.round(Math.min(TIMING.maxLineMs, Math.max(TIMING.minLineMs, raw)));
}

function seconds(milliseconds: number): string {
  return (milliseconds / 1000).toFixed(2);
}

function requireLine(entry: WorkingLine | undefined): WorkingLine {
  if (!entry) throw new Error("Internal timing index escaped the document");
  return entry;
}

function setRun(entries: WorkingLine[], startIndex: number, endIndex: number, startMs: number, durations: readonly number[]): void {
  let cursor = startMs;
  for (let index = startIndex; index < endIndex; index += 1) {
    const entry = requireLine(entries[index]);
    const duration = durations[index - startIndex];
    if (duration === undefined) throw new Error("Internal timing duration is missing");
    entry.startMs = cursor;
    entry.endMs = cursor + duration;
    cursor += duration;
  }
}

function distributeRun(entries: WorkingLine[], startIndex: number, endIndex: number, startMs: number, availableMs: number, source: string): void {
  const run = entries.slice(startIndex, endIndex);
  if (run.length === 0) return;
  const naturalTotal = run.reduce((sum, entry) => sum + entry.naturalMs, 0);
  let durations = run.map((entry) => entry.naturalMs);
  if (naturalTotal > availableMs) {
    const scale = availableMs / naturalTotal;
    const scaled = durations.map((duration) => duration * scale);
    if (scaled.some((duration) => duration < TIMING.floorLineMs)) {
      throw new InputError(`${source}: ${run.length} lines are crammed into ${seconds(availableMs)}s; at least one would fall below ${seconds(TIMING.floorLineMs)}s`);
    }
    durations = scaled.map((duration) => Math.round(duration));
    const drift = availableMs - durations.reduce((sum, duration) => sum + duration, 0);
    const last = durations.length - 1;
    const lastDuration = durations[last];
    if (lastDuration !== undefined) durations[last] = lastDuration + drift;
  } else if (availableMs - naturalTotal <= TIMING.gapKeepMs) {
    const scale = availableMs / naturalTotal;
    durations = durations.map((duration) => Math.round(duration * scale));
    const drift = availableMs - durations.reduce((sum, duration) => sum + duration, 0);
    const last = durations.length - 1;
    const lastDuration = durations[last];
    if (lastDuration !== undefined) durations[last] = lastDuration + drift;
  }
  setRun(entries, startIndex, endIndex, startMs, durations);
}

interface WordToken {
  readonly text: string;
  readonly emphasis: boolean;
  readonly characters: number;
}

function wordTokens(line: ParsedLine): readonly WordToken[] {
  const emphasisRanges: Array<{ start: number; end: number }> = [];
  let segmentStart = 0;
  for (const segment of line.segments) {
    const segmentEnd = segmentStart + segment.text.length;
    if (segment.emphasis) emphasisRanges.push({ start: segmentStart, end: segmentEnd });
    segmentStart = segmentEnd;
  }
  const tokens: WordToken[] = [];
  for (const match of line.text.matchAll(/\S+/g)) {
    const text = match[0];
    const start = match.index;
    const end = start + text.length;
    tokens.push({
      text,
      emphasis: emphasisRanges.some((range) => range.start < end && range.end > start),
      characters: Math.max(1, [...text].length),
    });
  }
  return tokens;
}

function allocateWordDurations(tokens: readonly WordToken[], durationMs: number): readonly number[] {
  if (tokens.length === 0) return [];
  const target = Math.max(durationMs, tokens.length * TIMING.minWordMs);
  const durations = new Array<number>(tokens.length).fill(0);
  let remaining = tokens.map((_, index) => index);
  let remainingMs = target;
  let remainingWeight = tokens.reduce((sum, token) => sum + token.characters, 0);

  while (remaining.length > 0) {
    const floored = remaining.find((index) => {
      const token = tokens[index];
      return token ? (remainingMs * token.characters) / remainingWeight < TIMING.minWordMs : false;
    });
    if (floored === undefined) break;
    durations[floored] = TIMING.minWordMs;
    remainingMs -= TIMING.minWordMs;
    remainingWeight -= tokens[floored]?.characters ?? 0;
    remaining = remaining.filter((index) => index !== floored);
  }

  for (const [position, index] of remaining.entries()) {
    const token = tokens[index];
    if (!token) continue;
    const isLast = position === remaining.length - 1;
    const assigned = isLast ? remainingMs : Math.round((remainingMs * token.characters) / remainingWeight);
    durations[index] = assigned;
    remainingMs -= assigned;
    remainingWeight -= token.characters;
  }
  return durations;
}

function resolveAbsoluteLines(document: ParsedDocument): WorkingLine[] {
  const entries: WorkingLine[] = [];
  for (const [blockIndex, block] of document.blocks.entries()) {
    for (const line of block.lines) entries.push({ line, blockIndex, naturalMs: naturalDuration(line, document.wpm) });
  }
  const anchors = entries.map((entry, index) => entry.line.anchor ? index : -1).filter((index) => index >= 0);
  if (anchors.length === 0) {
    setRun(entries, 0, entries.length, TIMING.leadInMs, entries.map((entry) => entry.naturalMs));
    return entries;
  }

  const firstAnchorIndex = anchors[0];
  if (firstAnchorIndex === undefined) throw new Error("Internal anchor list is empty");
  const firstAnchor = requireLine(entries[firstAnchorIndex]);
  const firstStart = firstAnchor.line.anchor?.startMs;
  if (firstStart === undefined) throw new Error("Internal anchor is missing its start");
  const leadingDuration = entries.slice(0, firstAnchorIndex).reduce((sum, entry) => sum + entry.naturalMs, 0);
  const leadingStart = firstStart - leadingDuration;
  if (leadingStart < 0) {
    throw new InputError(`${document.source}:${firstAnchor.line.sourceLine}: leading run would start before zero; move the first anchor later by ${seconds(-leadingStart)}s`);
  }
  setRun(entries, 0, firstAnchorIndex, leadingStart, entries.slice(0, firstAnchorIndex).map((entry) => entry.naturalMs));

  for (const [anchorPosition, anchorIndex] of anchors.entries()) {
    const anchored = requireLine(entries[anchorIndex]);
    const anchor = anchored.line.anchor;
    if (!anchor) throw new Error("Internal anchor is missing");
    anchored.startMs = anchor.startMs;
    anchored.endMs = anchor.endMs ?? anchor.startMs + anchored.naturalMs;
    const nextAnchorIndex = anchors[anchorPosition + 1];
    if (nextAnchorIndex === undefined) {
      const trailing = entries.slice(anchorIndex + 1).map((entry) => entry.naturalMs);
      setRun(entries, anchorIndex + 1, entries.length, anchored.endMs, trailing);
      continue;
    }
    const nextAnchored = requireLine(entries[nextAnchorIndex]);
    const nextStart = nextAnchored.line.anchor?.startMs;
    if (nextStart === undefined) throw new Error("Internal next anchor is missing its start");
    const available = nextStart - anchored.endMs;
    if (available <= 0) {
      throw new InputError(`${document.source}:${anchored.line.sourceLine} and ${nextAnchored.line.sourceLine} overlap by ${seconds(-available)}s`);
    }
    distributeRun(entries, anchorIndex + 1, nextAnchorIndex, anchored.endMs, available, document.source);
  }
  return entries;
}

export function resolveTiming(document: ParsedDocument, tailSeconds = 0.6): Timeline {
  if (!Number.isFinite(tailSeconds) || tailSeconds < 0) throw new InputError(`${document.source}: tail must be a non-negative number`);
  const entries = resolveAbsoluteLines(document);

  for (let index = 0; index < entries.length; index += 1) {
    const entry = requireLine(entries[index]);
    const startMs = entry.startMs;
    const endMs = entry.endMs;
    if (startMs === undefined || endMs === undefined) throw new Error("Internal line timing is unresolved");
    const required = wordTokens(entry.line).length * TIMING.minWordMs;
    const extension = required - (endMs - startMs);
    if (extension <= 0) continue;
    entry.endMs = endMs + extension;
    for (let followerIndex = index + 1; followerIndex < entries.length; followerIndex += 1) {
      const follower = requireLine(entries[followerIndex]);
      const followerStart = follower.startMs;
      const followerEnd = follower.endMs;
      if (followerStart === undefined || followerEnd === undefined) throw new Error("Internal follower timing is unresolved");
      if (follower.line.anchor) {
        const previous = requireLine(entries[followerIndex - 1]);
        const previousEnd = previous.endMs;
        if (previousEnd === undefined) throw new Error("Internal previous timing is unresolved");
        if (previousEnd > followerStart) {
          throw new InputError(`${document.source}:${previous.line.sourceLine} and ${follower.line.sourceLine} overlap by ${seconds(previousEnd - followerStart)}s after MIN_WORD flooring`);
        }
        break;
      }
      follower.startMs = followerStart + extension;
      follower.endMs = followerEnd + extension;
    }
  }

  const timedByBlock: TimedLine[][] = document.blocks.map(() => []);
  for (const entry of entries) {
    const startMs = entry.startMs;
    const endMs = entry.endMs;
    if (startMs === undefined || endMs === undefined) throw new Error("Internal line timing is unresolved");
    const tokens = wordTokens(entry.line);
    const durations = allocateWordDurations(tokens, endMs - startMs);
    let wordStart = startMs;
    const words: TimedWord[] = tokens.map((token, index) => {
      const duration = durations[index] ?? 0;
      const word: TimedWord = { text: token.text, emphasis: token.emphasis, startMs: wordStart, endMs: wordStart + duration };
      wordStart += duration;
      return word;
    });
    const target = timedByBlock[entry.blockIndex];
    if (!target) throw new Error("Internal block index escaped the document");
    target.push({ ...entry.line, startMs, endMs: Math.max(endMs, wordStart), words });
  }

  const blocks: TimedBlock[] = document.blocks.map((block, index) => ({ settings: block.settings, lines: timedByBlock[index] ?? [] }));
  const lastLine = blocks.at(-1)?.lines.at(-1);
  if (!lastLine) throw new InputError(`${document.source}: no timed caption lines found`);
  const durationMs = lastLine.endMs + Math.round(tailSeconds * 1000);
  assertDuration(durationMs / 1000, document.source);
  return { source: document.source, blocks, durationMs };
}
