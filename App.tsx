import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  Easing,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {descriptions} from './src/data/descriptions';
import {Exercise, exercises} from './src/data/exercises';
import {
  CustomExercise,
  customExercisesKey,
  nextCustomExerciseId,
  parseCustomExercises,
  toExercise,
} from './src/data/customExercises';
import {
  breatherStep,
  csvWorkoutLabel,
  exerciseCount,
  mergeSavedWorkouts,
  serializeWorkoutSettings,
  workoutLabel,
  workouts as starterWorkouts,
  workoutsKey,
  workoutOrderKey,
  deletedWorkoutsKey,
  parseIdList,
  parseWorkoutOrder,
  applyWorkoutOrder,
  Workout,
  WorkoutStep,
} from './src/data/workouts';
import {
  formatDisplayDate,
  formatDuration,
  formatTime,
  groupByLocalDate,
  historyKey,
  historyStats,
  localDateKey,
  parseHistory,
  serializeHistory,
  SessionEntry,
  toBackExercisesCsv,
} from './src/data/history';
import {MoveStorage, SpeechSettings} from './src/native/MoveStorage';
import {Icon, IconName} from './src/ui/Icon';
import {Calendar} from './src/ui/Calendar';
import {Dropdown} from './src/ui/Dropdown';
import {SwipeRow} from './src/ui/SwipeRow';
import {useDragReorder} from './src/ui/useDragReorder';
import {CatalogGrid} from './src/ui/CatalogGrid';
import {GlowTile} from './src/ui/GlowTile';
import {
  sessionBackgroundMap,
  assignCardBackgrounds,
  cardBackground,
  cardBackgroundsKey,
  parseCardBackgrounds,
  tileBackgrounds,
} from './src/ui/backgrounds';

type Screen = 'workouts' | 'catalog' | 'history' | 'stats' | 'settings';
type Phase = 'announce' | 'countdown' | 'work' | 'change-side' | 'finishing' | 'rest';

/** Space between the rows of the workout editor (must match the container's `gap`). */
const STEP_GAP = 12;

export default function App(): React.JSX.Element {
  // Editor rows: the exercise animation gets 55% of the row at its true 16:9 shape (640x360).
  // Row = screen - 2x18 padding - card border (2) - card padding (12) - gap (8).
  const {width: screenWidth} = useWindowDimensions();
  const stepImageWidth = Math.round((screenWidth - 36 - 2 - 12 - 8) * 0.55);
  const stepImageSize = {width: stepImageWidth, height: Math.round((stepImageWidth * 9) / 16)};
  const [screen, setScreen] = useState<Screen>('workouts');
  const [history, setHistory] = useState<SessionEntry[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>(starterWorkouts);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(starterWorkouts[0]?.id ?? '');
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('announce');
  const [countdown, setCountdown] = useState(5);
  const [rep, setRep] = useState(0);
  const [sideChanged, setSideChanged] = useState(false);
  const [paused, setPaused] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<boolean[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [restRemaining, setRestRemaining] = useState(0);
  const [restTotal, setRestTotal] = useState(0);
  const [skipBreatherAt, setSkipBreatherAt] = useState<number | null>(null);
  const [, setClock] = useState(0);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [detailExerciseId, setDetailExerciseId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickerFilter, setPickerFilter] = useState('');
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [cardBackgrounds, setCardBackgrounds] = useState<Record<string, number> | null>(null);
  const allExercises = useMemo(
    () => [...exercises, ...customExercises.map(toExercise)],
    [customExercises],
  );
  const exerciseMap = useMemo(
    () => new Map(allExercises.map(item => [item.id, item])),
    [allExercises],
  );
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return {year: now.getFullYear(), month: now.getMonth()};
  });

  const selectedWorkout = workouts.find(workout => workout.id === selectedWorkoutId) ?? workouts[0];
  const [openSwipe, setOpenSwipe] = useState<string | null>(null);
  const [deletedWorkoutIds, setDeletedWorkoutIds] = useState<string[]>([]);
  const [undoSteps, setUndoSteps] = useState<
    {workoutId: string; index: number; step: WorkoutStep}[]
  >([]);
  const [undoSessions, setUndoSessions] = useState<SessionEntry[]>([]);
  const [undoWorkouts, setUndoWorkouts] = useState<
    {workout: Workout; index: number; hidden: boolean}[]
  >([]);
  const workoutDrag = useDragReorder({
    count: workouts.length,
    gap: STEP_GAP,
    onReorder: reorderWorkout,
    captureTouches: false, // the tile is one touch area, the edit button inside keeps its own
  });
  const reorder = useDragReorder({
    count: selectedWorkout?.steps.length ?? 0,
    gap: STEP_GAP,
    onReorder: reorderStep,
  });
  const activeStep = activeWorkout?.steps[activeIndex] ?? null;
  const activeExercise = activeStep ? exerciseMap.get(activeStep.exerciseId) ?? null : null;
  useEffect(() => {
    if (!cardBackgrounds || !settingsLoaded) {
      return;
    }
    const next = assignCardBackgrounds(
      cardBackgrounds,
      workouts.map(workout => workout.id),
    );
    if (next !== cardBackgrounds) {
      setCardBackgrounds(next);
      fire(MoveStorage.setString(cardBackgroundsKey, JSON.stringify(next)));
    }
  }, [cardBackgrounds, workouts, settingsLoaded]);

  /** Background index for a workout (by id). */
  const backgroundFor = (workoutId: string | undefined) =>
    workoutId === undefined ? undefined : cardBackgrounds?.[workoutId];

  /** History: every session its own background (stable per session, never the same twice in a row). */
  const sessionBackgrounds = useMemo(() => sessionBackgroundMap(history), [history]);

  const dayColors = useMemo(() => {
    const map = new Map<string, string[]>();
    [...history]
      .sort((a, b) => a.timestamp - b.timestamp)
      .forEach(entry => {
        const key = localDateKey(entry.timestamp);
        map.set(key, [
          ...(map.get(key) ?? []),
          workoutTint(workoutIndexFor(entry.workout, workouts), 74, 62),
        ]);
      });
    return map;
  }, [history, workouts]);
  const detailExercise =
    detailExerciseId === null ? null : exerciseMap.get(detailExerciseId) ?? null;

  useEffect(() => {
    MoveStorage.getString(historyKey).then(raw => setHistory(parseHistory(raw)));
    MoveStorage.getString(customExercisesKey).then(raw =>
      setCustomExercises(parseCustomExercises(raw)),
    );
    MoveStorage.getString(cardBackgroundsKey).then(raw =>
      setCardBackgrounds(parseCardBackgrounds(raw)),
    );
    Promise.all([
      MoveStorage.getString(workoutsKey),
      MoveStorage.getString(workoutOrderKey),
      MoveStorage.getString(deletedWorkoutsKey),
    ])
      .then(([raw, order, deleted]) => {
        const hidden = parseIdList(deleted);
        setDeletedWorkoutIds(hidden);
        setWorkouts(
          applyWorkoutOrder(
            mergeSavedWorkouts(raw, starterWorkouts),
            parseWorkoutOrder(order),
          ).filter(workout => !hidden.includes(workout.id)),
        );
      })
      .finally(() => setSettingsLoaded(true));
  }, []);

  useEffect(() => {
    if (settingsLoaded) {
      fire(MoveStorage.setString(workoutsKey, serializeWorkoutSettings(workouts)));
      fire(MoveStorage.setString(workoutOrderKey, JSON.stringify(workouts.map(w => w.id))));
    }
  }, [workouts, settingsLoaded]);

  useEffect(() => {
    if (settingsLoaded) {
      fire(MoveStorage.setString(deletedWorkoutsKey, JSON.stringify(deletedWorkoutIds)));
    }
  }, [deletedWorkoutIds, settingsLoaded]);

  // The editor's undo list belongs to the workout that is open; swipes close when you move on.
  useEffect(() => {
    if (!editing) {
      setUndoSteps([]);
    }
    setOpenSwipe(null);
  }, [editing, selectedWorkoutId, screen]);

  useEffect(() => {
    fire(MoveStorage.setKeepAwake(activeWorkout !== null));
    if (!activeWorkout) {
      return;
    }
    const tick = setInterval(() => setClock(value => value + 1), 1000);
    return () => clearInterval(tick);
  }, [activeWorkout]);

  useEffect(() => {
    if (detailExerciseId === null && !editing && !creatingExercise && screen !== 'settings') {
      return;
    }
    // Back: exercise detail -> catalog; editor -> workout list; settings -> workouts.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (detailExerciseId !== null) {
        setDetailExerciseId(null);
      } else if (picking) {
        setPicking(false);
      } else if (creatingExercise) {
        setCreatingExercise(false);
      } else if (editing) {
        setEditing(false);
      } else {
        setScreen('workouts');
      }
      return true;
    });
    return () => subscription.remove();
  }, [detailExerciseId, editing, picking, creatingExercise, screen]);

  function navigate(next: Screen) {
    setEditing(false);
    setPicking(false);
    setCreatingExercise(false);
    setDetailExerciseId(null);
    setScreen(next);
  }

  useEffect(() => {
    if (!activeWorkout || !activeStep || paused) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    // Speak, then continue only once the voice has finished (never talk over the countdown).
    const speakThen = (text: string, next: () => void, gapMs: number) => {
      MoveStorage.speak(text)
        .catch(() => undefined)
        .then(() => {
          if (!cancelled) {
            timer = setTimeout(next, gapMs);
          }
        });
    };

    if (phase === 'announce' && activeStep.breather) {
      setRestTotal(activeStep.secondsPerRep);
      setRestRemaining(activeStep.secondsPerRep);
      setPhase('rest');
    } else if (phase === 'announce') {
      const name = exerciseMap.get(activeStep.exerciseId)?.name ?? 'Exercise';
      speakThen(
        activeStep.twoSides ? `${name}, left` : name,
        () => {
          setCountdown(5);
          setPhase('countdown');
        },
        400,
      );
    }

    if (phase === 'countdown') {
      if (countdown > 0) {
        if (countdown === 5) {
          // One accelerating drum roll spans the whole 5-second countdown.
          fire(MoveStorage.countdownRoll());
        }
        timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      } else {
        fire(MoveStorage.speak('Go'));
        timer = setTimeout(() => {
          if (!sideChanged) {
            setRep(0);
          }
          setPhase('work');
        }, 600);
      }
    }

    if (phase === 'change-side') {
      speakThen(
        'Right side',
        () => {
          setSideChanged(true);
          setCountdown(5);
          setPhase('countdown');
        },
        400,
      );
    }

    if (phase === 'work') {
      timer = setTimeout(() => {
        const nextRep = rep + 1;
        if (nextRep < activeStep.repetitions) {
          fire(MoveStorage.repChime());
        }
        setRep(nextRep);

        if (
          activeStep.twoSides &&
          !sideChanged &&
          nextRep >= Math.ceil(activeStep.repetitions / 2)
        ) {
          setPhase('change-side');
          return;
        }

        if (nextRep >= activeStep.repetitions) {
          markStepComplete(activeIndex);
          fire(MoveStorage.finishChime());
          setPhase('finishing');
        }
      }, activeStep.secondsPerRep * 1000);
    }

    if (phase === 'finishing') {
      timer = setTimeout(() => advanceAfterExercise(), 700);
    }

    if (phase === 'rest') {
      if (restRemaining > 0) {
        timer = setTimeout(() => setRestRemaining(restRemaining - 1), 1000);
      } else {
        fire(MoveStorage.restChime());
        timer = setTimeout(
          () => (activeStep.breather ? advanceAfterExercise() : setPhase('announce')),
          900,
        );
      }
    }

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
    // The timer intentionally captures the current playback state for one tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeWorkout?.id,
    activeStep,
    activeIndex,
    countdown,
    phase,
    rep,
    sideChanged,
    paused,
    restRemaining,
  ]);

  const elapsed = startedAt ? Math.max(0, Math.round((Date.now() - startedAt) / 1000)) : 0;

  async function saveHistory(nextHistory: SessionEntry[]) {
    setHistory(nextHistory);
    await MoveStorage.setString(historyKey, serializeHistory(nextHistory));
  }

  function startWorkout(workout: Workout) {
    if (exerciseCount(workout) === 0) {
      Alert.alert('No exercises yet', 'Edit the workout and add some exercises first.');
      return;
    }
    setActiveWorkout(workout);
    setActiveIndex(0);
    setPhase('announce');
    setCountdown(5);
    setRep(0);
    setSideChanged(false);
    setPaused(false);
    setCompletedSteps(workout.steps.map(() => false));
    setSkipBreatherAt(null);
    setStartedAt(Date.now());
  }

  function goToStep(index: number) {
    setActiveIndex(index);
    setCountdown(5);
    setRep(0);
    setSideChanged(false);
    setPaused(false);
    setPhase('announce');
  }

  /** Index of the step after `index`, skipping a breather the user chose to skip. */
  function stepAfter(index: number): number {
    const next = index + 1;
    const steps = activeWorkout?.steps ?? [];
    return next < steps.length && steps[next].breather && skipBreatherAt === next ? next + 1 : next;
  }

  /** Inserts a 4 s breather after the current exercise and saves it in the workout. */
  function insertBreather() {
    if (!activeWorkout) {
      return;
    }
    const at = activeIndex + 1;
    const steps = [...activeWorkout.steps];
    steps.splice(at, 0, breatherStep());
    setActiveWorkout({...activeWorkout, steps});
    setCompletedSteps(current => {
      const next = [...current];
      next.splice(at, 0, false);
      return next;
    });
    setWorkouts(list => list.map(item => (item.id === activeWorkout.id ? {...item, steps} : item)));
  }

  /** Breathe: re-enable a breather skipped for this run, or insert a new one. */
  function breathe() {
    if (activeWorkout?.steps[activeIndex + 1]?.breather && skipBreatherAt === activeIndex + 1) {
      setSkipBreatherAt(null);
    } else {
      insertBreather();
    }
  }

  function skipBreather() {
    if (activeStep?.breather) {
      fire(MoveStorage.stopAudio());
      setRestRemaining(0);
      advanceAfterExercise();
    } else {
      setSkipBreatherAt(activeIndex + 1);
    }
  }

  function startRest(seconds: number) {
    fire(MoveStorage.stopAudio());
    fire(MoveStorage.speak('Rest'));
    setRestTotal(seconds);
    setRestRemaining(seconds);
    setRep(0);
    setSideChanged(false);
    setPaused(false);
    setPhase('rest');
  }

  function restartCurrentExercise() {
    fire(MoveStorage.stopAudio());
    setPhase('announce');
    setCountdown(5);
    setRep(0);
    setSideChanged(false);
    setPaused(false);
  }

  function previousExercise() {
    if (!activeWorkout) {
      return;
    }
    let index = activeIndex - 1;
    while (index > 0 && activeWorkout.steps[index].breather) {
      index--;
    }
    if (index < 0 || activeWorkout.steps[index].breather) {
      return;
    }
    fire(MoveStorage.stopAudio());
    goToStep(index);
  }

  function nextExercise() {
    if (!activeWorkout) {
      return;
    }
    fire(MoveStorage.stopAudio());
    if (phase === 'rest' && !activeStep?.breather) {
      setRestRemaining(0);
      setPhase('announce');
      return;
    }
    const next = stepAfter(activeIndex);
    if (next < activeWorkout.steps.length) {
      goToStep(next);
    } else {
      finishWorkout(false);
    }
  }

  function advanceAfterExercise() {
    if (!activeWorkout) {
      return;
    }
    const next = stepAfter(activeIndex);
    if (next >= activeWorkout.steps.length) {
      finishWorkout(true);
      return;
    }
    const rest = activeWorkout.restSeconds ?? 0;
    const betweenExercises =
      !activeWorkout.steps[activeIndex].breather && !activeWorkout.steps[next].breather;
    goToStep(next);
    if (rest > 0 && betweenExercises) {
      startRest(rest);
    }
  }

  function markStepComplete(index: number) {
    setCompletedSteps(current => {
      const next = [...current];
      next[index] = true;
      return next;
    });
  }

  function finishWorkout(autoCompleted: boolean) {
    if (!activeWorkout) {
      return;
    }
    fire(MoveStorage.stopAudio());

    const completed = autoCompleted
      ? exerciseCount(activeWorkout)
      : completedSteps.filter((done, index) => done && !activeWorkout.steps[index]?.breather)
          .length;
    const entry: SessionEntry = {
      id: `${Date.now()}`,
      timestamp: Date.now(),
      workout: workoutLabel(activeWorkout),
      completed,
      total: exerciseCount(activeWorkout),
      durationSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
    };

    saveHistory([entry, ...history]).catch(error => {
      Alert.alert('Could not save workout', String(error));
    });
    setActiveWorkout(null);
    setScreen('history');
  }

  function updateSelectedWorkout(update: (workout: Workout) => Workout) {
    setWorkouts(current =>
      current.map(workout => (workout.id === selectedWorkout.id ? update(workout) : workout)),
    );
  }

  function updateStep(index: number, patch: Partial<WorkoutStep>) {
    updateSelectedWorkout(workout => ({
      ...workout,
      steps: workout.steps.map((step, stepIndex) =>
        stepIndex === index ? {...step, ...patch} : step,
      ),
    }));
  }

  function addWorkout() {
    const workout: Workout = {
      id: `custom-${Date.now()}`,
      name: 'New workout',
      custom: true,
      steps: [],
    };
    setWorkouts(list => [...list, workout]);
    setSelectedWorkoutId(workout.id);
    setEditing(true);
  }

  function deleteSelectedWorkout() {
    Alert.alert('Delete workout?', workoutLabel(selectedWorkout), [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setWorkouts(list => list.filter(item => item.id !== selectedWorkout.id));
          setSelectedWorkoutId(starterWorkouts[0].id);
          setEditing(false);
        },
      },
    ]);
  }

  function addExerciseToWorkout(exerciseId: number) {
    updateSelectedWorkout(workout => ({
      ...workout,
      steps: [...workout.steps, {exerciseId, repetitions: 10, secondsPerRep: 3, twoSides: false}],
    }));
    setPicking(false);
    setPickerFilter('');
  }

  async function saveNewExercise() {
    const name = newExerciseName.trim();
    if (!name) {
      return;
    }
    const next = [...customExercises, {id: nextCustomExerciseId(customExercises), name}];
    setCustomExercises(next);
    await MoveStorage.setString(customExercisesKey, JSON.stringify(next));
    setNewExerciseName('');
    setCreatingExercise(false);
    Alert.alert(
      'Exercise added',
      `"${name}" is in the catalog. Add it to a workout with Edit → Add Exercise.`,
    );
  }

  function deleteStep(index: number) {
    const step = selectedWorkout?.steps[index];
    if (!step) {
      return;
    }
    setUndoSteps(list => [...list, {workoutId: selectedWorkout.id, index, step}]);
    setOpenSwipe(null);
    removeStep(index);
  }

  function undoStep() {
    const last = undoSteps[undoSteps.length - 1];
    if (!last) {
      return;
    }
    setUndoSteps(list => list.slice(0, -1));
    setWorkouts(list =>
      list.map(workout => {
        if (workout.id !== last.workoutId) {
          return workout;
        }
        const steps = [...workout.steps];
        steps.splice(Math.min(last.index, steps.length), 0, last.step);
        return {...workout, steps};
      }),
    );
  }

  function deleteSession(entry: SessionEntry) {
    setUndoSessions(list => [...list, entry]);
    setOpenSwipe(null);
    saveHistory(history.filter(item => item.id !== entry.id)).catch(error =>
      Alert.alert('Could not delete', String(error)),
    );
  }

  function undoSession() {
    const last = undoSessions[undoSessions.length - 1];
    if (!last) {
      return;
    }
    setUndoSessions(list => list.slice(0, -1));
    saveHistory([...history, last]).catch(error => Alert.alert('Could not restore', String(error)));
  }

  /** Built-in workouts are remembered as hidden so they stay deleted after a restart. */
  function deleteWorkout(workout: Workout) {
    const index = workouts.findIndex(item => item.id === workout.id);
    const hidden = !workout.custom;
    setUndoWorkouts(list => [...list, {workout, index, hidden}]);
    if (hidden) {
      setDeletedWorkoutIds(ids => (ids.includes(workout.id) ? ids : [...ids, workout.id]));
    }
    setOpenSwipe(null);
    setWorkouts(list => list.filter(item => item.id !== workout.id));
  }

  function undoWorkout() {
    const last = undoWorkouts[undoWorkouts.length - 1];
    if (!last) {
      return;
    }
    setUndoWorkouts(list => list.slice(0, -1));
    setWorkouts(list => {
      const next = [...list];
      next.splice(Math.min(last.index, next.length), 0, last.workout);
      return next;
    });
    if (last.hidden) {
      setDeletedWorkoutIds(ids => ids.filter(id => id !== last.workout.id));
    }
  }

  function restoreDeletedWorkouts() {
    const back = starterWorkouts.filter(workout => deletedWorkoutIds.includes(workout.id));
    setWorkouts(list => [...list, ...back.filter(item => !list.some(w => w.id === item.id))]);
    setDeletedWorkoutIds([]);
    setUndoWorkouts([]);
  }

  function removeStep(index: number) {
    updateSelectedWorkout(workout => ({
      ...workout,
      steps: workout.steps.filter((_, stepIndex) => stepIndex !== index),
    }));
  }

  function playWorkout(workout: Workout) {
    setSelectedWorkoutId(workout.id);
    startWorkout(workout);
  }

  function openWorkout(workout: Workout) {
    setSelectedWorkoutId(workout.id);
    setEditing(true);
  }

  function reorderWorkout(from: number, to: number) {
    setWorkouts(list => {
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function reorderStep(from: number, to: number) {
    updateSelectedWorkout(workout => {
      const steps = [...workout.steps];
      const [moved] = steps.splice(from, 1);
      steps.splice(to, 0, moved);
      return {...workout, steps};
    });
  }

  function resetSelectedWorkout() {
    const defaults = starterWorkouts.find(workout => workout.id === selectedWorkout.id);
    if (defaults) {
      updateSelectedWorkout(() => defaults);
    }
  }

  function historyCsv(): string {
    return toBackExercisesCsv(history, name => csvWorkoutLabel(name, workouts));
  }

  async function exportCsv() {
    try {
      const path = await MoveStorage.exportCsv('back-exercises.csv', historyCsv());
      Alert.alert('Exported', path);
    } catch (error) {
      Alert.alert('Export failed', String(error));
    }
  }

  async function shareCsv() {
    try {
      await Share.share({title: 'back-exercises.csv', message: historyCsv()});
    } catch (error) {
      Alert.alert('Share failed', String(error));
    }
  }

  function shiftCalendar(delta: number) {
    setCalendarMonth(current => {
      const date = new Date(current.year, current.month + delta, 1);
      return {year: date.getFullYear(), month: date.getMonth()};
    });
  }

  const undoAction =
    screen === 'workouts' && editing && !picking && undoSteps.length > 0
      ? {count: undoSteps.length, onPress: undoStep}
      : screen === 'workouts' && !editing && !creatingExercise && undoWorkouts.length > 0
      ? {count: undoWorkouts.length, onPress: undoWorkout}
      : screen === 'history' && undoSessions.length > 0
      ? {count: undoSessions.length, onPress: undoSession}
      : undefined;

  if (activeWorkout && activeStep) {
    return (
      <Shell title={workoutLabel(activeWorkout)} screen={screen} setScreen={setScreen}>
        <View style={styles.runner}>
          <Text style={styles.meta}>
            {activeWorkout.steps.slice(0, activeIndex + 1).filter(item => !item.breather).length} /{' '}
            {exerciseCount(activeWorkout)} ·{' '}
            {activeStep.breather ? 'breather' : phaseLabel(phase, countdown)} ·{' '}
            {formatDuration(elapsed)}
          </Text>
          {phase === 'rest' ? (
            <View style={styles.restPanel}>
              <Text style={styles.restTitle}>{activeStep.breather ? 'Breather' : 'Rest'}</Text>
              <Text style={styles.restCount}>{restRemaining}s</Text>
              <SegmentBar total={1} done={0} fill={restTotal > 0 ? restRemaining / restTotal : 0} />
              {(() => {
                const upcoming = activeStep.breather
                  ? exerciseMap.get(activeWorkout.steps[stepAfter(activeIndex)]?.exerciseId ?? -1)
                  : activeExercise;
                return upcoming ? <Text style={styles.meta}>Up next: {upcoming.name}</Text> : null;
              })()}
            </View>
          ) : activeExercise ? (
            <ExercisePreview exercise={activeExercise} fill />
          ) : (
            <Text style={styles.bodyText}>Missing exercise.</Text>
          )}
          {phase !== 'rest' && (
            <>
              {activeStep.twoSides && (
                <View style={styles.sideRow}>
                  <Text style={[styles.sideBadge, !sideChanged && styles.sideBadgeActive]}>
                    Left
                  </Text>
                  <Text style={[styles.sideBadge, sideChanged && styles.sideBadgeActive]}>
                    Right
                  </Text>
                </View>
              )}
              <RepProgress
                key={`${activeIndex}-${sideChanged}`}
                step={activeStep}
                rep={rep}
                running={phase === 'work' && !paused}
              />
              <Text style={styles.prescription}>
                {activeStep.twoSides
                  ? `${activeStep.repetitions / 2} per side`
                  : `${activeStep.repetitions} reps`}{' '}
                · {activeStep.secondsPerRep}s each
              </Text>
            </>
          )}
          <View style={styles.iconRow}>
            <IconButton
              label="Previous"
              caption="Back"
              icon="previous"
              disabled={activeWorkout.steps.slice(0, activeIndex).every(item => item.breather)}
              onPress={previousExercise}
            />
            <IconButton
              label="Repeat"
              caption="Repeat"
              icon="replay"
              onPress={restartCurrentExercise}
            />
            {(() => {
              const nextIsBreather = activeWorkout.steps[activeIndex + 1]?.breather === true;
              if (activeStep.breather || (nextIsBreather && skipBreatherAt !== activeIndex + 1)) {
                return (
                  <IconButton
                    label="Skip breather"
                    caption="Skip"
                    icon="skip"
                    onPress={skipBreather}
                  />
                );
              }
              // After Skip the button is back to Breathe; on a skipped breather it re-enables it.
              return (
                <IconButton label="Breathe" caption="Breathe" icon="breathe" onPress={breathe} />
              );
            })()}
            <IconButton
              label={paused ? 'Resume' : 'Pause'}
              caption={paused ? 'Resume' : 'Pause'}
              icon={paused ? 'play' : 'pause'}
              onPress={() => {
                fire(MoveStorage.stopAudio());
                if (paused && phase === 'countdown') {
                  setCountdown(5); // the drum roll was cut off: restart it on resume
                }
                setPaused(!paused);
              }}
            />
            <IconButton label="Next" caption="Next" icon="next" onPress={nextExercise} />
            <IconButton
              label="Finish workout"
              caption="Finish"
              icon="stop"
              onPress={() => finishWorkout(false)}
            />
          </View>
        </View>
      </Shell>
    );
  }

  return (
    <Shell title="Move" screen={screen} setScreen={navigate} undo={undoAction}>
      {screen === 'workouts' && !editing && creatingExercise && (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SmallButton label="‹ Workouts" onPress={() => setCreatingExercise(false)} />
          <View style={styles.card}>
            <Text style={styles.cardTitle}>New exercise</Text>
            <TextInput
              style={styles.input}
              placeholderTextColor="#8b97a3"
              placeholder="Exercise name"
              value={newExerciseName}
              onChangeText={setNewExerciseName}
              autoFocus
              onSubmitEditing={saveNewExercise}
            />
            <Text style={styles.meta}>
              It gets a placeholder picture; reps and timing are set per workout.
            </Text>
            <Action label="Save exercise" onPress={saveNewExercise} />
          </View>
        </ScrollView>
      )}

      {screen === 'workouts' && !editing && !creatingExercise && (
        <ScrollView {...workoutDrag.scrollViewProps} contentContainerStyle={styles.content}>
          <View style={styles.addRow}>
            <PastelButton
              label="Add Workout"
              icon="symbolAddBold"
              color={pastels.mint}
              onPress={addWorkout}
            />
            <PastelButton
              label="Add Exercise"
              icon="symbolAddBold"
              color={pastels.sky}
              onPress={() => setCreatingExercise(true)}
            />
          </View>
          <View style={styles.stepList} {...workoutDrag.containerProps}>
            {workouts.map((workout, index) => {
              const rowProps = workoutDrag.getRowProps(index);
              const label = workoutLabel(workout);
              const done = history.filter(
                entry => csvWorkoutLabel(entry.workout, workouts) === label,
              );
              const last = done.reduce((latest, entry) => Math.max(latest, entry.timestamp), 0);
              return (
                <Animated.View
                  key={workout.id}
                  style={rowProps.style}
                  onLayout={rowProps.onLayout}
                  {...workoutDrag.getHandleProps(index, () =>
                    openSwipe === workout.id ? setOpenSwipe(null) : playWorkout(workout),
                  )}>
                  <SwipeRow
                    open={openSwipe === workout.id}
                    onOpenChange={isOpen => setOpenSwipe(isOpen ? workout.id : null)}
                    onDelete={() => deleteWorkout(workout)}
                    onEdit={() => openWorkout(workout)}
                    radius={10}>
                    <Textured style={styles.workoutCard} background={backgroundFor(workout.id)}>
                      <View
                        style={styles.workoutInfo}
                        accessible
                        accessibilityRole="button"
                        accessibilityLabel={`Start ${label}`}
                        accessibilityActions={[{name: 'activate', label: `Start ${label}`}]}
                        onAccessibilityAction={() => playWorkout(workout)}>
                        <Text
                          style={styles.cardTitle}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.75}>
                          {label}
                        </Text>
                        <Text style={styles.stepMeta} numberOfLines={1}>
                          {exerciseCount(workout)} exercises · ~
                          {Math.round(estimateSeconds(workout) / 60)} min ·{' '}
                          {done.length === 0
                            ? 'not done yet'
                            : `${done.length}× · last ${formatDisplayDate(last).slice(0, 5)}`}
                        </Text>
                      </View>
                      <Pressable
                        style={styles.editButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${label}`}
                        onPress={() => openWorkout(workout)}>
                        <Icon name="symbolEdit" size={30} color="#1f2d38" />
                      </Pressable>
                    </Textured>
                    <View
                      style={[styles.sideHandle, styles.workoutListHandle]}
                      accessibilityLabel="Press and hold the tile to reorder"
                      pointerEvents="none">
                      <Icon name="symbolDragIndicator" size={14} color="#8b97a3" />
                    </View>
                  </SwipeRow>
                </Animated.View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {screen === 'workouts' && editing && picking && (
        <CatalogGrid
          exercises={allExercises.filter(item =>
            item.name.toLowerCase().includes(pickerFilter.trim().toLowerCase()),
          )}
          onPress={item => addExerciseToWorkout(item.id)}
          header={
            <View style={styles.pickerHeader}>
              <SmallButton label="‹ Back to workout" onPress={() => setPicking(false)} />
              <TextInput
                style={styles.input}
                placeholderTextColor="#8b97a3"
                placeholder="Search exercises"
                value={pickerFilter}
                onChangeText={setPickerFilter}
              />
            </View>
          }
        />
      )}

      {screen === 'workouts' && editing && !picking && selectedWorkout && (
        <ScrollView
          {...reorder.scrollViewProps}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <SmallButton label="‹ Workouts" onPress={() => setEditing(false)} />
          <View style={styles.card}>
            {selectedWorkout.custom ? (
              <TextInput
                style={[styles.input, styles.cardTitle]}
                value={selectedWorkout.name}
                placeholder="Workout name"
                onChangeText={name => updateSelectedWorkout(workout => ({...workout, name}))}
              />
            ) : (
              <Text style={styles.cardTitle}>{workoutLabel(selectedWorkout)}</Text>
            )}
            <Text style={styles.meta}>
              {exerciseCount(selectedWorkout)} exercises · about{' '}
              {Math.round(estimateSeconds(selectedWorkout) / 60)} min
            </Text>
            <View style={styles.restSetting}>
              <Text style={styles.bodyText}>
                Rest between exercises: {selectedWorkout.restSeconds ?? 0}s
              </Text>
              <View style={styles.smallControlRow}>
                <SmallButton
                  label="- rest"
                  onPress={() =>
                    updateSelectedWorkout(workout => ({
                      ...workout,
                      restSeconds: Math.max(0, (workout.restSeconds ?? 0) - 5),
                    }))
                  }
                />
                <SmallButton
                  label="+ rest"
                  onPress={() =>
                    updateSelectedWorkout(workout => ({
                      ...workout,
                      restSeconds: Math.min(180, (workout.restSeconds ?? 0) + 5),
                    }))
                  }
                />
              </View>
            </View>
            {selectedWorkout.custom ? (
              <SmallButton label="Delete workout" onPress={deleteSelectedWorkout} />
            ) : (
              <SmallButton label="Reset to default settings" onPress={resetSelectedWorkout} />
            )}
          </View>

          <View style={styles.stepList} {...reorder.containerProps}>
            {selectedWorkout.steps.map((step, index) => {
              const rowProps = reorder.getRowProps(index);
              if (step.breather) {
                return (
                  <Animated.View
                    style={[styles.breatherCard, rowProps.style]}
                    onLayout={rowProps.onLayout}
                    key={`breather-${index}`}>
                    <View
                      style={styles.breatherHandle}
                      accessibilityLabel="Drag to reorder (press and hold)"
                      {...reorder.getHandleProps(index)}>
                      <Icon name="symbolDragIndicator" size={18} color="#9aa4ad" />
                    </View>
                    <Text style={styles.breatherLabel} numberOfLines={1}>
                      ≈ Breather {step.secondsPerRep}s
                    </Text>
                    <GridButton
                      label="- sec"
                      onPress={() =>
                        updateStep(index, {secondsPerRep: Math.max(1, step.secondsPerRep - 1)})
                      }
                    />
                    <GridButton
                      label="+ sec"
                      onPress={() => updateStep(index, {secondsPerRep: step.secondsPerRep + 1})}
                    />
                    <GridButton label="Remove" onPress={() => deleteStep(index)} />
                  </Animated.View>
                );
              }
              const exercise = exerciseMap.get(step.exerciseId);
              const number = selectedWorkout.steps
                .slice(0, index + 1)
                .filter(item => !item.breather).length;
              return (
                <Animated.View
                  style={rowProps.style}
                  onLayout={rowProps.onLayout}
                  key={`${step.exerciseId}-${index}`}>
                  <SwipeRow
                    open={openSwipe === `${selectedWorkout.id}:${index}`}
                    onOpenChange={isOpen =>
                      setOpenSwipe(isOpen ? `${selectedWorkout.id}:${index}` : null)
                    }
                    onDelete={() => deleteStep(index)}>
                    <View style={styles.stepCard}>
                      <View
                        style={styles.sideHandle}
                        accessibilityLabel="Drag to reorder (press and hold)"
                        {...reorder.getHandleProps(index)}>
                        <Icon name="symbolDragIndicator" size={14} color="#8b97a3" />
                      </View>
                      {exercise && (
                        <Image
                          source={exercise.asset}
                          style={[styles.stepThumb, stepImageSize]}
                          resizeMode="contain"
                        />
                      )}
                      <View style={styles.stepMain}>
                        <View style={styles.stepTitleRow}>
                          <Text style={styles.stepName} numberOfLines={2}>
                            {number}. {exercise ? exercise.name : 'Removed exercise'}
                          </Text>
                        </View>
                        <Text style={styles.stepMeta}>
                          {step.twoSides
                            ? `${step.repetitions / 2} per side`
                            : `${step.repetitions} reps`}{' '}
                          · {step.secondsPerRep}s each
                        </Text>
                        <View style={styles.editGrid}>
                          <View style={styles.editColumns}>
                            <View style={styles.editRow}>
                              <GridButton
                                label="+ rep"
                                onPress={() =>
                                  updateStep(index, {
                                    repetitions: step.repetitions + (step.twoSides ? 2 : 1),
                                  })
                                }
                              />
                              <GridButton
                                label="+ sec"
                                onPress={() =>
                                  updateStep(index, {
                                    secondsPerRep: step.secondsPerRep + 1,
                                  })
                                }
                              />
                            </View>
                            <View style={styles.editRow}>
                              <GridButton
                                label="- rep"
                                onPress={() => {
                                  const unit = step.twoSides ? 2 : 1;
                                  updateStep(index, {
                                    repetitions: Math.max(unit, step.repetitions - unit),
                                  });
                                }}
                              />
                              <GridButton
                                label="- sec"
                                onPress={() =>
                                  updateStep(index, {
                                    secondsPerRep: Math.max(1, step.secondsPerRep - 1),
                                  })
                                }
                              />
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                  </SwipeRow>
                </Animated.View>
              );
            })}
          </View>
          <Pressable
            style={styles.addButton}
            accessibilityRole="button"
            accessibilityLabel="Add exercise to workout"
            onPress={() => setPicking(true)}>
            <Icon name="symbolAdd" size={22} color="#126b46" />
            <Text style={styles.addButtonText}>Add Exercise</Text>
          </Pressable>
        </ScrollView>
      )}

      {screen === 'catalog' && detailExercise && (
        <ScrollView contentContainerStyle={styles.content}>
          <SmallButton label="‹ All exercises" onPress={() => setDetailExerciseId(null)} />
          <ExercisePreview exercise={detailExercise} large />
          {descriptions[detailExercise.id] ? (
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionTitle}>How to</Text>
              <Text style={styles.descriptionText}>{descriptions[detailExercise.id]}</Text>
            </View>
          ) : null}
          <Text style={styles.meta}>
            Used in:{' '}
            {workouts
              .filter(workout => workout.steps.some(item => item.exerciseId === detailExercise.id))
              .map(workoutLabel)
              .join(', ') || 'no workout yet'}
          </Text>
        </ScrollView>
      )}

      {screen === 'catalog' && !detailExercise && (
        <CatalogGrid
          exercises={allExercises}
          onPress={exercise => setDetailExerciseId(exercise.id)}
        />
      )}

      {screen === 'history' && (
        <ScrollView contentContainerStyle={styles.content}>
          <Calendar
            year={calendarMonth.year}
            month={calendarMonth.month}
            dayColors={dayColors}
            onShift={shiftCalendar}
          />
          {history.length > 0 && (
            <Text style={styles.meta}>Swipe a session left twice to delete it.</Text>
          )}
          {history.length === 0 ? (
            <Text style={styles.empty}>No completed sessions yet.</Text>
          ) : (
            groupByLocalDate(history).map(group => (
              <View style={styles.dayGroup} key={group.key}>
                <Text style={styles.dayLabel}>{group.label}</Text>
                {group.entries.map(entry => {
                  return (
                    <SwipeRow
                      key={entry.id}
                      open={openSwipe === entry.id}
                      onOpenChange={isOpen => setOpenSwipe(isOpen ? entry.id : null)}
                      onDelete={() => deleteSession(entry)}
                      radius={10}>
                      <Textured
                        style={styles.sessionCard}
                        background={sessionBackgrounds.get(entry.id)}>
                        <View style={styles.sessionMain}>
                          <Text style={styles.sessionTitle} numberOfLines={1}>
                            {csvWorkoutLabel(entry.workout, workouts)}
                          </Text>
                          <Text style={styles.stepMeta}>
                            {formatTime(entry.timestamp)} · {entry.completed} / {entry.total}{' '}
                            exercises
                          </Text>
                        </View>
                        <Text style={styles.sessionDuration}>
                          {formatDuration(entry.durationSeconds)}
                        </Text>
                      </Textured>
                    </SwipeRow>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {screen === 'settings' && (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.cardTitle}>Settings</Text>
          {deletedWorkoutIds.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Deleted workouts</Text>
              <Text style={styles.meta}>
                {deletedWorkoutIds.length} built-in workout
                {deletedWorkoutIds.length === 1 ? ' is' : 's are'} hidden.
              </Text>
              <PastelButton
                label="Restore"
                icon="symbolUndo"
                color={pastels.peach}
                onPress={restoreDeletedWorkouts}
              />
            </View>
          ) : null}
          <VoiceSettings />
        </ScrollView>
      )}

      {screen === 'stats' && (
        <StatsScreen
          backgrounds={cardBackgrounds}
          history={history}
          workouts={workouts}
          onExport={exportCsv}
          onShare={shareCsv}
        />
      )}
    </Shell>
  );
}

function phaseLabel(phase: Phase, countdown: number): string {
  if (phase === 'announce') {
    return 'announce';
  }
  if (phase === 'countdown') {
    return countdown > 0 ? `countdown ${countdown}` : 'go';
  }
  if (phase === 'change-side') {
    return 'change side';
  }
  if (phase === 'finishing') {
    return 'finishing';
  }
  if (phase === 'rest') {
    return 'rest';
  }
  return 'work';
}

function fire(promise: Promise<unknown>) {
  promise.catch(() => undefined);
}

function Shell({
  title,
  screen,
  setScreen,
  undo,
  children,
}: {
  title: string;
  screen: Screen;
  setScreen: (screen: Screen) => void;
  undo?: {count: number; onPress: () => void};
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {undo ? (
            <Pressable
              style={styles.undoButton}
              accessibilityRole="button"
              accessibilityLabel="Undo delete"
              onPress={undo.onPress}>
              <Icon name="symbolUndo" size={20} color="#1f2d38" />
              <Text style={styles.undoText}>Undo{undo.count > 1 ? ` (${undo.count})` : ''}</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.settingsButton}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => setScreen('settings')}>
            <Icon name="settings" size={28} color={screen === 'settings' ? '#126b46' : '#52606d'} />
          </Pressable>
        </View>
        <View style={styles.tabs}>
          <Tab
            label="Workouts"
            active={screen === 'workouts'}
            onPress={() => setScreen('workouts')}
          />
          <Tab
            label="Exercises"
            active={screen === 'catalog'}
            onPress={() => setScreen('catalog')}
          />
          <Tab label="History" active={screen === 'history'} onPress={() => setScreen('history')} />
          <Tab label="Stats" active={screen === 'stats'} onPress={() => setScreen('stats')} />
        </View>
      </View>
      {children}
    </SafeAreaView>
  );
}

/** A light pastel per workout: golden-angle hue steps keep neighbouring cards clearly different. */
function pastel(index: number, lightness = 91, saturation = 70): string {
  const hue = Math.round((200 + index * 137.5) % 360);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/** Card on the workout's grainy aurora texture (plain grey when the workout no longer exists). */
function Textured({
  background,
  style,
  children,
}: {
  /** Index into the card backgrounds; undefined shows a plain grey card. */
  background: number | undefined;
  style: object;
  children: React.ReactNode;
}) {
  const source = cardBackground(background);
  return source ? (
    <ImageBackground
      source={source}
      style={[style, styles.textured]}
      imageStyle={styles.texturedImage}
      resizeMethod="scale"
      resizeMode="cover">
      {children}
    </ImageBackground>
  ) : (
    <View style={[style, styles.textured, styles.untextured]}>{children}</View>
  );
}

/** Workout colour for history/stats; grey when the workout no longer exists. */
function workoutTint(index: number, lightness = 91, saturation = 70): string {
  return index >= 0 ? pastel(index, lightness, saturation) : lightness > 80 ? '#eef1f4' : '#9aa4ad';
}

/** Index of the workout a history label belongs to (-1 if it no longer exists). */
function workoutIndexFor(label: string, list: Workout[]): number {
  const csv = csvWorkoutLabel(label, list);
  return list.findIndex(workout => workoutLabel(workout) === csv);
}

/** Rough length including the spoken name, countdowns and side changes. */
function estimateSeconds(workout: Workout): number {
  const rests = Math.max(0, exerciseCount(workout) - 1) * ((workout.restSeconds ?? 0) + 1);
  return workout.steps.reduce(
    (total, item) =>
      item.breather
        ? total + item.secondsPerRep + 1
        : total + 2 + 5.6 + item.repetitions * item.secondsPerRep + 0.7 + (item.twoSides ? 7.5 : 0),
    rests,
  );
}

/** One segment per repetition; the current one fills over the repetition's duration. */
function RepProgress({step, rep, running}: {step: WorkoutStep; rep: number; running: boolean}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    if (!running) {
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: step.secondsPerRep * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [rep, running, step.secondsPerRep, progress]);

  const half = step.twoSides ? Math.ceil(step.repetitions / 2) : -1;
  return (
    <View
      style={styles.segmentBar}
      accessibilityRole="progressbar"
      accessibilityLabel={`Repetition ${Math.min(rep + 1, step.repetitions)} of ${
        step.repetitions
      }`}>
      {Array.from({length: step.repetitions}, (_, index) => (
        <View key={index} style={[styles.repSegment, index === half && styles.repSegmentSideGap]}>
          {index < rep && <View style={[styles.repSegmentFill, styles.fullWidth]} />}
          {index === rep && running && (
            <Animated.View
              style={[
                styles.repSegmentFill,
                {
                  width: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );
}

/** Generic bar: `done` full segments of `total`, plus `fill` (0–1) of the next one. */
function SegmentBar({total, done, fill}: {total: number; done: number; fill: number}) {
  return (
    <View style={styles.segmentBar}>
      {Array.from({length: total}, (_, index) => {
        const percent = index < done ? 100 : index === done ? Math.round(fill * 100) : 0;
        return (
          <View key={index} style={styles.repSegment}>
            <View style={[styles.repSegmentFill, styles.restFill, {width: `${percent}%`}]} />
          </View>
        );
      })}
    </View>
  );
}

function StatsScreen({
  history,
  workouts,
  backgrounds,
  onExport,
  onShare,
}: {
  history: SessionEntry[];
  workouts: Workout[];
  backgrounds: Record<string, number> | null;
  onExport: () => void;
  onShare: () => void;
}) {
  // Merge rows for the same workout recorded under old and new labels (e.g. with/without emoji).
  const stats = historyStats(
    history.map(entry => ({
      ...entry,
      workout: csvWorkoutLabel(entry.workout, workouts),
    })),
  );
  const maxCount = Math.max(1, ...stats.byWorkout.map(item => item.count));
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.addRow}>
        <PastelButton
          label="Export"
          accessibilityLabel="Export CSV"
          icon="symbolDownload"
          color={pastels.peach}
          onPress={onExport}
        />
        <PastelButton
          label="Share"
          accessibilityLabel="Share CSV"
          icon="symbolShare"
          color={pastels.lilac}
          onPress={onShare}
        />
      </View>
      <View style={styles.statGrid}>
        <GlowTile label="This week" value={stats.thisWeek} texture={tileBackgrounds.mint} />
        <GlowTile label="This month" value={stats.thisMonth} texture={tileBackgrounds.sky} />
        <GlowTile label="Sessions" value={stats.total} texture={tileBackgrounds.peach} />
        <GlowTile label="Minutes" value={stats.totalMinutes} texture={tileBackgrounds.lilac} />
      </View>
      {stats.byWorkout.length === 0 ? (
        <Text style={styles.meta}>No completed sessions yet.</Text>
      ) : (
        stats.byWorkout.map(item => {
          const index = workoutIndexFor(item.workout, workouts);
          return (
            <Textured
              key={item.workout}
              style={styles.byWorkoutRow}
              background={index >= 0 ? backgrounds?.[workouts[index].id] : undefined}>
              <View style={styles.byWorkoutHeader}>
                <Text style={styles.sessionTitle} numberOfLines={1}>
                  {item.workout}
                </Text>
                <Text style={styles.byWorkoutCount}>{item.count}×</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.round((item.count / maxCount) * 100)}%`,
                      backgroundColor: workoutTint(index, 55, 45),
                    },
                  ]}
                />
              </View>
              <Text style={styles.stepMeta}>
                last {formatDisplayDate(item.lastTimestamp)} · {Math.round(item.totalSeconds / 60)}{' '}
                min in total
              </Text>
            </Textured>
          );
        })
      )}
    </ScrollView>
  );
}

const VOICE_SAMPLE = 'Diagonal crunches, left. Go.';

function VoiceSettings() {
  const [settings, setSettings] = useState<SpeechSettings | null>(null);

  const reload = () =>
    MoveStorage.getSpeechSettings()
      .then(setSettings)
      .catch(() => setSettings(null));

  useEffect(() => {
    reload();
  }, []);

  if (!settings) {
    return null;
  }

  const pickEngine = async (name: string) => {
    await MoveStorage.setSpeechEngine(name);
    await reload();
    fire(MoveStorage.speak(VOICE_SAMPLE));
  };
  const pickVoice = async (name: string) => {
    await MoveStorage.setSpeechVoice(name);
    await reload();
    fire(MoveStorage.speak(VOICE_SAMPLE));
  };
  const changeRate = async (delta: number) => {
    await MoveStorage.setSpeechRate(Math.round((settings.rate + delta) * 100) / 100);
    await reload();
    fire(MoveStorage.speak(VOICE_SAMPLE));
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Voice</Text>
      <Text style={styles.meta}>Offline voices on this phone. Picking one plays a sample.</Text>
      <Dropdown
        label="Speech engine"
        value={settings.engine}
        options={settings.engines.map(engine => ({value: engine.name, label: engine.label}))}
        onChange={pickEngine}
      />
      <Dropdown
        label="Voice"
        value={settings.voice}
        options={settings.voices.map(voice => ({value: voice.name, label: voiceLabel(voice)}))}
        onChange={pickVoice}
      />
      <View style={styles.smallControlRow}>
        <SmallButton label="slower" onPress={() => changeRate(-0.05)} />
        <Text style={styles.bodyText}>speed {settings.rate.toFixed(2)}</Text>
        <SmallButton label="faster" onPress={() => changeRate(0.05)} />
        <SmallButton label="test" onPress={() => fire(MoveStorage.speak(VOICE_SAMPLE))} />
      </View>
    </View>
  );
}

const localeNames: Record<string, string> = {
  'en-GB': 'English (UK)',
  'en-US': 'English (US)',
  'en-AU': 'English (Australia)',
  'en-IN': 'English (India)',
  'en-NG': 'English (Nigeria)',
  'en-CA': 'English (Canada)',
  'en-IE': 'English (Ireland)',
};

/** "English (UK) · voice gba" instead of "en-gb-x-gba-local". */
function voiceLabel(voice: {name: string; locale: string}): string {
  const short = voice.name
    .replace(/^[a-z]{2}-[a-z]{2}-x-/i, '')
    .replace(/-(local|network)$/, '')
    .replace(/^[a-z]{2}-[A-Z]{2}-language$/i, 'default');
  return `${localeNames[voice.locale] ?? voice.locale} · voice ${short}`;
}

function Tab({label, active, onPress}: {label: string; active: boolean; onPress: () => void}) {
  return (
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

/** `fill`: grow/shrink with the runner's free space; `large`: fixed tall image (scroll views). */
function ExercisePreview({
  exercise,
  large = false,
  fill = false,
}: {
  exercise: Exercise;
  large?: boolean;
  fill?: boolean;
}) {
  // Explicit pixel size: the GIFs are 16:9 (640x360); screen padding is 18 on each side.
  const {width} = useWindowDimensions();
  const largeSize = {width: width - 36, height: Math.round(((width - 36) * 9) / 16)};
  return (
    <View style={fill ? styles.previewFill : styles.preview}>
      <Image
        source={exercise.asset}
        style={fill ? styles.previewImageFill : large ? largeSize : styles.previewImage}
        resizeMode="contain"
      />
      <Text style={styles.cardTitle}>{exercise.name}</Text>
    </View>
  );
}

function IconButton({
  label,
  caption,
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  caption: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      style={[styles.iconButton, disabled && styles.actionDisabled]}
      onPress={onPress}>
      <Icon name={icon} size={30} color={disabled ? '#9aa4ad' : '#226fb8'} />
      <Text
        style={[styles.iconCaption, disabled && styles.actionTextDisabled]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}>
        {caption}
      </Text>
    </Pressable>
  );
}

function Action({label, onPress}: {label: string; onPress: () => void}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.action}
      onPress={onPress}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function GridButton({label, onPress}: {label: string; onPress: () => void}) {
  return (
    <Pressable
      style={styles.gridButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Text style={styles.gridButtonText}>{label}</Text>
    </Pressable>
  );
}

const pastels = {
  mint: '#d3efe0',
  sky: '#d8e6f8',
  peach: '#fde3d3',
  lilac: '#e9def8',
};

/** Flat pastel action button with dark text, matching the soft card palette. */
function PastelButton({
  label,
  accessibilityLabel,
  icon,
  color,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  icon: IconName;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.pastelButton, {backgroundColor: color}]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}>
      <Icon name={icon} size={icon === 'symbolAddBold' ? 26 : 20} color="#1f2d38" />
      <Text style={styles.pastelButtonText}>{label}</Text>
    </Pressable>
  );
}

function SmallButton({label, onPress}: {label: string; onPress: () => void}) {
  return (
    <Pressable
      style={styles.smallButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Text style={styles.smallButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d9dee3',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingsButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  pastelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    borderRadius: 12,
  },
  pastelButtonText: {
    fontFamily: 'sans-serif-condensed',
    color: '#1f2d38',
    fontSize: 17,
    fontWeight: '700',
  },
  addRow: {
    flexDirection: 'row',
    gap: 10,
  },
  textured: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(31,45,56,0.12)',
  },
  texturedImage: {
    borderRadius: 12,
  },
  untextured: {
    backgroundColor: '#eef1f4',
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#168f5c',
    backgroundColor: '#f2faf6',
  },
  addButtonText: {
    color: '#126b46',
    fontSize: 15,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#c8d8e8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 17,
    color: '#1f2d38',
    backgroundColor: '#ffffff',
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    paddingVertical: 4,
    paddingLeft: 12,
    paddingRight: 6,
  },
  workoutInfo: {
    flex: 1,
    gap: 2,
  },
  title: {
    flexShrink: 1,
    fontFamily: 'sans-serif-condensed',
    color: '#1f2d38',
    fontSize: 30,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d9dee3',
    paddingVertical: 10,
  },
  tabActive: {
    borderColor: '#168f5c',
    backgroundColor: '#eaf7f1',
  },
  tabText: {
    color: '#52606d',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#126b46',
  },
  content: {
    padding: 18,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: '#d9dee3',
    borderRadius: 8,
    padding: 14,
    gap: 10,
    backgroundColor: '#fbfcfd',
  },
  breatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#8fb3d9',
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    backgroundColor: '#f4f8fc',
  },
  breatherLabel: {
    flex: 1.4,
    color: '#1f2d38',
    fontFamily: 'sans-serif-condensed',
    fontSize: 14,
    fontWeight: '600',
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#fde3d3',
  },
  undoText: {
    fontFamily: 'sans-serif-condensed',
    color: '#1f2d38',
    fontSize: 15,
    fontWeight: '700',
  },
  stepCard: {
    backgroundColor: '#ffffff', // opaque: the bin under a swiped tile must not show through
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d9dee3',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 6,
    gap: 8,
  },
  stepMain: {
    flex: 1,
    gap: 2,
  },
  stepName: {
    flex: 1,
    lineHeight: 17,
    fontFamily: 'sans-serif-condensed',
    color: '#1f2d38',
    fontSize: 14,
    fontWeight: '600',
  },
  stepMeta: {
    color: '#697782',
    fontSize: 12,
  },
  cardTitle: {
    fontFamily: 'sans-serif-condensed',
    color: '#1f2d38',
    fontSize: 20,
    fontWeight: '700',
  },
  bodyText: {
    color: '#1f2d38',
    fontSize: 17,
  },
  meta: {
    color: '#697782',
    fontSize: 15,
  },
  prescription: {
    color: '#1f2d38',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  empty: {
    color: '#697782',
    fontSize: 18,
    paddingTop: 18,
  },
  stepThumb: {
    borderRadius: 8, // size comes from stepImageSize
  },
  descriptionCard: {
    gap: 6,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(31,45,56,0.12)',
    backgroundColor: '#fbfcfd',
  },
  descriptionTitle: {
    fontFamily: 'sans-serif-condensed',
    color: '#1f2d38',
    fontSize: 17,
    fontWeight: '700',
  },
  descriptionText: {
    color: '#2f3d48',
    fontSize: 15,
    lineHeight: 22,
  },
  restSetting: {
    gap: 6,
  },
  segmentBar: {
    flexDirection: 'row',
    gap: 4,
    height: 18,
  },
  repSegment: {
    flex: 1,
    borderRadius: 4,
    backgroundColor: '#e3e8ec',
    overflow: 'hidden',
  },
  repSegmentSideGap: {
    marginLeft: 10,
  },
  repSegmentFill: {
    height: '100%',
    backgroundColor: '#168f5c',
  },
  fullWidth: {
    width: '100%',
  },
  restFill: {
    backgroundColor: '#226fb8',
  },
  restPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    alignSelf: 'stretch',
  },
  restTitle: {
    color: '#1f2d38',
    fontSize: 26,
    fontWeight: '700',
  },
  restCount: {
    color: '#226fb8',
    fontSize: 64,
    fontWeight: '700',
  },
  exerciseName: {
    fontFamily: 'sans-serif-condensed',
    color: '#1f2d38',
    fontSize: 17,
    fontWeight: '600',
  },
  preview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  previewImage: {
    width: '100%',
    height: 220,
  },
  previewFill: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    gap: 12,
  },
  previewImageFill: {
    width: '100%',
    flex: 1,
    minHeight: 0,
  },
  sideRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  sideBadge: {
    minWidth: 96,
    textAlign: 'center',
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
    fontSize: 17,
    fontWeight: '700',
    color: '#9aa4ad',
    backgroundColor: '#edf0f2',
  },
  sideBadgeActive: {
    color: '#ffffff',
    backgroundColor: '#226fb8',
  },
  runner: {
    flex: 1,
    padding: 18,
    gap: 12,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  iconButton: {
    flex: 1,
    height: 64,
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#eef5fb',
    borderWidth: 1,
    borderColor: '#c8d8e8',
  },
  iconCaption: {
    color: '#226fb8',
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 2,
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#168f5c',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  actionDisabled: {
    backgroundColor: '#edf0f2',
    borderColor: '#edf0f2',
  },
  actionText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionTextDisabled: {
    color: '#9aa4ad',
  },
  pickerHeader: {
    gap: 12,
  },
  stepList: {
    gap: STEP_GAP,
  },
  editGrid: {
    flexDirection: 'row',
    gap: 3,
  },
  editColumns: {
    flex: 1,
    gap: 3,
  },
  sideHandle: {
    position: 'absolute',
    left: -7, // straddles the card's left border (the screen padding is 18)
    top: '3%', // height follows the card's height, centred by equal insets
    bottom: '3%',
    zIndex: 2,
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#d9dee3',
    backgroundColor: '#ffffff',
  },
  editButton: {
    width: 52, // twice the old 26 dp buttons
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(31,45,56,0.15)',
  },
  workoutListHandle: {
    top: '7.7%', // 10% shorter than the editor's handle (94% of the card -> ~85%)
    bottom: '7.7%',
  },
  breatherHandle: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editRow: {
    flexDirection: 'row',
    gap: 3,
  },
  gridButton: {
    flex: 1,
    minHeight: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c8d8e8',
    backgroundColor: '#f7fbff',
  },
  smallControlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  smallButton: {
    minHeight: 34,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c8d8e8',
    paddingHorizontal: 9,
    justifyContent: 'center',
    backgroundColor: '#f7fbff',
  },
  gridButtonText: {
    color: '#226fb8',
    fontSize: 12,
    fontWeight: '700',
  },
  smallButtonText: {
    color: '#226fb8',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  dayGroup: {
    gap: 6,
  },
  dayLabel: {
    fontFamily: 'sans-serif-condensed',
    color: '#52606d',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  sessionMain: {
    flex: 1,
    gap: 2,
  },
  sessionTitle: {
    flexShrink: 1,
    fontFamily: 'sans-serif-condensed',
    color: '#1f2d38',
    fontSize: 16,
    fontWeight: '700',
  },
  sessionDuration: {
    fontFamily: 'sans-serif-condensed',
    color: '#1f2d38',
    fontSize: 17,
    fontWeight: '700',
  },
  byWorkoutRow: {
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 12,
    gap: 3,
  },
  byWorkoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  byWorkoutCount: {
    marginLeft: 'auto',
    fontFamily: 'sans-serif-condensed',
    color: '#1f2d38',
    fontSize: 17,
    fontWeight: '700',
  },
  barTrack: {
    height: 5,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.7)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statTile: {
    flexGrow: 1,
    flexBasis: '45%',
    borderWidth: 1,
    borderColor: '#d9dee3',
    borderRadius: 8,
    padding: 14,
    backgroundColor: '#fbfcfd',
  },
  statValue: {
    color: '#126b46',
    fontSize: 28,
    fontWeight: '700',
  },
});
