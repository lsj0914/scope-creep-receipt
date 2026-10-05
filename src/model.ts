export interface Task {
  id: string;
  name: string;
  hours: number;
  dependsOn: string[];
  optional: boolean;
}

export interface ChangeTask extends Task { blocks: string[] }

export interface Settings {
  startDate: string;
  deadline: string;
  dailyHours: number;
  hourlyRate: number;
  bufferPercent: number;
  currency: 'USD' | 'CNY' | 'EUR' | 'GBP';
}

export interface Project {
  version: 1;
  title: string;
  requester: string;
  reason: string;
  settings: Settings;
  baseline: Task[];
  changes: ChangeTask[];
}

export interface ScheduledTask extends Task {
  start: number;
  end: number;
  duration: number;
  slack: number;
  critical: boolean;
}

export interface Schedule { tasks: ScheduledTask[]; days: number; finishDate: string }
export interface Deferral { id: string; name: string; finishDate: string; savedDays: number; meetsDeadline: boolean }
export interface Receipt {
  baseline: Schedule;
  revised: Schedule;
  addedHours: number;
  bufferHours: number;
  totalHours: number;
  cost: number;
  deltaDays: number;
  deadlineSlip: number;
  impactedTasks: { id: string; name: string; delay: number }[];
  requiredDailyHours: number | null;
  deferrals: Deferral[];
}

export class ProjectError extends Error {
  constructor(public code: string, public detail = '') { super(detail || code); }
}
