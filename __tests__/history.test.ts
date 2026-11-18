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
import {
  csvWorkoutLabel,
  mergeSavedWorkouts,
  serializeWorkoutSettings,
  workouts,
} from '../src/data/workouts';
import {exercisesById} from '../src/data/exercises';

function entry(id: string, date: Date, workout: string, seconds = 884): SessionEntry {
  return {
    id,
    timestamp: date.getTime(),
    workout,
    completed: 16,
    total: 16,
    durationSeconds: seconds,
  };
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
    workouts
      .find(w => w.id === id)!
      .steps.filter(s => s.twoSides)
      .map(s => s.exerciseId);
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
    serializeWorkoutSettings(
      workouts.map(w => (w.id === 'office-micro' ? {...w, restSeconds: 15} : w)),
    ),
  );
  expect(withRest.find(w => w.id === 'office-micro')?.restSeconds).toBe(15);
  expect(mergeSavedWorkouts('not json')).toBe(workouts);
});

test('custom workouts are saved in full and restored after the bundled ones', () => {
  const custom = {
    id: 'custom-1',
    name: 'Evening',
    custom: true,
    steps: [{exerciseId: 1000, repetitions: 10, secondsPerRep: 3}],
  };
  const restored = mergeSavedWorkouts(serializeWorkoutSettings([...workouts, custom]));
  expect(restored.slice(0, workouts.length).map(w => w.id)).toEqual(workouts.map(w => w.id));
  expect(restored[workouts.length]).toMatchObject({id: 'custom-1', name: 'Evening', custom: true});
  expect(restored[workouts.length].steps[0].exerciseId).toBe(1000);
});

test('every workout gets its own random background while unused ones remain', () => {
  const {assignCardBackgrounds} = require('../src/ui/backgrounds');
  const ids = Array.from({length: 21}, (_, i) => `w${i}`);
  const assigned = assignCardBackgrounds({}, ids);
  expect(new Set(Object.values(assigned)).size).toBe(21);
  expect(assignCardBackgrounds(assigned, ids)).toBe(assigned); // stable once assigned
  const more = assignCardBackgrounds(assigned, [...ids, 'w21']);
  expect(more.w21).toBeGreaterThanOrEqual(0);
});

test('history sessions get varied backgrounds that never repeat back to back', () => {
  const {sessionBackgroundMap} = require('../src/ui/backgrounds');
  const sessions = Array.from({length: 30}, (_, i) => ({
    id: `${1700000000000 + i * 977}`,
    timestamp: i,
  }));
  const map: Map<string, number> = sessionBackgroundMap(sessions);
  const ordered = [...sessions].sort((a, b) => b.timestamp - a.timestamp).map(s => map.get(s.id));
  ordered.forEach((index, i) => expect(ordered.slice(Math.max(0, i - 4), i)).not.toContain(index));
  expect(new Set(ordered).size).toBeGreaterThan(8);
});

test('catalog categories cover every bundled exercise exactly once', () => {
  const {groupByCategory} = require('../src/data/categories');
  const {exercises} = require('../src/data/exercises');
  const groups = groupByCategory(exercises);
  const ids = groups.flatMap((g: {items: {id: number}[]}) => g.items.map(e => e.id));
  expect(ids.sort((a: number, b: number) => a - b)).toEqual(
    exercises.map((e: {id: number}) => e.id),
  );
  expect(groups.map((g: {title: string}) => g.title)).toContain('Standing');
});

test('every exercise has a description and the imported programs use real exercises', () => {
  const {descriptions} = require('../src/data/descriptions');
  const {extraDescriptions} = require('../src/data/extraExercises');
  const {exercises} = require('../src/data/exercises');
  const {importedWorkouts} = require('../src/data/importedWorkouts');
  for (const exercise of exercises) {
    const text = descriptions[exercise.id] ?? extraDescriptions[exercise.id];
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(40);
  }
  expect(importedWorkouts).toHaveLength(9);
  const ids = new Set(exercises.map((e: {id: number}) => e.id));
  for (const workout of importedWorkouts) {
    for (const step of workout.steps) {
      expect(ids.has(step.exerciseId)).toBe(true);
      expect(step.repetitions).toBeGreaterThan(0);
      expect(step.secondsPerRep).toBeGreaterThan(0);
      if (step.twoSides) {
        expect(step.repetitions % 2).toBe(0);
      }
    }
  }
});

test('drag and drop: rows of different heights land where they are dropped', () => {
  const {dropIndex, rowTops} = require('../src/ui/useDragReorder');
  // Rows: exercise (100), breather (30), exercise (100), exercise (100); 10 between rows.
  const heights = [100, 30, 100, 100];
  expect(rowTops(heights, 4, 10)).toEqual([0, 110, 150, 260]);
  expect(dropIndex(heights, 4, 10, 0, 0)).toBe(0); // not moved
  expect(dropIndex(heights, 4, 10, 0, 100)).toBe(1); // past the breather's centre
  expect(dropIndex(heights, 4, 10, 0, 400)).toBe(3); // to the very end
  expect(dropIndex(heights, 4, 10, 3, -400)).toBe(0); // to the very top
  expect(dropIndex(heights, 4, 10, 2, -60)).toBe(2); // centre 140 is still below the breather (125)
  expect(dropIndex(heights, 4, 10, 2, -90)).toBe(1); // centre 110 is above it: lands before it
  expect(dropIndex(heights, 4, 10, 1, 30)).toBe(1); // small nudge changes nothing
});

test('workout order: saved ids sort the list, unknown workouts keep their place at the end', () => {
  const {applyWorkoutOrder, parseWorkoutOrder} = require('../src/data/workouts');
  const list = ['a', 'b', 'c', 'd'].map(id => ({id}));
  expect(applyWorkoutOrder(list, ['c', 'a']).map((w: {id: string}) => w.id)).toEqual([
    'c',
    'a',
    'b',
    'd',
  ]);
  expect(applyWorkoutOrder(list, []).map((w: {id: string}) => w.id)).toEqual(['a', 'b', 'c', 'd']);
  expect(applyWorkoutOrder(list, ['d', 'zzz', 'b']).map((w: {id: string}) => w.id)).toEqual([
    'd',
    'b',
    'a',
    'c',
  ]);
  expect(parseWorkoutOrder('not json')).toEqual([]);
  expect(parseWorkoutOrder('["x",1,"y"]')).toEqual(['x', 'y']);
});

test('exercises from the health plan are complete, categorised and do not clash with the catalog', () => {
  const {
    extraExercises,
    extraDescriptions,
    extraDefaults,
    withExtras,
  } = require('../src/data/extraExercises');
  const {categories, groupByCategory} = require('../src/data/categories');
  const {exercises} = require('../src/data/exercises');
  const keys = new Set(categories.map((c: {key: string}) => c.key));
  const ids = new Set<number>();
  for (const extra of extraExercises) {
    expect(ids.has(extra.id)).toBe(false);
    ids.add(extra.id);
    expect(extra.id).toBeLessThan(1000);
    expect(keys.has(extra.category)).toBe(true);
    expect(extraDescriptions[extra.id].length).toBeGreaterThan(60);
    const d = extraDefaults[extra.id];
    expect(d.repetitions).toBeGreaterThan(0);
    expect(d.secondsPerRep).toBeGreaterThan(0);
    if (d.twoSides) {
      expect(d.repetitions % 2).toBe(0);
    }
  }
  expect(extraExercises.length).toBeGreaterThanOrEqual(30);
  const groups = groupByCategory(withExtras(exercises));
  expect(groups.reduce((n: number, g: {items: unknown[]}) => n + g.items.length, 0)).toBe(
    withExtras(exercises).length,
  );
  expect(groups.map((g: {key: string}) => g.key)).toEqual(
    expect.arrayContaining(['balance', 'warmup', 'strength', 'stretch']),
  );
});
