export const STYLE_NAMES = ["word-pop", "slide-karaoke", "typewriter", "stack-build"] as const;
export type StyleName = (typeof STYLE_NAMES)[number];

export const THEME_NAMES = ["midnight", "paper", "neon"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export interface Theme {
  readonly bg: string;
  readonly primary: string;
  readonly accent: string;
  readonly outline: string;
  readonly outlinePx: number;
}

export const THEMES: Readonly<Record<ThemeName, Theme>> = {
  midnight: { bg: "#101820", primary: "#FFFFFF", accent: "#FFA500", outline: "#101010", outlinePx: 6 },
  paper: { bg: "#F4EFE3", primary: "#1A1A1A", accent: "#C0392B", outline: "#F4EFE3", outlinePx: 4 },
  neon: { bg: "#0A0A12", primary: "#F5F5FF", accent: "#00E5FF", outline: "#12123A", outlinePx: 7 },
};

export const PRESET_NAMES = ["vertical", "horizontal"] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

export interface Preset {
  readonly width: number;
  readonly height: number;
  readonly fps: 30;
  readonly fontSize: number;
  readonly marginL: number;
  readonly marginR: number;
  readonly marginV: number;
  readonly maxLines: number;
}

export const PRESETS: Readonly<Record<PresetName, Preset>> = {
  vertical: { width: 1080, height: 1920, fps: 30, fontSize: 96, marginL: 80, marginR: 80, marginV: 160, maxLines: 3 },
  horizontal: { width: 1920, height: 1080, fps: 30, fontSize: 84, marginL: 160, marginR: 160, marginV: 120, maxLines: 2 },
};

export function hexToAss(hex: string, alpha = "00"): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Invalid RGB hex colour: ${hex}`);
  const red = match[1];
  const green = match[2];
  const blue = match[3];
  return `&H${alpha}${blue}${green}${red}&`.toUpperCase();
}
