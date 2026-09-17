import React from "react";
import { Redirect } from "expo-router";

/**
 * Expo Router matches routes against the page's real URL path. When this app
 * is hosted under a host-controlled prefix it didn't choose (e.g. a preview
 * artifact server), the initial path never matches a real route — so instead
 * of showing Expo Router's default "Unmatched Route" screen, send the user
 * into the app itself; app/index.tsx then redirects to login or home.
 */
export default function NotFound() {
  return <Redirect href="/" />;
}
