import {importedWorkouts} from './importedWorkouts';

export type Workout = {
  id: string;
  name: string;
  /** Prefix used in the UI and in back-exercises.csv (e.g. "🦦 PeSpate: abs"). */
  emoji?: string;
  /** Created in the app (not bundled); stored in full and can be renamed or deleted. */
  custom?: boolean;
  /** Catch-your-breath break between exercises, in seconds (0 = none). */
  restSeconds?: number;
  steps: WorkoutStep[];
};

export type WorkoutStep = {
  exerciseId: number;
  repetitions: number;
  secondsPerRep: number;
  twoSides?: boolean;
  /** A short pause inside the workout; `secondsPerRep` is its length. */
  breather?: boolean;
};

export const BREATHER_SECONDS = 4;

/** v2: only edited workouts are stored, so updated bundled defaults take effect. */
export const workoutsKey = 'workouts-v2';

/** The order of the workout list (ids), changed by dragging cards. */
export const workoutOrderKey = 'workout-order';

/** Ids of built-in workouts the user deleted; they stay hidden after a restart. */
export const deletedWorkoutsKey = 'workouts-deleted';

export function parseWorkoutOrder(raw: string | null): string[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export const parseIdList = parseWorkoutOrder;

/** Sorts workouts by a saved id order; workouts missing from it keep their relative order, last. */
export function applyWorkoutOrder<T extends {id: string}>(list: T[], order: string[]): T[] {
  const rank = (id: string) => {
    const index = order.indexOf(id);
    return index === -1 ? order.length : index;
  };
  return list
    .map((item, position) => ({item, position}))
    .sort((a, b) => rank(a.item.id) - rank(b.item.id) || a.position - b.position)
    .map(entry => entry.item);
}

export function breatherStep(seconds: number = BREATHER_SECONDS): WorkoutStep {
  return {exerciseId: 0, repetitions: 1, secondsPerRep: seconds, breather: true};
}

export function exerciseCount(workout: Pick<Workout, 'steps'>): number {
  return workout.steps.filter(item => !item.breather).length;
}

export const workouts: Workout[] = [
  // Reps and seconds per rep as configured in the original Back Exercises app (scanned
  // 17.11.2026). Its "Repeats per side" exercises use perSide().
  {
    id: 'pespate-abs',
    name: 'PeSpate: abs',
    emoji: '🦦',
    steps: [
      step(3, 12, 2), // Windshield Wipers
      step(6, 12, 2), // Straight Leg Scissors
      perSide(7, 12, 3), // Diagonal crunches
      step(14, 12, 3), // Straight leg lift
      step(16, 16, 4), // Alternating knee to the chest
      perSide(39, 20, 2), // Leg lift 3
      step(15, 12, 3), // Toes to the knee
      step(17, 16, 4), // Two knees to the chest
      step(18, 4, 6), // Fan
      step(19, 8, 4), // Double crunch
      step(20, 4, 16), // Leading knee twists
      step(21, 12, 2), // Bug
      step(9, 12, 3), // Bridge
      step(23, 8, 4), // Rolling situp
      perSide(34, 8, 4), // Side-lying kicks
      perSide(36, 8, 3), // Both leg lift
    ],
  },
  {
    id: 'patrulabe-upper-body',
    name: 'PatruLabe: upper body',
    emoji: '🐈',
    steps: [
      step(53, 4, 10), // Rolls
      step(49, 4, 4), // Cat 3
      step(50, 8, 2), // Tails
      step(55, 20, 3), // Knee Pushups
      step(51, 6, 4), // Bear
      step(58, 24, 2), // Hunting dog
      step(60, 24, 2), // Hunting dog 3
      perSide(52, 12, 3), // Table
      step(77, 6, 6), // Swimmer
      step(78, 20, 3), // Hands to heels
      step(82, 16, 3), // Cobra
      step(71, 12, 3), // Boat 1
      step(80, 8, 3), // Shoulder blade retraction and flys 2
      step(56, 8, 3), // Full pushups
      step(46, 6, 4), // Squat to heels
    ],
  },
  // body/sessions.md "Kineto session — Core-First A (L1)". "N/side" = N reps per side.
  {
    id: 'core-first-a',
    name: 'Core-First A',
    emoji: '🐢',
    steps: [
      step(47, 8, 4), // Cat 1
      step(1, 8, 4), // Lumbar Flattening
      step(21, 10, 3), // Bug
      step(17, 10, 3), // Two knees to the chest
      step(9, 10, 3), // Bridge
      perSide(58, 8, 3), // Hunting dog
      step(55, 8, 3), // Knee Pushups
      step(79, 10, 3), // Shoulder blade retraction and flys
      step(25, 10, 3), // Swimmer on back
      step(62, 3, 10), // Short plank (holds)
      perSide(100, 2, 15), // Side body stretch
    ],
  },
  // body/sessions.md "Kineto session — Core-First B (L2)".
  {
    id: 'core-first-b',
    name: 'Core-First B',
    emoji: '🦩',
    steps: [
      step(48, 8, 4), // Cat 2
      perSide(7, 8, 3), // Diagonal crunches
      perSide(59, 8, 3), // Hunting dog 2
      perSide(10, 8, 3), // Bridge with single leg raise
      step(51, 8, 3), // Bear
      step(56, 6, 3), // Full pushups
      step(67, 8, 3), // Swan 1
      step(83, 3, 8), // Superman (core gate metric)
      perSide(42, 3, 8), // Side forearm plank
      step(86, 3, 12), // Forearm plank (core gate metric)
      perSide(118, 6, 3), // Lunges (#116 in sessions.md numbering)
      perSide(101, 2, 15), // Sitting side slope
    ],
  },
  // body/sessions.md "Office micro-sessions" — short desk break; first routine using the
  // app's own exercise media (121 Wall push-up).
  {
    id: 'office-micro',
    name: 'Office: micro',
    emoji: '🐿️',
    steps: [
      step(116, 10, 2), // Arm rotations
      step(117, 10, 3), // Arm raises
      step(121, 8, 3), // Wall push-up
      step(115, 8, 3), // Squat
    ],
  },
  // The two exercises made for this app: both are done standing, no equipment beyond a wall and a band.
  {
    id: 'wall-and-band',
    name: 'Wall & band',
    emoji: '🐒',
    steps: [
      step(121, 10, 3), // Wall push-up
      step(122, 12, 3), // Band pull-apart
    ],
  },
  ...importedWorkouts,
];

export function workoutLabel(workout: Pick<Workout, 'name' | 'emoji'>): string {
  return workout.emoji ? `${workout.emoji} ${workout.name}` : workout.name;
}

/** Maps a stored history name (with or without emoji) to the current CSV label. */
export function csvWorkoutLabel(name: string, list: Workout[] = workouts): string {
  const match = list.find(workout => workout.name === name || workoutLabel(workout) === name);
  return match ? workoutLabel(match) : name;
}

/** Saved per-workout step settings layered over the bundled defaults. */
export function mergeSavedWorkouts(raw: string | null, defaults: Workout[] = workouts): Workout[] {
  if (!raw) {
    return defaults;
  }
  try {
    const saved = JSON.parse(raw) as {
      id: string;
      name?: string;
      steps: WorkoutStep[];
      restSeconds?: number;
    }[];
    if (!Array.isArray(saved)) {
      return defaults;
    }
    const custom: Workout[] = saved
      .filter(
        item =>
          item &&
          typeof item.name === 'string' &&
          !defaults.some(workout => workout.id === item.id) &&
          Array.isArray(item.steps) &&
          item.steps.every(isWorkoutStep),
      )
      .map(item => ({
        id: item.id,
        name: item.name as string,
        custom: true,
        steps: item.steps,
        restSeconds: typeof item.restSeconds === 'number' ? item.restSeconds : 0,
      }));
    const bundled = defaults.map(workout => {
      const match = saved.find(item => item && item.id === workout.id);
      if (!match) {
        return workout;
      }
      const steps =
        Array.isArray(match.steps) && match.steps.every(isWorkoutStep)
          ? match.steps
          : workout.steps;
      const restSeconds =
        typeof match.restSeconds === 'number' && match.restSeconds >= 0
          ? match.restSeconds
          : workout.restSeconds;
      return {...workout, steps, restSeconds};
    });
    return [...bundled, ...custom];
  } catch {
    return defaults;
  }
}

/** Stores only workouts that differ from the bundled defaults. */
export function serializeWorkoutSettings(list: Workout[], defaults: Workout[] = workouts): string {
  return JSON.stringify(
    list
      .filter(workout => {
        const base = defaults.find(item => item.id === workout.id);
        return (
          !base ||
          JSON.stringify(base.steps) !== JSON.stringify(workout.steps) ||
          (base.restSeconds ?? 0) !== (workout.restSeconds ?? 0)
        );
      })
      .map(workout => ({
        id: workout.id,
        ...(workout.custom ? {name: workout.name} : {}),
        steps: workout.steps,
        restSeconds: workout.restSeconds ?? 0,
      })),
  );
}

function isWorkoutStep(value: unknown): value is WorkoutStep {
  const item = value as WorkoutStep;
  return (
    !!item &&
    typeof item.exerciseId === 'number' &&
    typeof item.repetitions === 'number' &&
    typeof item.secondsPerRep === 'number'
  );
}

function step(
  exerciseId: number,
  repetitions: number,
  secondsPerRep: number,
  twoSides = false,
): WorkoutStep {
  return {exerciseId, repetitions, secondsPerRep, twoSides};
}

/** `reps` on each side: the runner says "Change side" at the midpoint. */
function perSide(exerciseId: number, reps: number, secondsPerRep: number): WorkoutStep {
  return step(exerciseId, reps * 2, secondsPerRep, true);
}
