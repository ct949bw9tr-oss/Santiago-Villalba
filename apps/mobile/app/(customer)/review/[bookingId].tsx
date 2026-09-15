import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ReviewScreen } from "../../../src/screens/ReviewScreen";

export default function Review() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  return <ReviewScreen bookingId={bookingId} />;
}
