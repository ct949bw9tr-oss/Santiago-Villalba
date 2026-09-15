import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { Avatar } from "../components/Avatar";
import { colors, radii, spacing, typography } from "../theme";
import { useCurrentUser, useTaskSwiftStore } from "../data";

export function CustomerProfileScreen() {
  const router = useRouter();
  const user = useCurrentUser();
  const switchMode = useTaskSwiftStore((s) => s.switchMode);
  const logout = useTaskSwiftStore((s) => s.logout);

  if (!user) return null;

  function switchToProviderMode() {
    switchMode("provider");
    router.replace("/(provider)/(tabs)/home");
  }

  return (
    <Screen scroll>
      <Text style={typography.display}>Perfil</Text>

      <View style={styles.profileRow}>
        <Avatar firstName={user.firstName} lastName={user.lastName} size={64} />
        <View style={{ marginLeft: spacing.md }}>
          <Text style={typography.h2}>
            {user.firstName} {user.lastName}
          </Text>
          <Text style={typography.caption}>{user.phone}</Text>
        </View>
      </View>

      {user.isProvider ? (
        <MenuRow icon="briefcase-outline" label="Cambiar a modo proveedor" onPress={switchToProviderMode} />
      ) : (
        <MenuRow icon="briefcase-outline" label="Quiero ofrecer servicios" onPress={() => router.push("/(provider)/onboarding")} />
      )}

      <View style={styles.section}>
        <MenuRow icon="heart-outline" label="Favoritos" onPress={() => router.push("/(customer)/favorites")} />
        <MenuRow icon="notifications-outline" label="Notificaciones" onPress={() => router.push("/(customer)/notifications")} />
        <MenuRow icon="location-outline" label="Direcciones" onPress={() => {}} />
        <MenuRow icon="card-outline" label="Métodos de pago" onPress={() => {}} />
        <MenuRow icon="shield-checkmark-outline" label="Centro de seguridad" onPress={() => {}} />
        <MenuRow icon="help-circle-outline" label="Ayuda y soporte" onPress={() => {}} />
      </View>

      <View style={styles.section}>
        <MenuRow icon="log-out-outline" label="Cerrar sesión" danger onPress={() => { logout(); router.replace("/(auth)/login"); }} />
      </View>
    </Screen>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.textSecondary} />
      <Text style={[typography.body, styles.menuLabel, danger && { color: colors.danger }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profileRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.xl },
  section: {
    marginTop: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  menuRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  menuLabel: { flex: 1 },
});
