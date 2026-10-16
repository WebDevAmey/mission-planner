import { type ClassValue, clsx } from 'clsx';
import { cx } from '@/utils/cx';

/** clsx + the project's tailwind-merge (cx), which knows the custom text-style
 * utilities (`text-body-medium`, …). Plain twMerge reads those as text colours
 * and drops the real colour next to them (e.g. `text-fd-surface` on ui/Button). */
export function cn(...inputs: ClassValue[]) {
  return cx(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

export function formatCoordinate(lat: number, lng: number): string {
  return `${lat.toFixed(7)}°, ${lng.toFixed(7)}°`;
}

const EARTH_RADIUS_M = 6371000;

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function round7(n: number): number {
  return parseFloat(n.toFixed(7));
}

export function round1(n: number): number {
  return parseFloat(n.toFixed(1));
}
