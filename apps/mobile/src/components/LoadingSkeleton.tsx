import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radii, spacing } from "../theme";

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.avatar} />
          <View style={styles.lines}>
            <View style={[styles.bar, { width: "60%" }]} />
            <View style={[styles.bar, { width: "40%" }]} />
            <View style={[styles.bar, { width: "80%" }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.bgMuted, marginBottom: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.border },
  lines: { marginLeft: spacing.md, flex: 1, justifyContent: "center", gap: 8 },
  bar: { height: 10, borderRadius: 4, backgroundColor: colors.border },
});
