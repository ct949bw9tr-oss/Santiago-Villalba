import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.wrap}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable key={opt.value} onPress={() => onChange(opt.value)} style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[typography.captionStrong, active ? { color: colors.textInverse } : { color: colors.textSecondary }]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", backgroundColor: colors.bgMuted, borderRadius: radii.pill, padding: 3, gap: 3 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radii.pill },
  segmentActive: { backgroundColor: colors.brand },
});
