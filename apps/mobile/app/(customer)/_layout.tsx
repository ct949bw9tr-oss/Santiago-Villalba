import React from "react";
import { Stack } from "expo-router";
import { colors } from "../../src/theme";

export default function CustomerLayout() {
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
      <Stack.Screen name="search" options={{ title: "Buscar" }} />
      <Stack.Screen name="category/[slug]" options={{ title: "" }} />
      <Stack.Screen name="provider/[id]" options={{ title: "" }} />
      <Stack.Screen name="booking/new" options={{ title: "Solicitar servicio" }} />
      <Stack.Screen name="booking/[id]" options={{ title: "Detalle del servicio" }} />
      <Stack.Screen name="chat/[bookingId]" options={{ title: "Mensajes" }} />
      <Stack.Screen name="review/[bookingId]" options={{ title: "Calificar servicio" }} />
      <Stack.Screen name="favorites" options={{ title: "Favoritos" }} />
      <Stack.Screen name="notifications" options={{ title: "Notificaciones" }} />
    </Stack>
  );
}
