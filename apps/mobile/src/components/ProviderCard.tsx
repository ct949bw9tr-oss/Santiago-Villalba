import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme";
import { formatDistance, pricingLabel } from "../lib/format";
import { Avatar } from "./Avatar";
import { RatingStars } from "./RatingStars";
import { ProviderSearchResult } from "../data/queries";

interface ProviderCardProps {
  result: ProviderSearchResult;
  onPress: () => void;
}

export function ProviderCard({ result, onPress }: ProviderCardProps) {
  const { user, profile, service, serviceName, distanceKm } = result;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Avatar firstName={user.firstName} lastName={user.lastName} size={56} online={profile.isOnline} />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={typography.h3} numberOfLines={1}>
            {user.firstName} {user.lastName[0]}.
          </Text>
          {profile.isVerified && <Ionicons name="checkmark-circle" size={16} color={colors.brand} style={styles.verifiedIcon} />}
        </View>
        <Text style={typography.caption} numberOfLines={1}>
          {profile.headline}
        </Text>
        <View style={styles.metaRow}>
          <RatingStars rating={profile.ratingAverage} />
          <Text style={typography.caption}> · {profile.completedJobsCount} trabajos</Text>
        </View>
        <View style={styles.metaRow}>
          {distanceKm !== null && <Text style={typography.caption}>{formatDistance(distanceKm)} · </Text>}
          <Text style={typography.captionStrong}>{pricingLabel(service.pricingModel, service.price, service.currency)}</Text>
        </View>
      </View>
      <View style={styles.rightCol}>
        {profile.isOnline ? (
          <View style={styles.availableBadge}>
            <Text style={styles.availableText}>Disponible</Text>
          </View>
        ) : (
          <Text style={typography.tiny}>Fuera de línea</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  pressed: { opacity: 0.8 },
  info: { flex: 1, marginLeft: spacing.md, justifyContent: "center", gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center" },
  verifiedIcon: { marginLeft: 4 },
  metaRow: { flexDirection: "row", alignItems: "center" },
  rightCol: { justifyContent: "center", alignItems: "flex-end" },
  availableBadge: { backgroundColor: `${colors.online}22`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.pill },
  availableText: { color: colors.online, fontSize: 11, fontWeight: "700" },
});
