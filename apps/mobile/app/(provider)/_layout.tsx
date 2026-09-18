import React from "react";
import { Stack } from "expo-router";
import { colors } from "../../src/theme";

export default function ProviderLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="request/[id]" options={{ title: "Solicitud" }} />
      <Stack.Screen name="chat/[bookingId]" options={{ title: "Mensajes" }} />
      <Stack.Screen name="onboarding/index" options={{ title: "Nuevo proveedor" }} />
      <Stack.Screen name="services/index" options={{ title: "Mis servicios" }} />
    </Stack>
  );
}
