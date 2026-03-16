const palette = {
  emerald: "#00D084",
  emeraldDark: "#00A86B",
  emeraldLight: "#00FF9F",
  emeraldMuted: "rgba(0, 208, 132, 0.15)",
  emeraldBorder: "rgba(0, 208, 132, 0.35)",

  red: "#FF4D6A",
  redMuted: "rgba(255, 77, 106, 0.15)",

  amber: "#FFBA33",
  amberMuted: "rgba(255, 186, 51, 0.15)",

  navy: "#0B1120",
  navyLight: "#111B2E",
  navySurface: "#1A2642",
  navyCard: "#1E2D4D",
  navyBorder: "rgba(255, 255, 255, 0.12)",

  white: "#FFFFFF",
  whiteHigh: "rgba(255, 255, 255, 0.95)",
  whiteMedium: "rgba(255, 255, 255, 0.70)",
  whiteLow: "rgba(255, 255, 255, 0.45)",
  whiteVeryLow: "rgba(255, 255, 255, 0.10)",

  blue: "#5B9BFF",
  blueMuted: "rgba(91, 155, 255, 0.18)",
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
    separator: "rgba(255, 255, 255, 0.08)",

    tabIconDefault: palette.whiteLow,
    tabIconSelected: palette.emerald,

    blue: palette.blue,
    blueMuted: palette.blueMuted,

    navySurface: palette.navySurface,
    navy: palette.navy,
    whiteLow: palette.whiteLow,
    whiteMedium: palette.whiteMedium,
    white: palette.white,
    whiteVeryLow: palette.whiteVeryLow,
  },
};
