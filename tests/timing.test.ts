import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "../src/parse";
import { TIMING, resolveTiming } from "../src/timing";

const fixtures = join(import.meta.dir, "fixtures");
const readFixture = (name: string): string => readFileSync(join(fixtures, name), "utf8");

function flatten(name: string) {
  return resolveTiming(parseDocument(readFixture(name), name)).blocks.flatMap((block) => block.lines);
}

describe("anchored-hybrid timing", () => {
  test("starts an anchorless document at LEAD_IN and uses natural durations", () => {
    const timeline = resolveTiming(parseDocument("Hi.\nLonger line.", "plain.md"));
    const lines = timeline.blocks[0]?.lines;
    expect(lines?.[0]?.startMs).toBe(TIMING.leadInMs);
    expect(lines?.[0]?.endMs).toBe(1200);
    expect(lines?.[1]?.startMs).toBe(1200);
  });

  test("uses explicit starts and ends verbatim", () => {
    const line = flatten("word-pop.md")[0];
    expect([line?.startMs, line?.endMs]).toEqual([400, 2400]);
  });

  test("packs a leading run backwards and rejects a negative start", () => {
    expect(() => flatten("leading-before-zero.md")).toThrow("move the first anchor later by 1.84s");
  });

  test("reports overlapping anchors with both source lines and seconds", () => {
    expect(() => flatten("overlapping-anchors.md")).toThrow("overlapping-anchors.md:1 and 3 overlap by 0.40s");
  });

  test("rejects a compressed run below FLOOR_LINE", () => {
    expect(() => flatten("over-compressed.md")).toThrow("3 lines are crammed into 0.60s");
  });

  test("compresses a between-anchor run proportionally", () => {
    const document = parseDocument("[00:00.00-00:01.00] A\none two three four five six\nshort\n[00:03.00] B", "compress.md");
    const lines = resolveTiming(document).blocks[0]?.lines;
    expect(lines?.[1]?.startMs).toBe(1000);
    expect(lines?.[2]?.endMs).toBe(3000);
    expect((lines?.[1]?.endMs ?? 0) - (lines?.[1]?.startMs ?? 0)).toBeGreaterThan((lines?.[2]?.endMs ?? 0) - (lines?.[2]?.startMs ?? 0));
  });

  test("leaves a deliberate blank gap when spare time exceeds GAP_KEEP", () => {
    const document = parseDocument("[00:00.00-00:01.00] A\nshort\n[00:05.00] B", "gap.md");
    const lines = resolveTiming(document).blocks[0]?.lines;
    expect(lines?.[1]?.endMs).toBe(1900);
    expect(lines?.[2]?.startMs).toBe(5000);
  });

  test("absorbs a small leftover into the run", () => {
    const document = parseDocument("[00:00.00-00:01.00] A\nshort\n[00:02.10] B", "absorb.md");
    const lines = resolveTiming(document).blocks[0]?.lines;
    expect(lines?.[1]?.endMs).toBe(2100);
  });

  test("applies MIN_WORD while preserving line duration when possible", () => {
    const line = resolveTiming(parseDocument("a encyclopedia z", "words.md")).blocks[0]?.lines[0];
    expect((line?.words[0]?.endMs ?? 0) - (line?.words[0]?.startMs ?? 0)).toBe(TIMING.minWordMs);
    expect(line?.words.at(-1)?.endMs).toBe(line?.endMs);
  });

  test("extends for many floored words but fails on the next anchor collision", () => {
    const text = "[00:00.00-00:00.90] a b c d e f g h\n[00:00.95] next";
    expect(() => resolveTiming(parseDocument(text, "word-floor.md"))).toThrow("word-floor.md:1 and 2 overlap by 0.01s");
  });

  test("detects MIN_WORD collision after shifting an unanchored follower", () => {
    const text = "[00:00.00-00:00.90] a b c d e f g h\nshort\n[00:01.85] next";
    expect(() => resolveTiming(parseDocument(text, "word-floor-run.md"))).toThrow("word-floor-run.md:2 and 3 overlap by 0.06s");
  });

  test("adds tail and rejects total duration over 300 seconds", () => {
    const normal = resolveTiming(parseDocument("Hello", "tail.md"), 1.25);
    expect(normal.durationMs).toBe(2450);
    expect(() => resolveTiming(parseDocument("[04:59.50-04:59.90] End", "ceiling.md"))).toThrow("duration");
  });
});
