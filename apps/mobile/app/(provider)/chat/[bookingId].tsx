import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ChatScreen } from "../../../src/screens/ChatScreen";

export default function ProviderChat() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  return <ChatScreen bookingId={bookingId} />;
}
