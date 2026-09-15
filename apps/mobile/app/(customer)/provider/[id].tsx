import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ProviderProfileScreen } from "../../../src/screens/ProviderProfileScreen";

export default function Provider() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProviderProfileScreen providerId={id} />;
}
