import { centre, reflowSafeText } from "./shared";
import type { AssEvent, StyleContext } from "./shared";

export function emitStackBuild(context: StyleContext): readonly AssEvent[] {
  const { x, y } = centre(context);
  const lineHeight = Math.round(context.preset.fontSize * 1.3);
  const events: AssEvent[] = [];
  const lines = context.block.lines;
  for (let stage = 0; stage < lines.length; stage += 1) {
    const stageLine = lines[stage];
    if (!stageLine) continue;
    const nextLine = lines[stage + 1];
    const stageEnd = nextLine?.startMs ?? lines.at(-1)?.endMs ?? stageLine.endMs;
    for (let lineIndex = Math.max(0, stage - 3); lineIndex <= stage; lineIndex += 1) {
      const line = lines[lineIndex];
      if (!line) continue;
      const tags = lineIndex === stage
        ? `{\\an5\\move(${x},${y + Math.round(lineHeight * 0.55)},${x},${y},0,220)\\fad(90,0)}`
        : `{\\an5\\move(${x},${y + (lineIndex - (stage - 1)) * lineHeight},${x},${y + (lineIndex - stage) * lineHeight},0,220)\\alpha&H80&\\fscx88\\fscy88}`;
      events.push({
        startMs: stageLine.startMs,
        endMs: stageEnd,
        styleName: context.styleName,
        text: `${tags}${reflowSafeText(line, context.theme)}`,
      });
    }
  }
  return events;
}
