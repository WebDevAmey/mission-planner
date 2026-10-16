export interface ShellUser {
  name: string | null;
  email: string;
}

/** The minimum the command palette needs to list a mission. */
export interface ShellMission {
  id: string;
  name: string;
}
