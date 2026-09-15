import { TextStyle } from "react-native";
import { colors } from "./colors";

export const typography: Record<string, TextStyle> = {
  display: { fontSize: 28, fontWeight: "700", color: colors.textPrimary, letterSpacing: -0.5 },
  h1: { fontSize: 22, fontWeight: "700", color: colors.textPrimary },
  h2: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  h3: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
  body: { fontSize: 15, fontWeight: "400", color: colors.textPrimary },
  bodyStrong: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  caption: { fontSize: 13, fontWeight: "400", color: colors.textSecondary },
  captionStrong: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  tiny: { fontSize: 11, fontWeight: "500", color: colors.textMuted },
};
