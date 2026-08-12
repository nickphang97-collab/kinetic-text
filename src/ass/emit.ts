import { PRESETS, THEMES, hexToAss } from "../themes";
import type { PresetName } from "../themes";
import type { Timeline } from "../timing";
import { emitSlideKaraoke } from "./styles/slideKaraoke";
import { emitStackBuild } from "./styles/stackBuild";
import { emitTypewriter } from "./styles/typewriter";
import { emitWordPop } from "./styles/wordPop";
import type { AssEvent, StyleContext } from "./styles/shared";

function assTime(milliseconds: number): string {
  const totalCentiseconds = Math.round(milliseconds / 10);
  const hours = Math.floor(totalCentiseconds / 360_000);
  const minutes = Math.floor((totalCentiseconds % 360_000) / 6_000);
  const seconds = Math.floor((totalCentiseconds % 6_000) / 100);
  const centiseconds = totalCentiseconds % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

export function emitAss(timeline: Timeline, presetName: PresetName): string {
  const preset = PRESETS[presetName];
  const firstBlock = timeline.blocks[0];
  if (!firstBlock) throw new Error("Cannot emit an empty timeline");
  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${preset.width}`,
    `PlayResY: ${preset.height}`,
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "YCbCr Matrix: TV.709",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    ...timeline.blocks.map((block, index) => {
      const theme = THEMES[block.settings.theme];
      const styleName = index === 0 ? "Kin" : `Kin${index}`;
      const bold = block.settings.font.toLowerCase().includes("regular") ? -1 : 0;
      return `Style: ${styleName},${block.settings.font},${preset.fontSize},${hexToAss(theme.primary)},${hexToAss(theme.primary, "66")},${hexToAss(theme.outline)},&H80000000,${bold},0,0,0,100,100,0,0,1,${theme.outlinePx},0,5,${preset.marginL},${preset.marginR},${preset.marginV},1`;
    }),
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const events: AssEvent[] = [];
  for (const [index, block] of timeline.blocks.entries()) {
    const context: StyleContext = {
      block,
      preset,
      theme: THEMES[block.settings.theme],
      styleName: index === 0 ? "Kin" : `Kin${index}`,
    };
    if (block.settings.style === "word-pop") events.push(...emitWordPop(context));
    else if (block.settings.style === "slide-karaoke") events.push(...emitSlideKaraoke(context));
    else if (block.settings.style === "typewriter") events.push(...emitTypewriter(context));
    else events.push(...emitStackBuild(context));
  }
  const dialogue = events.map((event) => `Dialogue: 0,${assTime(event.startMs)},${assTime(event.endMs)},${event.styleName},,,,,${event.text}`);
  return `${[...header, ...dialogue].join("\n")}\n`;
}
