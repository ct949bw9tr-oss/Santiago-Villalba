import React, { useEffect, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { colors, radii, spacing, typography } from "../theme";
import { useCurrentUser, useTaskSwiftStore } from "../data";
import { formatDateTime } from "../lib/format";

export function ChatScreen({ bookingId }: { bookingId: string }) {
  const navigation = useNavigation();
  const currentUser = useCurrentUser();
  const booking = useTaskSwiftStore((s) => s.bookings.find((b) => b.id === bookingId));
  const users = useTaskSwiftStore((s) => s.users);
  const allMessages = useTaskSwiftStore((s) => s.messages);
  const sendMessage = useTaskSwiftStore((s) => s.sendMessage);
  const markMessagesRead = useTaskSwiftStore((s) => s.markMessagesRead);
  const [draft, setDraft] = useState("");

  const thread = allMessages.filter((m) => m.bookingId === bookingId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  useEffect(() => {
    if (currentUser) markMessagesRead(bookingId, currentUser.id);
  }, [bookingId, currentUser, markMessagesRead]);

  useEffect(() => {
    if (booking) {
      const counterpartId = currentUser?.id === booking.providerId ? booking.customerId : booking.providerId;
      const counterpart = users.find((u) => u.id === counterpartId);
      navigation.setOptions({ title: counterpart ? `${counterpart.firstName} ${counterpart.lastName[0]}.` : "Mensajes" });
    }
  }, [booking, currentUser, users, navigation]);

  if (!booking || !currentUser) return null;

  function handleSend() {
    if (!draft.trim()) return;
    sendMessage(bookingId, currentUser!.id, draft.trim());
    setDraft("");
  }

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          data={thread}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            if (item.type === "system") {
              return (
                <View style={styles.systemRow}>
                  <Text style={typography.tiny}>{item.body}</Text>
                </View>
              );
            }
            const mine = item.senderId === currentUser.id;
            return (
              <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={mine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{item.body}</Text>
                </View>
                <Text style={styles.timestamp}>{formatDateTime(item.createdAt)}</Text>
              </View>
            );
          }}
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={colors.textMuted}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <Pressable onPress={handleSend} style={styles.sendBtn} disabled={!draft.trim()}>
            <Ionicons name="send" size={18} color={draft.trim() ? colors.brand : colors.textMuted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm },
  systemRow: { alignItems: "center", marginVertical: spacing.sm },
  bubbleRow: { alignItems: "flex-start", marginBottom: spacing.sm },
  bubbleRowMine: { alignItems: "flex-end" },
  bubble: { maxWidth: "78%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.lg },
  bubbleTheirs: { backgroundColor: colors.bgMuted, borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: colors.brand, borderBottomRightRadius: 4 },
  bubbleTextTheirs: { color: colors.textPrimary },
  bubbleTextMine: { color: colors.textInverse },
  timestamp: { ...typography.tiny, marginTop: 2 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: 10, maxHeight: 100 },
  sendBtn: { padding: spacing.sm },
});
