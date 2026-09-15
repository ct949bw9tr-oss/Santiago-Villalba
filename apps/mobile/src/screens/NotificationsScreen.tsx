import React, { useEffect } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { EmptyState } from "../components/EmptyState";
import { colors, spacing, typography } from "../theme";
import { useCurrentUser, useTaskSwiftStore } from "../data";
import { formatDateTime } from "../lib/format";

const NOTIF_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  new_request: "briefcase-outline",
  request_accepted: "checkmark-circle-outline",
  request_declined: "close-circle-outline",
  message_received: "chatbubble-outline",
  booking_reminder: "alarm-outline",
  provider_arriving: "navigate-outline",
  task_completed: "checkmark-done-outline",
  payment_processed: "card-outline",
  payout_sent: "cash-outline",
  review_request: "star-outline",
  dispute_update: "warning-outline",
};

export function NotificationsScreen() {
  const currentUser = useCurrentUser();
  const notifications = useTaskSwiftStore((s) => s.notifications);
  const markNotificationsRead = useTaskSwiftStore((s) => s.markNotificationsRead);

  useEffect(() => {
    if (currentUser) markNotificationsRead(currentUser.id);
  }, [currentUser, markNotificationsRead]);

  if (!currentUser) return null;
  const items = notifications
    .filter((n) => n.userId === currentUser.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        ListEmptyComponent={<EmptyState icon="notifications-outline" title="No tienes notificaciones" />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Ionicons name={NOTIF_ICON[item.type] ?? "notifications-outline"} size={18} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.bodyStrong}>{item.title}</Text>
              <Text style={typography.caption}>{item.body}</Text>
              <Text style={typography.tiny}>{formatDateTime(item.createdAt)}</Text>
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" },
});
