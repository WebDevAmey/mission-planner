import type { ConstraintConfig } from '@/lib/store/constraints-store';

export type IssueSeverity = 'error' | 'warning';

export type IssueCode =
  | 'MISSION_EMPTY'
  | 'NO_TAKEOFF'
  | 'NO_TERMINAL'
  | 'RTL_NOT_LAST'
  | 'DUPLICATE_SEQUENCE'
  | 'MISSING_COORDINATES'
  | 'DISTANCE_LIMIT'
  | 'ALT_ABOVE_MAX'
  | 'ALT_BELOW_MIN'
  | 'SPEED_ABOVE_MAX'
  | 'ZONE_NO_FLY_POINT'
  | 'ZONE_NO_FLY_CROSS'
  | 'ZONE_KEEP_OUT_POINT'
  | 'ZONE_KEEP_OUT_CROSS'
  | 'ZONE_KEEP_IN_POINT'
  | 'ZONE_KEEP_IN_EXIT'
  | 'DO_JUMP_TARGET_INVALID'
  | 'DO_JUMP_INFINITE'
  | 'TERRAIN_CLEARANCE'
  | 'ENDURANCE_EXCEEDED'
  | 'ENDURANCE_HIGH';

export interface Issue {
  code: IssueCode;
  severity: IssueSeverity;
  message: string;
  /** Editor item ids the issue is about (may be empty for mission-level issues). */
  itemIds: string[];
  /** Zone id for zone issues. */
  zoneId?: string;
}

/** Per-mission flight limits. Unset values are not checked. */
export interface MissionLimits {
  maxDistanceM?: number | null;
  maxAltM?: number | null;
  minAltM?: number | null;
  maxSpeedMs?: number | null;
  /** Minimum terrain clearance above ground, metres. */
  minAglM?: number | null;
  /** Rated vehicle endurance in seconds (for the energy budget). */
  ratedEnduranceS?: number | null;
  /** Fraction of rated endurance usable before landing reserve (default 0.8). */
  enduranceReserve?: number | null;
}

export function limitsFromConstraintConfig(c: ConstraintConfig): MissionLimits {
  return {
    maxDistanceM: c.maxDistanceM,
    maxAltM: c.maxAltM,
    minAltM: c.minAltM,
    maxSpeedMs: c.maxSpeedMs,
    minAglM: c.minAGLClearance,
  };
}

/** One terrain clearance sample produced by `computeClearanceProfile` (metrics). */
export interface ClearanceSampleInput {
  itemIds: string[];
  aglM: number;
}

export const errorCount = (issues: Issue[]) => issues.filter((i) => i.severity === 'error').length;
export const warningCount = (issues: Issue[]) => issues.filter((i) => i.severity === 'warning').length;
