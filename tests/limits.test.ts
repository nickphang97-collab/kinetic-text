import { describe, expect, test } from "bun:test";
import { LIMITS, assertAudioSize, assertDiskProjection, assertDuration, assertScriptLimits, escapeAssText, escapeFilterValue, resolveUserPath } from "../src/limits";

describe("input limits", () => {
  test("rejects script byte ceiling", () => expect(() => assertScriptLimits("x".repeat(LIMITS.scriptBytes + 1), "huge.md")).toThrow("bytes exceeds"));
  test("rejects line count ceiling", () => expect(() => assertScriptLimits(Array.from({ length: LIMITS.lines + 1 }, () => "x").join("\n"), "lines.md")).toThrow("lines exceeds"));
  test("rejects per-line character ceiling", () => expect(() => assertScriptLimits("x".repeat(LIMITS.lineCharacters + 1), "wide.md")).toThrow("characters exceeds"));
  test("rejects block ceiling", () => expect(() => assertScriptLimits(Array.from({ length: LIMITS.blocks + 1 }, () => "x").join("\n\n"), "blocks.md")).toThrow("blocks exceeds"));
  test("rejects duration ceiling", () => expect(() => assertDuration(LIMITS.durationSeconds + 0.01, "long.md")).toThrow("duration"));
  test("rejects audio ceiling", () => expect(() => assertAudioSize(LIMITS.audioBytes + 1, "audio.wav")).toThrow("audio limit"));
  test("rejects disk ceiling", () => expect(() => assertDiskProjection(LIMITS.diskBytes, 1)).toThrow("disk limit"));
  test("rejects relative path traversal", () => expect(() => resolveUserPath("../escape", "/work/project")).toThrow("path escape"));
});

describe("escaping", () => {
  test("escapes filter parser metacharacters without touching spaces", () => expect(escapeFilterValue("/work/font dir/A:B\\C")).toBe("/work/font dir/A\\:B\\\\C"));
  test("escapes ASS override delimiters", () => expect(escapeAssText("{\\move}" )).toBe("\\{\\\\move\\}"));
});
