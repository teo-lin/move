import React, {useEffect, useState} from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {Exercise, exerciseLabel, exercises, exercisesById} from './src/data/exercises';
import {workouts as starterWorkouts, Workout, WorkoutStep} from './src/data/workouts';
import {
  formatDate,
  formatDuration,
  historyKey,
  parseHistory,
  serializeHistory,
  SessionEntry,
  toBackExercisesCsv,
} from './src/data/history';
import {MoveStorage} from './src/native/MoveStorage';

type Screen = 'workouts' | 'catalog' | 'history';
type Phase = 'announce' | 'countdown' | 'work' | 'change-side' | 'finishing';

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

  const selectedWorkout = workouts.find(workout => workout.id === selectedWorkoutId) ?? workouts[0];
  const activeStep = activeWorkout?.steps[activeIndex] ?? null;
  const activeExercise = activeStep ? exercisesById.get(activeStep.exerciseId) ?? null : null;

  useEffect(() => {
    MoveStorage.getString(historyKey).then(raw => setHistory(parseHistory(raw)));
  }, []);

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
        fire(MoveStorage.repChime());
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

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
    // The timer intentionally captures the current playback state for one tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkout, activeStep, activeIndex, countdown, phase, rep, sideChanged, paused]);

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
      setPhase('announce');
      setCountdown(5);
      setRep(0);
      setSideChanged(false);
      setPaused(false);
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
      workout: activeWorkout.name,
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

  async function exportCsv() {
    try {
      const path = await MoveStorage.exportCsv('back-exercises.csv', toBackExercisesCsv(history));
      Alert.alert('Exported', path);
    } catch (error) {
      Alert.alert('Export failed', String(error));
    }
  }

  if (activeWorkout && activeStep) {
    return (
      <Shell title={activeWorkout.name} screen={screen} setScreen={setScreen}>
        <View style={styles.runner}>
          <Text style={styles.meta}>
            {activeIndex + 1} / {activeWorkout.steps.length} · {phaseLabel(phase, countdown)} ·{' '}
            {rep} / {activeStep.repetitions} · {formatDuration(elapsed)}
          </Text>
          {activeExercise ? (
            <ExercisePreview exercise={activeExercise} large />
          ) : (
            <Text style={styles.bodyText}>Missing exercise.</Text>
          )}
          <Text style={styles.prescription}>
            {activeStep.repetitions} reps · {activeStep.secondsPerRep}s per rep
            {activeStep.twoSides ? ' · change side halfway' : ''}
          </Text>
          <View style={styles.iconRow}>
            <IconButton label="Previous" icon="‹" disabled={activeIndex === 0} onPress={previousExercise} />
            <IconButton label="Repeat" icon="↻" onPress={restartCurrentExercise} />
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
                  {workout.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{selectedWorkout.name}</Text>
            <Text style={styles.meta}>{selectedWorkout.steps.length} exercises with timed cues</Text>
            <Action label="Start guided workout" onPress={() => startWorkout(selectedWorkout)} />
          </View>

          {selectedWorkout.steps.map((step, index) => {
            const exercise = exercisesById.get(step.exerciseId);
            return (
              <View style={styles.stepCard} key={`${step.exerciseId}-${index}`}>
                {exercise && <Image source={exercise.asset} style={styles.thumb} resizeMode="contain" />}
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
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {screen === 'catalog' && (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.meta}>{exercises.length} exercises bundled locally</Text>
          {exercises.map(exercise => (
            <ExerciseRow exercise={exercise} key={exercise.id} />
          ))}
        </ScrollView>
      )}

      {screen === 'history' && (
        <ScrollView contentContainerStyle={styles.content}>
          <Action label="Export CSV" onPress={exportCsv} />
          {history.length === 0 ? (
            <Text style={styles.empty}>No completed sessions yet.</Text>
          ) : (
            history.map(entry => (
              <View style={styles.card} key={entry.id}>
                <Text style={styles.cardTitle}>{entry.workout}</Text>
                <Text style={styles.meta}>
                  {formatDate(entry.timestamp)} · {entry.completed} / {entry.total} ·{' '}
                  {formatDuration(entry.durationSeconds)}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
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
        </View>
      </View>
      {children}
    </SafeAreaView>
  );
}

function Tab({label, active, onPress}: {label: string; active: boolean; onPress: () => void}) {
  return (
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ExerciseRow({exercise}: {exercise: Exercise}) {
  return (
    <View style={styles.exerciseRow}>
      <Image source={exercise.asset} style={styles.thumb} resizeMode="contain" />
      <View style={styles.exerciseText}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <Text style={styles.meta}>{exerciseLabel(exercise.id)}</Text>
      </View>
    </View>
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
    <Pressable style={styles.smallButton} onPress={onPress}>
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
    width: 62,
    height: 62,
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
    width: 58,
    height: 52,
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
    gap: 8,
  },
  segmentOption: {
    flex: 1,
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
  },
});
