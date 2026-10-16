import { z } from 'zod';
import { zoneInputSchema } from '@/lib/domain/zones/schema';
import { PlannerAction } from '@/lib/mavlink/commands';

const plannerActionValues = Object.values(PlannerAction) as [PlannerAction, ...PlannerAction[]];

export const WaypointSpecSchema = z.object({
  action: z.enum(plannerActionValues),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  altitude: z.number().nullable(),
  speed: z.number().positive().nullable().optional(),
  notes: z.string().max(140).optional(),
});
export type WaypointSpec = z.infer<typeof WaypointSpecSchema>;

export const MissionDraftSchema = z.object({
  rationale: z.string().max(400),
  waypoints: z.array(WaypointSpecSchema).min(1).max(40),
  altitudeOverride: z.boolean().optional(),
  revisionNotes: z.string().max(300).optional(),
  error: z.string().optional(),
});
export type MissionDraft = z.infer<typeof MissionDraftSchema>;

export const AuditFindingSchema = z.object({
  severity: z.enum(['blocker', 'warning', 'info']),
  code: z.string(),
  message: z.string().max(160),
  waypointIndexes: z.array(z.number().int().nonnegative()).optional(),
});
export type AuditFinding = z.infer<typeof AuditFindingSchema>;

export const AuditReportSchema = z.object({
  verdict: z.enum(['PASS', 'VETO']),
  riskScore: z.number().min(0).max(100),
  findings: z.array(AuditFindingSchema),
});
export type AuditReport = z.infer<typeof AuditReportSchema>;

export type AgentName = 'ATLAS' | 'SENTINEL' | 'SYSTEM';

export type AgentEvent =
  | { id: string; agent: AgentName; type: 'thinking'; title: string; timestamp: string }
  | { id: string; agent: AgentName; type: 'tool_call'; title: string; detail: string; timestamp: string }
  | { id: string; agent: AgentName; type: 'tool_result'; title: string; detail: string; timestamp: string }
  | { id: string; agent: AgentName; type: 'draft'; title: string; payload: MissionDraft; timestamp: string }
  | { id: string; agent: AgentName; type: 'audit'; title: string; payload: AuditReport; timestamp: string }
  | { id: string; agent: AgentName; type: 'error'; title: string; detail: string; timestamp: string }
  | { id: string; agent: AgentName; type: 'done'; title: string; payload: FlightDeckResult; timestamp: string };

export interface FlightDeckResult {
  status: 'approved_ready' | 'needs_human_input' | 'error';
  draftMission: MissionDraft | null;
  auditReport: AuditReport | null;
  vetoCount: number;
  error: string | null;
}

/** Request payload posted by the client — server has no access to the client's zustand stores. */
const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const label = z.string().max(200);

export const FlightDeckRequestSchema = z.object({
  prompt: z.string().min(1).max(2000),
  settings: z.object({
    defaultAltitude: z.number().min(0).max(10000),
    defaultSpeed: z.number().min(0).max(200),
    defaultLoiterTime: z.number().min(0).max(86400),
    defaultWaitTime: z.number().min(0).max(86400),
    altitudeReference: z.literal('relative'),
  }),
  constraints: z.object({
    maxDistanceM: z.number().min(0).max(1_000_000),
    maxAltM: z.number().min(0).max(10000),
    minAltM: z.number().min(0).max(10000),
    maxSpeedMs: z.number().min(0).max(200),
    minAGLClearance: z.number().min(0).max(10000),
    defaultSpeedMs: z.number().min(0).max(200),
  }),
  nfzs: z
    .array(
      z.object({
        id: z.string().max(100),
        latitude: lat,
        longitude: lng,
        radiusM: z.number().min(0).max(100000),
        label,
      })
    )
    .max(200),
  geofences: z
    .array(
      z.object({
        id: z.string().max(100),
        type: z.enum(['circle', 'polygon']),
        mode: z.enum(['keep-in', 'keep-out']),
        label,
        color: z.string().max(50),
        center: z.object({ lat, lng }).optional(),
        radiusM: z.number().min(0).max(100000).optional(),
        vertices: z.array(z.object({ lat, lng })).max(500).optional(),
        enabled: z.boolean(),
      })
    )
    .max(200),
  homePosition: z
    .object({ latitude: lat, longitude: lng, altitude: z.number().min(-1000).max(10000) })
    .nullable(),
  /** Unified mission zones; when present they replace `nfzs` and `geofences` for the audit. */
  zones: z.array(zoneInputSchema).max(200).optional(),
  /** Rated vehicle endurance in seconds for SENTINEL's energy budget. */
  ratedEnduranceS: z.number().positive().max(86400).optional(),
});
export type FlightDeckRequest = z.infer<typeof FlightDeckRequestSchema>;
