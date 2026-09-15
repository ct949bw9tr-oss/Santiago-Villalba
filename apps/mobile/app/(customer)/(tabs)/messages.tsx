import React from "react";
import { MessagesListScreen } from "../../../src/screens/MessagesListScreen";

export default function CustomerMessages() {
  return <MessagesListScreen role="customer" chatPathname="/(customer)/chat/[bookingId]" />;
}
