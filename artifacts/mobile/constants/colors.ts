const palette = {
  emerald: "#00D084",
  emeraldDark: "#00A86B",
  emeraldLight: "#00FF9F",
  emeraldMuted: "rgba(0, 208, 132, 0.12)",
  emeraldBorder: "rgba(0, 208, 132, 0.25)",

  red: "#FF3B5C",
  redMuted: "rgba(255, 59, 92, 0.12)",

  amber: "#F59E0B",
  amberMuted: "rgba(245, 158, 11, 0.12)",

  navy: "#0A0F1E",
  navyLight: "#0F1629",
  navySurface: "#131D35",
  navyCard: "#182040",
  navyBorder: "rgba(255, 255, 255, 0.08)",

  white: "#FFFFFF",
  whiteHigh: "rgba(255, 255, 255, 0.92)",
  whiteMedium: "rgba(255, 255, 255, 0.6)",
  whiteLow: "rgba(255, 255, 255, 0.35)",
  whiteVeryLow: "rgba(255, 255, 255, 0.08)",

  blue: "#3B82F6",
  blueMuted: "rgba(59, 130, 246, 0.15)",
};

export default {
  light: {
    text: palette.white,
    textSecondary: palette.whiteMedium,
    textTertiary: palette.whiteLow,

    background: palette.navy,
    backgroundSecondary: palette.navyLight,
    surface: palette.navySurface,
    card: palette.navyCard,

    tint: palette.emerald,
    tintDark: palette.emeraldDark,
    tintMuted: palette.emeraldMuted,
    tintBorder: palette.emeraldBorder,

    positive: palette.emerald,
    positiveMuted: palette.emeraldMuted,
    negative: palette.red,
    negativeMuted: palette.redMuted,
    neutral: palette.amber,
    neutralMuted: palette.amberMuted,

    border: palette.navyBorder,
    separator: "rgba(255, 255, 255, 0.06)",

    tabIconDefault: palette.whiteLow,
    tabIconSelected: palette.emerald,

    blue: palette.blue,
    blueMuted: palette.blueMuted,
  },
};
