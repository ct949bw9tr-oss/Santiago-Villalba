import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii } from "../theme";

interface AvatarProps {
  firstName: string;
  lastName?: string;
  size?: number;
  online?: boolean;
}

const PALETTE = ["#0B5FFF", "#00C48C", "#FFB020", "#E5484D", "#7C5CFF", "#0BA5A5"];

export function Avatar({ firstName, lastName, size = 48, online }: AvatarProps) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  const bg = PALETTE[(firstName.charCodeAt(0) || 0) % PALETTE.length];
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
        <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials}</Text>
      </View>
      {online !== undefined && (
        <View
          style={[
            styles.dot,
            { backgroundColor: online ? colors.online : colors.offline, width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14 },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  initials: { color: "#fff", fontWeight: "700" },
  dot: { position: "absolute", right: -1, bottom: -1, borderWidth: 2, borderColor: colors.bg, borderRadius: radii.pill },
});
