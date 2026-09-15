import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../components/Screen";
import { StatusPill } from "../components/StatusPill";
import { EmptyState } from "../components/EmptyState";
import { colors, radii, spacing, typography } from "../theme";
import { useCurrentUser, useTaskSwiftStore } from "../data";
import { getBookingsForUser } from "../data/queries";
import { formatDateTime, formatMoney } from "../lib/format";

export function CustomerBookingsListScreen() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  useTaskSwiftStore((s) => s.bookings); // subscribe so list re-renders on mutation
  const services = useTaskSwiftStore((s) => s.services);
  const providerServices = useTaskSwiftStore((s) => s.providerServices);
  const users = useTaskSwiftStore((s) => s.users);

  if (!currentUser) return null;
  const items = getBookingsForUser(currentUser.id, "customer");

  return (
    <Screen>
      <Text style={typography.display}>Mis reservas</Text>
      <FlatList
        data={items}
        keyExtractor={(b) => b.id}
        style={{ marginTop: spacing.lg }}
        ListEmptyComponent={
          <EmptyState icon="calendar-outline" title="Aún no tienes reservas" description="Explora servicios y solicita tu primera cita." />
        }
        renderItem={({ item }) => {
          const ps = providerServices.find((p) => p.id === item.providerServiceId);
          const svc = services.find((s) => s.id === ps?.serviceId);
          const provider = users.find((u) => u.id === item.providerId);
          return (
            <Pressable style={styles.card} onPress={() => router.push({ pathname: "/(customer)/booking/[id]", params: { id: item.id } })}>
              <View style={{ flex: 1 }}>
                <Text style={typography.bodyStrong}>{svc?.name ?? "Servicio"}</Text>
                <Text style={typography.caption}>
                  {provider ? `${provider.firstName} ${provider.lastName[0]}.` : ""} · {formatDateTime(item.scheduledFor) || "Inmediato"}
                </Text>
                <StatusPill status={item.status} />
              </View>
              <Text style={typography.bodyStrong}>{formatMoney(item.priceBreakdown.total, item.priceBreakdown.currency)}</Text>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
});
