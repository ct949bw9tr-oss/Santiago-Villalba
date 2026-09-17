import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { Avatar } from "../components/Avatar";
import { RatingStars } from "../components/RatingStars";
import { Button } from "../components/Button";
import { CategoryIcon } from "../components/CategoryIcon";
import { SegmentedControl } from "../components/SegmentedControl";
import { colors, radii, spacing, typography } from "../theme";
import { useCurrentUser, useIsFavorite, useProviderBundle, useTaskSwiftStore } from "../data";
import { pricingLabel } from "../lib/format";

type Tab = "info" | "services" | "reviews";

export function ProviderProfileScreen({ providerId }: { providerId: string }) {
  const router = useRouter();
  const navigation = useNavigation();
  const bundle = useProviderBundle(providerId);
  const currentUser = useCurrentUser();
  const isFavorite = useIsFavorite(currentUser?.id, providerId);
  const toggleFavorite = useTaskSwiftStore((s) => s.toggleFavorite);
  const [tab, setTab] = useState<Tab>("info");

  useEffect(() => {
    if (bundle) navigation.setOptions({ title: `${bundle.user.firstName} ${bundle.user.lastName[0]}.` });
  }, [bundle, navigation]);

  if (!bundle) {
    return (
      <Screen>
        <Text style={typography.body}>Proveedor no encontrado.</Text>
      </Screen>
    );
  }

  const { user, profile, service, serviceDefinition, area, portfolio, reviews } = bundle;
  const specialties = [serviceDefinition.name];

  return (
    <Screen
      scroll
      padded={false}
      footer={
        <View style={styles.ctaBar}>
          <View>
            <Text style={typography.caption}>Desde</Text>
            <Text style={typography.h3}>{pricingLabel(service.pricingModel, service.price, service.currency)}</Text>
          </View>
          <Button
            label="Reservar"
            fullWidth={false}
            onPress={() => router.push({ pathname: "/(customer)/booking/new", params: { providerId, providerServiceId: service.id } })}
            style={styles.ctaButton}
          />
        </View>
      }
    >
      <View style={styles.hero}>
        <Avatar firstName={user.firstName} lastName={user.lastName} size={84} online={profile.isOnline} />
        <View style={styles.nameRow}>
          <Text style={typography.h1}>
            {user.firstName} {user.lastName[0]}.
          </Text>
          {profile.isVerified && <Ionicons name="checkmark-circle" size={20} color={colors.brand} style={{ marginLeft: 6 }} />}
        </View>
        <View style={styles.metaRow}>
          <RatingStars rating={profile.ratingAverage} count={profile.ratingCount} />
          <Text style={typography.caption}> · +{profile.completedJobsCount} servicios</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={typography.caption}>{area?.city ?? "Colombia"}</Text>
        </View>
        {profile.isVerified && (
          <View style={styles.verifiedPill}>
            <Ionicons name="shield-checkmark" size={14} color={colors.online} />
            <Text style={styles.verifiedPillText}>Identidad verificada</Text>
          </View>
        )}
        {currentUser && (
          <Pressable style={styles.favoriteBtn} onPress={() => toggleFavorite(currentUser.id, providerId)}>
            <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={22} color={isFavorite ? colors.danger : colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <View style={styles.tabsWrap}>
        <SegmentedControl
          options={[
            { value: "info", label: "Información" },
            { value: "services", label: "Servicios" },
            { value: "reviews", label: `Reseñas (${reviews.length})` },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === "info" && (
        <>
          <View style={styles.section}>
            {profile.bio && <Text style={typography.body}>{profile.bio}</Text>}
            <View style={styles.infoRow}>
              <Ionicons name="language-outline" size={16} color={colors.textSecondary} />
              <Text style={typography.caption}>{profile.languages.join(", ")}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name={profile.isOnline ? "flash-outline" : "time-outline"} size={16} color={colors.textSecondary} />
              <Text style={typography.caption}>{profile.isOnline ? "Disponible ahora" : "Actualmente fuera de línea"}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={typography.h2}>Especialidades</Text>
            <View style={styles.chipsWrap}>
              {specialties.map((s) => (
                <View key={s} style={styles.specialtyChip}>
                  <Text style={styles.specialtyChipText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>

          {portfolio.length > 0 && (
            <View style={styles.section}>
              <Text style={typography.h2}>Portafolio</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
                {portfolio.map((item) => (
                  <View key={item.id} style={styles.portfolioTile}>
                    <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </>
      )}

      {tab === "services" && (
        <View style={styles.section}>
          <View style={styles.serviceCard}>
            <View style={styles.serviceIconWrap}>
              <CategoryIcon name="scissors" size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.bodyStrong}>{serviceDefinition.name}</Text>
              <Text style={typography.caption}>{serviceDefinition.defaultDurationMinutes ?? 45} min aprox.</Text>
            </View>
            <Text style={typography.h3}>{pricingLabel(service.pricingModel, service.price, service.currency)}</Text>
          </View>
        </View>
      )}

      {tab === "reviews" && (
        <View style={styles.section}>
          {reviews.length === 0 ? (
            <Text style={typography.caption}>Aún no hay reseñas.</Text>
          ) : (
            reviews.map((r) => (
              <View key={r.id} style={styles.reviewCard}>
                <RatingStars rating={r.ratings.overall} showValue={false} />
                {r.comment && <Text style={[typography.body, { marginTop: 4 }]}>{r.comment}</Text>}
              </View>
            ))
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: spacing.xl, paddingHorizontal: spacing.lg, position: "relative" },
  nameRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.md },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.xs },
  favoriteBtn: { position: "absolute", top: spacing.lg, right: spacing.lg, padding: spacing.xs },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: `${colors.online}18`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
  },
  verifiedPillText: { color: colors.online, fontSize: 12, fontWeight: "700" },
  tabsWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.sm },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  specialtyChip: { backgroundColor: colors.bgMuted, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6 },
  specialtyChipText: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  serviceIconWrap: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" },
  portfolioTile: {
    width: 96,
    height: 96,
    borderRadius: radii.md,
    backgroundColor: colors.bgMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  reviewCard: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.sm },
  ctaBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ctaButton: { paddingHorizontal: spacing.xl },
});
