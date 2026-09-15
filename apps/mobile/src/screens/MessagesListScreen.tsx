import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../components/Screen";
import { Avatar } from "../components/Avatar";
import { EmptyState } from "../components/EmptyState";
import { colors, spacing, typography } from "../theme";
import { useCurrentUser, useTaskSwiftStore } from "../data";
import { formatDateTime } from "../lib/format";

export function MessagesListScreen({ role, chatPathname }: { role: "customer" | "provider"; chatPathname: string }) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const bookings = useTaskSwiftStore((s) => s.bookings);
  const messages = useTaskSwiftStore((s) => s.messages);
  const users = useTaskSwiftStore((s) => s.users);

  if (!currentUser) return null;

  const myBookings = bookings.filter((b) => (role === "customer" ? b.customerId === currentUser.id : b.providerId === currentUser.id));
  const threads = myBookings
    .map((b) => {
      const thread = messages.filter((m) => m.bookingId === b.id);
      if (thread.length === 0) return null;
      const last = thread[thread.length - 1]!;
      const counterpartId = role === "customer" ? b.providerId : b.customerId;
      const counterpart = users.find((u) => u.id === counterpartId);
      const unread = thread.some((m) => m.senderId !== currentUser.id && !m.readAt);
      return { booking: b, counterpart, last, unread };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .sort((a, b) => new Date(b.last.createdAt).getTime() - new Date(a.last.createdAt).getTime());

  return (
    <Screen>
      <Text style={typography.display}>Mensajes</Text>
      <FlatList
        data={threads}
        keyExtractor={(t) => t.booking.id}
        style={{ marginTop: spacing.lg }}
        ListEmptyComponent={<EmptyState icon="chatbubble-outline" title="No tienes conversaciones" description="Los chats aparecen cuando reservas un servicio." />}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push({ pathname: chatPathname as never, params: { bookingId: item.booking.id } })}
          >
            <Avatar firstName={item.counterpart?.firstName ?? "?"} lastName={item.counterpart?.lastName} size={48} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={typography.bodyStrong}>
                {item.counterpart ? `${item.counterpart.firstName} ${item.counterpart.lastName[0]}.` : "Usuario"}
              </Text>
              <Text style={typography.caption} numberOfLines={1}>
                {item.last.type === "system" ? item.last.body : item.last.body}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={typography.tiny}>{formatDateTime(item.last.createdAt)}</Text>
              {item.unread && <View style={styles.unreadDot} />}
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, marginTop: 6 },
});
