import React from "react";
import { StyleSheet } from "react-native";
import RNMapView, { Marker } from "react-native-maps";
import { GeoPoint } from "@taskswift/types";
import { colors, radii } from "../theme";
import { MapMarker } from "./mapTypes";

const MARKER_COLORS: Record<string, string> = {
  provider: colors.brand,
  you: colors.accent,
  destination: colors.danger,
};

export function MapView({ markers, height = 220, center }: { markers: MapMarker[]; height?: number; center?: GeoPoint }) {
  const focus = center ?? markers[0]?.position;
  if (!focus) return null;

  return (
    <RNMapView
      style={[styles.map, { height }]}
      initialRegion={{ latitude: focus.lat, longitude: focus.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
    >
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          coordinate={{ latitude: marker.position.lat, longitude: marker.position.lng }}
          title={marker.label}
          pinColor={MARKER_COLORS[marker.variant ?? "provider"]}
        />
      ))}
    </RNMapView>
  );
}

const styles = StyleSheet.create({
  map: { width: "100%", borderRadius: radii.lg, overflow: "hidden" },
});
