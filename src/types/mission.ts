import {
  type MissionParameters,
  type PlannerAction,
  type MavlinkFrame,
  type MavlinkMissionCommand,
} from '@/lib/mavlink/commands';

export interface MissionCoordinates {
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
}

export interface MissionItem extends MissionCoordinates {
  id: string;
  sequence: number;
  action: PlannerAction;
  command: MavlinkMissionCommand;
  frame: MavlinkFrame;
  name: string;
  parameters: MissionParameters;
  notes?: string;
  speed?: number;
}

export interface MissionPlanSettings {
  defaultAltitude: number;
  defaultSpeed: number;
  defaultLoiterTime: number;
  defaultWaitTime: number;
  altitudeReference: 'relative';
}

export interface HomePosition {
  latitude: number;
  longitude: number;
  altitude: number;
}

export interface MissionPlan {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  items: MissionItem[];
  settings: MissionPlanSettings;
  homePosition?: HomePosition | null;
}

export interface MissionExportPayload {
  content: string;
  extension: 'json' | 'plan' | 'waypoints';
  mimeType: string;
}

export interface BuiltMissionItem extends MissionCoordinates {
  seq: number;
  current: 0 | 1;
  autocontinue: 0 | 1;
  frame: MavlinkFrame;
  command: MavlinkMissionCommand;
  action: PlannerAction;
  name: string;
  param1: number;
  param2: number;
  param3: number;
  param4: number;
  param5: number;
  param6: number;
  param7: number;
}

export interface SanityWarning {
  seq?: number;
  message: string;
  severity: 'warning' | 'error';
}
