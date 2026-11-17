/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import {MoveStorage} from '../src/native/MoveStorage';

jest.mock('../src/data/workouts', () => ({
  ...jest.requireActual('../src/data/workouts'),
  workouts: [
    {
      id: 'test-workout',
      name: 'Test Workout',
      restSeconds: 3,
      steps: [
        {exerciseId: 3, repetitions: 2, secondsPerRep: 1, twoSides: true},
        {exerciseId: 6, repetitions: 1, secondsPerRep: 1},
      ],
    },
  ],
}));

jest.mock('../src/native/MoveStorage', () => ({
  MoveStorage: {
    getString: jest.fn(() => Promise.resolve(null)),
    setString: jest.fn(() => Promise.resolve(true)),
    exportCsv: jest.fn(() => Promise.resolve('Download/move/back-exercises.csv')),
    speak: jest.fn(() => Promise.resolve(true)),
    countdownRoll: jest.fn(() => Promise.resolve(true)),
    repChime: jest.fn(() => Promise.resolve(true)),
    finishChime: jest.fn(() => Promise.resolve(true)),
    restChime: jest.fn(() => Promise.resolve(true)),
    stopAudio: jest.fn(() => Promise.resolve(true)),
    setKeepAwake: jest.fn(() => Promise.resolve(true)),
    getSpeechSettings: jest.fn(() => Promise.reject(new Error('not in tests'))),
  },
}));

const moveStorageMock = MoveStorage as jest.Mocked<typeof MoveStorage>;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

async function advancePlayback(milliseconds: number) {
  let remaining = milliseconds;

  while (remaining > 0) {
    const tick = Math.min(remaining, 250);
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(tick);
      await Promise.resolve();
    });
    remaining -= tick;
  }
}

test('renders correctly', async () => {
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });
});

test('auto-advances once after a two-sided exercise finishes', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });

  const startButton = renderer!.root.findByProps({accessibilityLabel: 'Start Test Workout'});

  await ReactTestRenderer.act(async () => {
    startButton.props.onPress();
    await Promise.resolve();
  });

  await advancePlayback(25000);

  expect(moveStorageMock.speak).toHaveBeenCalledWith('Windshield Wipers, left');
  expect(moveStorageMock.speak).toHaveBeenCalledWith('Right side');
  expect(moveStorageMock.speak).toHaveBeenCalledWith('Straight Leg Scissors');
  // Two reps, two-sided: the first rep chimes, the last rep is marked by the finish chime.
  expect(moveStorageMock.repChime).toHaveBeenCalledTimes(1);
  expect(moveStorageMock.finishChime).toHaveBeenCalledTimes(1);
  // A 3 s catch-your-breath break separates the exercises.
  expect(moveStorageMock.speak).toHaveBeenCalledWith('Rest');
  expect(moveStorageMock.restChime).toHaveBeenCalledTimes(1);
  // The screen is kept on while the workout runs.
  expect(moveStorageMock.setKeepAwake).toHaveBeenCalledWith(true);
});

test('inserting a breather saves it in the workout and offers to skip it', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });
  await ReactTestRenderer.act(async () => {
    renderer!.root.findByProps({accessibilityLabel: 'Start Test Workout'}).props.onPress();
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    renderer!.root.findByProps({accessibilityLabel: 'Breathe'}).props.onPress();
    await Promise.resolve();
  });

  // The button turns into "Skip breather" and the workout (with the breather) is persisted.
  expect(renderer!.root.findAllByProps({accessibilityLabel: 'Skip breather'}).length).toBeGreaterThan(0);
  const saved = moveStorageMock.setString.mock.calls.filter(([key]) => key === 'workouts-v2').pop();
  expect(saved).toBeDefined();
  const steps = JSON.parse(saved![1])[0].steps;
  expect(steps.map((s: {breather?: boolean}) => !!s.breather)).toEqual([false, true, false]);
  expect(steps[1].secondsPerRep).toBe(4);

  // Skip -> the button goes back to Breathe; Breathe re-enables the skipped breather (no duplicate).
  await ReactTestRenderer.act(async () => {
    renderer!.root.findByProps({accessibilityLabel: 'Skip breather'}).props.onPress();
    await Promise.resolve();
  });
  expect(renderer!.root.findAllByProps({accessibilityLabel: 'Breathe'}).length).toBeGreaterThan(0);
  await ReactTestRenderer.act(async () => {
    renderer!.root.findByProps({accessibilityLabel: 'Breathe'}).props.onPress();
    await Promise.resolve();
  });
  expect(renderer!.root.findAllByProps({accessibilityLabel: 'Skip breather'}).length).toBeGreaterThan(0);
  const last = moveStorageMock.setString.mock.calls.filter(([key]) => key === 'workouts-v2').pop();
  expect(JSON.parse(last![1])[0].steps).toHaveLength(3);
});
