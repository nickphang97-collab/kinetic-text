import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emitAss } from "../src/ass/emit";
import { parseDocument } from "../src/parse";
import { resolveTiming } from "../src/timing";

const fixtures = join(import.meta.dir, "fixtures");

function ass(name: string): string {
  const source = readFileSync(join(fixtures, `${name}.md`), "utf8");
  return emitAss(resolveTiming(parseDocument(source, `${name}.md`)), "vertical");
}

function dialogues(value: string): readonly string[] {
  return value.split("\n").filter((line) => line.startsWith("Dialogue:"));
}

describe("ASS style vocabulary", () => {
  test("emits the locked header with pinned Lato Black and no synthetic bold", () => {
    const output = ass("word-pop");
    expect(output).toContain("PlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\nScaledBorderAndShadow: yes");
    expect(output).toContain("Style: Kin,Lato Black,96");
    expect(output).toContain("&H80000000,0,0,0,0,100,100");
  });

  test("word-pop uses one positioned event per word with the emphasis overshoot", () => {
    const output = ass("word-pop");
    expect(dialogues(output)).toHaveLength(1);
    expect(output).toContain("\\pos(540,883)\\fscx45\\fscy45\\alpha&HFF&");
    expect(output).toContain("\\t(0,90,\\fscx126\\fscy126\\alpha&H00&)\\t(90,170,\\fscx108\\fscy108)");
  });

  test("slide-karaoke emits one line event with progressive kf units", () => {
    const output = ass("slide-karaoke");
    expect(dialogues(output)).toHaveLength(1);
    expect(output.match(/\\kf\d+/g)).toHaveLength(3);
  });

  test("typewriter lays out one q2 line and reveals every character", () => {
    const output = ass("typewriter");
    expect(dialogues(output)).toHaveLength(1);
    expect(output).toContain("\\q2");
    expect(output.match(/\\alpha&HFF&/g)?.length).toBeGreaterThan(10);
  });

  test("stack-build emits one event per line and stage", () => {
    const output = ass("stack-build");
    expect(dialogues(output)).toHaveLength(10);
    expect(output).toContain("\\move(540,952,540,883,0,220)");
    expect(output).toContain("\\alpha&H80&\\fscx88\\fscy88");
  });

  test("escapes override-looking user text", () => {
    const output = ass("tag-injection");
    expect(output).not.toContain("{\\move(0,0,9999,9999)}");
    expect(output).toContain("\\{\\\\move(0,0,9999,9999)\\}");
  });
});
