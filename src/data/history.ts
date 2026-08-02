export type SessionEntry = {
  id: string;
  timestamp: number;
  workout: string;
  completed: number;
  total: number;
  durationSeconds: number;
};

export const historyKey = 'history';

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

export function toBackExercisesCsv(entries: SessionEntry[]): string {
  const rows = ['"Date","Workout","Completion","Duration"'];
  for (const entry of entries) {
    rows.push(
      [
        csvField(formatDate(entry.timestamp)),
        csvField(entry.workout),
        csvField(`${entry.completed} / ${entry.total}`),
        csvField(formatDuration(entry.durationSeconds)),
      ].join(','),
    );
  }
  return `${rows.join('\n')}\n`;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
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
