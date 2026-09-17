import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  scissors: "cut-outline",
  sparkles: "sparkles-outline",
  sparkle: "sparkles-outline",
  hammer: "hammer-outline",
  "book-open": "book-outline",
  barbell: "barbell-outline",
};

export function CategoryIcon({ name, size = 22, color = colors.brand }: { name: string; size?: number; color?: string }) {
  return <Ionicons name={ICON_MAP[name] ?? "pricetag-outline"} size={size} color={color} />;
}
