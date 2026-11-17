import {
  formatCsvDate,
  formatDisplayDate,
  groupByLocalDate,
  historyStats,
  monthGrid,
  SessionEntry,
  startOfWeek,
  toBackExercisesCsv,
} from '../src/data/history';
import {csvWorkoutLabel, mergeSavedWorkouts, serializeWorkoutSettings, workouts} from '../src/data/workouts';
import {exercisesById} from '../src/data/exercises';

function entry(id: string, date: Date, workout: string, seconds = 884): SessionEntry {
  return {id, timestamp: date.getTime(), workout, completed: 16, total: 16, durationSeconds: seconds};
}

test('dates: CSV keeps yyyy.MM.dd, UI shows dd.MM.yyyy', () => {
  const date = new Date(2026, 7, 1, 9, 30);
  expect(formatCsvDate(date.getTime())).toBe('2026.08.01');
  expect(formatDisplayDate(date)).toBe('01.08.2026');
});

test('weeks start on Monday', () => {
  // Sunday 15.11.2026 belongs to the week starting Monday 09.11.2026.
  expect(formatDisplayDate(startOfWeek(new Date(2026, 10, 15)))).toBe('09.11.2026');
  expect(formatDisplayDate(startOfWeek(new Date(2026, 10, 16)))).toBe('16.11.2026');
  // November 2026 starts on a Sunday: six empty Monday-first cells before day 1.
  const grid = monthGrid(2026, 10);
  expect(grid[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
  expect(grid[0][6]?.getDate()).toBe(1);
  expect(grid.every(week => week.length === 7)).toBe(true);
});

test('CSV matches the back-exercises.csv baseline format, newest first', () => {
  const rows = [
    entry('1', new Date(2026, 6, 25, 10), 'PeSpate: abs'),
    entry('2', new Date(2026, 7, 1, 10), '🐈 PatruLabe: upper body', 704),
  ];
  expect(toBackExercisesCsv(rows, name => csvWorkoutLabel(name))).toBe(
    '"Date","Workout","Completion","Duration"\n' +
      '"2026.08.01","🐈 PatruLabe: upper body","16 / 16","11:44"\n' +
      '"2026.07.25","🦦 PeSpate: abs","16 / 16","14:44"\n',
  );
});

test('history groups by local date and stats count the current Monday-first week', () => {
  const now = new Date(2026, 10, 18, 12); // Wednesday
  const rows = [
    entry('a', new Date(2026, 10, 16, 8), 'A'),
    entry('b', new Date(2026, 10, 16, 19), 'B'),
    entry('c', new Date(2026, 10, 15, 8), 'A'), // previous Sunday
  ];
  const groups = groupByLocalDate(rows);
  expect(groups.map(g => [g.label, g.entries.length])).toEqual([
    ['16.11.2026', 2],
    ['15.11.2026', 1],
  ]);
  const stats = historyStats(rows, now);
  expect(stats.thisWeek).toBe(2);
  expect(stats.thisMonth).toBe(3);
  expect(stats.activeDays).toBe(2);
  expect(stats.byWorkout.find(w => w.workout === 'A')?.count).toBe(2);
});

test('every routine references a bundled exercise, including the new 121 Wall push-up', () => {
  for (const workout of workouts) {
    for (const item of workout.steps) {
      expect(exercisesById.has(item.exerciseId)).toBe(true);
    }
  }
  expect(exercisesById.get(121)?.name).toBe('Wall push-up');
  // Scanned from the original app: per-side moves.
  const sided = (id: string) =>
    workouts.find(w => w.id === id)!.steps.filter(s => s.twoSides).map(s => s.exerciseId);
  expect(sided('pespate-abs')).toEqual([7, 39, 34, 36]);
  expect(sided('patrulabe-upper-body')).toEqual([52]);
  expect(workouts.map(w => w.id)).toEqual(
    expect.arrayContaining(['core-first-a', 'core-first-b', 'office-micro']),
  );
});

test('saved step settings override defaults and survive bad input', () => {
  const edited = workouts.map(w =>
    w.id === 'core-first-a' ? {...w, steps: w.steps.slice(0, 2).reverse()} : w,
  );
  const merged = mergeSavedWorkouts(serializeWorkoutSettings(edited));
  expect(merged.find(w => w.id === 'core-first-a')?.steps.map(s => s.exerciseId)).toEqual([1, 47]);
  expect(merged.find(w => w.id === 'core-first-b')?.steps).toEqual(
    workouts.find(w => w.id === 'core-first-b')?.steps,
  );
  const withRest = mergeSavedWorkouts(
    serializeWorkoutSettings(workouts.map(w => (w.id === 'office-micro' ? {...w, restSeconds: 15} : w))),
  );
  expect(withRest.find(w => w.id === 'office-micro')?.restSeconds).toBe(15);
  expect(mergeSavedWorkouts('not json')).toBe(workouts);
});
