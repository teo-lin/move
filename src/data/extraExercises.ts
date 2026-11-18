import type {Exercise} from './exercises';

/**
 * Exercises named in the health plan (body/sessions.md) that the original catalog lacks.
 * They have no animation yet, so they show the placeholder picture; dropping a GIF named
 * "<id> <Name>.gif" into assets/exercises and running `npm run generate:exercises` replaces the
 * placeholder automatically (the generated entry wins over the one here).
 */
const placeholder = require('../../assets/placeholder-exercise.png');

export type ExtraExercise = Exercise & {category: string};

type Def = {
  id: number;
  name: string;
  category: 'warmup' | 'balance' | 'strength' | 'stretch';
  /** Defaults used when the exercise is added to a workout: reps (per side if perSide) x seconds. */
  reps: number;
  seconds: number;
  perSide?: boolean;
  description: string;
};

const defs: Def[] = [
  // --- Balance (sessions.md: Balance) ---------------------------------------------------------
  {
    id: 123,
    name: 'Tandem stance',
    category: 'balance',
    reps: 3,
    seconds: 30,
    perSide: true,
    description:
      'Start position: stand upright next to a wall, feet in one line, the heel of one foot touching the toes of the other, arms relaxed or out to the sides. Look straight ahead and hold the position steady, touching the wall only if needed. Hold 30 seconds, then swap the front foot. Do 3 holds per side.',
  },
  {
    id: 124,
    name: 'Single-leg stance',
    category: 'balance',
    reps: 3,
    seconds: 25,
    perSide: true,
    description:
      'Start position: stand upright near a wall, feet hip-width apart, eyes open. Shift your weight onto one leg and lift the other foot a few centimetres off the floor, knee slightly bent. Keep the hips level and look straight ahead. Hold 20-30 seconds, then switch legs. Do 3 holds per side. Progression: eyes closed for 10-15 seconds with a wall within reach, then standing on a foam pad.',
  },
  {
    id: 125,
    name: 'Heel-to-toe walking',
    category: 'balance',
    reps: 2,
    seconds: 20,
    description:
      'Start position: stand upright, arms out to the sides for balance, looking ahead. Walk forward placing each heel directly in front of the toes of the other foot, as if on a line. Take 10 steps forward, then 10 steps back. Do 2 rounds. Stay near a wall if you feel unsteady.',
  },
  {
    id: 126,
    name: 'Romberg stance',
    category: 'balance',
    reps: 2,
    seconds: 20,
    description:
      'Start position: stand upright with the feet together and the arms relaxed, with a wall or a sturdy support within reach. Close your eyes and stand as still as you can. Hold 20 seconds, open your eyes, rest, and repeat once more. Stop if you feel dizzy.',
  },
  // --- Warm-up (sessions.md: Warm-up & cool-down) ----------------------------------------------
  {
    id: 127,
    name: 'Leg swings',
    category: 'warmup',
    reps: 10,
    seconds: 2,
    perSide: true,
    description:
      'Start position: stand upright holding a wall or a chair with one hand. Swing the free leg forward and backward in a relaxed, controlled arc, keeping the trunk upright. Do 10 swings, then turn to face the wall and swing the leg sideways across the body and out to the side 10 times. Switch legs.',
  },
  {
    id: 128,
    name: 'Standing hip circles',
    category: 'warmup',
    reps: 20,
    seconds: 3,
    description:
      'Start position: stand upright, feet hip-width apart, hands on the hips. Draw big, slow circles with the hips, as if stirring a bowl. Do 10 circles one way, then 10 the other way. Keep the knees soft and the shoulders still.',
  },
  {
    id: 129,
    name: 'Seated thoracic rotation',
    category: 'warmup',
    reps: 8,
    seconds: 3,
    perSide: true,
    description:
      'Start position: sit tall on a chair, feet flat on the floor, arms crossed over the chest. Keeping the hips facing forward, slowly rotate the upper body to one side as far as is comfortable, then return and rotate to the other side. Move from the middle of the back, not the lower back. Do 8-10 turns each way.',
  },
  // --- Desk, grip and strength (sessions.md: Office micro-sessions, Hand gripper, Calisthenics) ---
  {
    id: 130,
    name: 'Flexor-ball squeeze',
    category: 'strength',
    reps: 15,
    seconds: 3,
    perSide: true,
    description:
      'Start position: sit or stand with a soft rubber flexor ball in one hand, arm relaxed. Squeeze the ball firmly, hold the squeeze for 2 seconds, then release slowly. Do 15-20 squeezes per hand, 3 sets. A softer alternative to the spring gripper, for the desk or for travel.',
  },
  {
    id: 131,
    name: 'Hand gripper squeeze',
    category: 'strength',
    reps: 15,
    seconds: 4,
    perSide: true,
    description:
      'Start position: sit or stand holding a spring hand gripper (for example a 45 kg one) in one hand, elbow bent and relaxed. Squeeze the handles together slowly and under control, hold 2 seconds at the closed position, then release slowly. Do 3 sets of 15 per hand. Train grip on rest days, away from dead hangs and grip calisthenics.',
  },
  {
    id: 132,
    name: 'Band row',
    category: 'strength',
    reps: 15,
    seconds: 3,
    description:
      'Start position: sit on the floor or a chair with the legs extended and a resistance band looped around the feet (or stand with the band fixed at chest height), holding the ends with both hands, arms straight. Pull the hands toward the ribs, elbows close to the body, squeezing the shoulder blades together. Return slowly. Do 15 repetitions.',
  },
  {
    id: 133,
    name: 'Standing calf raise',
    category: 'strength',
    reps: 20,
    seconds: 2,
    description:
      'Start position: stand upright, feet hip-width apart, one hand resting lightly on a wall for balance. Rise onto the balls of the feet as high as you can, pause 1 second, then lower slowly. Do 20 repetitions.',
  },
  {
    id: 134,
    name: 'Wall sit',
    category: 'strength',
    reps: 3,
    seconds: 20,
    description:
      'Start position: stand with your back against a wall, feet about 50 cm from the wall, hip-width apart. Slide down until the knees are bent at about 90 degrees, thighs parallel to the floor, back flat on the wall. Hold, breathing normally. Build up from 20 seconds toward 60. Stand up slowly. Stop on any knee or back pain.',
  },
  {
    id: 135,
    name: 'Step-ups',
    category: 'strength',
    reps: 10,
    seconds: 3,
    perSide: true,
    description:
      'Start position: stand facing a sturdy step or low box. Step up with one foot, press through the heel until you stand tall on the step, then step down slowly with control. Do 10 repetitions per leg. Start light and add a dumbbell as you progress, weekly.',
  },
  {
    id: 136,
    name: 'Goblet squat',
    category: 'strength',
    reps: 10,
    seconds: 4,
    description:
      'Start position: stand with the feet slightly wider than the hips, holding a dumbbell vertically against the chest with both hands. Keep the chest up, sit back and down with the knees tracking over the toes, then press through the feet to stand. Do 8-12 repetitions, starting light. Part of the bone-loading work.',
  },
  {
    id: 137,
    name: 'Bulgarian split squat',
    category: 'strength',
    reps: 8,
    seconds: 4,
    perSide: true,
    description:
      'Start position: stand facing away from a bench, one foot resting behind you on it, the other foot a long stride forward. Lower the back knee toward the floor with the front knee over the front foot and the torso upright, then press back up. Do 8 repetitions per leg. Do both sides and compare; drop it if one side hurts.',
  },
  {
    id: 138,
    name: 'Pistol squat progression',
    category: 'strength',
    reps: 5,
    seconds: 5,
    perSide: true,
    description:
      'Start position: stand on one leg beside a sturdy support (a door frame or a post), the other leg held forward. Squat down on the standing leg as low as you can control, holding the support, then stand. Progress over the weeks by using less support and going deeper. Do 5 repetitions per leg. Stop on knee or back pain.',
  },
  {
    id: 139,
    name: 'Band deadlift',
    category: 'strength',
    reps: 10,
    seconds: 4,
    description:
      'Start position: stand on the middle of a resistance band, feet hip-width apart, holding the band ends in both hands in front of the thighs. Push the hips back with a flat back and a slight knee bend until the hands pass the knees, then drive the hips forward to stand tall. Do 10-12 repetitions. Keep the spine neutral; stop on sharp lumbar pain.',
  },
  {
    id: 140,
    name: 'Dumbbell Romanian deadlift',
    category: 'strength',
    reps: 10,
    seconds: 4,
    description:
      'Start position: stand holding a light dumbbell in each hand in front of the thighs, knees slightly bent. Hinge at the hips, pushing them back, and slide the dumbbells down the legs to mid-shin with a flat back. Drive the hips forward to stand. Do 8-12 repetitions and add weight progressively. Stop on sharp lumbar pain.',
  },
  {
    id: 141,
    name: 'Archer push-up',
    category: 'strength',
    reps: 5,
    seconds: 4,
    perSide: true,
    description:
      'Start position: high plank with the hands wider than the shoulders. Lower the chest toward one hand while the other arm stays straight out to the side, then press back up and repeat to the other side. Do 5-8 repetitions per side. Reach this progression through full push-up sets of 3 x 12-15; go back to knee push-ups if form breaks.',
  },
  {
    id: 142,
    name: 'Hollow body hold',
    category: 'strength',
    reps: 3,
    seconds: 8,
    description:
      'Start position: lie on your back, arms overhead, legs straight. Press the lower back into the floor, lift the shoulders and legs a few centimetres off the floor so the body forms a shallow banana shape, and hold. Start with 5-10 seconds. Bend the knees to make it easier; stop on lumbar pain.',
  },
  {
    id: 143,
    name: 'Tuck L-sit',
    category: 'strength',
    reps: 3,
    seconds: 4,
    description:
      'Start position: support yourself on parallel bars or floor blocks (or hang from a bar) with straight arms and the shoulders pressed down. Pull the knees up toward the chest and hold 3-5 seconds. Advanced core work: only after the core gate (forearm plank 30 s, Superman 20 s, pain-free).',
  },
  {
    id: 144,
    name: 'L-sit',
    category: 'strength',
    reps: 3,
    seconds: 4,
    description:
      'Start position: support yourself on parallel bars or floor blocks with straight arms, shoulders pressed down, legs extended straight in front. Lift the legs to horizontal and hold 3-5 seconds. Advanced core work: only after the core gate (forearm plank 30 s, Superman 20 s, pain-free).',
  },
  {
    id: 145,
    name: 'Supported dead hang',
    category: 'strength',
    reps: 3,
    seconds: 25,
    description:
      'Start position: stand under a pull-up bar with your feet on a box so that it carries part of your weight, and hold the bar with straight arms. Let the body hang with relaxed shoulders, taking only part of the weight on the hands. Hold 20-30 seconds, 2-3 times. Only after the core gate (forearm plank 30 s, Superman 20 s, pain-free). Stop immediately on any back pain.',
  },
  {
    id: 146,
    name: 'Passive dead hang',
    category: 'strength',
    reps: 3,
    seconds: 25,
    description:
      'Start position: hang from a pull-up bar with straight arms and relaxed (passive) shoulders. Hold 20-30 seconds, 2-3 times. It decompresses the spine. Only after supported hangs and the core gate; stop immediately on any back or shoulder pain. Do not schedule on the same day as the hand gripper.',
  },
  {
    id: 147,
    name: 'Band-assisted pull-up',
    category: 'strength',
    reps: 5,
    seconds: 5,
    description:
      'Start position: hang from a pull-up bar with a resistance band looped over it and under one knee or both feet. Pull the chest toward the bar until the chin passes it, then lower slowly. Start with the lightest assistance that works and reduce it over time. Do 3-5 repetitions. Only after the core gate and supported hangs.',
  },
  {
    id: 148,
    name: 'Pull-up',
    category: 'strength',
    reps: 3,
    seconds: 5,
    description:
      'Start position: hang from a pull-up bar, hands slightly wider than the shoulders, arms straight. Pull until the chin is over the bar, then lower with control. The goal is 3-5 repetitions. Only after the core gate and progress with band-assisted pull-ups; stop on back pain.',
  },
  // --- Stretches and breathing (sessions.md: cool-down, Office micro-sessions) -------------------
  {
    id: 149,
    name: 'Hip flexor stretch',
    category: 'stretch',
    reps: 1,
    seconds: 30,
    perSide: true,
    description:
      'Start position: kneel on one knee (with padding under it), the other foot forward in a lunge. Tuck the pelvis slightly and shift forward until you feel a stretch at the front of the back hip. Hold 30 seconds, then switch sides. Tight hip flexors from sitting worsen back and sciatic pain.',
  },
  {
    id: 150,
    name: 'Calf stretch',
    category: 'stretch',
    reps: 1,
    seconds: 30,
    perSide: true,
    description:
      'Start position: stand facing a wall, one foot forward, the back leg straight with the heel on the floor. Lean forward, bending the front knee, until you feel a stretch in the back calf. Hold 30 seconds, then switch sides.',
  },
  {
    id: 151,
    name: 'Hamstring stretch',
    category: 'stretch',
    reps: 1,
    seconds: 25,
    perSide: true,
    description:
      'Start position: lie on your back with one leg raised and a strap or towel around the foot (or sit with one leg extended). Straighten the raised knee gently until you feel a mild stretch at the back of the thigh. Keep the back flat and go only to mild tension, never pain. Hold 20-30 seconds per leg.',
  },
  {
    id: 152,
    name: 'Seated forward fold',
    category: 'stretch',
    reps: 2,
    seconds: 25,
    description:
      'Start position: sit with the legs extended (knees slightly bent if tight) or sit on a chair. Hinge forward from the hips, letting the arms reach toward the feet, until you feel a mild stretch at the back of the legs. Relax the neck and breathe slowly. Hold 20-30 seconds. Skip it or go less far if it bothers the lower back.',
  },
  {
    id: 153,
    name: 'Diaphragmatic breathing',
    category: 'stretch',
    reps: 5,
    seconds: 8,
    description:
      'Start position: sit or lie comfortably, one hand on the chest and one on the belly. Inhale slowly through the nose so the belly rises more than the chest, then exhale slowly through the mouth. Do 5 slow breaths. Use it for calm and to reset after long sitting.',
  },
];

export const extraExercises: ExtraExercise[] = defs.map(def => ({
  id: def.id,
  name: def.name,
  asset: placeholder,
  category: def.category,
}));

export const extraDescriptions: Record<number, string> = Object.fromEntries(
  defs.map(def => [def.id, def.description]),
);

/** Reps/seconds used when the exercise is added to a workout (two-sided reps are the total). */
export const extraDefaults: Record<
  number,
  {repetitions: number; secondsPerRep: number; twoSides: boolean}
> = Object.fromEntries(
  defs.map(def => [
    def.id,
    {
      repetitions: def.perSide ? def.reps * 2 : def.reps,
      secondsPerRep: def.seconds,
      twoSides: !!def.perSide,
    },
  ]),
);
