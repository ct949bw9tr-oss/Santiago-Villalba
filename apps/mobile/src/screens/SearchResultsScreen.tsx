import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { ProviderCard } from "../components/ProviderCard";
import { EmptyState } from "../components/EmptyState";
import { MapPlaceholder, MapPin } from "../components/MapPlaceholder";
import { SegmentedControl } from "../components/SegmentedControl";
import { Avatar } from "../components/Avatar";
import { RatingStars } from "../components/RatingStars";
import { colors, radii, spacing, typography } from "../theme";
import { useTaskSwiftStore } from "../data";
import { ProviderSearchFilters, searchProviders } from "../data/queries";
import { pricingLabel } from "../lib/format";

interface SearchResultsScreenProps {
  initialQuery?: string;
  categorySlug?: string;
}

type FilterChip = "availableNow" | "verifiedOnly";
type ViewMode = "list" | "map";

// Deterministic pseudo-positions so the same result always lands on the same spot.
function pinPosition(seed: string): { top: number; left: number } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return { top: 15 + (hash % 70), left: 15 + ((hash >> 8) % 70) };
}

export function SearchResultsScreen({ initialQuery, categorySlug }: SearchResultsScreenProps) {
  const router = useRouter();
  const categories = useTaskSwiftStore((s) => s.categories);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [activeChips, setActiveChips] = useState<Set<FilterChip>>(new Set());
  const [sort, setSort] = useState<ProviderSearchFilters["sort"]>("recommended");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const category = categories.find((c) => c.slug === categorySlug);

  const results = useMemo(
    () =>
      searchProviders({
        query,
        categorySlug,
        availableNow: activeChips.has("availableNow"),
        verifiedOnly: activeChips.has("verifiedOnly"),
        sort,
      }),
    [query, categorySlug, activeChips, sort]
  );

  function toggleChip(chip: FilterChip) {
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (next.has(chip)) next.delete(chip);
      else next.add(chip);
      return next;
    });
  }

  return (
    <Screen>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.input}
          placeholder={category ? category.name : "Buscar servicio o profesional"}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoFocus={!categorySlug}
        />
      </View>

      <View style={styles.toggleWrap}>
        <SegmentedControl
          options={[
            { value: "list", label: "Lista" },
            { value: "map", label: "Mapa" },
          ]}
          value={viewMode}
          onChange={setViewMode}
        />
      </View>

      <View style={styles.chipsRow}>
        <Chip label="Disponible ahora" active={activeChips.has("availableNow")} onPress={() => toggleChip("availableNow")} />
        <Chip label="Verificados" active={activeChips.has("verifiedOnly")} onPress={() => toggleChip("verifiedOnly")} />
        <Chip label="Mejor calificados" active={sort === "rating"} onPress={() => setSort(sort === "rating" ? "recommended" : "rating")} />
        <Chip label="Precio" active={sort === "price"} onPress={() => setSort(sort === "price" ? "recommended" : "price")} />
      </View>

      {viewMode === "map" ? (
        <View style={styles.mapWrap}>
          <MapPlaceholder
            height={320}
            pins={results.map((r): MapPin => ({ id: r.service.id, ...pinPosition(r.service.id), variant: "provider" }))}
          />
          {results[0] && (
            <Pressable
              style={styles.mapCard}
              onPress={() => router.push({ pathname: "/(customer)/provider/[id]", params: { id: results[0]!.user.id } })}
            >
              <Avatar firstName={results[0].user.firstName} lastName={results[0].user.lastName} size={48} online={results[0].profile.isOnline} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={typography.bodyStrong} numberOfLines={1}>
                  {results[0].user.firstName} {results[0].user.lastName[0]}.
                </Text>
                <RatingStars rating={results[0].profile.ratingAverage} />
                <Text style={typography.captionStrong}>{pricingLabel(results[0].service.pricingModel, results[0].service.price, results[0].service.currency)}</Text>
              </View>
              <Text style={styles.mapCardCta}>Ver perfil</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.service.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ProviderCard result={item} onPress={() => router.push({ pathname: "/(customer)/provider/[id]", params: { id: item.user.id } })} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="sad-outline"
              title="No encontramos profesionales disponibles"
              description="Prueba ampliar el radio de búsqueda, cambiar de zona o programar para más tarde."
            />
          }
        />
      )}
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[typography.captionStrong, active && { color: colors.textInverse }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.bgMuted,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.textPrimary },
  toggleWrap: { marginBottom: spacing.md },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  list: { paddingBottom: 40 },
  mapWrap: { position: "relative" },
  mapCard: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: spacing.md,
    marginHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapCardCta: { color: colors.brand, fontWeight: "700", fontSize: 13 },
});
