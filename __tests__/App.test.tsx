/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import {MoveStorage} from '../src/native/MoveStorage';

jest.mock('../src/data/workouts', () => ({
  workouts: [
    {
      id: 'test-workout',
      name: 'Test Workout',
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
    click: jest.fn(() => Promise.resolve(true)),
    repChime: jest.fn(() => Promise.resolve(true)),
    finishChime: jest.fn(() => Promise.resolve(true)),
    stopAudio: jest.fn(() => Promise.resolve(true)),
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

  const startButton = renderer!.root.findByProps({accessibilityLabel: 'Start guided workout'});

  await ReactTestRenderer.act(async () => {
    startButton.props.onPress();
    await Promise.resolve();
  });

  await advancePlayback(19000);

  expect(moveStorageMock.speak).toHaveBeenCalledWith('Windshield Wipers');
  expect(moveStorageMock.speak).toHaveBeenCalledWith('Change side');
  expect(moveStorageMock.speak).toHaveBeenCalledWith('Straight Leg Scissors');
  expect(moveStorageMock.repChime).toHaveBeenCalledTimes(2);
  expect(moveStorageMock.finishChime).toHaveBeenCalledTimes(1);
});
