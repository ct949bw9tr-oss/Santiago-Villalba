import React, { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { Avatar } from "../components/Avatar";
import { RatingStars } from "../components/RatingStars";
import { Button } from "../components/Button";
import { CategoryIcon } from "../components/CategoryIcon";
import { colors, radii, spacing, typography } from "../theme";
import { useCurrentUser, useIsFavorite, useProviderBundle, useTaskSwiftStore } from "../data";
import { pricingLabel } from "../lib/format";

export function ProviderProfileScreen({ providerId }: { providerId: string }) {
  const router = useRouter();
  const navigation = useNavigation();
  const bundle = useProviderBundle(providerId);
  const currentUser = useCurrentUser();
  const isFavorite = useIsFavorite(currentUser?.id, providerId);
  const toggleFavorite = useTaskSwiftStore((s) => s.toggleFavorite);

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

  return (
    <Screen
      scroll
      padded={false}
      footer={
        <View style={styles.ctaBar}>
          <View>
            <Text style={typography.caption}>Precio</Text>
            <Text style={typography.h3}>{pricingLabel(service.pricingModel, service.price, service.currency)}</Text>
          </View>
          <Button
            label="Solicitar servicio"
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
        <Text style={typography.body}>{profile.headline}</Text>
        <View style={styles.metaRow}>
          <RatingStars rating={profile.ratingAverage} count={profile.ratingCount} />
        </View>
        <View style={styles.statsRow}>
          <Stat label="Trabajos" value={`${profile.completedJobsCount}`} />
          <Stat label="Experiencia" value={`${profile.yearsExperience ?? 0} años`} />
          <Stat label="Responde en" value={`${profile.responseTimeMinutes ?? "—"} min`} />
        </View>
        {currentUser && (
          <Pressable style={styles.favoriteBtn} onPress={() => toggleFavorite(currentUser.id, providerId)}>
            <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={22} color={isFavorite ? colors.danger : colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <View style={styles.section}>
        {profile.bio && <Text style={typography.body}>{profile.bio}</Text>}
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
          <Text style={typography.caption}>
            {area?.city ?? "Colombia"} · radio de {area?.radiusKm ?? 5} km
          </Text>
        </View>
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
        <Text style={typography.h2}>Servicio</Text>
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

      <View style={styles.section}>
        <Text style={typography.h2}>Reseñas ({reviews.length})</Text>
        {reviews.length === 0 ? (
          <Text style={[typography.caption, { marginTop: spacing.sm }]}>Aún no hay reseñas.</Text>
        ) : (
          reviews.map((r) => (
            <View key={r.id} style={styles.reviewCard}>
              <RatingStars rating={r.ratings.overall} showValue={false} />
              {r.comment && <Text style={[typography.body, { marginTop: 4 }]}>{r.comment}</Text>}
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={typography.h3}>{value}</Text>
      <Text style={typography.tiny}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: spacing.xl, paddingHorizontal: spacing.lg, position: "relative" },
  nameRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.md },
  metaRow: { marginTop: spacing.xs },
  statsRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.lg },
  stat: { alignItems: "center" },
  favoriteBtn: { position: "absolute", top: spacing.lg, right: spacing.lg, padding: spacing.xs },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.sm },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
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
