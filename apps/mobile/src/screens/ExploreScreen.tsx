import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { CategoryIcon } from "../components/CategoryIcon";
import { colors, radii, spacing, typography } from "../theme";
import { useTaskSwiftStore } from "../data";

export function ExploreScreen() {
  const router = useRouter();
  const categories = useTaskSwiftStore((s) => s.categories);

  return (
    <Screen scroll>
      <Text style={typography.display}>Explorar</Text>

      <Pressable style={styles.searchBar} onPress={() => router.push("/(customer)/search")}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <Text style={styles.searchPlaceholder}>Buscar servicio o profesional</Text>
      </Pressable>

      <View style={styles.grid}>
        {categories.map((c) => (
          <Pressable
            key={c.id}
            style={styles.gridCard}
            onPress={() => router.push({ pathname: "/(customer)/category/[slug]", params: { slug: c.slug } })}
          >
            <View style={styles.iconWrap}>
              <CategoryIcon name={c.icon} size={26} />
            </View>
            <Text style={typography.bodyStrong}>{c.name}</Text>
            <Text style={typography.caption}>{c.nameEn}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    backgroundColor: colors.bgMuted,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  searchPlaceholder: { color: colors.textMuted, fontSize: 15 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.xl },
  gridCard: {
    width: "47%",
    backgroundColor: colors.bgMuted,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: 4,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
});
