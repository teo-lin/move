import React, {useEffect, useRef} from 'react';
import {Animated, PanResponder, StyleSheet, useWindowDimensions, View} from 'react-native';

import {Icon} from './Icon';

const REVEAL = 76; // dp the tile slides to show the bin / pencil
const TRIGGER = 36; // dp of swipe that counts as a swipe

/** Which action a row is currently showing underneath it (null = nothing). */
export type Revealed = 'delete' | 'edit' | null;

/**
 * A row you can swipe, both ways, two swipes each:
 *  - LEFT:  the tile slides over and a bin shows underneath; swipe left AGAIN and the tile slides
 *           away and `onDelete` runs.
 *  - RIGHT (only when `onEdit` is given): a pencil shows underneath; swipe right AGAIN and
 *           `onEdit` runs.
 * Swiping back the other way closes whatever is showing.
 *
 * The parent owns `revealed`, so only one row is ever open at a time. Only horizontal-looking
 * moves are claimed, so vertical scrolling and buttons inside the row keep working.
 *
 * NOTE: this must wrap (be an ancestor of) any other touch handler on the same tile. Android's
 * responder system asks only the ancestors of the current responder whether they want a moving
 * gesture, so a swipe handler nested inside another handler is never asked.
 */
export function SwipeRow({
  revealed,
  onReveal,
  onDelete,
  onEdit,
  radius = 8,
  hint = false,
  onHinted,
  children,
}: {
  revealed: Revealed;
  onReveal: (revealed: Revealed) => void;
  onDelete: () => void;
  onEdit?: () => void;
  radius?: number;
  /** Play the one-off "you can swipe me" demo (left, right, then a little up-down wiggle). */
  hint?: boolean;
  onHinted?: () => void;
  children: React.ReactNode;
}) {
  const x = useRef(new Animated.Value(0)).current;
  const {width} = useWindowDimensions();
  const latest = useRef({revealed, onReveal, onDelete, onEdit, width});
  latest.current = {revealed, onReveal, onDelete, onEdit, width};
  const y = useRef(new Animated.Value(0)).current;
  const base = useRef(0);

  useEffect(() => {
    if (!hint) {
      return;
    }
    const step = (to: number) =>
      Animated.timing(x, {toValue: to, duration: 280, useNativeDriver: true});
    const wiggle = (to: number) =>
      Animated.timing(y, {toValue: to, duration: 130, useNativeDriver: true});
    const demo = Animated.sequence([
      Animated.delay(700),
      step(-REVEAL * 0.8),
      step(0),
      ...(latest.current.onEdit ? [step(REVEAL * 0.8), step(0)] : []),
      wiggle(-7),
      wiggle(7),
      wiggle(-5),
      wiggle(0),
    ]);
    demo.start(({finished}) => {
      if (finished) {
        onHinted?.();
      }
    });
    return () => demo.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hint]);

  const restingX = (state: Revealed) =>
    state === 'delete' ? -REVEAL : state === 'edit' ? REVEAL : 0;
  const settle = (to: number) =>
    Animated.timing(x, {toValue: to, duration: 160, useNativeDriver: true}).start();

  useEffect(() => {
    settle(restingX(revealed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.6,
      onPanResponderGrant: () => {
        x.stopAnimation(value => {
          base.current = value;
        });
      },
      onPanResponderMove: (_event, gesture) => {
        const min = -(REVEAL + 140);
        const max = latest.current.onEdit ? REVEAL + 140 : 0;
        x.setValue(Math.max(min, Math.min(max, base.current + gesture.dx)));
      },
      onPanResponderRelease: (_event, gesture) => {
        const {revealed: state, onReveal: reveal, onDelete: remove, onEdit: edit} = latest.current;
        if (gesture.dx < -TRIGGER) {
          if (state === 'delete') {
            // second swipe left: slide the tile away, then delete
            Animated.timing(x, {
              toValue: -latest.current.width,
              duration: 160,
              useNativeDriver: true,
            }).start(() => remove());
          } else if (state === 'edit') {
            reveal(null); // swiping back closes the pencil
          } else {
            reveal('delete');
          }
        } else if (gesture.dx > TRIGGER) {
          if (state === 'edit' && edit) {
            // second swipe right: run the edit, the tile snaps back
            settle(0);
            reveal(null);
            edit();
          } else if (state === 'delete') {
            reveal(null); // swiping back closes the bin
          } else if (edit) {
            reveal('edit');
          } else {
            settle(0);
          }
        } else {
          settle(restingX(state));
        }
      },
      onPanResponderTerminate: () => settle(restingX(latest.current.revealed)),
    }),
  ).current;

  return (
    <View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.layer,
          styles.bin,
          {
            borderRadius: radius,
            opacity: x.interpolate({
              inputRange: [-6, 0],
              outputRange: [1, 0],
              extrapolate: 'clamp',
            }),
          },
        ]}>
        <View style={styles.icon}>
          <Icon name="symbolDelete" size={28} color="#b4443b" />
        </View>
      </Animated.View>
      {onEdit ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.layer,
            styles.edit,
            {
              borderRadius: radius,
              opacity: x.interpolate({
                inputRange: [0, 6],
                outputRange: [0, 1],
                extrapolate: 'clamp',
              }),
            },
          ]}>
          <View style={styles.icon}>
            <Icon name="symbolEdit" size={26} color="#226fb8" />
          </View>
        </Animated.View>
      ) : null}
      <Animated.View
        style={{transform: [{translateX: x}, {translateY: y}]}}
        {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...(StyleSheet.absoluteFill as object),
    justifyContent: 'center',
  },
  bin: {
    backgroundColor: '#fde4e1',
    alignItems: 'flex-end',
  },
  edit: {
    backgroundColor: '#dce9fb',
    alignItems: 'flex-start',
  },
  icon: {
    width: REVEAL,
    alignItems: 'center',
  },
});
