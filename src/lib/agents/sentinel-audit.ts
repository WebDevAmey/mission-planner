import type { MissionItem, MissionPlan, MissionPlanSettings } from '@/types/mission';
import { PlannerAction, supportsCoordinates } from '@/lib/mavlink/commands';
import { createMissionItem, missionSanityCheck } from '@/lib/services/mission-builder';
import { computeRiskScore } from '@/lib/services/risk-scorer';
import { computeMissionMetrics } from '@/lib/services/metrics-service';
import { checkGeofences } from '@/lib/services/geofence-checker';
import { getElevations } from '@/lib/services/terrain-service';
import type { ConstraintConfig, NoFlyZone } from '@/lib/store/constraints-store';
import type { GeofenceItem } from '@/lib/store/geofence-store';
import type { AuditFinding, AuditReport, MissionDraft } from '@/lib/agents/schemas';

/**
 * SENTINEL is deliberately NOT an LLM call. Its verdict rules are fixed code, not a
 * judgment call a model could be argued or prompt-injected out of — that's the whole
 * point of giving it veto power in the graph.
 */

// No battery-capacity model exists in this app; assume a conservative small-multirotor
// endurance so SENTINEL has *some* energy floor rather than none.
const ASSUMED_MAX_ENDURANCE_SEC = 20 * 60;
const RISK_VETO_THRESHOLD = 65;

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
  nfzs: NoFlyZone[];
  geofences: GeofenceItem[];
  homePosition: { latitude: number; longitude: number; altitude: number } | null;
}

export async function runSentinelAudit(
  draft: MissionDraft,
  ctx: SentinelAuditContext
): Promise<{ report: AuditReport; items: MissionItem[] }> {
  const items = buildMissionItemsFromDraft(draft, ctx.settings);
  const findings: AuditFinding[] = [];

  const stubPlan: MissionPlan = {
    id: 'draft',
    name: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items,
    settings: ctx.settings,
    homePosition: ctx.homePosition,
  };

  for (const w of missionSanityCheck(stubPlan)) {
    findings.push({
      severity: w.severity === 'error' ? 'blocker' : 'warning',
      code: 'SANITY',
      message: w.message,
      waypointIndexes: w.seq !== undefined ? [w.seq] : undefined,
    });
  }

  for (const v of checkGeofences(items, ctx.geofences)) {
    findings.push({
      severity: 'blocker',
      code: 'GEOFENCE',
      message: v.message,
      waypointIndexes: [v.waypointIndex],
    });
  }

  const risk = computeRiskScore(items, ctx.config, ctx.nfzs);
  if (risk.total > RISK_VETO_THRESHOLD) {
    findings.push({
      severity: 'blocker',
      code: 'RISK_SCORE',
      message: `Risk score ${risk.total.toFixed(0)}/100 exceeds veto threshold of ${RISK_VETO_THRESHOLD}`,
    });
  } else if (risk.total > 45) {
    findings.push({
      severity: 'warning',
      code: 'RISK_SCORE',
      message: `Risk score ${risk.total.toFixed(0)}/100 is elevated`,
    });
  }

  const metrics = computeMissionMetrics(items, ctx.config, ctx.nfzs, ctx.homePosition);
  const enduranceFraction = metrics.estimatedFlightTimeSec / ASSUMED_MAX_ENDURANCE_SEC;
  if (enduranceFraction > 0.8) {
    findings.push({
      severity: 'blocker',
      code: 'ENERGY',
      message: `Estimated flight time ${metrics.estimatedFlightTimeFormatted} exceeds 80% of assumed ${Math.round(ASSUMED_MAX_ENDURANCE_SEC / 60)}min endurance`,
    });
  }

  await appendTerrainFindings(items, ctx, findings);

  const verdict: AuditReport['verdict'] = findings.some((f) => f.severity === 'blocker')
    ? 'VETO'
    : 'PASS';

  return {
    report: { verdict, riskScore: risk.total, findings },
    items,
  };
}

async function appendTerrainFindings(
  items: MissionItem[],
  ctx: SentinelAuditContext,
  findings: AuditFinding[]
): Promise<void> {
  const spatial = items
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) => supportsCoordinates(item.action) && item.latitude !== null && item.longitude !== null
    );
  if (spatial.length === 0) return;

  const homePoint = ctx.homePosition
    ? { lat: ctx.homePosition.latitude, lng: ctx.homePosition.longitude }
    : { lat: spatial[0].item.latitude!, lng: spatial[0].item.longitude! };

  try {
    const [homeElev, ...wpElevs] = await getElevations([
      homePoint,
      ...spatial.map(({ item }) => ({ lat: item.latitude!, lng: item.longitude! })),
    ]);

    spatial.forEach(({ item, index }, i) => {
      const terrainDeltaFromHome = wpElevs[i] - homeElev;
      const clearance = (item.altitude ?? 0) - terrainDeltaFromHome;
      if (clearance < ctx.config.minAGLClearance) {
        findings.push({
          severity: 'blocker',
          code: 'TERRAIN_CLEARANCE',
          message: `Waypoint ${index + 1} clears terrain by ~${Math.round(clearance)}m, below the ${ctx.config.minAGLClearance}m minimum`,
          waypointIndexes: [index],
        });
      }
    });
  } catch {
    // Public elevation API is best-effort; don't hard-fail the whole mission on a flaky network call.
    findings.push({
      severity: 'warning',
      code: 'TERRAIN_UNAVAILABLE',
      message: 'Terrain data unavailable — clearance was not verified',
    });
  }
}
