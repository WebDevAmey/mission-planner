import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { getElevations } from '@/lib/services/terrain-service';
import { fetchUpstreamJson } from '@/lib/http/upstream';

export const geocodeTool = tool(
  async ({ query }: { query: string }) => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
      const data = (await fetchUpstreamJson(url, {
        headers: { 'User-Agent': 'MPS-FlightDeck/0.1 (mission-planner)' },
        timeoutMs: 8000,
        maxBytes: 256 * 1024,
      })) as Array<{ lat: string; lon: string; display_name: string }>;
      if (!Array.isArray(data) || data.length === 0) return { ok: false, error: 'No match found for that location' };
      return {
        ok: true,
        data: {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
          displayName: data[0].display_name,
        },
      };
    } catch {
      return { ok: false, error: 'GEOCODE_UNAVAILABLE' };
    }
  },
  {
    name: 'geocode',
    description: 'Resolve a named place (e.g. "Central Park, NYC") to latitude/longitude. Skip this if the user already gave coordinates.',
    schema: z.object({ query: z.string().min(1).max(200).describe('Place name or address to resolve') }),
  }
);

export const getTerrainElevationTool = tool(
  async ({ points }: { points: { lat: number; lng: number }[] }) => {
    try {
      const elevations = await getElevations(points);
      return { ok: true, data: points.map((p, i) => ({ ...p, elevationM: elevations[i] })) };
    } catch {
      return { ok: false, error: 'TERRAIN_UNAVAILABLE' };
    }
  },
  {
    name: 'get_terrain_elevation',
    description: 'Look up ground elevation (meters, MSL) for a set of lat/lng points in the operating area.',
    schema: z.object({
      points: z
        .array(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }))
        .min(1)
        .max(50),
    }),
  }
);

export const atlasTools = [geocodeTool, getTerrainElevationTool];
