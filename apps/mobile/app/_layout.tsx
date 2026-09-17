import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTaskSwiftStore } from "../src/data";
import { colors, spacing, typography } from "../src/theme";

export default function RootLayout() {
  const hydratePublic = useTaskSwiftStore((s) => s.hydratePublic);
  const isPublicDataReady = useTaskSwiftStore((s) => s.isPublicDataReady);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    hydratePublic().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [hydratePublic]);

  if (!isPublicDataReady) {
    return (
      <View style={styles.loading}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={[typography.body, styles.loadingText]}>Cargando TaskSwift…</Text>
        {error && <Text style={[typography.caption, styles.errorText]}>No se pudo conectar: {error}</Text>}
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(provider)" />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, padding: spacing.xl },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary },
  errorText: { marginTop: spacing.sm, color: colors.danger, textAlign: "center" },
});
