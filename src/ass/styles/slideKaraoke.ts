import { escapeAssText } from "../../limits";
import { hexToAss } from "../../themes";
import { centre } from "./shared";
import type { AssEvent, StyleContext } from "./shared";

export function emitSlideKaraoke(context: StyleContext, karaokeTag: "kf" | "k" = "kf"): readonly AssEvent[] {
  const { x, y } = centre(context);
  const accent = hexToAss(context.theme.accent);
  const primary = hexToAss(context.theme.primary);
  return context.block.lines.map((line) => {
    const words = line.words.map((word) => {
      const centiseconds = Math.max(1, Math.round((word.endMs - word.startMs) / 10));
      const emphasis = word.emphasis
        ? `{\\1c${accent}\\frz-3\\t(0,110,\\frz3)\\t(110,220,\\frz0)}`
        : `{\\1c${primary}\\frz0}`;
      return `{\\${karaokeTag}${centiseconds}}${emphasis}${escapeAssText(word.text)}`;
    }).join(" ");
    return {
      startMs: line.startMs,
      endMs: line.endMs,
      styleName: context.styleName,
      text: `{\\an5\\pos(${x},${y})\\fad(120,120)}${words}`,
    };
  });
}
