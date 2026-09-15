import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Category } from "@taskswift/types";
import { colors, radii, spacing, typography } from "../theme";
import { CategoryIcon } from "./CategoryIcon";

export function CategoryCard({ category, onPress }: { category: Category; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.iconWrap}>
        <CategoryIcon name={category.icon} />
      </View>
      <Text style={typography.captionStrong} numberOfLines={1}>
        {category.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", width: 84, gap: spacing.sm },
  pressed: { opacity: 0.7 },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: radii.lg,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
