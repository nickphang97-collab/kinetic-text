import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "../src/parse";

const fixtures = join(import.meta.dir, "fixtures");
const readFixture = (name: string): string => readFileSync(join(fixtures, name), "utf8");

describe("parseDocument", () => {
  test("parses the exact demo grammar and forward style directives", () => {
    const document = parseDocument(readFixture("demo.md"), "demo.md");
    expect(document.wpm).toBe(150);
    expect(document.blocks).toHaveLength(5);
    expect(document.blocks.map((block) => block.settings.style)).toEqual(["word-pop", "word-pop", "slide-karaoke", "typewriter", "stack-build"]);
    expect(document.blocks[0]?.lines[0]?.anchor?.startMs).toBe(400);
    expect(document.blocks[0]?.lines[0]?.text).toBe("You don't need permission");
    expect(document.blocks[0]?.lines[0]?.segments).toEqual([
      { text: "You don't need ", emphasis: false },
      { text: "permission", emphasis: true },
    ]);
    expect(document.blocks[4]?.lines).toHaveLength(4);
  });

  test("parses explicit start/end anchors", () => {
    const document = parseDocument(readFixture("word-pop.md"), "word-pop.md");
    expect(document.blocks[0]?.lines[0]?.anchor).toEqual({ startMs: 400, endMs: 2400 });
  });

  test("honours escaped asterisks and brackets", () => {
    const document = parseDocument("\\[literal] and \\*plain\\* plus *hot*", "escapes.md");
    expect(document.blocks[0]?.lines[0]?.text).toBe("[literal] and *plain* plus hot");
    expect(document.blocks[0]?.lines[0]?.segments.at(-1)).toEqual({ text: "hot", emphasis: true });
  });

  test("preserves ASS-looking text literally for the emitter to escape", () => {
    const document = parseDocument(readFixture("tag-injection.md"), "tag-injection.md");
    expect(document.blocks[0]?.lines[0]?.text).toContain("{\\move(0,0,9999,9999)}");
  });

  test.each([
    ["unknown-front-matter.md", "unknown front-matter key 'colour'"],
    ["two-emphasis.md", "at most one emphasis span"],
    ["unclosed-emphasis.md", "unclosed emphasis"],
  ])("rejects broken fixture %s", (name, message) => {
    expect(() => parseDocument(readFixture(name), name)).toThrow(message);
  });

  test("rejects unknown directives and reports the line", () => {
    expect(() => parseDocument(":: wpm: 200\nText", "directive.md")).toThrow("directive.md:1");
  });

  test("rejects invalid style values", () => {
    expect(() => parseDocument("---\nstyle: bounce\n---\nText", "style.md")).toThrow("style.md:2");
  });
});
