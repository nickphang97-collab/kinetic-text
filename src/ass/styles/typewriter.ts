import { escapeAssText } from "../../limits";
import { hexToAss } from "../../themes";
import { centre } from "./shared";
import type { AssEvent, StyleContext } from "./shared";

interface CharacterUnit {
  readonly character: string;
  readonly emphasis: boolean;
}

export function emitTypewriter(context: StyleContext): readonly AssEvent[] {
  const { x, y } = centre(context);
  const accent = hexToAss(context.theme.accent);
  const primary = hexToAss(context.theme.primary);
  return context.block.lines.map((line) => {
    const units: CharacterUnit[] = line.segments.flatMap((segment) => [...segment.text].map((character) => ({ character, emphasis: segment.emphasis })));
    const duration = line.endMs - line.startMs;
    const text = units.map((unit, index) => {
      const reveal = Math.round((index / Math.max(1, units.length)) * duration * 0.75);
      const cooled = unit.emphasis ? accent : primary;
      const wobble = unit.emphasis ? "\\frz-3\\t(0,110,\\frz3)\\t(110,220,\\frz0)" : "\\frz0";
      return `{\\alpha&HFF&\\t(${reveal},${reveal + 1},\\alpha&H00&)\\1c${accent}\\t(${reveal + 70},${reveal + 140},\\1c${cooled})${wobble}}${escapeAssText(unit.character)}`;
    }).join("");
    return {
      startMs: line.startMs,
      endMs: line.endMs,
      styleName: context.styleName,
      text: `{\\an5\\pos(${x},${y})\\q2}${text}`,
    };
  });
}
