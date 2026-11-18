import type {Workout, WorkoutStep} from './workouts';

/**
 * The original Back Exercises app's built-in programs, with its default repetitions and seconds.
 * Each step is [exerciseId, repetitions, secondsPerRep, perSide]; for per-side moves the
 * repetitions are per side. Timed holds are stored as repetitions of the hold length.
 */
const programs: {id: string; name: string; steps: [number, number, number, boolean][]}[] = [
  {
    id: 'back-healthy-back',
    name: 'Healthy back',
    steps: [
      [1, 2, 30, false], // Lumbar Flattening
      [12, 16, 1, false], // Ankle Pumps
      [13, 16, 3, false], // Heel Slides
      [16, 16, 4, false], // Alternating knee to the chest
      [24, 2, 8, true], // Leg circles
      [35, 12, 2, true], // Leg lift 1
      [42, 1, 15, true], // Side forearm plank
      [46, 12, 3, false], // Squat to heels
      [50, 12, 2, false], // Tails
      [57, 16, 3, false], // Knee steps
      [60, 16, 3, false], // Hunting dog 3
      [62, 8, 2, false], // Short plank
      [67, 8, 4, false], // Swan 1
      [76, 8, 3, false], // Boat 6
      [72, 8, 3, false], // Boat 2
      [106, 8, 6, false], // Rollback 2
      [102, 8, 4, false], // Reverse bridge
      [103, 2, 15, false], // Reverse bridge with hold
      [20, 12, 8, false], // Leading knee twists
    ],
  },
  {
    id: 'back-strong-back',
    name: 'Strong back',
    steps: [
      [98, 8, 2, false], // Shoulder circles
      [99, 8, 2, false], // Sitting shoulder blade retraction
      [104, 16, 4, false], // Reverse bridge with complication
      [107, 12, 6, false], // Rollback 3
      [109, 2, 15, false], // Reverse plank
      [66, 1, 15, true], // Side plank on the palms
      [55, 8, 2, false], // Knee Pushups
      [75, 8, 3, false], // Boat 5
      [76, 8, 3, false], // Boat 6
      [68, 4, 4, false], // Swan 2
      [4, 12, 4, false], // Windshield Wipers 2
      [10, 12, 4, false], // Bridge with single leg raise
      [14, 12, 3, false], // Straight leg lift
      [19, 8, 4, false], // Double crunch
      [26, 12, 3, false], // Scissors
      [25, 8, 4, false], // Swimmer on back
      [61, 1, 15, true], // Hunting dog 4
      [63, 1, 15, true], // Shortened plate
      [119, 3, 8, false], // Roll Up
      [117, 12, 4, false], // Arm raises
      [116, 16, 2, false], // Arm rotations
      [114, 16, 2, false], // Forward leg kicks
      [112, 8, 4, false], // Forward bends
      [115, 8, 4, false], // Squat
    ],
  },
  {
    id: 'back-strengthening-the-neck',
    name: 'Strengthening the neck',
    steps: [
      [95, 4, 4, true], // Neck rotation stretch
      [94, 4, 4, true], // Neck side strech
      [93, 8, 8, false], // Neck forward stretch
      [96, 8, 8, false], // Neck resistance down
      [89, 8, 4, false], // Neck resistance forward
      [90, 8, 4, false], // Neck resistance back
      [91, 4, 4, true], // Head side bow with resistance
      [92, 4, 4, true], // Head turns with resistance
      [44, 8, 4, true], // Sideways head lift
      [32, 8, 4, false], // Head nod
      [87, 8, 3, false], // Head lift
    ],
  },
  {
    id: 'back-strengthening-the-lower-back',
    name: 'Strengthening the lower back',
    steps: [
      [12, 16, 1, false], // Ankle Pumps
      [3, 16, 4, false], // Windshield Wipers
      [6, 12, 2, false], // Straight Leg Scissors
      [9, 8, 3, false], // Bridge
      [37, 8, 2, true], // Leg lift 2
      [34, 8, 4, true], // Side-lying kicks
      [40, 8, 2, true], // Leg lift 4
      [42, 1, 15, true], // Side forearm plank
      [59, 16, 2, false], // Hunting dog 2
      [58, 16, 3, false], // Hunting dog
      [53, 8, 8, false], // Rolls
      [85, 16, 4, false], // Prone heel kicks
      [77, 8, 3, false], // Swimmer
      [47, 8, 4, false], // Cat 1
      [48, 8, 4, false], // Cat 2
      [51, 16, 8, false], // Bear
    ],
  },
  {
    id: 'back-strengthening-the-chest',
    name: 'Strengthening the chest',
    steps: [
      [98, 8, 2, false], // Shoulder circles
      [97, 8, 2, false], // Shoulder lift
      [99, 8, 2, false], // Sitting shoulder blade retraction
      [108, 16, 4, false], // Twist
      [105, 8, 4, false], // Body rollback
      [27, 8, 4, false], // Shoulders to the ears
      [28, 8, 3, false], // Shoulder blade protraction
      [29, 8, 4, false], // Arms behind the head
      [30, 8, 6, false], // Lying arm circles
      [31, 8, 3, false], // Deflection
      [39, 12, 2, true], // Leg lift 3
      [43, 1, 15, true], // Side forearm plank 2
      [53, 8, 8, false], // Rolls
      [55, 8, 2, false], // Knee Pushups
      [73, 8, 3, false], // Boat 3
      [80, 8, 3, false], // Shoulder blade retraction and flys 2
      [81, 8, 3, false], // Sphinx
      [86, 2, 15, false], // Forearm plank
    ],
  },
  {
    id: 'back-functional-back',
    name: 'Functional back',
    steps: [
      [1, 2, 30, false], // Lumbar Flattening
      [12, 16, 1, false], // Ankle Pumps
      [22, 12, 6, false], // Hip rotations
      [16, 16, 4, false], // Alternating knee to the chest
      [5, 2, 15, false], // A Hundred
      [7, 8, 3, true], // Diagonal crunches
      [8, 8, 3, false], // Inverse crunches
      [10, 12, 4, false], // Bridge with single leg raise
      [21, 12, 4, false], // Bug
      [33, 2, 15, false], // Head nod with hold
      [45, 1, 15, true], // Sideways head lift with hold
      [36, 8, 3, true], // Both leg lift
      [38, 8, 3, true], // Leg and core lift
      [41, 6, 2, true], // Leg lift 5
      [66, 1, 15, true], // Side plank on the palms
      [74, 8, 3, false], // Boat 4
      [88, 4, 10, false], // Head lift with hold
      [69, 8, 3, false], // Swan 3
      [70, 8, 3, false], // Swan 4
      [110, 12, 2, false], // Reverse plank with complication
      [117, 12, 4, false], // Arm raises
      [113, 8, 4, false], // Forward bends with complication
      [115, 8, 4, false], // Squat
      [111, 8, 4, true], // Warrior
      [118, 8, 4, true], // Lunges
      [120, 3, 8, false], // Roll Down
      [119, 3, 8, false], // Roll Up
    ],
  },
  {
    id: 'back-with-persistent-pain',
    name: 'With persistent pain',
    steps: [
      [1, 2, 30, false], // Lumbar Flattening
      [12, 16, 1, false], // Ankle Pumps
      [13, 16, 3, false], // Heel Slides
      [2, 12, 6, false], // Heel Slides with Knee to Chest
      [15, 16, 3, false], // Toes to the knee
      [3, 16, 4, false], // Windshield Wipers
      [11, 8, 8, false], // Slow Bridge
      [17, 16, 6, false], // Two knees to the chest
      [18, 12, 5, false], // Fan
      [23, 8, 10, false], // Rolling situp
      [32, 8, 4, false], // Head nod
      [44, 8, 4, true], // Sideways head lift
      [35, 12, 2, true], // Leg lift 1
      [79, 8, 3, false], // Shoulder blade retraction and flys
      [81, 8, 3, false], // Sphinx
      [84, 8, 2, false], // Heel presses
      [87, 8, 3, false], // Head lift
    ],
  },
  {
    id: 'back-morning-exercises',
    name: 'Morning exercises',
    steps: [
      [94, 4, 4, true], // Neck side strech
      [93, 8, 8, false], // Neck forward stretch
      [96, 8, 8, false], // Neck resistance down
      [98, 8, 2, false], // Shoulder circles
      [97, 8, 2, false], // Shoulder lift
      [100, 8, 4, true], // Side body stretch
      [99, 8, 2, false], // Sitting shoulder blade retraction
      [101, 8, 4, true], // Sitting side slope
      [102, 8, 4, false], // Reverse bridge
      [103, 2, 15, false], // Reverse bridge with hold
      [106, 8, 6, false], // Rollback 2
      [107, 12, 6, false], // Rollback 3
      [72, 8, 3, false], // Boat 2
      [76, 8, 3, false], // Boat 6
      [53, 8, 8, false], // Rolls
      [119, 3, 8, false], // Roll Up
    ],
  },
  {
    id: 'back-stretching-the-spine',
    name: 'Stretching the spine',
    steps: [
      [95, 4, 4, true], // Neck rotation stretch
      [94, 4, 4, true], // Neck side strech
      [93, 8, 8, false], // Neck forward stretch
      [96, 8, 8, false], // Neck resistance down
      [100, 8, 4, true], // Side body stretch
      [46, 12, 3, false], // Squat to heels
      [53, 8, 8, false], // Rolls
      [82, 8, 3, false], // Cobra
      [78, 8, 3, false], // Hands to heels
      [119, 3, 8, false], // Roll Up
      [120, 3, 8, false], // Roll Down
    ],
  },
];

export const importedWorkouts: Workout[] = programs.map(program => ({
  id: program.id,
  name: program.name,
  steps: program.steps.map(
    ([exerciseId, repetitions, secondsPerRep, perSide]): WorkoutStep => ({
      exerciseId,
      repetitions: perSide ? repetitions * 2 : repetitions,
      secondsPerRep,
      twoSides: perSide,
    }),
  ),
}));
