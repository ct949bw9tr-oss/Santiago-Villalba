import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { uuidFrom } from "@taskswift/seed-data";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { colors, spacing, typography } from "../theme";
import { useTaskSwiftStore } from "../data";

const QUICK_LOGIN = [
  { label: "Santiago Villalba", sublabel: "Cliente de prueba", userId: uuidFrom("user:customer:Santiago Villalba") },
  { label: "Andrés Ramírez", sublabel: "Barbero de prueba", userId: uuidFrom("user:provider:Andrés Ramírez") },
];

export function LoginScreen() {
  const router = useRouter();
  const login = useTaskSwiftStore((s) => s.login);
  const [phone, setPhone] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function quickLogin(userId: string) {
    setPendingUserId(userId);
    setError(null);
    try {
      await login(userId);
      router.replace("/");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("quickLogin failed", e);
      setError(message);
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <Screen scroll>
      <View style={styles.brand}>
        <View style={styles.logoMark}>
          <Text style={styles.logoMarkText}>TS</Text>
        </View>
        <Text style={typography.display}>TaskSwift</Text>
        <Text style={[typography.body, styles.tagline]}>Encuentra profesionales cerca de ti, al instante.</Text>
      </View>

      <View style={styles.form}>
        <Text style={typography.captionStrong}>Número de celular</Text>
        <View style={styles.phoneRow}>
          <Text style={typography.body}>🇨🇴 +57</Text>
          <TextInput
            style={styles.phoneInput}
            keyboardType="phone-pad"
            placeholder="300 123 4567"
            placeholderTextColor={colors.textMuted}
            value={phone}
            onChangeText={setPhone}
          />
        </View>
        <Button
          label="Enviar código"
          onPress={() => router.push({ pathname: "/(auth)/otp", params: { phone } })}
          disabled={phone.trim().length < 7}
          style={styles.submit}
        />
      </View>

      <View style={styles.divider} />

      <Text style={[typography.captionStrong, styles.quickTitle]}>Acceso rápido de prueba</Text>
      {QUICK_LOGIN.map((item) => (
        <Pressable key={item.userId} style={styles.quickCard} onPress={() => quickLogin(item.userId)} disabled={!!pendingUserId}>
          <View>
            <Text style={typography.bodyStrong}>{item.label}</Text>
            <Text style={typography.caption}>{item.sublabel}</Text>
          </View>
          {pendingUserId === item.userId ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <Text style={{ color: colors.brand, fontWeight: "700" }}>Entrar</Text>
          )}
        </Pressable>
      ))}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>No se pudo entrar</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", marginTop: spacing.xxl, marginBottom: spacing.xl },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  logoMarkText: { color: "#fff", fontWeight: "800", fontSize: 22 },
  tagline: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs, paddingHorizontal: spacing.lg },
  form: { gap: spacing.sm },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  phoneInput: { flex: 1, paddingVertical: 14, fontSize: 15, color: colors.textPrimary },
  submit: { marginTop: spacing.sm },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xl },
  quickTitle: { marginBottom: spacing.sm },
  quickCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  errorBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorTitle: { fontWeight: "700", color: colors.danger, marginBottom: 4 },
  errorText: { color: colors.danger },
});
