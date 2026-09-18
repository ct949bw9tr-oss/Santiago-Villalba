import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GeoPoint } from "@taskswift/types";
import { colors, radii } from "../theme";
import { GOOGLE_MAPS_API_KEY } from "../lib/mapsConfig";
import { MapMarker } from "./mapTypes";

const MARKER_COLORS: Record<string, string> = {
  provider: colors.brand,
  you: colors.accent,
  destination: colors.danger,
};

const BOGOTA_CENTER: GeoPoint = { lat: 4.711, lng: -74.0721 };

let loaderPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as any;
  if (w.google?.maps) return Promise.resolve();
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Google Maps"));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

export function MapView({ markers, height = 220, center }: { markers: MapMarker[]; height?: number; center?: GeoPoint }) {
  const containerRef = useRef<View>(null);
  const mapRef = useRef<any>(null);
  const markerObjsRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return;
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const node = containerRef.current as unknown as HTMLDivElement | null;
    if (!node) return;
    const google = (window as any).google;
    const focus = center ?? markers[0]?.position ?? BOGOTA_CENTER;

    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(node, {
        center: focus,
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
      });
    } else {
      mapRef.current.setCenter(focus);
    }

    markerObjsRef.current.forEach((m) => m.setMap(null));
    markerObjsRef.current = markers.map(
      (marker) =>
        new google.maps.Marker({
          position: marker.position,
          map: mapRef.current,
          title: marker.label,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: MARKER_COLORS[marker.variant ?? "provider"],
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
        })
    );
  }, [ready, markers, center]);

  if (!GOOGLE_MAPS_API_KEY || failed) {
    return (
      <View style={[styles.fallback, { height }]}>
        <Text style={styles.fallbackText}>Mapa no disponible por ahora</Text>
      </View>
    );
  }

  return <View ref={containerRef} style={[styles.map, { height }]} />;
}

const styles = StyleSheet.create({
  map: { width: "100%", borderRadius: radii.lg, overflow: "hidden" },
  fallback: { backgroundColor: "#E6EEF9", borderRadius: radii.lg, alignItems: "center", justifyContent: "center" },
  fallbackText: { color: colors.textMuted },
});
