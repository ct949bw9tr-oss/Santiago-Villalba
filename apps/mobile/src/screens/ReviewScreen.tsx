import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { colors, radii, spacing, typography } from "../theme";
import { useCurrentUser, useTaskSwiftStore } from "../data";

const CATEGORIES: { key: "quality" | "punctuality" | "communication" | "professionalism"; label: string }[] = [
  { key: "quality", label: "Calidad" },
  { key: "punctuality", label: "Puntualidad" },
  { key: "communication", label: "Comunicación" },
  { key: "professionalism", label: "Profesionalismo" },
];

export function ReviewScreen({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const submitReview = useTaskSwiftStore((s) => s.submitReview);
  const [overall, setOverall] = useState(5);
  const [ratings, setRatings] = useState<Record<string, number>>({ quality: 5, punctuality: 5, communication: 5, professionalism: 5 });
  const [comment, setComment] = useState("");

  if (!currentUser) return null;

  function submit() {
    const result = submitReview(
      bookingId,
      currentUser!.id,
      { overall, quality: ratings.quality, punctuality: ratings.punctuality, communication: ratings.communication, professionalism: ratings.professionalism },
      comment.trim() || undefined
    );
    if (!result.ok) {
      Alert.alert("No se pudo enviar la reseña", result.reason);
      return;
    }
    router.back();
  }

  return (
    <Screen scroll>
      <Text style={typography.h1}>Calificación general</Text>
      <StarRow value={overall} onChange={setOverall} size={32} />

      {CATEGORIES.map((c) => (
        <View key={c.key} style={styles.categoryRow}>
          <Text style={typography.body}>{c.label}</Text>
          <StarRow value={ratings[c.key] ?? 5} onChange={(v) => setRatings((r) => ({ ...r, [c.key]: v }))} size={20} />
        </View>
      ))}

      <Text style={[typography.h3, { marginTop: spacing.xl }]}>Comentario (opcional)</Text>
      <TextInput
        style={styles.commentInput}
        placeholder="Cuéntanos cómo fue tu experiencia..."
        placeholderTextColor={colors.textMuted}
        value={comment}
        onChangeText={setComment}
        multiline
      />

      <Button label="Enviar reseña" onPress={submit} style={styles.submit} />
    </Screen>
  );
}

function StarRow({ value, onChange, size }: { value: number; onChange: (v: number) => void; size: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)}>
          <Ionicons name={n <= value ? "star" : "star-outline"} size={size} color={colors.star} style={{ marginRight: 4 }} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  starRow: { flexDirection: "row", marginTop: spacing.md, marginBottom: spacing.lg },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 90,
    textAlignVertical: "top",
    marginTop: spacing.sm,
  },
  submit: { marginTop: spacing.xl, marginBottom: spacing.xxl },
});
