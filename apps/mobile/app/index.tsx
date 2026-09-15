import React from "react";
import { Redirect } from "expo-router";
import { useTaskSwiftStore } from "../src/data";

export default function Index() {
  const currentUserId = useTaskSwiftStore((s) => s.currentUserId);
  const activeMode = useTaskSwiftStore((s) => s.activeMode);

  if (!currentUserId) return <Redirect href="/(auth)/login" />;
  return <Redirect href={activeMode === "provider" ? "/(provider)/(tabs)/home" : "/(customer)/(tabs)/home"} />;
}
