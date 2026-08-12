import { escapeAssText } from "../limits";
import { PRESETS, THEMES, hexToAss } from "../themes";
import type { PresetName } from "../themes";
import type { Timeline } from "../timing";

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
  const theme = THEMES[firstBlock.settings.theme];
  const secondary = hexToAss(theme.primary, "66");
  const bold = firstBlock.settings.font.toLowerCase().includes("regular") ? -1 : 0;
  const cx = Math.round(preset.width / 2);
  const cy = Math.round(preset.height * 0.46);
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
    `Style: Kin,${firstBlock.settings.font},${preset.fontSize},${hexToAss(theme.primary)},${secondary},${hexToAss(theme.outline)},&H80000000,${bold},0,0,0,100,100,0,0,1,${theme.outlinePx},0,5,${preset.marginL},${preset.marginR},${preset.marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const events = timeline.blocks.flatMap((block) => block.lines.map((line) => (
    `Dialogue: 0,${assTime(line.startMs)},${assTime(line.endMs)},Kin,,,,,{\\an5\\pos(${cx},${cy})\\fad(120,120)}${escapeAssText(line.text)}`
  )));
  return `${[...header, ...events].join("\n")}\n`;
}
