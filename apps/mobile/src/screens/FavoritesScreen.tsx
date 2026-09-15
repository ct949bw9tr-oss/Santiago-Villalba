import React, { useMemo } from "react";
import { FlatList, Text } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../components/Screen";
import { ProviderCard } from "../components/ProviderCard";
import { EmptyState } from "../components/EmptyState";
import { spacing, typography } from "../theme";
import { useCurrentUser, useTaskSwiftStore } from "../data";
import { searchProviders } from "../data/queries";

export function FavoritesScreen() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const favorites = useTaskSwiftStore((s) => s.favorites);

  const favoriteProviderIds = useMemo(
    () => new Set(favorites.filter((f) => f.customerId === currentUser?.id).map((f) => f.providerId)),
    [favorites, currentUser]
  );
  const results = useMemo(() => searchProviders({}).filter((r) => favoriteProviderIds.has(r.user.id)), [favoriteProviderIds]);

  return (
    <Screen>
      <Text style={typography.display}>Favoritos</Text>
      <FlatList
        data={results}
        keyExtractor={(r) => r.service.id}
        style={{ marginTop: spacing.lg }}
        ListEmptyComponent={<EmptyState icon="heart-outline" title="Sin favoritos aún" description="Toca el corazón en el perfil de un proveedor para guardarlo aquí." />}
        renderItem={({ item }) => (
          <ProviderCard result={item} onPress={() => router.push({ pathname: "/(customer)/provider/[id]", params: { id: item.user.id } })} />
        )}
      />
    </Screen>
  );
}
