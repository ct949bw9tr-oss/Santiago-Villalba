import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BookingStatus } from "@taskswift/types";
import { statusColors } from "../theme";
import { BOOKING_STATUS_LABEL_ES } from "../lib/format";

export function StatusPill({ status }: { status: BookingStatus }) {
  const color = statusColors[status];
  return (
    <View style={[styles.pill, { backgroundColor: `${color}22` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{BOOKING_STATUS_LABEL_ES[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, alignSelf: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  label: { fontSize: 12, fontWeight: "700" },
});
