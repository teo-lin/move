export type Workout = {
  id: string;
  name: string;
  /** Prefix used in the UI and in back-exercises.csv (e.g. "🦦 PeSpate: abs"). */
  emoji?: string;
  /** Catch-your-breath break between exercises, in seconds (0 = none). */
  restSeconds?: number;
  steps: WorkoutStep[];
};

export type WorkoutStep = {
  exerciseId: number;
  repetitions: number;
  secondsPerRep: number;
  twoSides?: boolean;
};

export const workoutsKey = 'workouts';

export const workouts: Workout[] = [
  {
    id: 'pespate-abs',
    name: 'PeSpate: abs',
    emoji: '🦦',
    steps: [
      step(3, 16, 3),
      step(6, 16, 3),
      step(7, 16, 3, true),
      step(14, 16, 3, true),
      step(16, 16, 3),
      step(39, 16, 3, true),
      step(15, 16, 3),
      step(17, 16, 3),
      step(18, 16, 3),
      step(19, 16, 3),
      step(20, 16, 3),
      step(21, 16, 3),
      step(9, 16, 3),
      step(23, 16, 3),
      step(34, 16, 3, true),
      step(36, 16, 3),
    ],
  },
  {
    id: 'patrulabe-upper-body',
    name: 'PatruLabe: upper body',
    emoji: '🐈',
    steps: [
      step(53, 15, 3),
      step(49, 15, 3),
      step(50, 15, 3),
      step(55, 15, 3),
      step(51, 15, 3),
      step(58, 15, 3, true),
      step(60, 15, 3),
      step(52, 15, 3),
      step(77, 15, 3),
      step(78, 15, 3),
      step(82, 15, 3),
      step(71, 15, 3),
      step(79, 15, 3),
      step(56, 15, 3),
      step(46, 15, 3),
    ],
  },
  // body/sessions.md "Kineto session — Core-First A (L1)". "N/side" = N reps per side.
  {
    id: 'core-first-a',
    name: 'Core-First A',
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
    steps: [
      step(116, 10, 2), // Arm rotations
      step(117, 10, 3), // Arm raises
      step(121, 8, 3), // Wall push-up
      step(115, 8, 3), // Squat
    ],
  },
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
    const saved = JSON.parse(raw) as {id: string; steps: WorkoutStep[]; restSeconds?: number}[];
    if (!Array.isArray(saved)) {
      return defaults;
    }
    return defaults.map(workout => {
      const match = saved.find(item => item && item.id === workout.id);
      if (!match) {
        return workout;
      }
      const steps =
        Array.isArray(match.steps) && match.steps.every(isWorkoutStep) ? match.steps : workout.steps;
      const restSeconds =
        typeof match.restSeconds === 'number' && match.restSeconds >= 0
          ? match.restSeconds
          : workout.restSeconds;
      return {...workout, steps, restSeconds};
    });
  } catch {
    return defaults;
  }
}

export function serializeWorkoutSettings(list: Workout[]): string {
  return JSON.stringify(
    list.map(workout => ({id: workout.id, steps: workout.steps, restSeconds: workout.restSeconds ?? 0})),
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

function step(exerciseId: number, repetitions: number, secondsPerRep: number, twoSides = false): WorkoutStep {
  return {exerciseId, repetitions, secondsPerRep, twoSides};
}

/** `reps` on each side: the runner says "Change side" at the midpoint. */
function perSide(exerciseId: number, reps: number, secondsPerRep: number): WorkoutStep {
  return step(exerciseId, reps * 2, secondsPerRep, true);
}
