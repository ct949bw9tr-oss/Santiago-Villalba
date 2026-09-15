import { GeoPoint } from "@taskswift/types";

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two points, in kilometers. */
export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

export function isWithinServiceArea(customerLocation: GeoPoint, providerCenter: GeoPoint, radiusKm: number): boolean {
  return haversineDistanceKm(customerLocation, providerCenter) <= radiusKm;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
