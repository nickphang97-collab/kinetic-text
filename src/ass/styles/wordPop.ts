import { escapeAssText } from "../../limits";
import { hexToAss } from "../../themes";
import { centre } from "./shared";
import type { AssEvent, StyleContext } from "./shared";

export function emitWordPop(context: StyleContext): readonly AssEvent[] {
  const { x, y } = centre(context);
  const accent = hexToAss(context.theme.accent);
  const events: AssEvent[] = [];
  for (const line of context.block.lines) {
    for (const word of line.words) {
      const tags = word.emphasis
        ? `{\\an5\\pos(${x},${y})\\fscx45\\fscy45\\alpha&HFF&\\1c${accent}\\bord${context.theme.outlinePx + 2}\\t(0,90,\\fscx126\\fscy126\\alpha&H00&)\\t(90,170,\\fscx108\\fscy108)\\fad(0,90)}`
        : `{\\an5\\pos(${x},${y})\\fscx45\\fscy45\\alpha&HFF&\\t(0,90,\\fscx112\\fscy112\\alpha&H00&)\\t(90,160,\\fscx100\\fscy100)\\fad(0,90)}`;
      events.push({ startMs: word.startMs, endMs: word.endMs, styleName: context.styleName, text: `${tags}${escapeAssText(word.text)}` });
    }
  }
  return events;
}
