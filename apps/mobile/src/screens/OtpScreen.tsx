import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { colors, spacing, typography } from "../theme";
import { useTaskSwiftStore } from "../data";

export function OtpScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const loginOrRegisterByPhone = useTaskSwiftStore((s) => s.loginOrRegisterByPhone);
  const [code, setCode] = useState("");

  function verify() {
    loginOrRegisterByPhone(phone ?? "");
    router.replace("/");
  }

  return (
    <Screen scroll>
      <Text style={[typography.h1, styles.title]}>Verifica tu número</Text>
      <Text style={[typography.body, styles.subtitle]}>
        Enviamos un código de 6 dígitos a +57 {phone}. (Modo demo: cualquier código de 6 dígitos funciona.)
      </Text>
      <TextInput
        style={styles.codeInput}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="000000"
        placeholderTextColor={colors.textMuted}
        value={code}
        onChangeText={setCode}
      />
      <Button label="Verificar" onPress={verify} disabled={code.trim().length < 6} style={styles.button} />
      <View style={styles.resend}>
        <Text style={typography.caption}>¿No recibiste el código? </Text>
        <Text style={[typography.captionStrong, { color: colors.brand }]}>Reenviar</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: spacing.xl },
  subtitle: { color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xl },
  codeInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  button: {},
  resend: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
});
