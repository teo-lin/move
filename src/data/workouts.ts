export type Workout = {
  id: string;
  name: string;
  steps: WorkoutStep[];
};

export type WorkoutStep = {
  exerciseId: number;
  repetitions: number;
  secondsPerRep: number;
  twoSides?: boolean;
};

export const workouts: Workout[] = [
  {
    id: 'pespate-abs',
    name: 'PeSpate: abs',
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
];

function step(exerciseId: number, repetitions: number, secondsPerRep: number, twoSides = false): WorkoutStep {
  return {exerciseId, repetitions, secondsPerRep, twoSides};
}
