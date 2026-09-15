import React from "react";
import { useLocalSearchParams } from "expo-router";
import { BookingRequestScreen } from "../../../src/screens/BookingRequestScreen";

export default function NewBooking() {
  const { providerId, providerServiceId } = useLocalSearchParams<{ providerId: string; providerServiceId: string }>();
  return <BookingRequestScreen providerId={providerId} providerServiceId={providerServiceId} />;
}
