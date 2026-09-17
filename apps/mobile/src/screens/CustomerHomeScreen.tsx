import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { CategoryCard } from "../components/CategoryCard";
import { ProviderCard } from "../components/ProviderCard";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyState } from "../components/EmptyState";
import { colors, spacing, typography } from "../theme";
import { useCurrentUser, useTaskSwiftStore, useUnreadNotificationCount } from "../data";
import { searchProviders } from "../data/queries";

export function CustomerHomeScreen() {
  const router = useRouter();
  const user = useCurrentUser();
  const addresses = useTaskSwiftStore((s) => s.addresses);
  const categories = useTaskSwiftStore((s) => s.categories);
  const bookings = useTaskSwiftStore((s) => s.bookings);
  const unread = useUnreadNotificationCount(user?.id);

  const defaultAddress = addresses.find((a) => a.userId === user?.id && a.isDefault);
  const availableNow = useMemo(() => searchProviders({ availableNow: true, sort: "rating" }).slice(0, 5), []);
  const topRated = useMemo(() => searchProviders({ sort: "rating" }).slice(0, 5), []);
  const lastCompleted = bookings.find((b) => b.customerId === user?.id && b.status === "completed");

  if (!user) return null;

  return (
    <Screen scroll edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.location}>
          <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
          <Text style={typography.captionStrong}>{defaultAddress?.city ?? "Bogotá"}, Colombia</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
        </Pressable>
        <Pressable onPress={() => router.push("/(customer)/notifications")} style={styles.bell}>
          <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
          {unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <Text style={[typography.display, styles.greeting]}>Hola, {user.firstName}</Text>

      <Pressable style={styles.searchBar} onPress={() => router.push("/(customer)/search")}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <Text style={styles.searchPlaceholder}>¿Qué necesitas hoy?</Text>
      </Pressable>

      <View style={styles.categoryGrid}>
        {categories.map((c) => (
          <CategoryCard key={c.id} category={c} onPress={() => router.push({ pathname: "/(customer)/category/[slug]", params: { slug: c.slug } })} />
        ))}
      </View>

      <View style={styles.trustBanner}>
        <Ionicons name="shield-checkmark" size={28} color={colors.textInverse} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[typography.bodyStrong, { color: colors.textInverse }]}>Personas de confianza,</Text>
          <Text style={[typography.bodyStrong, { color: colors.textInverse }]}>siempre cerca.</Text>
        </View>
      </View>

      {lastCompleted && (
        <Pressable
          style={styles.rebookCard}
          onPress={() => router.push({ pathname: "/(customer)/provider/[id]", params: { id: lastCompleted.providerId } })}
        >
          <View style={{ flex: 1 }}>
            <Text style={[typography.captionStrong, { color: colors.textInverse }]}>¿Todo bien la última vez?</Text>
            <Text style={[typography.h3, { color: colors.textInverse, marginTop: 2 }]}>Contratar de nuevo</Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={32} color={colors.textInverse} />
        </Pressable>
      )}

      <SectionHeader title="Cerca de ti" actionLabel="Ver todos" onAction={() => router.push("/(customer)/search")} />
      {availableNow.length === 0 ? (
        <EmptyState icon="time-outline" title="Nadie disponible ahora" description="Prueba programar un servicio para más tarde." />
      ) : (
        availableNow.map((r) => (
          <ProviderCard key={r.service.id} result={r} onPress={() => router.push({ pathname: "/(customer)/provider/[id]", params: { id: r.user.id } })} />
        ))
      )}

      <SectionHeader title="Mejor valorados" />
      {topRated.map((r) => (
        <ProviderCard key={r.service.id} result={r} onPress={() => router.push({ pathname: "/(customer)/provider/[id]", params: { id: r.user.id } })} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  location: { flexDirection: "row", alignItems: "center", gap: 4 },
  bell: { position: "relative" },
  badge: { position: "absolute", top: -4, right: -4, backgroundColor: colors.danger, borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  greeting: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.bgMuted,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  searchPlaceholder: { color: colors.textMuted, fontSize: 15 },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  trustBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.textPrimary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: 16,
  },
  rebookCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: 16,
  },
});
