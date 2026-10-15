import { v4 as uuidv4 } from 'uuid';
import {
  type MissionParameters,
  type PlannerAction,
  getMissionCommandDefinition,
  supportsAltitude,
  supportsCoordinates,
  MavlinkFrame,
  MavlinkMissionCommand,
  PlannerAction as PA,
} from '@/lib/mavlink/commands';
import type { BuiltMissionItem, MissionCoordinates, MissionItem, MissionPlan, MissionPlanSettings } from '@/types/mission';
import { round1, round7 } from '@/lib/utils';

export const NON_AUTOCONTINUE_ACTIONS = new Set<PlannerAction>([PA.RTL, PA.LAND]);

const defaultCoordinates = (
  coordinateHint: Partial<MissionCoordinates> | undefined,
  settings: MissionPlanSettings
): MissionCoordinates => ({
  latitude: coordinateHint?.latitude ?? 0,
  longitude: coordinateHint?.longitude ?? 0,
  altitude: coordinateHint?.altitude ?? settings.defaultAltitude,
});

const syncCoordinatesToParams = (
  parameters: MissionParameters,
  coordinate: MissionCoordinates
): MissionParameters => ({
  ...parameters,
  param5: round7(coordinate.latitude ?? 0),
  param6: round7(coordinate.longitude ?? 0),
  param7: round1(coordinate.altitude ?? 0),
});

export const normalizeMissionItem = (
  item: MissionItem,
  settings: MissionPlanSettings
): MissionItem => {
  const definition = getMissionCommandDefinition(item.action);
  const nextCoordinates: MissionCoordinates = {
    latitude: definition.supportsCoordinates
      ? round7(item.latitude ?? 0)
      : null,
    longitude: definition.supportsCoordinates
      ? round7(item.longitude ?? 0)
      : null,
    altitude: definition.supportsAltitude
      ? round1(item.altitude ?? settings.defaultAltitude)
      : null,
  };

  return {
    ...item,
    command: definition.command,
    name: definition.label,
    ...nextCoordinates,
    parameters: syncCoordinatesToParams(item.parameters, nextCoordinates),
  };
};

export const createMissionItem = (
  action: PlannerAction,
  sequence: number,
  settings: MissionPlanSettings,
  coordinateHint?: Partial<MissionCoordinates>
): MissionItem => {
  const definition = getMissionCommandDefinition(action);
  const baseCoordinates = defaultCoordinates(coordinateHint, settings);
  const coordinates: MissionCoordinates = {
    latitude: supportsCoordinates(action) ? baseCoordinates.latitude : null,
    longitude: supportsCoordinates(action) ? baseCoordinates.longitude : null,
    altitude: supportsAltitude(action) ? baseCoordinates.altitude : null,
  };

  return normalizeMissionItem(
    {
      id: uuidv4(),
      sequence,
      action,
      command: definition.command,
      frame: MavlinkFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT,
      name: definition.label,
      parameters: definition.defaultParameters({
        altitude: settings.defaultAltitude,
        speed: settings.defaultSpeed,
        loiterTime: settings.defaultLoiterTime,
        waitTime: settings.defaultWaitTime,
      }),
      ...coordinates,
    },
    settings
  );
};

export const resequenceMissionItems = (
  items: MissionItem[],
  settings: MissionPlanSettings
): MissionItem[] =>
  items.map((item, index) =>
    normalizeMissionItem({ ...item, sequence: index }, settings)
  );

export const buildMissionList = (mission: MissionPlan): BuiltMissionItem[] => {
  const resequenced = resequenceMissionItems(mission.items, mission.settings);
  const output: BuiltMissionItem[] = [];
  let seq = 0;

  for (const item of resequenced) {
    const speed = item.speed ?? 0;
    const hasSpeed =
      getMissionCommandDefinition(item.action).supportsSpeed && speed > 0;

    if (hasSpeed) {
      output.push({
        seq,
        current: 0,
        autocontinue: 1,
        frame: MavlinkFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT,
        command: MavlinkMissionCommand.MAV_CMD_DO_CHANGE_SPEED,
        action: PA.SET_SPEED,
        name: 'DO_CHANGE_SPEED',
        latitude: null,
        longitude: null,
        altitude: null,
        param1: 0,
        param2: speed,
        param3: -1,
        param4: 0,
        param5: 0,
        param6: 0,
        param7: 0,
      });
      seq++;
    }

    output.push({
      seq,
      current: seq === 0 ? 1 : 0,
      autocontinue: NON_AUTOCONTINUE_ACTIONS.has(item.action) ? 0 : 1,
      frame: item.frame,
      command: item.command,
      action: item.action,
      name: item.name,
      latitude: item.latitude !== null ? round7(item.latitude) : null,
      longitude: item.longitude !== null ? round7(item.longitude) : null,
      altitude: item.altitude !== null ? round1(item.altitude) : null,
      param1: item.parameters.param1 ?? 0,
      param2: item.parameters.param2 ?? 0,
      param3: item.parameters.param3 ?? 0,
      param4: item.parameters.param4 ?? 0,
      param5: item.parameters.param5 ?? 0,
      param6: item.parameters.param6 ?? 0,
      param7: item.parameters.param7 ?? 0,
    });
    seq++;
  }

  return output;
};

