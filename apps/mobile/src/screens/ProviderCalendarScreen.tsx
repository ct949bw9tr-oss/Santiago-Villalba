import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../components/Screen";
import { EmptyState } from "../components/EmptyState";
import { colors, radii, spacing, typography } from "../theme";
import { useCurrentUser, useTaskSwiftStore } from "../data";
import { formatDateTime, formatMoney } from "../lib/format";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function ProviderCalendarScreen() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const availabilitySlots = useTaskSwiftStore((s) => s.availabilitySlots);
  const toggleAvailabilityDay = useTaskSwiftStore((s) => s.toggleAvailabilityDay);
  const bookings = useTaskSwiftStore((s) => s.bookings);

  if (!currentUser) return null;

  const mySlots = availabilitySlots.filter((s) => s.providerId === currentUser.id);
  const upcoming = bookings
    .filter((b) => b.providerId === currentUser.id && b.timing === "scheduled" && ["accepted", "provider_en_route", "pending_provider", "requested"].includes(b.status))
    .sort((a, b) => new Date(a.scheduledFor ?? 0).getTime() - new Date(b.scheduledFor ?? 0).getTime());

  return (
    <Screen scroll>
      <Text style={typography.display}>Calendario</Text>

      <Text style={[typography.h3, styles.sectionTitle]}>Disponibilidad semanal</Text>
      <View style={styles.daysRow}>
        {DAY_LABELS.map((label, dayOfWeek) => {
          const slot = mySlots.find((s) => s.dayOfWeek === dayOfWeek);
          const active = slot?.isActive ?? false;
          return (
            <Pressable
              key={label}
              style={[styles.dayPill, active && styles.dayPillActive]}
              onPress={() => (slot ? toggleAvailabilityDay(currentUser.id, dayOfWeek) : undefined)}
            >
              <Text style={[typography.captionStrong, active && { color: colors.textInverse }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={typography.caption}>9:00 AM – 6:00 PM en los días activos</Text>

      <Text style={[typography.h3, styles.sectionTitle]}>Próximas citas</Text>
      {upcoming.length === 0 ? (
        <EmptyState icon="calendar-outline" title="No tienes citas programadas" />
      ) : (
        upcoming.map((b) => (
          <Pressable key={b.id} style={styles.appointmentRow} onPress={() => router.push({ pathname: "/(provider)/request/[id]", params: { id: b.id } })}>
            <Text style={typography.bodyStrong}>{formatDateTime(b.scheduledFor)}</Text>
            <Text style={typography.caption}>{formatMoney(b.priceBreakdown.total, b.priceBreakdown.currency)}</Text>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.sm },
  daysRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm },
  dayPill: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  dayPillActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  appointmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
});
