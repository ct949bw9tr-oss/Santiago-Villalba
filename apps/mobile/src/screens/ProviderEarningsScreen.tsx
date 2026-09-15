import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../components/Screen";
import { EmptyState } from "../components/EmptyState";
import { colors, radii, spacing, typography } from "../theme";
import { useCurrentUser, useTaskSwiftStore } from "../data";
import { getBookingsForUser, getEarningsSummary } from "../data/queries";
import { formatDateTime, formatMoney } from "../lib/format";

export function ProviderEarningsScreen() {
  const currentUser = useCurrentUser();
  useTaskSwiftStore((s) => s.bookings);

  if (!currentUser) return null;
  const earnings = getEarningsSummary(currentUser.id);
  const completed = getBookingsForUser(currentUser.id, "provider").filter((b) => b.status === "completed");

  return (
    <Screen scroll>
      <Text style={typography.display}>Ganancias</Text>

      <View style={styles.grid}>
        <StatCard label="Hoy" value={formatMoney(earnings.today, earnings.currency)} />
        <StatCard label="Esta semana" value={formatMoney(earnings.thisWeek, earnings.currency)} />
        <StatCard label="Este mes" value={formatMoney(earnings.thisMonth, earnings.currency)} />
        <StatCard label="Servicios completados" value={`${earnings.totalJobs}`} />
        <StatCard label="Valor promedio" value={formatMoney(earnings.averageJobValue, earnings.currency)} />
      </View>

      <Text style={[typography.h3, styles.sectionTitle]}>Historial de transacciones</Text>
      {completed.length === 0 ? (
        <EmptyState icon="cash-outline" title="Aún no tienes servicios completados" />
      ) : (
        completed.map((b) => (
          <View key={b.id} style={styles.txRow}>
            <View>
              <Text style={typography.bodyStrong}>{formatMoney(b.priceBreakdown.providerPayout, b.priceBreakdown.currency)}</Text>
              <Text style={typography.caption}>{formatDateTime(b.completedByCustomerAt ?? b.createdAt)}</Text>
            </View>
            <Text style={typography.caption}>Servicio completado</Text>
          </View>
        ))
      )}
    </Screen>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={typography.caption}>{label}</Text>
      <Text style={typography.h2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.xl },
  statCard: { width: "47%", padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.bgMuted, gap: 4 },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.sm },
  txRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
