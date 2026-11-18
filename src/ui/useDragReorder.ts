import {useEffect, useRef, useState} from 'react';
import {
  Animated,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  PanResponderInstance,
  ScrollView,
} from 'react-native';

/** Hold a handle this long (without moving) to pick the row up; a quick swipe scrolls instead. */
export const LONG_PRESS_MS = 350;
const SLOP = 8; // dp the finger may wander during the hold before it counts as a scroll attempt
const EDGE = 80; // dp from the viewport edge where auto-scroll starts
const MAX_SPEED = 16; // dp per frame at the very edge

/** Top of every row relative to the first row, for rows of varying height. */
export function rowTops(heights: number[], count: number, gap: number): number[] {
  const tops: number[] = [];
  let y = 0;
  for (let i = 0; i < count; i++) {
    tops.push(y);
    y += (heights[i] ?? 0) + gap;
  }
  return tops;
}

/**
 * Index the dragged row ends up at if it is dropped now: the number of other rows whose
 * centre is above the dragged row's centre (`offset` = how far it has moved from its start).
 */
export function dropIndex(
  heights: number[],
  count: number,
  gap: number,
  active: number,
  offset: number,
): number {
  const tops = rowTops(heights, count, gap);
  const center = tops[active] + (heights[active] ?? 0) / 2 + offset;
  let target = 0;
  for (let j = 0; j < count; j++) {
    if (j !== active && tops[j] + (heights[j] ?? 0) / 2 < center) {
      target++;
    }
  }
  return target;
}

/**
 * Drag-and-drop reordering for a list of variable-height rows inside one ScrollView.
 * Grab a row's handle and move: the row follows the finger, the others slide aside, and the
 * list scrolls by itself near the top/bottom edge. No native modules needed.
 *
 * - spread `scrollViewProps` on the ScrollView and `containerProps` on the View wrapping the rows
 * - spread `getRowProps(i)` on each row (an Animated.View) and `getHandleProps(i)` on its handle
 */
export function useDragReorder({
  count,
  gap,
  onReorder,
  captureTouches = true,
}: {
  count: number;
  gap: number;
  onReorder: (from: number, to: number) => void;
  /**
   * true (default): the handle takes every touch that starts on it (a small grip).
   * false: for a whole row that also holds buttons; deeper buttons win their own touches, and
   * the row tells a tap (-> onTap) from a long press (-> drag) from a swipe (-> list scrolls).
   */
  captureTouches?: boolean;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const viewportHeight = useRef(0);
  const contentHeight = useRef(0);
  const containerY = useRef(0);
  const heights = useRef<number[]>([]);
  const drag = useRef({active: -1, startScroll: 0, dy: 0, target: -1});
  const dragY = useRef(new Animated.Value(0)).current;
  const shifts = useRef<Animated.Value[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const responders = useRef<Record<number, PanResponderInstance>>({});
  const latest = useRef({count, gap, onReorder, captureTouches});
  latest.current = {count, gap, onReorder, captureTouches};
  const taps = useRef<Record<number, (() => void) | undefined>>({});
  const moved = useRef(false);
  const [active, setActive] = useState(-1);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDy = useRef(0);
  const armedDy = useRef(0);

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const shiftFor = (index: number) => {
    if (!shifts.current[index]) {
      shifts.current[index] = new Animated.Value(0);
    }
    return shifts.current[index];
  };

  const animateShifts = (from: number, target: number) => {
    const {count: n, gap: g} = latest.current;
    const amount = (heights.current[from] ?? 0) + g;
    for (let j = 0; j < n; j++) {
      if (j === from) {
        continue;
      }
      let to = 0;
      if (from < target && j > from && j <= target) {
        to = -amount;
      } else if (from > target && j >= target && j < from) {
        to = amount;
      }
      Animated.timing(shiftFor(j), {toValue: to, duration: 120, useNativeDriver: true}).start();
    }
  };

  const update = () => {
    const d = drag.current;
    if (d.active < 0) {
      return;
    }
    const {count: n, gap: g} = latest.current;
    const offset = d.dy + (scrollY.current - d.startScroll);
    dragY.setValue(offset);
    const target = dropIndex(heights.current, n, g, d.active, offset);
    if (target !== d.target) {
      d.target = target;
      animateShifts(d.active, target);
    }
  };

  const tick = () => {
    const d = drag.current;
    if (d.active < 0) {
      return;
    }
    const {count: n, gap: g} = latest.current;
    const offset = d.dy + (scrollY.current - d.startScroll);
    const top =
      containerY.current + rowTops(heights.current, n, g)[d.active] + offset - scrollY.current;
    // Scroll only when the row is near an edge AND the finger is moving toward that edge, so a row
    // that is simply picked up next to the top of the screen does not scroll the list.
    const center = top + (heights.current[d.active] ?? 0) / 2;
    let delta = 0;
    if (d.dy < 0 && center < EDGE) {
      delta = -MAX_SPEED * Math.min(1, (EDGE - center) / EDGE);
    } else if (d.dy > 0 && center > viewportHeight.current - EDGE) {
      delta = MAX_SPEED * Math.min(1, (center - (viewportHeight.current - EDGE)) / EDGE);
    }
    if (delta !== 0) {
      const maxY = Math.max(0, contentHeight.current - viewportHeight.current);
      const next = Math.min(maxY, Math.max(0, scrollY.current + delta));
      if (next !== scrollY.current) {
        scrollY.current = next;
        scrollRef.current?.scrollTo({y: next, animated: false});
      }
    }
    update();
  };

  const start = (index: number) => {
    const d = drag.current;
    d.active = index;
    d.startScroll = scrollY.current;
    d.dy = 0;
    d.target = index;
    dragY.setValue(0);
    shifts.current.forEach(value => value.setValue(0));
    setActive(index);
    if (timer.current) {
      clearInterval(timer.current);
    }
    timer.current = setInterval(tick, 16);
  };

  const finish = () => {
    const d = drag.current;
    if (d.active < 0) {
      return;
    }
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    const from = d.active;
    const target = d.target;
    d.active = -1;
    shifts.current.forEach(value => value.setValue(0));
    dragY.setValue(0);
    setActive(-1);
    if (target >= 0 && target !== from) {
      latest.current.onReorder(from, target);
    }
  };

  useEffect(
    () => () => {
      if (timer.current) {
        clearInterval(timer.current);
      }
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
      }
    },
    [],
  );

  const getHandleProps = (index: number, onTap?: () => void) => {
    taps.current[index] = onTap; // always the latest closure
    if (!responders.current[index]) {
      responders.current[index] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => latest.current.captureTouches,
        onMoveShouldSetPanResponder: () => drag.current.active >= 0,
        // Until the row is picked up, the list may take the gesture over (a swipe = scroll).
        onPanResponderTerminationRequest: () => drag.current.active < 0,
        onPanResponderGrant: () => {
          lastDy.current = 0;
          moved.current = false;
          cancelPress();
          pressTimer.current = setTimeout(() => {
            pressTimer.current = null;
            armedDy.current = lastDy.current;
            start(index);
          }, LONG_PRESS_MS);
        },
        onPanResponderMove: (_event, gesture) => {
          lastDy.current = gesture.dy;
          if (drag.current.active >= 0) {
            drag.current.dy = gesture.dy - armedDy.current;
            update();
          } else if (Math.hypot(gesture.dx, gesture.dy) > SLOP) {
            moved.current = true;
            cancelPress(); // moved before the long press: this is a scroll, not a drag
          }
        },
        onPanResponderRelease: () => {
          cancelPress();
          if (drag.current.active >= 0) {
            finish();
          } else if (!moved.current) {
            taps.current[index]?.(); // a short press that stayed put: a tap
          }
        },
        onPanResponderTerminate: () => {
          cancelPress();
          finish();
        },
      });
    }
    return responders.current[index].panHandlers;
  };

  const getRowProps = (index: number) => ({
    onLayout: (event: LayoutChangeEvent) => {
      heights.current[index] = event.nativeEvent.layout.height;
    },
    style:
      active === index
        ? {
            transform: [{translateY: dragY}, {scale: 1.02}],
            zIndex: 20,
            elevation: 8,
            opacity: 0.95,
          }
        : {transform: [{translateY: shiftFor(index)}]},
  });

  return {
    isDragging: active >= 0,
    activeIndex: active,
    getRowProps,
    getHandleProps,
    containerProps: {
      onLayout: (event: LayoutChangeEvent) => {
        containerY.current = event.nativeEvent.layout.y;
      },
    },
    scrollViewProps: {
      ref: scrollRef,
      scrollEnabled: active < 0,
      scrollEventThrottle: 16,
      onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (drag.current.active < 0) {
          scrollY.current = event.nativeEvent.contentOffset.y;
        }
      },
      onLayout: (event: LayoutChangeEvent) => {
        viewportHeight.current = event.nativeEvent.layout.height;
      },
      onContentSizeChange: (_width: number, height: number) => {
        contentHeight.current = height;
      },
    },
  };
}
