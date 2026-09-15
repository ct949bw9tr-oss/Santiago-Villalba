import React from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/EmptyState";
import { StatusPill } from "../components/StatusPill";
import { colors, radii, spacing, typography } from "../theme";
import { useCurrentProviderProfile, useCurrentUser, useTaskSwiftStore } from "../data";
import { getBookingsForUser, getEarningsSummary } from "../data/queries";
import { formatDateTime, formatMoney } from "../lib/format";

export function ProviderHomeScreen() {
  const router = useRouter();
  const user = useCurrentUser();
  const profile = useCurrentProviderProfile();
  const toggleOnline = useTaskSwiftStore((s) => s.toggleOnline);
  useTaskSwiftStore((s) => s.bookings);

  if (!user || !profile) return null;

  const earnings = getEarningsSummary(user.id);
  const myBookings = getBookingsForUser(user.id, "provider");
  const pending = myBookings.filter((b) => b.status === "requested" || b.status === "pending_provider");
  const upcoming = myBookings.filter((b) => ["accepted", "provider_en_route", "in_progress"].includes(b.status));

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View>
          <Text style={typography.display}>Hola, {user.firstName}</Text>
          <Text style={typography.caption}>{profile.headline}</Text>
        </View>
        <View style={styles.onlineToggle}>
          <Text style={[typography.captionStrong, { color: profile.isOnline ? colors.online : colors.textMuted }]}>
            {profile.isOnline ? "En línea" : "Fuera de línea"}
          </Text>
          <Switch value={profile.isOnline} onValueChange={() => toggleOnline(user.id)} trackColor={{ true: colors.online }} />
        </View>
      </View>

      <View style={styles.earningsCard}>
        <Text style={[typography.caption, { color: colors.textInverse }]}>Ganancias de hoy</Text>
        <Text style={[typography.display, { color: colors.textInverse }]}>{formatMoney(earnings.today, earnings.currency)}</Text>
        <View style={styles.earningsRow}>
          <View>
            <Text style={[typography.tiny, { color: colors.textInverse }]}>Esta semana</Text>
            <Text style={[typography.h3, { color: colors.textInverse }]}>{formatMoney(earnings.thisWeek, earnings.currency)}</Text>
          </View>
          <View>
            <Text style={[typography.tiny, { color: colors.textInverse }]}>Trabajos totales</Text>
            <Text style={[typography.h3, { color: colors.textInverse }]}>{earnings.totalJobs}</Text>
          </View>
        </View>
      </View>

      <SectionHeader title="Solicitudes disponibles" actionLabel={pending.length > 0 ? "Ver todo" : undefined} onAction={() => router.push("/(provider)/(tabs)/requests")} />
      {pending.length === 0 ? (
        <EmptyState icon="briefcase-outline" title="No tienes solicitudes nuevas" description="Actívate como disponible para recibir más solicitudes." />
      ) : (
        pending.slice(0, 3).map((b) => (
          <Pressable key={b.id} style={styles.bookingRow} onPress={() => router.push({ pathname: "/(provider)/request/[id]", params: { id: b.id } })}>
            <View style={{ flex: 1 }}>
              <Text style={typography.bodyStrong}>{formatMoney(b.priceBreakdown.total, b.priceBreakdown.currency)}</Text>
              <Text style={typography.caption}>{b.timing === "now" ? "Inmediato" : formatDateTime(b.scheduledFor)}</Text>
            </View>
            <StatusPill status={b.status} />
          </Pressable>
        ))
      )}

      <SectionHeader title="Próximos servicios" />
      {upcoming.length === 0 ? (
        <EmptyState icon="calendar-outline" title="No tienes servicios próximos" />
      ) : (
        upcoming.map((b) => (
          <Pressable key={b.id} style={styles.bookingRow} onPress={() => router.push({ pathname: "/(provider)/request/[id]", params: { id: b.id } })}>
            <View style={{ flex: 1 }}>
              <Text style={typography.bodyStrong}>{formatMoney(b.priceBreakdown.total, b.priceBreakdown.currency)}</Text>
              <Text style={typography.caption}>{b.timing === "now" ? "Inmediato" : formatDateTime(b.scheduledFor)}</Text>
            </View>
            <StatusPill status={b.status} />
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  onlineToggle: { alignItems: "center", gap: 4 },
  earningsCard: { backgroundColor: colors.brand, borderRadius: radii.xl, padding: spacing.lg, marginTop: spacing.xl },
  earningsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.lg },
  bookingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
});
