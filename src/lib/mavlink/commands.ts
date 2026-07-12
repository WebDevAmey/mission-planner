export enum PlannerAction {
  TAKEOFF = 'takeoff',
  WAYPOINT = 'waypoint',
  LOITER = 'loiter',
  LOITER_UNLIM = 'loiter_unlim',
  LOITER_TURNS = 'loiter_turns',
  SPLINE_WAYPOINT = 'spline_waypoint',
  RTL = 'rtl',
  LAND = 'land',
  WAIT = 'wait',
  CONDITION_DISTANCE = 'condition_distance',
  SET_SPEED = 'set_speed',
  CHANGE_ALTITUDE = 'change_altitude',
  SET_ROI = 'set_roi',
  CAM_TRIGG_DIST = 'cam_trigg_dist',
  DO_JUMP = 'do_jump',
}

export enum MavlinkMissionCommand {
  MAV_CMD_NAV_WAYPOINT = 16,
  MAV_CMD_NAV_LOITER_UNLIM = 17,
  MAV_CMD_NAV_LOITER_TURNS = 18,
  MAV_CMD_NAV_LOITER_TIME = 19,
  MAV_CMD_NAV_RETURN_TO_LAUNCH = 20,
  MAV_CMD_NAV_LAND = 21,
  MAV_CMD_NAV_TAKEOFF = 22,
  MAV_CMD_NAV_CONTINUE_AND_CHANGE_ALT = 30,
  MAV_CMD_NAV_SPLINE_WAYPOINT = 82,
  MAV_CMD_CONDITION_DELAY = 112,
  MAV_CMD_CONDITION_DISTANCE = 114,
  MAV_CMD_DO_JUMP = 177,
  MAV_CMD_DO_CHANGE_SPEED = 178,
  MAV_CMD_DO_SET_ROI = 201,
  MAV_CMD_DO_SET_CAM_TRIGG_DIST = 206,
}

export enum MavlinkFrame {
  MAV_FRAME_GLOBAL = 0,
  MAV_FRAME_GLOBAL_RELATIVE_ALT = 3,
  MAV_FRAME_GLOBAL_TERRAIN_ALT = 10,
}

export const FRAME_LABELS: Record<number, string> = {
  [MavlinkFrame.MAV_FRAME_GLOBAL]: 'ABS',
  [MavlinkFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT]: 'REL',
  [MavlinkFrame.MAV_FRAME_GLOBAL_TERRAIN_ALT]: 'TER',
};

export const FRAME_OPTIONS = [
  { value: MavlinkFrame.MAV_FRAME_GLOBAL, label: 'ABS' },
  { value: MavlinkFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT, label: 'REL' },
  { value: MavlinkFrame.MAV_FRAME_GLOBAL_TERRAIN_ALT, label: 'TER' },
];

export interface MissionParameters {
  param1: number;
  param2: number;
  param3: number;
  param4: number;
  param5: number;
  param6: number;
  param7: number;
}

export interface MissionCommandDefinition {
  action: PlannerAction;
  command: MavlinkMissionCommand;
  label: string;
  description: string;
  supportsCoordinates: boolean;
  supportsAltitude: boolean;
  supportsSpeed: boolean;
  paramLabels: [string, string, string, string];
  defaultParameters: (defaults: {
    altitude: number;
    speed: number;
    loiterTime: number;
    waitTime: number;
  }) => MissionParameters;
}

const zeroParams = (): MissionParameters => ({
  param1: 0,
  param2: 0,
  param3: 0,
  param4: 0,
  param5: 0,
  param6: 0,
  param7: 0,
});

export const MAVLINK_COMMAND_DEFINITIONS: Record<PlannerAction, MissionCommandDefinition> = {
  [PlannerAction.TAKEOFF]: {
    action: PlannerAction.TAKEOFF,
    command: MavlinkMissionCommand.MAV_CMD_NAV_TAKEOFF,
    label: 'TAKEOFF',
    description: 'Launch and climb to the requested altitude.',
    supportsCoordinates: true,
    supportsAltitude: true,
    supportsSpeed: true,
    paramLabels: ['Pitch(°)', 'Empty', 'Empty', 'Yaw(°)'],
    defaultParameters: () => zeroParams(),
  },
  [PlannerAction.WAYPOINT]: {
    action: PlannerAction.WAYPOINT,
    command: MavlinkMissionCommand.MAV_CMD_NAV_WAYPOINT,
    label: 'WAYPOINT',
    description: 'Fly to a geographic waypoint.',
    supportsCoordinates: true,
    supportsAltitude: true,
    supportsSpeed: true,
    paramLabels: ['Hold(s)', 'Accept(m)', 'PassRadius(m)', 'Yaw(°)'],
    defaultParameters: () => ({
      ...zeroParams(),
      param2: 2,
    }),
  },
  [PlannerAction.LOITER]: {
    action: PlannerAction.LOITER,
    command: MavlinkMissionCommand.MAV_CMD_NAV_LOITER_TIME,
    label: 'LOITER_TIME',
    description: 'Loiter around a point for a fixed duration.',
    supportsCoordinates: true,
    supportsAltitude: true,
    supportsSpeed: true,
    paramLabels: ['Time(s)', 'Empty', 'Radius(m)', 'Hdg(°)'],
    defaultParameters: (defaults) => ({
      ...zeroParams(),
      param1: defaults.loiterTime,
      param3: 25,
    }),
  },
  [PlannerAction.LOITER_UNLIM]: {
    action: PlannerAction.LOITER_UNLIM,
    command: MavlinkMissionCommand.MAV_CMD_NAV_LOITER_UNLIM,
    label: 'LOITER_UNLIM',
    description: 'Loiter indefinitely around a point.',
    supportsCoordinates: true,
    supportsAltitude: true,
    supportsSpeed: true,
    paramLabels: ['Empty', 'Empty', 'Radius(m)', 'Hdg(°)'],
    defaultParameters: () => ({
      ...zeroParams(),
      param3: 25,
    }),
  },
  [PlannerAction.LOITER_TURNS]: {
    action: PlannerAction.LOITER_TURNS,
    command: MavlinkMissionCommand.MAV_CMD_NAV_LOITER_TURNS,
    label: 'LOITER_TURNS',
    description: 'Loiter around a point for a set number of turns.',
    supportsCoordinates: true,
    supportsAltitude: true,
    supportsSpeed: true,
    paramLabels: ['Turns', 'Hdg Req', 'Radius(m)', 'Hdg(°)'],
    defaultParameters: () => ({
      ...zeroParams(),
      param1: 1,
      param3: 25,
    }),
  },
  [PlannerAction.SPLINE_WAYPOINT]: {
    action: PlannerAction.SPLINE_WAYPOINT,
    command: MavlinkMissionCommand.MAV_CMD_NAV_SPLINE_WAYPOINT,
    label: 'SPLINE_WAYPOINT',
    description: 'Fly to a waypoint using a spline path.',
    supportsCoordinates: true,
    supportsAltitude: true,
    supportsSpeed: true,
    paramLabels: ['Hold(s)', 'Empty', 'Empty', 'Empty'],
    defaultParameters: () => zeroParams(),
  },
  [PlannerAction.RTL]: {
    action: PlannerAction.RTL,
    command: MavlinkMissionCommand.MAV_CMD_NAV_RETURN_TO_LAUNCH,
    label: 'RETURN_TO_LAUNCH',
    description: 'Return to launch and hand off RTL behavior to the vehicle.',
    supportsCoordinates: false,
    supportsAltitude: false,
    supportsSpeed: false,
    paramLabels: ['Empty', 'Empty', 'Empty', 'Empty'],
    defaultParameters: () => zeroParams(),
  },
  [PlannerAction.LAND]: {
    action: PlannerAction.LAND,
    command: MavlinkMissionCommand.MAV_CMD_NAV_LAND,
    label: 'LAND',
    description: 'Land at the specified point.',
    supportsCoordinates: true,
    supportsAltitude: true,
    supportsSpeed: false,
    paramLabels: ['Abort Alt', 'Land Mode', 'Empty', 'Yaw(°)'],
    defaultParameters: () => zeroParams(),
  },
  [PlannerAction.WAIT]: {
    action: PlannerAction.WAIT,
    command: MavlinkMissionCommand.MAV_CMD_CONDITION_DELAY,
    label: 'CONDITION_DELAY',
    description: 'Wait before continuing the mission.',
    supportsCoordinates: false,
    supportsAltitude: false,
    supportsSpeed: false,
    paramLabels: ['Time(s)', 'Empty', 'Empty', 'Empty'],
    defaultParameters: (defaults) => ({
      ...zeroParams(),
      param1: defaults.waitTime,
    }),
  },
  [PlannerAction.CONDITION_DISTANCE]: {
    action: PlannerAction.CONDITION_DISTANCE,
    command: MavlinkMissionCommand.MAV_CMD_CONDITION_DISTANCE,
    label: 'CONDITION_DIST',
    description: 'Advance to next command when within distance of next WP.',
    supportsCoordinates: false,
    supportsAltitude: false,
    supportsSpeed: false,
    paramLabels: ['Dist(m)', 'Empty', 'Empty', 'Empty'],
    defaultParameters: () => ({
      ...zeroParams(),
      param1: 10,
    }),
  },
  [PlannerAction.SET_SPEED]: {
    action: PlannerAction.SET_SPEED,
    command: MavlinkMissionCommand.MAV_CMD_DO_CHANGE_SPEED,
    label: 'DO_CHANGE_SPEED',
    description: 'Set mission cruise speed.',
    supportsCoordinates: false,
    supportsAltitude: false,
    supportsSpeed: false,
    paramLabels: ['Type', 'Speed(m/s)', 'Throttle', 'Empty'],
    defaultParameters: (defaults) => ({
      ...zeroParams(),
      param2: defaults.speed,
      param3: -1,
    }),
  },
  [PlannerAction.CHANGE_ALTITUDE]: {
    action: PlannerAction.CHANGE_ALTITUDE,
    command: MavlinkMissionCommand.MAV_CMD_NAV_CONTINUE_AND_CHANGE_ALT,
    label: 'CONTINUE_AND_CHANGE_ALT',
    description: 'Continue and change to the requested altitude.',
    supportsCoordinates: false,
    supportsAltitude: true,
    supportsSpeed: true,
    paramLabels: ['Action', 'Empty', 'Empty', 'Empty'],
    defaultParameters: () => zeroParams(),
  },
  [PlannerAction.SET_ROI]: {
    action: PlannerAction.SET_ROI,
    command: MavlinkMissionCommand.MAV_CMD_DO_SET_ROI,
    label: 'DO_SET_ROI',
    description: 'Point camera towards a region of interest.',
    supportsCoordinates: true,
    supportsAltitude: true,
    supportsSpeed: false,
    paramLabels: ['ROI Mode', 'WP Index', 'ROI Index', 'Empty'],
    defaultParameters: () => zeroParams(),
  },
  [PlannerAction.CAM_TRIGG_DIST]: {
    action: PlannerAction.CAM_TRIGG_DIST,
    command: MavlinkMissionCommand.MAV_CMD_DO_SET_CAM_TRIGG_DIST,
    label: 'CAM_TRIGG_DIST',
    description: 'Trigger camera shutter at specified distance intervals.',
    supportsCoordinates: false,
    supportsAltitude: false,
    supportsSpeed: false,
    paramLabels: ['Dist(m)', 'Shutter', 'Trigger', 'Empty'],
    defaultParameters: () => ({
      ...zeroParams(),
      param1: 25,
    }),
  },
  [PlannerAction.DO_JUMP]: {
    action: PlannerAction.DO_JUMP,
    command: MavlinkMissionCommand.MAV_CMD_DO_JUMP,
    label: 'DO_JUMP',
    description: 'Jump to the specified waypoint index.',
    supportsCoordinates: false,
    supportsAltitude: false,
    supportsSpeed: false,
    paramLabels: ['WP Index', 'Repeat', 'Empty', 'Empty'],
    defaultParameters: () => ({
      ...zeroParams(),
      param1: 1,
      param2: 1,
    }),
  },
};

export const PLANNER_ACTION_OPTIONS = Object.values(PlannerAction).map((action) => ({
  value: action,
  label: MAVLINK_COMMAND_DEFINITIONS[action].label,
}));

export const getMissionCommandDefinition = (action: PlannerAction): MissionCommandDefinition =>
  MAVLINK_COMMAND_DEFINITIONS[action];

export const supportsCoordinates = (action: PlannerAction): boolean =>
  MAVLINK_COMMAND_DEFINITIONS[action].supportsCoordinates;

export const supportsAltitude = (action: PlannerAction): boolean =>
  MAVLINK_COMMAND_DEFINITIONS[action].supportsAltitude;

export const supportsSpeed = (action: PlannerAction): boolean =>
  MAVLINK_COMMAND_DEFINITIONS[action].supportsSpeed;

export const FRAME_NAMES: Record<number, string> = {
  [MavlinkFrame.MAV_FRAME_GLOBAL]: 'MAV_FRAME_GLOBAL',
  [MavlinkFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT]: 'MAV_FRAME_GLOBAL_RELATIVE_ALT',
  [MavlinkFrame.MAV_FRAME_GLOBAL_TERRAIN_ALT]: 'MAV_FRAME_GLOBAL_TERRAIN_ALT',
};

export const COMMAND_NAMES: Record<number, string> = {
  [MavlinkMissionCommand.MAV_CMD_NAV_WAYPOINT]: 'MAV_CMD_NAV_WAYPOINT',
  [MavlinkMissionCommand.MAV_CMD_NAV_LOITER_UNLIM]: 'MAV_CMD_NAV_LOITER_UNLIM',
  [MavlinkMissionCommand.MAV_CMD_NAV_LOITER_TURNS]: 'MAV_CMD_NAV_LOITER_TURNS',
  [MavlinkMissionCommand.MAV_CMD_NAV_LOITER_TIME]: 'MAV_CMD_NAV_LOITER_TIME',
  [MavlinkMissionCommand.MAV_CMD_NAV_RETURN_TO_LAUNCH]: 'MAV_CMD_NAV_RETURN_TO_LAUNCH',
  [MavlinkMissionCommand.MAV_CMD_NAV_LAND]: 'MAV_CMD_NAV_LAND',
  [MavlinkMissionCommand.MAV_CMD_NAV_TAKEOFF]: 'MAV_CMD_NAV_TAKEOFF',
  [MavlinkMissionCommand.MAV_CMD_NAV_CONTINUE_AND_CHANGE_ALT]: 'MAV_CMD_NAV_CONTINUE_AND_CHANGE_ALT',
  [MavlinkMissionCommand.MAV_CMD_NAV_SPLINE_WAYPOINT]: 'MAV_CMD_NAV_SPLINE_WAYPOINT',
  [MavlinkMissionCommand.MAV_CMD_CONDITION_DELAY]: 'MAV_CMD_CONDITION_DELAY',
  [MavlinkMissionCommand.MAV_CMD_CONDITION_DISTANCE]: 'MAV_CMD_CONDITION_DISTANCE',
  [MavlinkMissionCommand.MAV_CMD_DO_JUMP]: 'MAV_CMD_DO_JUMP',
  [MavlinkMissionCommand.MAV_CMD_DO_CHANGE_SPEED]: 'MAV_CMD_DO_CHANGE_SPEED',
  [MavlinkMissionCommand.MAV_CMD_DO_SET_ROI]: 'MAV_CMD_DO_SET_ROI',
  [MavlinkMissionCommand.MAV_CMD_DO_SET_CAM_TRIGG_DIST]: 'MAV_CMD_DO_SET_CAM_TRIGG_DIST',
};

export const COMMAND_SHORT_LABELS: Record<number, string> = {
  [MavlinkMissionCommand.MAV_CMD_NAV_WAYPOINT]: 'Waypoint',
  [MavlinkMissionCommand.MAV_CMD_NAV_LOITER_UNLIM]: 'Loiter (Unlimited)',
  [MavlinkMissionCommand.MAV_CMD_NAV_LOITER_TURNS]: 'Loiter (Turns)',
  [MavlinkMissionCommand.MAV_CMD_NAV_LOITER_TIME]: 'Loiter (Time)',
  [MavlinkMissionCommand.MAV_CMD_NAV_RETURN_TO_LAUNCH]: 'Return to Launch',
  [MavlinkMissionCommand.MAV_CMD_NAV_LAND]: 'Land',
  [MavlinkMissionCommand.MAV_CMD_NAV_TAKEOFF]: 'Takeoff',
  [MavlinkMissionCommand.MAV_CMD_NAV_CONTINUE_AND_CHANGE_ALT]: 'Change Altitude',
  [MavlinkMissionCommand.MAV_CMD_NAV_SPLINE_WAYPOINT]: 'Spline Waypoint',
  [MavlinkMissionCommand.MAV_CMD_CONDITION_DELAY]: 'Delay',
  [MavlinkMissionCommand.MAV_CMD_CONDITION_DISTANCE]: 'Condition Distance',
  [MavlinkMissionCommand.MAV_CMD_DO_JUMP]: 'Jump',
  [MavlinkMissionCommand.MAV_CMD_DO_CHANGE_SPEED]: 'Change Speed',
  [MavlinkMissionCommand.MAV_CMD_DO_SET_ROI]: 'Set ROI',
  [MavlinkMissionCommand.MAV_CMD_DO_SET_CAM_TRIGG_DIST]: 'Camera Trigger',
};

/** Icon emoji for timeline display */
export const COMMAND_ICONS: Record<string, string> = {
  [PlannerAction.TAKEOFF]: '🛫',
  [PlannerAction.WAYPOINT]: '📍',
  [PlannerAction.LOITER]: '🔄',
  [PlannerAction.LOITER_UNLIM]: '🔄',
  [PlannerAction.LOITER_TURNS]: '🔄',
  [PlannerAction.SPLINE_WAYPOINT]: '📍',
  [PlannerAction.RTL]: '🏠',
  [PlannerAction.LAND]: '🛬',
  [PlannerAction.WAIT]: '⏳',
  [PlannerAction.CONDITION_DISTANCE]: '📏',
  [PlannerAction.SET_SPEED]: '⚡',
  [PlannerAction.CHANGE_ALTITUDE]: '⬆',
  [PlannerAction.SET_ROI]: '📷',
  [PlannerAction.CAM_TRIGG_DIST]: '📷',
  [PlannerAction.DO_JUMP]: '↩',
};
