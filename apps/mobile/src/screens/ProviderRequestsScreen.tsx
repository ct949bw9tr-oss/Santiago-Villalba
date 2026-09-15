import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../components/Screen";
import { StatusPill } from "../components/StatusPill";
import { EmptyState } from "../components/EmptyState";
import { Avatar } from "../components/Avatar";
import { colors, radii, spacing, typography } from "../theme";
import { useCurrentUser, useTaskSwiftStore } from "../data";
import { getBookingsForUser } from "../data/queries";
import { formatDateTime, formatMoney } from "../lib/format";

export function ProviderRequestsScreen() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const users = useTaskSwiftStore((s) => s.users);
  useTaskSwiftStore((s) => s.bookings);

  if (!currentUser) return null;
  const items = getBookingsForUser(currentUser.id, "provider").filter(
    (b) => !["completed", "cancelled_customer", "cancelled_provider", "expired", "refunded"].includes(b.status)
  );

  return (
    <Screen>
      <Text style={typography.display}>Solicitudes</Text>
      <FlatList
        data={items}
        keyExtractor={(b) => b.id}
        style={{ marginTop: spacing.lg }}
        ListEmptyComponent={<EmptyState icon="briefcase-outline" title="No tienes solicitudes activas" />}
        renderItem={({ item }) => {
          const customer = users.find((u) => u.id === item.customerId);
          return (
            <Pressable style={styles.card} onPress={() => router.push({ pathname: "/(provider)/request/[id]", params: { id: item.id } })}>
              <Avatar firstName={customer?.firstName ?? "?"} lastName={customer?.lastName} size={44} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={typography.bodyStrong}>
                  {customer ? `${customer.firstName} ${customer.lastName[0]}.` : "Cliente"}
                </Text>
                <Text style={typography.caption}>{item.timing === "now" ? "Inmediato" : formatDateTime(item.scheduledFor)}</Text>
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
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
});
