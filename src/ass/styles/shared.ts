import { escapeAssText } from "../../limits";
import { hexToAss } from "../../themes";
import type { Preset, Theme } from "../../themes";
import type { TimedBlock, TimedLine } from "../../timing";

export interface StyleContext {
  readonly block: TimedBlock;
  readonly preset: Preset;
  readonly theme: Theme;
  readonly styleName: string;
}

export interface AssEvent {
  readonly startMs: number;
  readonly endMs: number;
  readonly styleName: string;
  readonly text: string;
}

export function centre(context: StyleContext): { readonly x: number; readonly y: number } {
  return { x: Math.round(context.preset.width / 2), y: Math.round(context.preset.height * 0.46) };
}

export function reflowSafeText(line: TimedLine, theme: Theme): string {
  const primary = hexToAss(theme.primary);
  const accent = hexToAss(theme.accent);
  return line.segments.map((segment) => {
    const text = escapeAssText(segment.text);
    if (!segment.emphasis) return text;
    return `{\\1c${accent}\\frz-3\\t(0,110,\\frz3)\\t(110,220,\\frz0)}${text}{\\1c${primary}\\frz0}`;
  }).join("");
}
