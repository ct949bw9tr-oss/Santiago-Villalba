import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../theme";

export interface MapPin {
  id: string;
  top: number; // 0-100, percentage position within the map area
  left: number; // 0-100
  label?: string;
  variant?: "provider" | "you" | "destination";
}

/**
 * A stylized stand-in for a real map. There's no Google Maps API key configured for
 * this project yet, so react-native-maps (which needs one, and has no built-in web
 * support anyway) isn't wired up — this renders street-like guide lines and pins at
 * approximate positions instead of a real, navigable map.
 */
export function MapPlaceholder({ pins = [], height = 220 }: { pins?: MapPin[]; height?: number }) {
  return (
    <View style={[styles.wrap, { height }]}>
      <View style={[styles.street, { top: "30%", left: 0, right: 0, height: 10 }]} />
      <View style={[styles.street, { top: "68%", left: 0, right: 0, height: 10 }]} />
      <View style={[styles.street, { left: "22%", top: 0, bottom: 0, width: 10 }]} />
      <View style={[styles.street, { left: "72%", top: 0, bottom: 0, width: 10 }]} />

      {pins.map((pin) => (
        <View key={pin.id} style={[styles.pinWrap, { top: `${pin.top}%`, left: `${pin.left}%` }]}>
          <View style={[styles.pin, pin.variant === "you" && styles.pinYou, pin.variant === "destination" && styles.pinDestination]}>
            <Ionicons
              name={pin.variant === "you" ? "navigate" : pin.variant === "destination" ? "flag" : "person"}
              size={12}
              color="#fff"
            />
          </View>
          {pin.label && <Text style={styles.pinLabel}>{pin.label}</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: "#E6EEF9", borderRadius: radii.lg, overflow: "hidden", position: "relative" },
  street: { position: "absolute", backgroundColor: "#D3E0F2" },
  pinWrap: { position: "absolute", alignItems: "center", transform: [{ translateX: -12 }, { translateY: -24 }] },
  pin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  pinYou: { backgroundColor: colors.accent },
  pinDestination: { backgroundColor: colors.danger },
  pinLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    color: colors.textPrimary,
    backgroundColor: "#fff",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    overflow: "hidden",
  },
});
