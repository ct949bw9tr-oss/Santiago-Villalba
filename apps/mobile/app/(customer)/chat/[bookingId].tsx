import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ChatScreen } from "../../../src/screens/ChatScreen";

export default function Chat() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  return <ChatScreen bookingId={bookingId} />;
}
