import type {Exercise} from './exercises';

/** Exercises the user adds in the app. They have no animation, so they show a placeholder. */
export type CustomExercise = {id: number; name: string};

export const customExercisesKey = 'custom-exercises';

/** Bundled exercise ids are 1–999; user-added ones start here. */
export const FIRST_CUSTOM_EXERCISE_ID = 1000;

const placeholder = require('../../assets/placeholder-exercise.png');

export function parseCustomExercises(raw: string | null): CustomExercise[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is CustomExercise =>
            !!item && typeof item.id === 'number' && typeof item.name === 'string' && item.name.trim() !== '',
        )
      : [];
  } catch {
    return [];
  }
}

export function nextCustomExerciseId(list: CustomExercise[]): number {
  return Math.max(FIRST_CUSTOM_EXERCISE_ID - 1, ...list.map(item => item.id)) + 1;
}

export function toExercise(item: CustomExercise): Exercise {
  return {id: item.id, name: item.name, asset: placeholder};
}
