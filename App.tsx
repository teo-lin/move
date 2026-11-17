import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  Easing,
  Image,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {Exercise, exerciseLabel, exercises, exercisesById} from './src/data/exercises';
import {
  csvWorkoutLabel,
  mergeSavedWorkouts,
  serializeWorkoutSettings,
  workoutLabel,
  workouts as starterWorkouts,
  workoutsKey,
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
  monthGrid,
  parseHistory,
  serializeHistory,
  SessionEntry,
  startOfWeek,
  toBackExercisesCsv,
  weekdayLabels,
} from './src/data/history';
import {MoveStorage} from './src/native/MoveStorage';

type Screen = 'workouts' | 'catalog' | 'history' | 'stats';
type Phase = 'announce' | 'countdown' | 'work' | 'change-side' | 'finishing' | 'rest';

const BREATHER_SECONDS = 20;
const BREATHER_EXTRA_SECONDS = 15;

export default function App(): React.JSX.Element {
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
  const [, setClock] = useState(0);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [detailExerciseId, setDetailExerciseId] = useState<number | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return {year: now.getFullYear(), month: now.getMonth()};
  });

  const selectedWorkout = workouts.find(workout => workout.id === selectedWorkoutId) ?? workouts[0];
  const activeStep = activeWorkout?.steps[activeIndex] ?? null;
  const activeExercise = activeStep ? exercisesById.get(activeStep.exerciseId) ?? null : null;
  const detailExercise = detailExerciseId === null ? null : exercisesById.get(detailExerciseId) ?? null;

  useEffect(() => {
    MoveStorage.getString(historyKey).then(raw => setHistory(parseHistory(raw)));
    MoveStorage.getString(workoutsKey)
      .then(raw => setWorkouts(mergeSavedWorkouts(raw, starterWorkouts)))
      .finally(() => setSettingsLoaded(true));
  }, []);

  useEffect(() => {
    if (settingsLoaded) {
      fire(MoveStorage.setString(workoutsKey, serializeWorkoutSettings(workouts)));
    }
  }, [workouts, settingsLoaded]);

  useEffect(() => {
    fire(MoveStorage.setKeepAwake(activeWorkout !== null));
    if (!activeWorkout) {
      return;
    }
    const tick = setInterval(() => setClock(value => value + 1), 1000);
    return () => clearInterval(tick);
  }, [activeWorkout]);

  useEffect(() => {
    if (detailExerciseId === null) {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setDetailExerciseId(null);
      return true;
    });
    return () => subscription.remove();
  }, [detailExerciseId]);

  useEffect(() => {
    if (!activeWorkout || !activeStep || paused) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    if (phase === 'announce') {
      fire(MoveStorage.speak(exercisesById.get(activeStep.exerciseId)?.name ?? 'Exercise'));
      timer = setTimeout(() => {
        setCountdown(5);
        setPhase('countdown');
      }, 1600);
    }

    if (phase === 'countdown') {
      if (countdown > 0) {
        fire(MoveStorage.click());
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
      fire(MoveStorage.speak('Change side'));
      timer = setTimeout(() => {
        setSideChanged(true);
        setCountdown(5);
        setPhase('countdown');
      }, 1400);
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
        timer = setTimeout(() => setPhase('announce'), 900);
      }
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
    // The timer intentionally captures the current playback state for one tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkout, activeStep, activeIndex, countdown, phase, rep, sideChanged, paused, restRemaining]);

  const elapsed = startedAt ? Math.max(0, Math.round((Date.now() - startedAt) / 1000)) : 0;

  async function saveHistory(nextHistory: SessionEntry[]) {
    setHistory(nextHistory);
    await MoveStorage.setString(historyKey, serializeHistory(nextHistory));
  }

  function startWorkout(workout: Workout) {
    setActiveWorkout(workout);
    setActiveIndex(0);
    setPhase('announce');
    setCountdown(5);
    setRep(0);
    setSideChanged(false);
    setPaused(false);
    setCompletedSteps(workout.steps.map(() => false));
    setStartedAt(Date.now());
  }

  function startRest(seconds: number) {
    fire(MoveStorage.stopAudio());
    fire(MoveStorage.speak('Catch your breath'));
    setRestTotal(seconds);
    setRestRemaining(seconds);
    setRep(0);
    setSideChanged(false);
    setPaused(false);
    setPhase('rest');
  }

  /** Runner "breather" button: pause for a breath, then redo the current exercise. */
  function takeBreather() {
    if (phase === 'rest') {
      setRestTotal(total => total + BREATHER_EXTRA_SECONDS);
      setRestRemaining(remaining => remaining + BREATHER_EXTRA_SECONDS);
      return;
    }
    startRest(Math.max(BREATHER_SECONDS, activeWorkout?.restSeconds ?? 0));
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
    if (activeIndex === 0) {
      return;
    }
    fire(MoveStorage.stopAudio());
    setActiveIndex(activeIndex - 1);
    setPhase('announce');
    setCountdown(5);
    setRep(0);
    setSideChanged(false);
    setPaused(false);
  }

  function nextExercise() {
    if (!activeWorkout) {
      return;
    }
    fire(MoveStorage.stopAudio());
    if (phase === 'rest') {
      setRestRemaining(0);
      setPhase('announce');
      return;
    }
    if (activeIndex < activeWorkout.steps.length - 1) {
      setActiveIndex(activeIndex + 1);
      setPhase('announce');
      setCountdown(5);
      setRep(0);
      setSideChanged(false);
      setPaused(false);
    } else {
      finishWorkout(false);
    }
  }

  function advanceAfterExercise() {
    if (!activeWorkout) {
      return;
    }
    if (activeIndex < activeWorkout.steps.length - 1) {
      setActiveIndex(activeIndex + 1);
      setCountdown(5);
      setRep(0);
      setSideChanged(false);
      setPaused(false);
      const rest = activeWorkout.restSeconds ?? 0;
      if (rest > 0) {
        startRest(rest);
      } else {
        setPhase('announce');
      }
    } else {
      finishWorkout(true);
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
      ? activeWorkout.steps.length
      : completedSteps.filter(Boolean).length;
    const entry: SessionEntry = {
      id: `${Date.now()}`,
      timestamp: Date.now(),
      workout: workoutLabel(activeWorkout),
      completed,
      total: activeWorkout.steps.length,
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

  function moveStep(index: number, direction: -1 | 1) {
    updateSelectedWorkout(workout => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= workout.steps.length) {
        return workout;
      }
      const steps = [...workout.steps];
      const [step] = steps.splice(index, 1);
      steps.splice(nextIndex, 0, step);
      return {...workout, steps};
    });
  }

  function confirmDeleteEntry(entry: SessionEntry) {
    Alert.alert(
      'Delete session?',
      `${formatDisplayDate(entry.timestamp)} ${formatTime(entry.timestamp)} · ${entry.workout} · ${entry.completed} / ${entry.total}`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            saveHistory(history.filter(item => item.id !== entry.id)).catch(error =>
              Alert.alert('Could not delete', String(error)),
            ),
        },
      ],
    );
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

  if (activeWorkout && activeStep) {
    return (
      <Shell title={workoutLabel(activeWorkout)} screen={screen} setScreen={setScreen}>
        <View style={styles.runner}>
          <Text style={styles.meta}>
            {activeIndex + 1} / {activeWorkout.steps.length} · {phaseLabel(phase, countdown)} ·{' '}
            {formatDuration(elapsed)}
          </Text>
          {phase === 'rest' ? (
            <View style={styles.restPanel}>
              <Text style={styles.restTitle}>Catch your breath</Text>
              <Text style={styles.restCount}>{restRemaining}s</Text>
              <SegmentBar total={1} done={0} fill={restTotal > 0 ? restRemaining / restTotal : 0} />
              {activeExercise && (
                <Text style={styles.meta}>
                  Up next: {exerciseLabel(activeExercise.id)} {activeExercise.name}
                </Text>
              )}
            </View>
          ) : activeExercise ? (
            <ExercisePreview exercise={activeExercise} large />
          ) : (
            <Text style={styles.bodyText}>Missing exercise.</Text>
          )}
          {phase !== 'rest' && (
            <>
              <RepProgress
                key={`${activeIndex}-${sideChanged}`}
                step={activeStep}
                rep={rep}
                running={phase === 'work' && !paused}
              />
              <Text style={styles.prescription}>
                {activeStep.repetitions} reps · {activeStep.secondsPerRep}s per rep
                {activeStep.twoSides ? ' · change side halfway' : ''}
              </Text>
            </>
          )}
          <View style={styles.iconRow}>
            <IconButton label="Previous" icon="‹" disabled={activeIndex === 0} onPress={previousExercise} />
            <IconButton label="Repeat" icon="↻" onPress={restartCurrentExercise} />
            <IconButton
              label={phase === 'rest' ? `Add ${BREATHER_EXTRA_SECONDS} seconds` : 'Catch your breath'}
              icon={phase === 'rest' ? '+' : '≈'}
              onPress={takeBreather}
            />
            <IconButton
              label={paused ? 'Resume' : 'Pause'}
              icon={paused ? '▶' : 'Ⅱ'}
              onPress={() => {
                fire(MoveStorage.stopAudio());
                setPaused(!paused);
              }}
            />
            <IconButton label="Next" icon="›" onPress={nextExercise} />
            <IconButton label="Finish workout" icon="■" onPress={() => finishWorkout(false)} />
          </View>
        </View>
      </Shell>
    );
  }

  return (
    <Shell title="Move" screen={screen} setScreen={setScreen}>
      {screen === 'workouts' && selectedWorkout && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.segment}>
            {workouts.map(workout => (
              <Pressable
                key={workout.id}
                style={[styles.segmentOption, workout.id === selectedWorkout.id && styles.segmentOptionActive]}
                onPress={() => setSelectedWorkoutId(workout.id)}>
                <Text
                  style={[
                    styles.segmentText,
                    workout.id === selectedWorkout.id && styles.segmentTextActive,
                  ]}>
                  {workoutLabel(workout)}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{workoutLabel(selectedWorkout)}</Text>
            <Text style={styles.meta}>
              {selectedWorkout.steps.length} exercises · about{' '}
              {Math.round(estimateSeconds(selectedWorkout) / 60)} min with cues
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
            <Action label="Start guided workout" onPress={() => startWorkout(selectedWorkout)} />
            <SmallButton label="Reset to default settings" onPress={resetSelectedWorkout} />
          </View>

          {selectedWorkout.steps.map((step, index) => {
            const exercise = exercisesById.get(step.exerciseId);
            return (
              <View style={styles.stepCard} key={`${step.exerciseId}-${index}`}>
                {exercise && <Image source={exercise.asset} style={styles.stepThumb} resizeMode="contain" />}
                <View style={styles.stepMain}>
                  <Text style={styles.exerciseName}>
                    {index + 1}. {exercise ? exercise.name : `Exercise ${step.exerciseId}`}
                  </Text>
                  <Text style={styles.meta}>
                    {exerciseLabel(step.exerciseId)} · {step.repetitions} reps · {step.secondsPerRep}s
                    {step.twoSides ? ' · two sides' : ''}
                  </Text>
                  <View style={styles.smallControlRow}>
                    <SmallButton label="↑" onPress={() => moveStep(index, -1)} />
                    <SmallButton label="↓" onPress={() => moveStep(index, 1)} />
                    <SmallButton label="- rep" onPress={() => updateStep(index, {repetitions: Math.max(1, step.repetitions - 1)})} />
                    <SmallButton label="+ rep" onPress={() => updateStep(index, {repetitions: step.repetitions + 1})} />
                    <SmallButton label="- sec" onPress={() => updateStep(index, {secondsPerRep: Math.max(1, step.secondsPerRep - 1)})} />
                    <SmallButton label="+ sec" onPress={() => updateStep(index, {secondsPerRep: step.secondsPerRep + 1})} />
                    <SmallButton
                      label={step.twoSides ? 'side on' : 'side off'}
                      onPress={() => updateStep(index, {twoSides: !step.twoSides})}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {screen === 'catalog' && detailExercise && (
        <ScrollView contentContainerStyle={styles.content}>
          <SmallButton label="‹ All exercises" onPress={() => setDetailExerciseId(null)} />
          <ExercisePreview exercise={detailExercise} large />
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
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.meta}>{exercises.length} exercises bundled locally</Text>
          {exercises.map(exercise => (
            <ExerciseRow
              exercise={exercise}
              key={exercise.id}
              onPress={() => setDetailExerciseId(exercise.id)}
            />
          ))}
        </ScrollView>
      )}

      {screen === 'history' && (
        <ScrollView contentContainerStyle={styles.content}>
          <Calendar
            year={calendarMonth.year}
            month={calendarMonth.month}
            activeDays={new Set(history.map(entry => localDateKey(entry.timestamp)))}
            onShift={shiftCalendar}
          />
          {history.length > 0 && <Text style={styles.meta}>Long-press a session to delete it.</Text>}
          {history.length === 0 ? (
            <Text style={styles.empty}>No completed sessions yet.</Text>
          ) : (
            groupByLocalDate(history).map(group => (
              <View style={styles.card} key={group.key}>
                <Text style={styles.cardTitle}>{group.label}</Text>
                {group.entries.map(entry => (
                  <Pressable
                    key={entry.id}
                    onLongPress={() => confirmDeleteEntry(entry)}
                    accessibilityRole="button"
                    accessibilityHint="Long press to delete this session">
                    <Text style={styles.bodyText}>
                      {formatTime(entry.timestamp)} · {entry.workout} · {entry.completed} / {entry.total}{' '}
                      · {formatDuration(entry.durationSeconds)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {screen === 'stats' && (
        <StatsScreen history={history} onExport={exportCsv} onShare={shareCsv} />
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
  children,
}: {
  title: string;
  screen: Screen;
  setScreen: (screen: Screen) => void;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.tabs}>
          <Tab label="Workouts" active={screen === 'workouts'} onPress={() => setScreen('workouts')} />
          <Tab label="Catalog" active={screen === 'catalog'} onPress={() => setScreen('catalog')} />
          <Tab label="History" active={screen === 'history'} onPress={() => setScreen('history')} />
          <Tab label="Stats" active={screen === 'stats'} onPress={() => setScreen('stats')} />
        </View>
      </View>
      {children}
    </SafeAreaView>
  );
}

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Rough length including the spoken name, countdowns and side changes. */
function estimateSeconds(workout: Workout): number {
  const rests = Math.max(0, workout.steps.length - 1) * ((workout.restSeconds ?? 0) + 1);
  return workout.steps.reduce(
    (total, item) =>
      total + 1.6 + 5.6 + item.repetitions * item.secondsPerRep + 0.7 + (item.twoSides ? 7 : 0),
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
      accessibilityLabel={`Repetition ${Math.min(rep + 1, step.repetitions)} of ${step.repetitions}`}>
      {Array.from({length: step.repetitions}, (_, index) => (
        <View key={index} style={[styles.repSegment, index === half && styles.repSegmentSideGap]}>
          {index < rep && <View style={[styles.repSegmentFill, styles.fullWidth]} />}
          {index === rep && running && (
            <Animated.View
              style={[
                styles.repSegmentFill,
                {width: progress.interpolate({inputRange: [0, 1], outputRange: ['0%', '100%']})},
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

function Calendar({
  year,
  month,
  activeDays,
  onShift,
}: {
  year: number;
  month: number;
  activeDays: Set<string>;
  onShift: (delta: number) => void;
}) {
  const title = `${monthNames[month]} ${year}`;
  const today = localDateKey(new Date());
  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const daysThisWeek = [...activeDays].filter(key => {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date >= weekStart && date <= weekEnd;
  }).length;

  return (
    <View style={styles.card}>
      <View style={styles.calendarHeader}>
        <SmallButton label="‹" onPress={() => onShift(-1)} />
        <Text style={styles.cardTitle}>{title}</Text>
        <SmallButton label="›" onPress={() => onShift(1)} />
      </View>
      <View style={styles.calendarRow}>
        {weekdayLabels.map(label => (
          <Text style={styles.calendarWeekday} key={label}>
            {label}
          </Text>
        ))}
      </View>
      {monthGrid(year, month).map((week, index) => (
        <View style={styles.calendarRow} key={index}>
          {week.map((day, dayIndex) => {
            const key = day ? localDateKey(day) : '';
            const active = day !== null && activeDays.has(key);
            return (
              <View
                key={dayIndex}
                style={[
                  styles.calendarCell,
                  active && styles.calendarCellActive,
                  key === today && styles.calendarCellToday,
                ]}>
                <Text style={[styles.calendarDay, active && styles.calendarDayActive]}>
                  {day ? day.getDate() : ''}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
      <Text style={styles.meta}>
        This week ({formatDisplayDate(weekStart)} – {formatDisplayDate(weekEnd)}): {daysThisWeek} active{' '}
        {daysThisWeek === 1 ? 'day' : 'days'}
      </Text>
    </View>
  );
}

function StatsScreen({
  history,
  onExport,
  onShare,
}: {
  history: SessionEntry[];
  onExport: () => void;
  onShare: () => void;
}) {
  const stats = historyStats(history);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.statGrid}>
        <StatTile label="This week" value={stats.thisWeek} />
        <StatTile label="This month" value={stats.thisMonth} />
        <StatTile label="Sessions" value={stats.total} />
        <StatTile label="Minutes" value={stats.totalMinutes} />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>By workout</Text>
        {stats.byWorkout.length === 0 ? (
          <Text style={styles.meta}>No completed sessions yet.</Text>
        ) : (
          stats.byWorkout.map(item => (
            <Text style={styles.bodyText} key={item.workout}>
              {item.workout}: {item.count}× · last {formatDisplayDate(item.lastTimestamp)} ·{' '}
              {Math.round(item.totalSeconds / 60)} min
            </Text>
          ))
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>back-exercises.csv</Text>
        <Text style={styles.meta}>
          Same columns as the health repo baseline: "Date","Workout","Completion","Duration". Export
          writes Download/move/back-exercises.csv for adb pull.
        </Text>
        <Action label="Export CSV" onPress={onExport} />
        <Action label="Share CSV" onPress={onShare} />
      </View>
    </ScrollView>
  );
}

function StatTile({label, value}: {label: string; value: number}) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.meta}>{label}</Text>
    </View>
  );
}

function Tab({label, active, onPress}: {label: string; active: boolean; onPress: () => void}) {
  return (
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ExerciseRow({exercise, onPress}: {exercise: Exercise; onPress: () => void}) {
  return (
    <Pressable
      style={styles.exerciseRow}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={exercise.name}>
      <Image source={exercise.asset} style={styles.thumb} resizeMode="contain" />
      <View style={styles.exerciseText}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <Text style={styles.meta}>{exerciseLabel(exercise.id)}</Text>
      </View>
    </Pressable>
  );
}

function ExercisePreview({exercise, large = false}: {exercise: Exercise; large?: boolean}) {
  return (
    <View style={styles.preview}>
      <Image source={exercise.asset} style={large ? styles.previewImageLarge : styles.previewImage} resizeMode="contain" />
      <Text style={styles.cardTitle}>
        {exerciseLabel(exercise.id)} {exercise.name}
      </Text>
    </View>
  );
}

function IconButton({
  label,
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon: string;
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
      <Text style={[styles.iconText, disabled && styles.actionTextDisabled]}>{icon}</Text>
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
  title: {
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
  stepCard: {
    minHeight: 110,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d9dee3',
    borderRadius: 8,
    padding: 10,
    gap: 12,
  },
  stepMain: {
    flex: 1,
    gap: 8,
  },
  cardTitle: {
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
  exerciseRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d9dee3',
    borderRadius: 8,
    padding: 10,
    gap: 12,
  },
  thumb: {
    width: 96,
    height: 96,
  },
  stepThumb: {
    width: 128,
    height: 128,
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
  exerciseText: {
    flex: 1,
    gap: 4,
  },
  exerciseName: {
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
  previewImageLarge: {
    width: '100%',
    height: 420,
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
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#eef5fb',
    borderWidth: 1,
    borderColor: '#c8d8e8',
  },
  iconText: {
    color: '#226fb8',
    fontSize: 28,
    fontWeight: '700',
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
  segment: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentOption: {
    flexGrow: 1,
    flexBasis: '45%',
    borderWidth: 1,
    borderColor: '#d9dee3',
    borderRadius: 8,
    padding: 10,
  },
  segmentOptionActive: {
    borderColor: '#168f5c',
    backgroundColor: '#eaf7f1',
  },
  segmentText: {
    color: '#52606d',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: '#126b46',
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
  smallButtonText: {
    color: '#226fb8',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarRow: {
    flexDirection: 'row',
  },
  calendarWeekday: {
    flex: 1,
    textAlign: 'center',
    color: '#697782',
    fontSize: 13,
    fontWeight: '700',
  },
  calendarCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 2,
    borderRadius: 6,
  },
  calendarCellActive: {
    backgroundColor: '#168f5c',
  },
  calendarCellToday: {
    borderWidth: 2,
    borderColor: '#226fb8',
  },
  calendarDay: {
    color: '#1f2d38',
    fontSize: 15,
  },
  calendarDayActive: {
    color: '#ffffff',
    fontWeight: '700',
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
