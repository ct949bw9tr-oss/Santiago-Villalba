import React from "react";
import { useLocalSearchParams } from "expo-router";
import { SearchResultsScreen } from "../../src/screens/SearchResultsScreen";

export default function Search() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  return <SearchResultsScreen initialQuery={q} />;
}
