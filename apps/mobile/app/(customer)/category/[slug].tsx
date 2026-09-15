import React from "react";
import { useLocalSearchParams } from "expo-router";
import { SearchResultsScreen } from "../../../src/screens/SearchResultsScreen";

export default function Category() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <SearchResultsScreen categorySlug={slug} />;
}
