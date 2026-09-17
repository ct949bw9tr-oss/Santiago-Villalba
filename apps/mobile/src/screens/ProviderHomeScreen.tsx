import React, { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/EmptyState";
import { StatusPill } from "../components/StatusPill";
import { SegmentedControl } from "../components/SegmentedControl";
import { colors, radii, spacing, typography } from "../theme";
import { useCurrentProviderProfile, useCurrentUser, useTaskSwiftStore } from "../data";
import { getBookingsForUser, getEarningsSummary } from "../data/queries";
import { formatDateTime, formatMoney } from "../lib/format";

type Period = "today" | "week" | "month";

export function ProviderHomeScreen() {
  const router = useRouter();
  const user = useCurrentUser();
  const profile = useCurrentProviderProfile();
  const toggleOnline = useTaskSwiftStore((s) => s.toggleOnline);
  const users = useTaskSwiftStore((s) => s.users);
  useTaskSwiftStore((s) => s.bookings);
  const [period, setPeriod] = useState<Period>("today");

  if (!user || !profile) return null;

  const earnings = getEarningsSummary(user.id);
  const myBookings = getBookingsForUser(user.id, "provider");
  const pending = myBookings.filter((b) => b.status === "requested" || b.status === "pending_provider");
  const upcoming = myBookings.filter((b) => ["accepted", "provider_en_route", "in_progress"].includes(b.status));

  const periodEarnings = period === "today" ? earnings.today : period === "week" ? earnings.thisWeek : earnings.thisMonth;
  const jobsToday = myBookings.filter((b) => b.status === "completed" && isToday(b.completedByCustomerAt ?? b.createdAt)).length;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View>
          <Text style={typography.display}>Mi espacio</Text>
          <Text style={typography.caption}>{profile.headline}</Text>
        </View>
        <Pressable onPress={() => router.push("/(provider)/(tabs)/profile")} hitSlop={8}>
          <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.onlineRow}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyStrong, { color: profile.isOnline ? colors.online : colors.textMuted }]}>
            {profile.isOnline ? "En línea" : "Fuera de línea"}
          </Text>
          <Text style={typography.caption}>{profile.isOnline ? "Recibe nuevas solicitudes" : "No recibirás solicitudes nuevas"}</Text>
        </View>
        <Switch value={profile.isOnline} onValueChange={() => toggleOnline(user.id)} trackColor={{ true: colors.online }} />
      </View>

      <View style={styles.periodWrap}>
        <SegmentedControl
          options={[
            { value: "today", label: "Hoy" },
            { value: "week", label: "Esta semana" },
            { value: "month", label: "Este mes" },
          ]}
          value={period}
          onChange={setPeriod}
        />
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Servicios hoy" value={`${jobsToday}`} />
        <StatCard label="Ingresos" value={formatMoney(periodEarnings, earnings.currency)} />
        <StatCard label="Calificación" value={profile.ratingAverage.toFixed(1)} icon="star" />
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
        upcoming.map((b) => {
          const customer = users.find((u) => u.id === b.customerId);
          return (
            <Pressable key={b.id} style={styles.bookingRow} onPress={() => router.push({ pathname: "/(provider)/request/[id]", params: { id: b.id } })}>
              <View style={{ flex: 1 }}>
                <Text style={typography.bodyStrong}>{b.timing === "now" ? "Inmediato" : formatDateTime(b.scheduledFor)}</Text>
                <Text style={typography.caption}>{customer ? `${customer.firstName} ${customer.lastName[0]}.` : "Cliente"}</Text>
              </View>
              <StatusPill status={b.status} />
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function StatCard({ label, value, icon }: { label: string; value: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statValueRow}>
        {icon && <Ionicons name={icon} size={16} color={colors.star} style={{ marginRight: 4 }} />}
        <Text style={typography.h2}>{value}</Text>
      </View>
      <Text style={typography.tiny}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  onlineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.bgMuted,
  },
  periodWrap: { marginTop: spacing.xl },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  statValueRow: { flexDirection: "row", alignItems: "center" },
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
