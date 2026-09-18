import { GeoPoint } from "@taskswift/types";

export interface MapMarker {
  id: string;
  position: GeoPoint;
  variant?: "provider" | "you" | "destination";
  label?: string;
}

export const MARKER_COLOR_KEYS = {
  provider: "brand",
  you: "accent",
  destination: "danger",
} as const;
