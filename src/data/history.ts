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

export type WorkoutStats = {
  workout: string;
  count: number;
  lastTimestamp: number;
  totalSeconds: number;
};

export type HistoryStats = {
  total: number;
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
  /** Sessions per calendar month, from the month of the first session up to the current one. */
  perMonth: number;
  totalMinutes: number;
  activeDays: number;
  byWorkout: WorkoutStats[];
};

export function historyStats(entries: SessionEntry[], now: Date = new Date()): HistoryStats {
  const weekStart = startOfWeek(now).getTime();
  const weekEnd = weekStart + 7 * DAY_MS;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1).getTime();
  const byWorkout = new Map<string, WorkoutStats>();
  let totalSeconds = 0;
  let firstTimestamp = Infinity;

  for (const entry of entries) {
    totalSeconds += entry.durationSeconds;
    firstTimestamp = Math.min(firstTimestamp, entry.timestamp);
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

  const first = new Date(firstTimestamp);
  const months =
    entries.length === 0
      ? 1
      : Math.max(
          1,
          (now.getFullYear() - first.getFullYear()) * 12 + now.getMonth() - first.getMonth() + 1,
        );

  return {
    total: entries.length,
    thisWeek: entries.filter(e => e.timestamp >= weekStart && e.timestamp < weekEnd).length,
    thisMonth: entries.filter(e => e.timestamp >= monthStart && e.timestamp < monthEnd).length,
    thisYear: entries.filter(e => e.timestamp >= yearStart && e.timestamp < yearEnd).length,
    perMonth: Math.round((entries.length / months) * 10) / 10,
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

/** Workout name without a leading emoji / punctuation, so "🦦 PeSpate: abs" matches "PeSpate: abs". */
export function plainWorkoutName(name: string): string {
  return name.replace(/^[^A-Za-z0-9À-ɏ]+/, '').trim();
}

const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);

/** Splits one CSV text into rows of fields (handles quotes and doubled quotes). */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const endRow = () => {
    row.push(field);
    field = '';
    if (row.some(value => value !== '')) {
      rows.push(row);
    }
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === NL || char === CR) {
      if (char === CR && text[i + 1] === NL) {
        i++;
      }
      endRow();
    } else {
      field += char;
    }
  }
  endRow();
  return rows;
}

/**
 * Reads a Back Exercises style CSV (`Date,Workout,Completion,Duration`, dates `yyyy.MM.dd`,
 * completion `done / total`, duration `mm:ss` or `h:mm:ss`) into sessions at noon of that day.
 * Rows that do not parse are skipped.
 */
export function parseBackExercisesCsv(text: string): SessionEntry[] {
  const entries: SessionEntry[] = [];
  const counters = new Map<string, number>();
  for (const [date, workout, completion, duration] of parseCsvRows(text).slice(1)) {
    const day = /^(\d{4})[.-](\d{2})[.-](\d{2})$/.exec((date ?? '').trim());
    const done = /^(\d+)\s*\/\s*(\d+)$/.exec((completion ?? '').trim());
    const time = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec((duration ?? '').trim());
    if (!day || !done || !time || !workout?.trim()) {
      continue;
    }
    const seconds = Number(time[1] ?? 0) * 3600 + Number(time[2]) * 60 + Number(time[3]);
    const dayKey = `${day[1]}.${day[2]}.${day[3]}`;
    const index = counters.get(dayKey) ?? 0;
    counters.set(dayKey, index + 1);
    entries.push({
      id: `import-${dayKey}-${index}`,
      timestamp: new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]), 12, 0, 0).getTime(),
      workout: labelWithEmoji(workout),
      completed: Number(done[1]),
      total: Number(done[2]),
      durationSeconds: seconds,
    });
  }
  return entries;
}

/** "🧞Spate" -> "🧞 Spate": keeps a leading emoji (one space after it), or the plain name. */
export function labelWithEmoji(name: string): string {
  const plain = plainWorkoutName(name);
  const prefix = name.slice(0, name.indexOf(plain)).trim();
  return prefix ? `${prefix} ${plain}` : plain;
}

function sessionKey(entry: SessionEntry): string {
  return [
    formatCsvDate(entry.timestamp),
    plainWorkoutName(entry.workout),
    entry.completed,
    entry.total,
    Math.round(entry.durationSeconds),
  ].join('|');
}

/**
 * Adds the incoming sessions the history does not have yet. Identical sessions are compared by
 * date, workout, completion and duration, and counted, so two equal sessions on one day stay two.
 */
export function mergeSessions(
  existing: SessionEntry[],
  incoming: SessionEntry[],
): {merged: SessionEntry[]; added: SessionEntry[]; updated: number} {
  const have = new Map<string, SessionEntry[]>();
  for (const entry of existing) {
    const key = sessionKey(entry);
    have.set(key, [...(have.get(key) ?? []), entry]);
  }
  const added: SessionEntry[] = [];
  const renamed = new Map<string, string>(); // id -> label with emoji
  for (const entry of incoming) {
    const key = sessionKey(entry);
    const match = have.get(key)?.shift();
    if (!match) {
      added.push(entry);
    } else if (match.id.startsWith('import-') && match.workout !== entry.workout) {
      renamed.set(match.id, entry.workout); // an earlier import without the emoji
    }
  }
  const kept = existing.map(entry =>
    renamed.has(entry.id) ? {...entry, workout: renamed.get(entry.id) as string} : entry,
  );
  return {merged: sortNewestFirst([...kept, ...added]), added, updated: renamed.size};
}
