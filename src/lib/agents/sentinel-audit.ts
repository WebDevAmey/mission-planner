import type { MissionItem, MissionPlan, MissionPlanSettings } from '@/types/mission';
import type { PlannerAction } from '@/lib/mavlink/commands';
import { createMissionItem } from '@/lib/domain/items';
import { buildClearanceSamples, computeClearanceProfile, computeMissionMetrics, formatDurationShort } from '@/lib/domain/metrics';
import { homeOf } from '@/lib/domain/mission';
import { computeRisk, limitsFromConstraintConfig, validateMission, type Issue } from '@/lib/domain/validate';
import { zonesFromLegacy, type Zone } from '@/lib/domain/zones';
import { getElevations } from '@/lib/services/terrain-service';
import type { ConstraintConfig, NoFlyZone } from '@/lib/store/constraints-store';
import type { GeofenceItem } from '@/lib/store/geofence-store';
import type { AuditFinding, AuditReport, MissionDraft } from '@/lib/agents/schemas';

/**
 * SENTINEL is deliberately NOT an LLM call. Its verdict rules are fixed code, not a
 * judgment call a model could be argued or prompt-injected out of — that's the whole
 * point of giving it veto power in the graph.
 */

/** Fallback rated endurance when the mission has none: a conservative small multirotor. */
export const DEFAULT_RATED_ENDURANCE_S = 20 * 60;
/** Upper bound on terrain samples per audit, to keep the public elevation API calls bounded. */
const MAX_TERRAIN_SAMPLES = 400;

export function buildMissionItemsFromDraft(
  draft: MissionDraft,
  settings: MissionPlanSettings
): MissionItem[] {
  return draft.waypoints.map((wp, index) => {
    const item = createMissionItem(wp.action as PlannerAction, index, settings, {
      latitude: wp.latitude ?? undefined,
      longitude: wp.longitude ?? undefined,
      altitude: wp.altitude ?? undefined,
    });
    if (wp.speed) item.speed = wp.speed;
    if (wp.notes) item.notes = wp.notes;
    return item;
  });
}

export interface SentinelAuditContext {
  settings: MissionPlanSettings;
  config: ConstraintConfig;
  /** Unified zones. When omitted, legacy `nfzs` + `geofences` are converted. */
  zones?: Zone[];
  nfzs?: NoFlyZone[];
  geofences?: GeofenceItem[];
  homePosition: { latitude: number; longitude: number; altitude: number } | null;
  /** Rated vehicle endurance in seconds (defaults to DEFAULT_RATED_ENDURANCE_S). */
  ratedEnduranceS?: number | null;
  /** Terrain lookup; defaults to the public elevation service. Injected in tests. */
  elevations?: (points: { lat: number; lng: number }[]) => Promise<number[]>;
}

function toFinding(issue: Issue, indexOf: Map<string, number>): AuditFinding {
  const idx = issue.itemIds.map((id) => indexOf.get(id)).filter((i): i is number => i !== undefined);
  return {
    severity: issue.severity === 'error' ? 'blocker' : 'warning',
    code: issue.code,
    message: issue.message,
    waypointIndexes: idx.length > 0 ? idx : undefined,
  };
}

export async function runSentinelAudit(
  draft: MissionDraft,
  ctx: SentinelAuditContext
): Promise<{ report: AuditReport; items: MissionItem[] }> {
  const items = buildMissionItemsFromDraft(draft, ctx.settings);
  const mission: MissionPlan = {
    id: 'draft',
    name: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items,
    settings: ctx.settings,
    homePosition: ctx.homePosition,
  };
  const zones = ctx.zones ?? zonesFromLegacy(ctx.nfzs ?? [], ctx.geofences ?? []);
  const ratedEnduranceS = ctx.ratedEnduranceS ?? DEFAULT_RATED_ENDURANCE_S;
  const limits = { ...limitsFromConstraintConfig(ctx.config), ratedEnduranceS };
  const metrics = computeMissionMetrics(mission, {
    model: { cruiseSpeedMs: ctx.config.defaultSpeedMs || ctx.settings.defaultSpeed },
    ratedEnduranceS,
  });

  const findings: AuditFinding[] = [];
  const terrain = await terrainClearance(mission, ctx, findings);
  const issues = validateMission(mission, { zones, limits, terrain, estimatedTimeS: metrics.timeS, distanceM: metrics.distanceM });
  const indexOf = new Map(items.map((it, i) => [it.id, i]));
  findings.unshift(...issues.map((i) => toFinding(i, indexOf)));

  // Informational only: the verdict comes from validator errors, never from the score.
  const risk = computeRisk(mission, { zones, limits, issues, distanceM: metrics.distanceM });
  findings.push({
    severity: 'info',
    code: 'SUMMARY',
    message: `${(metrics.distanceM / 1000).toFixed(2)} km, ~${formatDurationShort(metrics.timeS)} (${Math.round((metrics.enduranceFraction ?? 0) * 100)}% of rated endurance), risk ${risk.total.toFixed(0)}/100 ${risk.level}`,
  });

  const verdict: AuditReport['verdict'] = findings.some((f) => f.severity === 'blocker') ? 'VETO' : 'PASS';
  return { report: { verdict, riskScore: risk.total, findings }, items };
}

/** Home-relative terrain clearance along every leg; adds a warning when terrain is unavailable. */
async function terrainClearance(mission: MissionPlan, ctx: SentinelAuditContext, findings: AuditFinding[]) {
  const home = homeOf(mission);
  let samples = buildClearanceSamples(mission);
  if (!home || samples.length === 0) return undefined;
  if (samples.length > MAX_TERRAIN_SAMPLES) {
    const stride = samples.length / MAX_TERRAIN_SAMPLES;
    samples = Array.from({ length: MAX_TERRAIN_SAMPLES }, (_, i) => samples[Math.floor(i * stride)]);
  }
  try {
    const lookup = ctx.elevations ?? getElevations;
    const [homeElev, ...elevs] = await lookup([
      { lat: home[1], lng: home[0] },
      ...samples.map((s) => ({ lat: s.pos[1], lng: s.pos[0] })),
    ]);
    return computeClearanceProfile(samples, elevs, homeElev);
  } catch {
    // Public elevation API is best-effort; don't hard-fail the whole mission on a flaky network call.
    findings.push({
      severity: 'warning',
      code: 'TERRAIN_UNAVAILABLE',
      message: 'Terrain data unavailable — clearance was not verified',
    });
    return undefined;
  }
}
