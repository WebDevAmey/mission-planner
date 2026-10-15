import { z } from 'zod';
import { validateLngLatPolygon } from '@/lib/domain/geo';

const lngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

/** Zod schema for a zone payload (API create/update). */
export const zoneInputSchema = z
  .object({
    id: z.string().min(1).optional(),
    kind: z.enum(['no_fly', 'keep_in', 'keep_out']),
    shape: z.enum(['circle', 'polygon']),
    label: z.string().trim().max(200).default(''),
    enabled: z.boolean().default(true),
    centerLat: z.number().min(-90).max(90).nullable().optional(),
    centerLng: z.number().min(-180).max(180).nullable().optional(),
    radiusM: z.number().positive().max(100000).nullable().optional(),
    vertices: z.array(lngLat).min(3).max(501).nullable().optional(),
    minAltM: z.number().nullable().optional(),
    maxAltM: z.number().nullable().optional(),
  })
  .superRefine((zone, ctx) => {
    if (zone.shape === 'circle') {
      if (zone.centerLat == null || zone.centerLng == null || zone.radiusM == null) {
        ctx.addIssue({ code: 'custom', message: 'Circle zones need centerLat, centerLng and radiusM' });
      }
    } else {
      const v = zone.vertices ? validateLngLatPolygon(zone.vertices) : { ok: false, reason: 'too_few_points' };
      if (!v.ok) {
        ctx.addIssue({ code: 'custom', path: ['vertices'], message: `Invalid polygon: ${v.reason}` });
      }
    }
    if (zone.minAltM != null && zone.maxAltM != null && zone.minAltM > zone.maxAltM) {
      ctx.addIssue({ code: 'custom', path: ['minAltM'], message: 'minAltM must be <= maxAltM' });
    }
  });

export type ZoneInput = z.infer<typeof zoneInputSchema>;
