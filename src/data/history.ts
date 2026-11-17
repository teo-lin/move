export type SessionEntry = {
  id: string;
  timestamp: number;
  workout: string;
  completed: number;
  total: number;
  durationSeconds: number;
};

export const historyKey = 'history';

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseHistory(raw: string | null): SessionEntry[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isSessionEntry);
  } catch {
    return [];
  }
}

export function serializeHistory(entries: SessionEntry[]): string {
  return JSON.stringify(entries);
}

/**
 * Same format as `body/baseline/back-exercises.csv`: newest first, `yyyy.MM.dd` dates.
 * `labelFor` maps a stored workout name to the label used in the CSV (e.g. adds the emoji
 * prefix for sessions recorded before workouts had one).
 */
export function toBackExercisesCsv(
  entries: SessionEntry[],
  labelFor: (workout: string) => string = workout => workout,
): string {
  const rows = ['"Date","Workout","Completion","Duration"'];
  for (const entry of sortNewestFirst(entries)) {
    rows.push(
      [
        csvField(formatCsvDate(entry.timestamp)),
        csvField(labelFor(entry.workout)),
        csvField(`${entry.completed} / ${entry.total}`),
        csvField(formatDuration(entry.durationSeconds)),
      ].join(','),
    );
  }
  return `${rows.join('\n')}\n`;
}

/** `yyyy.MM.dd` — the date format of the baseline CSV. */
export function formatCsvDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

/** European display format: `dd.MM.yyyy`. */
export function formatDisplayDate(timestamp: number | Date): string {
  const date = new Date(timestamp);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${pad(minutes)}:${pad(remainder)}`;
}

/** Local calendar day key, `yyyy-MM-dd`. */
export function localDateKey(timestamp: number | Date): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type DayGroup = {key: string; label: string; entries: SessionEntry[]};

/** Sessions grouped by local calendar day, newest day first. */
export function groupByLocalDate(entries: SessionEntry[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const entry of sortNewestFirst(entries)) {
    const key = localDateKey(entry.timestamp);
    let group = groups.get(key);
    if (!group) {
      group = {key, label: formatDisplayDate(entry.timestamp), entries: []};
      groups.set(key, group);
    }
    group.entries.push(entry);
  }
  return [...groups.values()];
}

/** Monday 00:00 local time of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (start.getDay() + 6) % 7; // Sunday=6, Monday=0
  start.setDate(start.getDate() - mondayOffset);
  return start;
}

export const weekdayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** Month grid with weeks starting on Monday; days outside the month are null. */
export function monthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = Array.from({length: leading}, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export type WorkoutStats = {workout: string; count: number; lastTimestamp: number; totalSeconds: number};

export type HistoryStats = {
  total: number;
  thisWeek: number;
  thisMonth: number;
  totalMinutes: number;
  activeDays: number;
  byWorkout: WorkoutStats[];
};

export function historyStats(entries: SessionEntry[], now: Date = new Date()): HistoryStats {
  const weekStart = startOfWeek(now).getTime();
  const weekEnd = weekStart + 7 * DAY_MS;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const byWorkout = new Map<string, WorkoutStats>();
  let totalSeconds = 0;

  for (const entry of entries) {
    totalSeconds += entry.durationSeconds;
    const stats = byWorkout.get(entry.workout) ?? {
      workout: entry.workout,
      count: 0,
      lastTimestamp: 0,
      totalSeconds: 0,
    };
    stats.count += 1;
    stats.totalSeconds += entry.durationSeconds;
    stats.lastTimestamp = Math.max(stats.lastTimestamp, entry.timestamp);
    byWorkout.set(entry.workout, stats);
  }

  return {
    total: entries.length,
    thisWeek: entries.filter(e => e.timestamp >= weekStart && e.timestamp < weekEnd).length,
    thisMonth: entries.filter(e => e.timestamp >= monthStart && e.timestamp < monthEnd).length,
    totalMinutes: Math.round(totalSeconds / 60),
    activeDays: new Set(entries.map(e => localDateKey(e.timestamp))).size,
    byWorkout: [...byWorkout.values()].sort((a, b) => b.lastTimestamp - a.lastTimestamp),
  };
}

function sortNewestFirst(entries: SessionEntry[]): SessionEntry[] {
  return [...entries].sort((a, b) => b.timestamp - a.timestamp);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function isSessionEntry(value: unknown): value is SessionEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const entry = value as SessionEntry;
  return (
    typeof entry.id === 'string' &&
    typeof entry.timestamp === 'number' &&
    typeof entry.workout === 'string' &&
    typeof entry.completed === 'number' &&
    typeof entry.total === 'number' &&
    typeof entry.durationSeconds === 'number'
  );
}
