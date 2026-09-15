import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { Avatar } from "../components/Avatar";
import { RatingStars } from "../components/RatingStars";
import { colors, radii, spacing, typography } from "../theme";
import { useCurrentProviderProfile, useCurrentUser, useTaskSwiftStore } from "../data";

const VERIFICATION_LABEL: Record<string, string> = {
  unverified: "Sin verificar",
  phone_verified: "Teléfono verificado",
  identity_pending: "Verificación en proceso",
  identity_verified: "Identidad verificada",
  rejected: "Verificación rechazada",
  suspended: "Cuenta suspendida",
};

export function ProviderProfileEditScreen() {
  const router = useRouter();
  const user = useCurrentUser();
  const profile = useCurrentProviderProfile();
  const switchMode = useTaskSwiftStore((s) => s.switchMode);
  const logout = useTaskSwiftStore((s) => s.logout);

  if (!user || !profile) return null;

  function switchToCustomerMode() {
    switchMode("customer");
    router.replace("/(customer)/(tabs)/home");
  }

  return (
    <Screen scroll>
      <Text style={typography.display}>Perfil</Text>

      <View style={styles.profileRow}>
        <Avatar firstName={user.firstName} lastName={user.lastName} size={64} online={profile.isOnline} />
        <View style={{ marginLeft: spacing.md, flex: 1 }}>
          <Text style={typography.h2}>
            {user.firstName} {user.lastName}
          </Text>
          <Text style={typography.caption}>{profile.headline}</Text>
          <RatingStars rating={profile.ratingAverage} count={profile.ratingCount} />
        </View>
      </View>

      <View style={styles.verificationCard}>
        <Ionicons
          name={profile.isVerified ? "shield-checkmark" : "shield-outline"}
          size={20}
          color={profile.isVerified ? colors.accent : colors.warning}
        />
        <Text style={[typography.captionStrong, { marginLeft: spacing.sm }]}>{VERIFICATION_LABEL[profile.verificationState]}</Text>
      </View>

      <MenuRow icon="swap-horizontal-outline" label="Cambiar a modo cliente" onPress={switchToCustomerMode} />

      <View style={styles.section}>
        <MenuRow icon="pricetags-outline" label="Mis servicios y precios" onPress={() => {}} />
        <MenuRow icon="images-outline" label="Portafolio" onPress={() => {}} />
        <MenuRow icon="map-outline" label="Área de servicio" onPress={() => {}} />
        <MenuRow icon="wallet-outline" label="Método de pago (payout)" onPress={() => {}} />
        <MenuRow icon="document-text-outline" label="Términos del proveedor" onPress={() => {}} />
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
  verificationCard: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.bgMuted,
  },
  section: { marginTop: spacing.xl, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  menuRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  menuLabel: { flex: 1 },
});
