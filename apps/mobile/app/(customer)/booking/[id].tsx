import React from "react";
import { useLocalSearchParams } from "expo-router";
import { BookingDetailScreen } from "../../../src/screens/BookingDetailScreen";

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BookingDetailScreen bookingId={id} chatPathname="/(customer)/chat/[bookingId]" />;
}
