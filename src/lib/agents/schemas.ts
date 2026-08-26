import { z } from 'zod';
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
export const FlightDeckRequestSchema = z.object({
  prompt: z.string().min(1).max(2000),
  settings: z.object({
    defaultAltitude: z.number(),
    defaultSpeed: z.number(),
    defaultLoiterTime: z.number(),
    defaultWaitTime: z.number(),
    altitudeReference: z.literal('relative'),
  }),
  constraints: z.object({
    maxDistanceM: z.number(),
    maxAltM: z.number(),
    minAltM: z.number(),
    maxSpeedMs: z.number(),
    minAGLClearance: z.number(),
    defaultSpeedMs: z.number(),
  }),
  nfzs: z.array(
    z.object({
      id: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      radiusM: z.number(),
      label: z.string(),
    })
  ),
  geofences: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['circle', 'polygon']),
      mode: z.enum(['keep-in', 'keep-out']),
      label: z.string(),
      color: z.string(),
      center: z.object({ lat: z.number(), lng: z.number() }).optional(),
      radiusM: z.number().optional(),
      vertices: z.array(z.object({ lat: z.number(), lng: z.number() })).optional(),
      enabled: z.boolean(),
    })
  ),
  homePosition: z
    .object({ latitude: z.number(), longitude: z.number(), altitude: z.number() })
    .nullable(),
});
export type FlightDeckRequest = z.infer<typeof FlightDeckRequestSchema>;
